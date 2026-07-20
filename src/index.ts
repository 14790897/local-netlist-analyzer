/**
 * v1.0.28 — Exact JSON parser for JLCEDA netlist format v2.0.0
 * Format: {version,components:{"gge1":{props:{Designator:"U1"},pinInfoMap:{"1":{net:"VCC"}}}}}
 */
export { openSettings, openAIChat } from './ai';
export { startBridge, stopBridge } from './ws-bridge';
export function activate(_status?: 'onStartupFinished', _arg?: string): void {
    // V3.0/3.1: window.eda already has sch_SelectControl etc.
    // V3.2 sandbox: eda is already the V3.0-compatible shim, also works.
    // V3.2 main page (when our bundle accidentally lands there):
    //   re-alias eda to _EXTAPI_ROOT_ and patch getState_* getters on
    //   primitives so the rest of the code (which uses p.getState_*())
    //   works as-is.
    try { installV32Shim(); } catch (_) {}
    try { startBridge(); } catch (_) {}
}

// JLCEDA V3.2.148 split the extension API across two places:
//   - extension sandbox: `self.eda` already has the V3.0-compatible shape
//     (sch_SelectControl with getState_* getters on each primitive), so
//     legacy code "just works" inside the sandbox.
//   - main page:        `eda` no longer exists. The new root is
//     `window._EXTAPI_ROOT_`, and primitive objects expose their fields
//     as plain properties (primitiveType, designator, net, …) without
//     the legacy getState_* getters.
//
// Most of our code (doAnalyze, aiAnalyzeSelection, etc.) calls
// `p.getState_PrimitiveType()`, `p.getState_Designator()` etc., which is
// fine inside the V3.2 sandbox but returns `undefined` on the V3.2 main
// page. This shim aliases `eda` → `_EXTAPI_ROOT_` and wraps each
// primitive returned by the four selection methods so the legacy getters
// forward to the matching plain field.
//
// Safe on V3.0/3.1: if window.eda is already a real V3.0 API, the shim
// is a no-op (it only runs when eda is missing and _EXTAPI_ROOT_ is
// present).
function installV32Shim(): void {
    try {
        var g: any = (typeof globalThis !== 'undefined' ? globalThis : window) as any;
        var root: any = g._EXTAPI_ROOT_;

        // Case 1: eda already populated (V3.0/3.1 sandbox).
        if (g.eda && g.eda !== root && g.eda.sch_SelectControl) return;

        // Case 2: V3.2 sandbox or V3.2 main page — try to bind to whatever
        // root we can find. Prefer the extension-sandbox eda (it already
        // has the legacy getters); fall back to _EXTAPI_ROOT_ (main page).
        if (g.eda && g.eda.sch_SelectControl) {
            g.__edaShimInstalled = true;
            return;
        }
        if (!root) return;

        // For V3.2 main page, alias eda to _EXTAPI_ROOT_ and patch the
        // four primitive-returning methods so the legacy getState_*
        // getters exist on every primitive they return.
        g.eda = root;
        g.__edaShimInstalled = true;

        var getters: Record<string, (p: any) => any> = {
            getState_PrimitiveType: function (p) { return p.primitiveType; },
            getState_Designator:    function (p) { return p.designator; },
            getState_Net:           function (p) { return p.net; },
            getState_OwnerComponentDesignator: function (p) { return p.ownerComponentDesignator; },
            getState_PinNumber:     function (p) { return p.number; },
            getState_PrimitiveId:   function (p) { return p.primitiveId || p.id; },
        };
        var shimPrimitives = function (list: any): any {
            if (!list || !Array.isArray(list)) return list;
            for (var i = 0; i < list.length; i++) {
                var p = list[i];
                if (!p || typeof p !== 'object' || p.__edaShimPatched) continue;
                for (var k in getters) {
                    if (typeof p[k] === 'undefined') {
                        try { p[k] = getters[k](p); } catch (_) {}
                    }
                }
                p.__edaShimPatched = true;
            }
            return list;
        };
        if (root.sch_SelectControl) {
            var sc = root.sch_SelectControl;
            for (var m of ['getAllSelectedPrimitives', 'getSelectedPrimitives', 'getPrimitivesByPrimitiveId', 'getPrimitiveByPrimitiveId']) {
                var orig = sc[m];
                if (typeof orig === 'function' && !sc['__' + m]) {
                    sc['__' + m] = orig;
                    sc[m] = function () {
                        var args = arguments;
                        var p = orig.apply(sc, args);
                        return shimPrimitives(p);
                    };
                }
            }
        }
    } catch (_) {}
}

