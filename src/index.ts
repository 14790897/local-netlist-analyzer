/**
 * v1.0.25 — FIX: getNetlist may return OBJECT (desktop EDA) or STRING (web)
 * Based on jlcmcp bridge: typeof netlist === 'string' ? netlist : JSON.stringify(netlist)
 */
export function activate(status?: 'onStartupFinished', arg?: string): void {}

function showDialog(msg: string) {
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (_) {}
}

async function getNetlistText(): Promise<string> {
    // Try getNetlist - may return string or object
    var formats = ['JLCEDA', 'EasyEDA', 'Protel2', undefined];
    for (var fi = 0; fi < formats.length; fi++) {
        try {
            var raw = formats[fi]
                ? await eda.sch_Netlist.getNetlist(formats[fi] as any)
                : await eda.sch_Netlist.getNetlist();
            if (raw) {
                // KEY FIX: desktop EDA returns object, web returns string
                return typeof raw === 'string' ? raw : JSON.stringify(raw);
            }
        } catch (_) {}
    }
    return '';
}

function parseNetlist(raw: string): { nets: Record<string, string[]>; comps: Set<string> } {
    var nets: Record<string, string[]> = {};
    var comps = new Set<string>();
    if (!raw) return { nets, comps };

    var lines = raw.split('\n');

    // S1: NET: format
    if (raw.indexOf('NET:') >= 0) {
        var cn = '';
        for (var i = 0; i < lines.length; i++) {
            var t = lines[i].trim();
            if (t.startsWith('NET:')) { cn = t.substring(4).trim(); if (!nets[cn]) nets[cn] = []; }
            else if (cn && t.indexOf('-') > 0) { nets[cn].push(t); comps.add(t.substring(0, t.indexOf('-'))); }
        }
    }

    // S2: PROTEL NETLIST 2.0
    if (comps.size === 0 && raw.indexOf('PROTEL NETLIST 2.0') >= 0) {
        var inNet = false, justP = false, cnet = '';
        for (var j = 0; j < lines.length; j++) {
            var l = lines[j].trim();
            if (l === '(') { inNet = true; justP = true; continue; }
            if (l === ')') { inNet = false; continue; }
            if (l === '[' || l === ']') { inNet = false; continue; }
            if (inNet) {
                if (justP) { cnet = l; justP = false; continue; }
                if (cnet && l.indexOf('-') > 0) {
                    var d2 = l.indexOf('-'), des2 = l.substring(0, d2), pin2 = l.substring(d2 + 1).split(' ')[0];
                    if (!nets[cnet]) nets[cnet] = [];
                    nets[cnet].push(des2 + '-' + pin2);
                    comps.add(des2);
                }
            }
        }
    }

    // S3: Try JSON parse (desktop EDA returns .enet JSON object)
    if (comps.size === 0) {
        try {
            var obj = JSON.parse(raw);
            if (typeof obj === 'object' && !Array.isArray(obj)) {
                var keys = Object.keys(obj);
                for (var k = 0; k < keys.length; k++) {
                    var c = obj[keys[k]];
                    if (!c || typeof c !== 'object') continue;
                    var desig = (c.props && c.props.Designator) || keys[k];
                    comps.add(desig);
                    var pins = c.pins || {};
                    var pnKeys = Object.keys(pins);
                    for (var pk = 0; pk < pnKeys.length; pk++) {
                        var netName = pins[pnKeys[pk]];
                        if (!netName) continue;
                        if (!nets[netName]) nets[netName] = [];
                        nets[netName].push(desig + '-' + pnKeys[pk]);
                    }
                }
            }
        } catch (_) {}
    }

    // S4: Generic Ref-Pin regex
    if (comps.size === 0) {
        var REFPIN = /([A-Za-z]+\d+)-(\d+)/g;
        var hits: {des: string; pin: string; line: number}[] = [];
        for (var hk = 0; hk < lines.length; hk++) {
            REFPIN.lastIndex = 0; var m;
            while ((m = REFPIN.exec(lines[hk])) !== null) {
                hits.push({des: m[1], pin: m[2], line: hk});
                comps.add(m[1]);
            }
        }
        if (hits.length > 0) {
            var cn2 = '_NET1', ll = -2;
            for (var h = 0; h < hits.length; h++) {
                if (hits[h].line - ll > 1) cn2 = '_NET' + (Object.keys(nets).length + 1);
                if (!nets[cn2]) nets[cn2] = [];
                nets[cn2].push(hits[h].des + '-' + hits[h].pin);
                ll = hits[h].line;
            }
        }
    }
    return { nets, comps };
}

export async function analyzeSelection(): Promise<void> {
    try {
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}

        if (!ids || !ids.length) { showDialog('请先在原理图中框选需要分析的元件'); return; }

        var nl = await getNetlistText();
        try { (globalThis as any).__nl_raw = nl; } catch (_) {}

        var result = parseNetlist(nl);
        if (result.comps.size > 0) {
            showDialog(ids.length + '选中 ' + result.comps.size + '元件 ' + Object.keys(result.nets).length + '网络');
        } else {
            var preview = nl ? nl.substring(0, 200).replace(/\n/g, '\\n') : 'EMPTY';
            showDialog(ids.length + '选中 0元件 RAW:' + preview);
        }
    } catch (e) {
        showDialog('分析出错: ' + (e && (e as any).message || String(e)));
    }
}
