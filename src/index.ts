/**
 * v1.0.28 — Exact JSON parser for JLCEDA netlist format v2.0.0
 * Format: {version,components:{"gge1":{props:{Designator:"U1"},pinInfoMap:{"1":{net:"VCC"}}}}}
 */
export function activate(_status?: 'onStartupFinished', _arg?: string): void {}

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
        // Step 1: Get selected component designators via structured API
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

        // Fallback: count via ID
        var ids: string[] = [];
        try { ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}

        if (!ids || !ids.length) {
            showDialog('请先在原理图中框选需要分析的元件');
            return;
        }

        // Step 2: Parse netlist, filter to selected components
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

                    // Only process if selected (or if no structured desigs available, take all)
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

        // Step 3: Show dialog + offer CSV export
        var neta = Object.keys(nets);
        var summary = ids.length + '选中 ' + comps.size + '元件 ' + neta.length + '网络';

        // Build CSV and offer download
        var csv = 'Net,Designator,Pin\n';
        var shown: string[] = [];
        for (var ni = 0; ni < neta.length; ni++) {
            var entries = nets[neta[ni]];
            for (var ei = 0; ei < entries.length; ei++) {
                var parts = entries[ei].split('-');
                csv += '"' + neta[ni] + '","' + parts[0] + '","' + (parts[1] || '') + '"\n';
                if (shown.length < 5) shown.push(neta[ni] + ':' + entries[ei]);
            }
        }

        // Save CSV
        try {
            var blob = new Blob([csv], { type: 'text/csv' });
            await eda.sys_FileSystem.saveFile(blob, 'local-netlist.csv');
        } catch (_) {}

        // Show compact summary
        var detail = shown.length > 0 ? ' | ' + shown.join(' ') : '';
        showDialog(summary + detail);

        // Also save raw netlist
        if (nl) {
            try {
                var rawBlob = new Blob([nl], { type: 'application/json' });
                await eda.sys_FileSystem.saveFile(rawBlob, 'netlist-raw.json');
            } catch(_2) {}
        }
    } catch (e) {
        showDialog('分析出错: ' + (e && (e as any).message || String(e)));
    }
}
