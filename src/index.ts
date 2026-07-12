/**
 * v1.0.16 — try all 4 netlist formats
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
        console.log('[NL] ids=' + (ids ? ids.length : 0) + ' (FULL EXPORT)');

        console.log('[NL] getNetlist...');
        var nl: any = '';
        try { nl = await Promise.race([
            eda.sch_Netlist.getNetlist('JLCEDA' as any),
            new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 15000); })
        ]); } catch (e) { console.log('[NL] timeout'); }

        var raw = ''; try { raw = JSON.stringify(nl); } catch (_) {}
        console.log('[NL] JSON=' + raw.substring(0, 300));

        var nets: Record<string, string[]> = {};
        var comps = new Set<string>();
        var matched = 0;

        // A: JSON string -> .enet format
        if (!matched && typeof nl === 'string') {
            try { var j = JSON.parse(nl);
                if (j && typeof j === 'object') {
                    Object.keys(j).forEach(function(d) {
                        var c = j[d]; if (!c || typeof c !== 'object') return;
                        comps.add((c.props && c.props.Designator) || d);
                        Object.keys(c.pins || {}).forEach(function(p) {
                            var v = c.pins[p]; if (typeof v !== 'string' || !v) return;
                            if (!nets[v]) nets[v] = [];
                            nets[v].push(((c.props && c.props.Designator) || d) + '-' + p);
                        });
                    });
                    matched = 1; console.log('[NL] fmt=A: enet-JSON');
                }
            } catch (_) {}
        }

        // B: text -> (net ref-pin ...)
        if (!matched && typeof nl === 'string') {
            var found = false;
            nl.split('\n').forEach(function(l) {
                var t = l.trim();
                if (t.startsWith('(') && t.endsWith(')')) {
                    var a = t.slice(1, -1).split(/\s+/).filter(Boolean);
                    if (a.length >= 2) {
                        if (!nets[a[0]]) nets[a[0]] = [];
                        for (var i = 1; i < a.length; i++) {
                            var r = a[i], d = r.indexOf('-');
                            nets[a[0]].push(d > 0 ? r : r);
                            comps.add(d > 0 ? r.substring(0, d) : r);
                        }
                        found = true;
                    }
                }
            });
            if (found) { matched = 2; console.log('[NL] fmt=B: text'); }
        }

        // C: object with props/pins -> .enet object
        if (!matched && nl && typeof nl === 'object' && !Array.isArray(nl)) {
            var keys = Object.keys(nl);
            if (keys.length) {
                var s = nl[keys[0]];
                if (s && typeof s === 'object' && (s.props || s.pins)) {
                    keys.forEach(function(d) {
                        var c = nl[d]; if (!c || typeof c !== 'object') return;
                        comps.add((c.props && c.props.Designator) || d);
                        Object.keys(c.pins || {}).forEach(function(p) {
                            var v = c.pins[p]; if (typeof v !== 'string' || !v) return;
                            if (!nets[v]) nets[v] = [];
                            nets[v].push(((c.props && c.props.Designator) || d) + '-' + p);
                        });
                    });
                    matched = 3; console.log('[NL] fmt=C: enet-obj');
                } else if (typeof s === 'string') {
                    // D: hierarchical index {des: id}
                    keys.forEach(function(d) { comps.add(d); });
                    matched = 4; console.log('[NL] fmt=D: hier-index (no nets)');
                }
            }
        }

        if (!matched) console.log('[NL] fmt=UNKNOWN');

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

        popup(msg);
    } catch (e) {
        popup('分析出错: ' + (e && (e as any).message || String(e)));
    }
}