function showDialog(msg: string) {
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
}

/**
 * ESYS_NetlistType values per prodocs.lceda.cn:
 * JLCEDA_PRO="JLCEDA", ALTIUM_DESIGNER="Protel2", EASYEDA_PRO="EasyEDA"
 */
async function getNetlistText(): Promise<string> {
    var types: any[] = ['JLCEDA', 'Protel2', 'EasyEDA', undefined];
    for (var i = 0; i < types.length; i++) {
        try {
            var file: any = types[i] !== undefined
                ? await eda.sch_ManufactureData.getNetlistFile('netlist', types[i])
                : await eda.sch_ManufactureData.getNetlistFile();
            if (!file) continue;
            var text = '';
            if (typeof file.text === 'function') text = await file.text();
            else if (typeof file.arrayBuffer === 'function') text = new TextDecoder().decode(await file.arrayBuffer());
            else if (typeof file === 'string') text = file;
            if (text) return text;
        } catch (_) {}
    }
    return '';
}

/** Parse JLCEDA v2.0.0 netlist JSON format */
function parseV2Netlist(raw: string): { nets: Record<string, string[]>; comps: Set<string> } {
    var nets: Record<string, string[]> = {};
    var comps = new Set<string>();
    try {
        var obj = JSON.parse(raw);
        var components = obj.components || obj;
        if (!components || typeof components !== 'object') return { nets, comps };

        var keys = Object.keys(components);
        for (var i = 0; i < keys.length; i++) {
            var c = components[keys[i]];
            if (!c || typeof c !== 'object') continue;

        // Get designator — filter out anything that doesn't look like a real refdes
        // (e.g. pastes, queries, notes). Must match strict Aa1+ pattern, <= 10 chars.
        var desig = (c.props && c.props.Designator) || c.designator || c.Designator || keys[i];
        if (!desig || desig.length > 10 || !/^[A-Za-z][A-Za-z0-9_]*\d+$/.test(desig)) continue;
        comps.add(desig);

            // Parse pinInfoMap for net connections
            var pim = c.pinInfoMap || c.pins || c.pinMap || {};
            if (!pim || typeof pim !== 'object') continue;

            var pnKeys = Object.keys(pim);
            for (var j = 0; j < pnKeys.length; j++) {
                var pin = pim[pnKeys[j]];
                if (!pin || typeof pin !== 'object') continue;
                var net = pin.net || '';
                var num = pin.number || pnKeys[j];
                if (net && num) {
                    if (!nets[net]) nets[net] = [];
                    nets[net].push(desig + '-' + num);
                }
            }
        }
    } catch (_) {}
    return { nets, comps };
}

export async function analyzeSelection(): Promise<void> {
    try {
        var r = await doAnalyze();
        if (!r.ok) { showDialog(r.error || '请先在原理图中框选需要分析的元件'); return; }

        // Save files only if user enabled it in settings
        if (loadFileConfig().saveToDisk) {
            try { await eda.sys_FileSystem.saveFile(new Blob([r.csv], { type: 'text/csv' }), 'local-netlist.csv'); } catch (_) {}
            if (r.nl) { try { await eda.sys_FileSystem.saveFile(new Blob([r.nl], { type: 'application/json' }), 'netlist-raw.json'); } catch (_2) {} }
        }

        // Store for IFrame
        storeResult(r);

        // Show summary
        var detail: string[] = [];
        for (var dn = 0; dn < Math.min(6, r.neta.length); dn++) {
            detail.push(r.neta[dn] + '(' + r.nets[r.neta[dn]].length + 'pin)');
        }
        // Use 「·」 middle dot instead of ASCII '|' — pipe character renders as 「中」 in
        // some Chinese monospace fonts used by JLCEDA dialogs, causing user confusion.
        showDialog(r.summary + (detail.length > 0 ? '  ·  ' + detail.join(' · ') : ''));
    } catch (e) {
        showDialog('分析出错: ' + (e && (e as any).message || String(e)));
    }
}

