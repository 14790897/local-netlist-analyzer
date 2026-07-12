/**
 * v1.0.17 — JLCEDA NET: format parser (the real format)
 */
function popup(msg: string) {
    console.log('[NL] ' + msg);
    try { (eda.sys_ToastMessage as any).showToastMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
}

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        console.log('[NL] start');
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        console.log('[NL] ids=' + (ids ? ids.length : 0));

        if (!ids || !ids.length) {
            popup('请先在原理图中框选需要分析的元件');
            return;
        }

        console.log('[NL] getNetlist JLCEDA...');
        var nl: any = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) { console.log('[NL] err: ' + e); }
        if (!nl || (typeof nl === 'string' && !nl.trim())) {
            console.log('[NL] JLCEDA empty, trying EasyEDA...');
            try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) { console.log('[NL] err2: ' + e); }
        }

        var nets: Record<string, string[]> = {};
        var comps = new Set<string>();
        var matched = false;

        if (typeof nl === 'string' && nl.length > 0) {
            var lines = nl.split('\n');

            // Format: JLCEDA_PRO — "NET: netname" followed by "  Des-Pin"
            for (var li = 0; li < lines.length; li++) {
                var t = lines[li].trim();
                if (t.startsWith('NET:')) {
                    var netName = t.substring(4).trim();
                    if (!nets[netName]) nets[netName] = [];
                    // Collect all ref-pin on subsequent lines until next NET: or empty
                    for (var nj = li + 1; nj < lines.length; nj++) {
                        var sub = lines[nj].trim();
                        if (sub.startsWith('NET:') || sub === '') break;
                        var dash = sub.indexOf('-');
                        if (dash > 0) {
                            var des = sub.substring(0, dash);
                            nets[netName].push(sub);
                            comps.add(des);
                        }
                    }
                    matched = true;
                } else if (t === '(' || t.startsWith('(')) {
                    // Format: PROTEL2 — "(netname" ... "Des-Pin" ... ")"
                    var nn = t === '(' ? lines[li] : t.substring(1).trim();
                    // Actually PROTEL2 format: first line after ( is netname
                    if (t === '(') {
                        var nextLine = li + 1 < lines.length ? lines[li + 1].trim() : '';
                        nn = nextLine;
                    }
                    if (!nets[nn]) nets[nn] = [];
                    for (var pk = li + 1; pk < lines.length; pk++) {
                        var s = lines[pk].trim();
                        if (s === ')' || s.startsWith('(')) break;
                        var d = s.indexOf('-');
                        if (d > 0) {
                            nets[nn].push(s);
                            comps.add(s.substring(0, d));
                        }
                    }
                    matched = true;
                } else if (t.startsWith('{') || t.startsWith('PROTEL') || t.startsWith('*')) {
                    continue; // header lines, skip
                }
            }

            console.log('[NL] parsed ' + comps.size + 'c ' + Object.keys(nets).length + 'n from text');
        }

        var msg = ids.length + '选中 ' + comps.size + '元件 ' + Object.keys(nets).length + '网络';
        var text = msg + '\n\n= 元件 =\n';
        var ca: string[] = []; comps.forEach(function(d) { ca.push(d); });
        ca.sort().forEach(function(d) { text += d + '\n'; });
        text += '\n= 网络 =\n';
        var na = Object.keys(nets); na.sort();
        na.forEach(function(n) { text += n + ': ' + (nets[n] || []).join(' ') + '\n'; });

        try { await (eda.sys_FileSystem as any).saveFile({
            fileName: '局部网表_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.txt',
            content: text
        }); } catch (_) {}

        // Store for IFrame / browser test verification
        try { sessionStorage.setItem('__netlist_result', JSON.stringify({
            selectedCount: ids.length, components: comps.size, nets: Object.keys(nets).length,
            componentList: ca, netList: nets, netlistText: text
        })); } catch (_) {}

        popup(msg);
    } catch (e) {
        popup('分析出错: ' + (e && (e as any).message || String(e)));
    }
}
