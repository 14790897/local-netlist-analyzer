/**
 * v1.0.22 — based on jifengshandian/easyeda-ai-assistant gold standard
 * Uses ESYS_NetlistType.PROTEL2 + 4 parser strategies
 */
export function activate(status?: 'onStartupFinished', arg?: string): void {}

function showDialog(msg: string) {
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (_) {}
}

/**
 * Parse netlist with 4 strategies (from easyeda-ai-assistant):
 * 1. JLCEDA_PRO (NET: format)
 * 2. PROTEL NETLIST 2.0
 * 3. Protel2 Standard
 * 4. Generic Designator-Pin regex
 */
function parseNetlist(netlistRaw: string): { nets: Record<string, string[]>; comps: Set<string> } {
    var nets: Record<string, string[]> = {};
    var comps = new Set<string>();
    if (!netlistRaw) return { nets: nets, comps: comps };

    var lines = netlistRaw.split('\n');

    // Strategy 1: JLCEDA_PRO — "NET: netname" + indented "Des-Pin"
    if (netlistRaw.indexOf('NET:') >= 0) {
        var currentNet = '';
        for (var li = 0; li < lines.length; li++) {
            var t = lines[li].trim();
            if (t.startsWith('NET:')) {
                currentNet = t.substring(4).trim();
                if (!nets[currentNet]) nets[currentNet] = [];
            } else if (currentNet && t.indexOf('-') > 0) {
                nets[currentNet].push(t);
                comps.add(t.substring(0, t.indexOf('-')));
            }
        }
    }

    // Strategy 2: PROTEL NETLIST 2.0
    if (comps.size === 0 && netlistRaw.indexOf('PROTEL NETLIST 2.0') >= 0) {
        var inNet = false, currentN = '', justParen = false;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i].trim();
            if (l === '(') { inNet = true; justParen = true; currentN = ''; continue; }
            if (l === ')') { inNet = false; currentN = ''; continue; }
            if (l === '[' || l === ']') { inNet = false; continue; }
            if (inNet) {
                if (justParen) { currentN = l; justParen = false; continue; }
                if (currentN && l.indexOf('-') > 0) {
                    var dash = l.indexOf('-');
                    var d = l.substring(0, dash), p = l.substring(dash + 1);
                    var sp = p.indexOf(' '); if (sp > 0) p = p.substring(0, sp);
                    if (!nets[currentN]) nets[currentN] = [];
                    nets[currentN].push(d + '-' + p);
                    comps.add(d);
                }
            }
        }
    }

    // Strategy 3: Protel2 Standard (Net List section)
    if (comps.size === 0 && (netlistRaw.indexOf('Net List') >= 0 || netlistRaw.indexOf('Component List') >= 0)) {
        var inNL = false, cn = '';
        for (var j = 0; j < lines.length; j++) {
            var tl = lines[j].trim();
            if (tl.indexOf('Net List') >= 0) { inNL = true; continue; }
            if (tl.indexOf('Component List') >= 0) { inNL = false; continue; }
            if (!inNL) continue;
            var m = tl.match(/^\(\s*([^\s)]+)\s*$/);
            if (m && !tl.endsWith(')')) { cn = m[1]; continue; }
            if (cn) {
                var pm = tl.match(/^([A-Z][A-Z0-9]*\d)-(\S+)\s*$/);
                if (pm) {
                    if (!nets[cn]) nets[cn] = [];
                    nets[cn].push(pm[1] + '-' + pm[2]);
                    comps.add(pm[1]);
                    continue;
                }
            }
            if (tl === ')') cn = '';
        }
    }

    // Strategy 4: Generic regex — catch ALL Ref-Pin patterns
    if (comps.size === 0) {
        var REFPIN = /([A-Za-z]+\d+)-(\d+)/g;
        var hits: {des: string; pin: string; line: number}[] = [];
        for (var k = 0; k < lines.length; k++) {
            REFPIN.lastIndex = 0; var rm;
            while ((rm = REFPIN.exec(lines[k])) !== null) {
                hits.push({des: rm[1], pin: rm[2], line: k});
                comps.add(rm[1]);
            }
        }
        if (hits.length > 0) {
            var cn2 = '_NET1', lastLine = -2;
            for (var h = 0; h < hits.length; h++) {
                if (hits[h].line - lastLine > 1) cn2 = '_NET' + (Object.keys(nets).length + 1);
                if (!nets[cn2]) nets[cn2] = [];
                nets[cn2].push(hits[h].des + '-' + hits[h].pin);
                lastLine = hits[h].line;
            }
        }
    }
    return { nets: nets, comps: comps };
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

        // Use PROTEL2 format (gold standard from easyeda-ai-assistant)
        var nl: string = '';
        try { nl = await eda.sch_Netlist.getNetlist((eda as any).ESYS_NetlistType?.PROTEL2 || 'PROTEL2'); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}

        var result = parseNetlist(nl);
        showDialog(ids.length + '选中 ' + result.comps.size + '元件 ' + Object.keys(result.nets).length + '网络');
    } catch (e) {
        showDialog('分析出错');
    }
}
