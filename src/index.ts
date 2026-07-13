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

        // Raw dump for debugging
        try { (globalThis as any).__nl_raw = nl; } catch (_) {}
        console.log('[NL] raw type=' + typeof nl + ' len=' + (typeof nl === 'string' ? nl.length : 'obj'));

        var nets: Record<string, string[]> = {};
        var comps = new Set<string>();
        var matched = false;

        // --- PARSER: scan all Ref-Pin patterns, then group by net boundaries ---
        // A Ref-Pin looks like: U1-8, C1-1, R2-3, J1-5, FPC1-2, etc.
        // Pattern: letters+digits then - then digits (allow multi-char refdes like FPC1)
        var REFPIN = /([A-Za-z]+\d+)-(\d+)/g;

        if (typeof nl === 'string' && nl.length > 40) {
            // First, check for explicit NET: keyword format
            var lines = nl.split('\n');
            for (var li = 0; li < lines.length; li++) {
                var t = lines[li].trim();
                if (t.startsWith('NET:')) {
                    var netName = t.substring(4).trim();
                    if (!nets[netName]) nets[netName] = [];
                    for (var nj = li + 1; nj < lines.length; nj++) {
                        var sub = lines[nj].trim();
                        if (sub.startsWith('NET:') || sub === '') break;
                        if (sub.indexOf('-') > 0) {
                            nets[netName].push(sub);
                            comps.add(sub.substring(0, sub.indexOf('-')));
                        }
                    }
                    matched = true;
                }
            }

            // If NET: format didn't match, fall back to (netname ...) format
            if (!matched) {
                for (var li2 = 0; li2 < lines.length; li2++) {
                    var t2 = lines[li2].trim();
                    if (t2 === '(' || t2.startsWith('(')) {
                        var nn = t2 === '(' ? (li2 + 1 < lines.length ? lines[li2 + 1].trim() : '') : t2.substring(1).trim();
                        if (!nets[nn]) nets[nn] = [];
                        for (var pk = li2 + 1; pk < lines.length; pk++) {
                            var s = lines[pk].trim();
                            if (s === ')' || s.startsWith('(')) break;
                            if (s.indexOf('-') > 0) {
                                nets[nn].push(s);
                                comps.add(s.substring(0, s.indexOf('-')));
                            }
                        }
                        matched = true;
                    }
                }
            }

            // Ultimate fallback: scan ALL Ref-Pin patterns in entire string
            // Group consecutive hits under numbered nets if no explicit net names found
            if (!matched) {
                var allHits: {des: string; pin: string; line: number}[] = [];
                var rawLines = nl.split('\n');
                for (var lk = 0; lk < rawLines.length; lk++) {
                    var line = rawLines[lk];
                    REFPIN.lastIndex = 0;
                    var m;
                    while ((m = REFPIN.exec(line)) !== null) {
                        allHits.push({des: m[1], pin: m[2], line: lk});
                        comps.add(m[1]);
                    }
                }
                if (allHits.length > 0) {
                    var currentNet = '_NET1';
                    var lastLine = -2;
                    for (var hi = 0; hi < allHits.length; hi++) {
                        // New net when line gap > 1 or different line
                        if (allHits[hi].line - lastLine > 1) {
                            currentNet = '_NET' + (Object.keys(nets).length + 1);
                        }
                        if (!nets[currentNet]) nets[currentNet] = [];
                        nets[currentNet].push(allHits[hi].des + '-' + allHits[hi].pin);
                        lastLine = allHits[hi].line;
                    }
                    matched = true;
                }
            }

            console.log('[NL] parsed ' + comps.size + 'c ' + Object.keys(nets).length + 'n fmt=' + (matched ? 'ok' : 'FAIL'));
        }

        // Object format (e.g. from newer API versions)
        if (!matched && nl && typeof nl === 'object') {
            Object.keys(nl).forEach(function (des) {
                var c = nl[des];
                if (!c || typeof c !== 'object') return;
                var desig = (c.props && c.props.Designator) || des;
                comps.add(desig);
                var pins = c.pins || {};
                Object.keys(pins).forEach(function (pn) {
                    var netName = pins[pn];
                    if (!netName) return;
                    if (!nets[netName]) nets[netName] = [];
                    nets[netName].push(desig + '-' + pn);
                });
            });
            matched = true;
            console.log('[NL] parsed ' + comps.size + 'c ' + Object.keys(nets).length + 'n from obj');
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
