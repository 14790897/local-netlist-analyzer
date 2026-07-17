/**
 * v1.0.28 — Exact JSON parser for JLCEDA netlist format v2.0.0
 * Format: {version,components:{"gge1":{props:{Designator:"U1"},pinInfoMap:{"1":{net:"VCC"}}}}}
 */
export { openSettings, openAIChat } from './ai';
export { startBridge, stopBridge } from './ws-bridge';
export function activate(_status?: 'onStartupFinished', _arg?: string): void {
    try { installV32Shim(); } catch (_) {}
    try { startBridge(); } catch (_) {}
}

// JLCEDA V3.2.148 moved the extension API from `window.eda` to
// `window._EXTAPI_ROOT_`, and changed primitive shape from getter-based
// (getState_Designator, getState_Net, …) to plain property access
// (designator, net, primitiveType, …). Older v3.0/3.1 extensions
// expecting `eda.*` and `p.getState_*` will silently fail in V3.2.
//
// This shim re-aliases `eda` to `_EXTAPI_ROOT_` and wraps each
// primitive so the legacy getter API still works. We keep the shim
// idempotent and silent if either side is missing, so v3.0 still runs.
function installV32Shim(): void {
    try {
        var g: any = (typeof globalThis !== 'undefined' ? globalThis : window) as any;
        var root: any = g._EXTAPI_ROOT_;
        if (!root || g.__edaShimInstalled) return;
        if (typeof g.eda !== 'undefined' && g.eda && g.eda !== root) {
            // V3.0 path already active — nothing to shim
            g.__edaShimInstalled = true;
            return;
        }
        g.eda = root;
        g.__edaShimInstalled = true;

        // Wrap primitive arrays so legacy .getState_* getters return the
        // matching plain field. We only patch the methods our code uses.
        var proto: any = {
            getState_PrimitiveType: function () { return this.primitiveType; },
            getState_Designator:    function () { return this.designator; },
            getState_Net:           function () { return this.net; },
            getState_OwnerComponentDesignator: function () { return this.ownerComponentDesignator; },
            getState_PinNumber:     function () { return this.number; },
            getState_PrimitiveId:   function () { return this.primitiveId || this.id; },
        };
        var shimPrimitives = function (list: any): any {
            if (!list || !Array.isArray(list)) return list;
            for (var i = 0; i < list.length; i++) {
                var p = list[i];
                if (p && !p.__shimmed && typeof p === 'object') {
                    for (var k in proto) {
                        if (typeof p[k] === 'undefined' && typeof proto[k] === 'function') {
                            try { p[k] = proto[k]; } catch (_) {}
                        }
                    }
                    p.__shimmed = true;
                }
            }
            return list;
        };
        // Hook the two selection methods that return primitives
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

        // Save files
        try { await eda.sys_FileSystem.saveFile(new Blob([r.csv], { type: 'text/csv' }), 'local-netlist.csv'); } catch (_) {}
        if (r.nl) { try { await eda.sys_FileSystem.saveFile(new Blob([r.nl], { type: 'application/json' }), 'netlist-raw.json'); } catch (_2) {} }

        // Store for IFrame
        storeResult(r);

        // Show summary
        var detail: string[] = [];
        for (var dn = 0; dn < Math.min(6, r.neta.length); dn++) {
            detail.push(r.neta[dn] + '(' + r.nets[r.neta[dn]].length + 'pin)');
        }
        showDialog(r.summary + (detail.length > 0 ? ' | ' + detail.join(' ') : ''));
    } catch (e) {
        showDialog('分析出错: ' + (e && (e as any).message || String(e)));
    }
}

/** Unified AI analysis — extract netlist then directly open AI chat with a preset prompt */
export async function aiAnalyzeSelection(): Promise<void> {
    try {
        var r = await doAnalyze();
        if (!r.ok) { showDialog(r.error || '请先在原理图中框选需要分析的元件'); return; }

        // Save files silently
        try { await eda.sys_FileSystem.saveFile(new Blob([r.csv], { type: 'text/csv' }), 'local-netlist.csv'); } catch (_) {}
        if (r.nl) { try { await eda.sys_FileSystem.saveFile(new Blob([r.nl], { type: 'application/json' }), 'netlist-raw.json'); } catch (_2) {} }

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
                    // 6 = COMPONENT in JLCEDA sch
                    if (pt === 'COMPONENT' || pt === 6) {
                        var d = p.getState_Designator && p.getState_Designator();
                        if (d) selectedDesignators.add(d);
                    } else if (pt === 'PIN' || pt === 5) {
                        // Pin: read its owning component and pin number to find the net
                        var owner = p.getState_OwnerComponentDesignator && p.getState_OwnerComponentDesignator();
                        var pinNum = p.getState_PinNumber && p.getState_PinNumber();
                        var pinNet = p.getState_Net && p.getState_Net();
                        if (owner && pinNum) {
                            if (!selectedPinsByComp[owner]) selectedPinsByComp[owner] = new Set();
                            selectedPinsByComp[owner].add(String(pinNum));
                        }
                        if (pinNet) selectedNets.add(pinNet);
                    } else if (pt === 'WIRE' || pt === 7) {
                        var wn = p.getState_Net && p.getState_Net();
                        if (wn) selectedNets.add(wn);
                    }
                } catch (_) {}
            }
        }
    } catch (_) {}

    var ids: string[] = [];
    try { ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
    if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}

    if (!ids || !ids.length) {
        empty.error = '请先在原理图中框选需要分析的元件';
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