/** Unified AI analysis — extract netlist then directly open AI chat with a preset prompt */
export async function aiAnalyzeSelection(): Promise<void> {
    try {
        var r = await doAnalyze();
        if (!r.ok) { showDialog(r.error || '请先在原理图中框选需要分析的元件'); return; }

        // Save files only if user enabled it in settings
        if (loadFileConfig().saveToDisk) {
            try { await eda.sys_FileSystem.saveFile(new Blob([r.csv], { type: 'text/csv' }), 'local-netlist.csv'); } catch (_) {}
            if (r.nl) { try { await eda.sys_FileSystem.saveFile(new Blob([r.nl], { type: 'application/json' }), 'netlist-raw.json'); } catch (_2) {} }
        }

        // Store for chat IFrame
        storeResult(r);

        // Check API config
        var cfg = loadAIConfig();

        if (!cfg.key) {
            showDialog('请先配置 AI API Key（将在设置面板中打开）');
            try { eda.sys_IFrame.openIFrame('/iframe/settings.html', 520, 480, 'ai-settings', { title: 'AI 设置 — 请先配置 API Key' }); } catch (_) {}
            return;
        }

        // Build preset prompt — explain what the netlist is, then ask for a structured analysis.
        // The chat IFrame will pick this up via __ai_prefill and auto-send it.
        var nets = Object.keys(r.nets);
        var preset =
            '请基于以下原理图局部网表（已框选 ' + r.comps.size + ' 个元件、' + r.neta.length + ' 个网络），' +
            '用中文给出结构化分析。覆盖以下要点：\n' +
            '1) 这部分电路的主要功能（1-2 句话）\n' +
            '2) 涉及的电源轨（VCC/GND/特殊电压）\n' +
            '3) 关键信号路径（输入→处理→输出）\n' +
            '4) 元件分工：U 系列负责什么、R/C/Q/L/LED 各起什么作用\n' +
            '5) 任何值得注意的设计要点或潜在问题';
        try { eda.sys_Storage.setExtensionUserConfig('__ai_prefill', preset); } catch (_) {}

        // Open chat directly
        try {
            eda.sys_IFrame.openIFrame('/iframe/chat.html', 700, 560, 'ai-chat', {
                title: 'AI 分析: ' + r.comps.size + '元件 ' + r.neta.length + '网络',
                maximizeButton: true,
            });
        } catch (_) {
            showDialog(r.summary + ' — IFrame 打开失败，请手动点击 AI 对话');
        }
    } catch (e) {
        showDialog('分析出错: ' + (e && (e && (e as any).message || String(e))));
    }
}

// ====== Internal ======

interface AnalysisResult {
    ok: boolean;
    error?: string;
    ids: string[];
    nets: Record<string, string[]>;
    comps: Set<string>;
    neta: string[];
    nl: string;
    csv: string;
    summary: string;
}

