/**
 * v1.0.24 — getNetlistFile (new API) + getNetlist (deprecated fallback)
 * 4 parser strategies from easyeda-ai-assistant
 */
export function activate(status?: 'onStartupFinished', arg?: string): void {}

function showDialog(msg: string) {
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (_) {}
}

function parseNetlist(netlistRaw: string): { nets: Record<string, string[]>; comps: Set<string> } {
    var nets: Record<string, string[]> = {};
    var comps = new Set<string>();
    if (!netlistRaw) return { nets, comps };

    // S1: JLCEDA_PRO NET: format
    var lines = netlistRaw.split('\n');
    if (netlistRaw.indexOf('NET:') >= 0) {
        var cn = '';
        for (var i = 0; i < lines.length; i++) {
            var t = lines[i].trim();
            if (t.startsWith('NET:')) { cn = t.substring(4).trim(); if (!nets[cn]) nets[cn] = []; }
            else if (cn && t.indexOf('-') > 0) { nets[cn].push(t); comps.add(t.substring(0, t.indexOf('-'))); }
        }
    }

    // S2: PROTEL NETLIST 2.0
    if (comps.size === 0 && netlistRaw.indexOf('PROTEL NETLIST 2.0') >= 0) {
        var inNet = false, justP = false, cnet = '';
        for (var j = 0; j < lines.length; j++) {
            var l = lines[j].trim();
            if (l === '(') { inNet = true; justP = true; continue; }
            if (l === ')') { inNet = false; continue; }
            if (l === '[' || l === ']') { inNet = false; continue; }
            if (inNet) {
                if (justP) { cnet = l; justP = false; continue; }
                if (cnet && l.indexOf('-') > 0) {
                    var d = l.indexOf('-'), des = l.substring(0, d), pin = l.substring(d + 1).split(' ')[0];
                    if (!nets[cnet]) nets[cnet] = [];
                    nets[cnet].push(des + '-' + pin);
                    comps.add(des);
                }
            }
        }
    }

    // S3: Generic Ref-Pin regex
    if (comps.size === 0) {
        var REFPIN = /([A-Za-z]+\d+)-(\d+)/g;
        var hits: {des: string; pin: string; line: number}[] = [];
        for (var k = 0; k < lines.length; k++) {
            REFPIN.lastIndex = 0; var m;
            while ((m = REFPIN.exec(lines[k])) !== null) {
                hits.push({des: m[1], pin: m[2], line: k});
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

async function getNetlistText(): Promise<string> {
    // P1: New API - SCH_ManufactureData.getNetlistFile (replacement for deprecated getNetlist)
    try {
        var file = await (eda.sch_ManufactureData as any).getNetlistFile(undefined, 'JLCEDA');
        if (file) {
            // File object may have content or need to be read
            if (typeof file === 'string') return file;
            if (file.content) return file.content;
            if (file.data) return file.data;
            if (file.text) return await file.text();
            // Try toString
            var s = String(file);
            if (s.length > 40) return s;
        }
    } catch (_) {}

    // P2: Deprecated getNetlist with JLCEDA
    try { var nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); if (nl) return nl; } catch (_) {}

    // P3: EasyEDA format
    try { var nl2 = await eda.sch_Netlist.getNetlist('EasyEDA' as any); if (nl2) return nl2; } catch (_) {}

    // P4: PROTEL2 format
    try { var nl3 = await eda.sch_Netlist.getNetlist('Protel2' as any); if (nl3) return nl3; } catch (_) {}

    return '';
}

export async function analyzeSelection(): Promise<void> {
    try {
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}

        if (!ids || !ids.length) {
            showDialog('请先在原理图中框选需要分析的元件');
            return;
        }

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
