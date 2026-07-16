/**
 * v1.0.28 — Exact JSON parser for JLCEDA netlist format v2.0.0
 * Format: {version,components:{"gge1":{props:{Designator:"U1"},pinInfoMap:{"1":{net:"VCC"}}}}}
 */
export { openSettings, openAIChat } from './ai';
export { startBridge, stopBridge } from './ws-bridge';
export function activate(_status?: 'onStartupFinished', _arg?: string): void {
    try { startBridge(); } catch (_) {}
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

            // Get designator
            var desig = (c.props && c.props.Designator) || c.designator || c.Designator || keys[i];
            if (!desig || desig.length > 20 || !/^[A-Za-z]+\d+/.test(desig)) continue;
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

/** Unified AI analysis — extract netlist then directly open AI chat */
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
        showDialog('分析出错: ' + (e && (e as any).message || String(e)));
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

    var selectedDesigs = new Set<string>();
    try {
        var primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        if (primitives) {
            for (var i = 0; i < primitives.length; i++) {
                try {
                    var pt = primitives[i].getState_PrimitiveType && primitives[i].getState_PrimitiveType();
                    if (!pt || (pt !== 'COMPONENT' && pt !== 6)) continue;
                    var d = primitives[i].getState_Designator && primitives[i].getState_Designator();
                    if (d) selectedDesigs.add(d);
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
                if (selectedDesigs.size > 0 && !selectedDesigs.has(desig)) continue;
                if (!desig) continue;
                comps.add(desig);
                var pim = c.pinInfoMap || c.pins || c.pinMap || {};
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