async function doAnalyze(): Promise<AnalysisResult> {
    var empty: AnalysisResult = { ok: false, ids: [], nets: {}, comps: new Set(), neta: [], nl: '', csv: '', summary: '' };

    // Step 1: gather selected primitives and categorize by type.
    //   - selectedDesignators: components selected (we use these as "definitely include" anchors)
    //   - selectedNets: nets touched by selected pins/wires (used to filter the rest of the netlist)
    //   - selectedPins: per-component set of pin numbers we know are in the selection
    // The user may have selected only wires/pins (e.g. a few nets) without grabbing whole
    // components, so we must not require a non-empty selectedDesignators — that was the
    // previous bug where empty designators made us fall back to "include everything".
    var selectedDesignators = new Set<string>();
    var selectedNets = new Set<string>();
    var selectedPinsByComp: Record<string, Set<string>> = {};
    try {
        var primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        if (primitives) {
            for (var i = 0; i < primitives.length; i++) {
                var p = primitives[i];
                try {
                    var pt = p.getState_PrimitiveType && p.getState_PrimitiveType();
                    // V3.2 returns string enum: 'Component' / 'ComponentPin' / 'Wire' (see prodocs ENUM ESCH_PrimitiveType)
                    // Be permissive: accept old 'COMPONENT'/'PIN'/'WIRE' too for V3.0 backward compat.
                    if (pt === 'Component' || pt === 'COMPONENT' || pt === 6) {
                        var d = p.getState_Designator && p.getState_Designator();
                        if (d) selectedDesignators.add(d);
                    } else if (pt === 'ComponentPin' || pt === 'Pin' || pt === 'PIN' || pt === 5) {
                        // ComponentPin / Pin: V3.2 Pin class has no getState_OwnerComponentDesignator;
                        // we'll re-attribute to its owner via getAllPinsByPrimitiveId below.
                        var pinNum = p.getState_PinNumber && p.getState_PinNumber();
                        var pinNet = p.getState_Net && p.getState_Net();
                        if (pinNum) {
                            // Mark by primitiveId for later lookup
                            try {
                                var pid = p.getState_PrimitiveId && p.getState_PrimitiveId();
                                if (pid) selectedPinsByComp[pid] = new Set([String(pinNum)]);
                            } catch (_) {}
                        }
                        if (pinNet) selectedNets.add(pinNet);
                    } else if (pt === 'Wire' || pt === 'WIRE' || pt === 7) {
                        var wn = p.getState_Net && p.getState_Net();
                        if (wn) selectedNets.add(wn);
                    }
                } catch (_) {}
            }
        }
    } catch (e) {
        // V3.2 sandbox can throw if sch canvas isn't active. Log so the user sees a real reason
        // instead of the generic "请先在原理图中框选..." error.
        return Object.assign(empty, { error: '无法读取当前选中: ' + (e && (e as any).message || String(e)) + '。请先在原理图页打开并框选元件' });
    }

    // Re-attribute selected pins to their owning components (V3.2 has no getState_OwnerComponentDesignator)
    //   For each selected pin primitiveId, find which component lists it among getAllPinsByPrimitiveId
    try {
        var allComps = await eda.sch_PrimitiveComponent.getAll();
        if (allComps) {
            for (var ci = 0; ci < allComps.length; ci++) {
                var c = allComps[ci];
                try {
                    var d = c.getState_Designator && c.getState_Designator();
                    var cp = c.getState_PrimitiveId && c.getState_PrimitiveId();
                    if (!d || !cp) continue;
                    var pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(cp);
                    if (!pins) continue;
                    for (var pn = 0; pn < pins.length; pn++) {
                        var p = pins[pn];
                        try {
                            var ppid = p.getState_PrimitiveId && p.getState_PrimitiveId();
                            if (ppid && selectedPinsByComp[ppid]) {
                                if (!selectedPinsByComp[d]) selectedPinsByComp[d] = new Set();
                                selectedPinsByComp[d].add(p.getState_PinNumber && p.getState_PinNumber() || '');
                            }
                        } catch (_) {}
                    }
                } catch (_) {}
            }
        }
    } catch (_) {}

    var ids: string[] = [];
    try { ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
    if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}

    if (!ids || !ids.length) {
        // Distinguish "nothing selected" from "API not available in this environment"
        var apiAvail = false;
        try { apiAvail = typeof (eda as any).sch_SelectControl === 'object' && typeof (eda as any).sch_SelectControl.getAllSelectedPrimitives === 'function'; } catch (_) {}
        if (!apiAvail) {
            empty.error = '当前环境未提供 sch_SelectControl API。请在原理图页面打开,或刷新编辑器重试 (V3.2 沙箱需要 sch canvas 已激活)';
        } else {
            empty.error = '请先在原理图中框选需要分析的元件(选中数量=0)';
        }
        return empty;
    }

    // Decide which designators to keep. If the user selected any whole components,
    // keep those plus any components that have at least one selected pin
    // (because selecting a pin/wire typically means "I want this net").
    // If the user only selected wires (no component, no pin), fall back to
    // "include only components that touch a selected net".
    var includeDesigs = new Set<string>(selectedDesignators);
    var pinKeys = Object.keys(selectedPinsByComp);
    for (var pi = 0; pi < pinKeys.length; pi++) includeDesigs.add(pinKeys[pi]);

    var nets: Record<string, string[]> = {};
    var comps = new Set<string>();
    var nl = await getNetlistText();

    if (nl) {
        try {
            var obj = JSON.parse(nl);
            var components = obj.components || obj;
            var ckeys = Object.keys(components);
            for (var k = 0; k < ckeys.length; k++) {
                var c = components[ckeys[k]];
                if (!c || typeof c !== 'object') continue;
                var desig = (c.props && c.props.Designator) || '';
                // Filter non-refdes: pastes, notes, query strings etc.
                if (!desig || desig.length > 10 || !/^[A-Za-z][A-Za-z0-9_]*\d+$/.test(desig)) continue;

                // Two filtering modes:
                //   1) user selected at least one whole component or pin: restrict to those
                //   2) user only selected wires / nothing categorical: include components
                //      that participate in any selected net
                var includeThis = false;
                if (includeDesigs.size > 0) {
                    includeThis = includeDesigs.has(desig);
                } else if (selectedNets.size > 0) {
                    // will be set true below if any pin of this desig is in a selected net
                    includeThis = false;
                } else {
                    // Nothing usable was selected — refuse to dump the whole schematic
                    empty.error = '请先在原理图中框选需要分析的元件（或引脚/连线）';
                    return empty;
                }

                var pim = c.pinInfoMap || c.pins || c.pinMap || {};
                var pnKeys = Object.keys(pim);
                var compPins: string[] = [];
                for (var j = 0; j < pnKeys.length; j++) {
                    var pin = pim[pnKeys[j]];
                    if (!pin || typeof pin !== 'object') continue;
                    var pnet = pin.net || '';
                    var pnum = pin.number || pnKeys[j];
                    if (pnet && pnum) compPins.push(desig + '-' + pnum);
                    if (pnet && selectedNets.has(pnet) && includeDesigs.size === 0) {
                        // wire-only selection: include this component
                        includeThis = true;
                    }
                }
                if (!includeThis) continue;
                comps.add(desig);
                for (var cp = 0; cp < compPins.length; cp++) {
                    var entry = compPins[cp];
                    // Use the net from the raw netlist entry; fall back to '' if missing
                    var pinNet = '';
                    for (var jj = 0; jj < pnKeys.length; jj++) {
                        var pp = pim[pnKeys[jj]];
                        if (pp && (pp.number === entry.split('-')[1] || pnKeys[jj] === entry.split('-')[1])) {
                            pinNet = pp.net || '';
                            break;
                        }
                    }
                    if (pinNet) {
                        if (!nets[pinNet]) nets[pinNet] = [];
                        nets[pinNet].push(entry);
                    }
                }
            }
        } catch (_) {}
    }

    if (comps.size === 0) {
        empty.error = '所选区域未匹配到任何元件（请尝试框选稍大一些的区域，或确保选中了元件本身）';
        return empty;
    }

    var neta = Object.keys(nets).sort();
    var csv = 'Net,Designator,Pin\n';
    for (var ni = 0; ni < neta.length; ni++) {
        var ents = nets[neta[ni]];
        for (var ei = 0; ei < ents.length; ei++) csv += neta[ni] + ',' + ents[ei] + '\n';
    }

    return {
        ok: true,
        ids: ids,
        nets: nets,
        comps: comps,
        neta: neta,
        nl: nl,
        csv: csv,
        summary: ids.length + '选中 ' + comps.size + '元件 ' + neta.length + '网络'
    };
}

function storeResult(r: AnalysisResult): void {
    try {
        eda.sys_Storage.setExtensionUserConfig('__nl_data', JSON.stringify({
            nets: r.nets,
            comps: r.comps.size,
            netCount: r.neta.length
        }));
    } catch (_) {}
}

/** Read AI config — inline copy from ai.ts to avoid circular dep */
function loadAIConfig(): any {
    try {
        var raw = eda.sys_Storage.getExtensionUserConfig('__ai_config');
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { endpoint: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini' };
}

/** Read file-save config — controls whether analyzeSelection / aiAnalyzeSelection
 *  writes CSV + JSON to the project directory. Default true (legacy behavior).
 *  Settings UI lives in iframe/settings.html under the "文件保存设置" section. */
function loadFileConfig(): { saveToDisk: boolean } {
    try {
        var raw = eda.sys_Storage.getExtensionUserConfig('__file_config');
        if (raw) {
            var p = JSON.parse(raw);
            if (p && typeof p.saveToDisk === 'boolean') return { saveToDisk: p.saveToDisk };
        }
    } catch (_) {}
    return { saveToDisk: true };
}
