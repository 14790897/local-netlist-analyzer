/**
 * v1.0.12 — try-catch around everything, file + dialog output
 */
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}

        if (!ids || !ids.length) {
            eda.sys_Dialog.showInformationMessage('请先在原理图中框选需要分析的元件');
            return;
        }

        // 2. 网表
        var nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any);

        // 3. 解析
        var nets: Record<string, string[]> = {};
        var comps = new Set<string>();

        if (typeof nl === 'string') {
            try {
                var j = JSON.parse(nl);
                Object.keys(j).forEach(function(d) {
                    var c = j[d]; if (!c) return;
                    var desig = (c.props && c.props.Designator) || d;
                    comps.add(desig);
                    var pins = c.pins || {};
                    Object.keys(pins).forEach(function(n) {
                        var v = pins[n]; if (!v) return;
                        if (!nets[v]) nets[v] = [];
                        nets[v].push(desig + '-' + n);
                    });
                });
            } catch (_) {
                nl.split('\n').forEach(function(l) {
                    var t = l.trim();
                    if (!t.startsWith('(') || !t.endsWith(')')) return;
                    var a = t.slice(1, -1).split(/\s+/).filter(Boolean);
                    if (a.length < 2) return;
                    var nm = a[0]; if (!nets[nm]) nets[nm] = [];
                    for (var i = 1; i < a.length; i++) {
                        var r = a[i], d = r.indexOf('-'), des = d > 0 ? r.substring(0, d) : r;
                        nets[nm].push(d > 0 ? r : r);
                        comps.add(des);
                    }
                });
            }
        } else if (nl && typeof nl === 'object') {
            Object.keys(nl).forEach(function(d) {
                var c = nl[d]; if (!c) return;
                var desig = (c.props && c.props.Designator) || d;
                comps.add(desig);
                var pins = c.pins || {};
                Object.keys(pins).forEach(function(n) {
                    var v = pins[n]; if (!v) return;
                    if (!nets[v]) nets[v] = [];
                    nets[v].push(desig + '-' + n);
                });
            });
        }

        // 4. 文本
        var text = ids.length + ' 选中 | ' + comps.size + ' 元件 | ' + Object.keys(nets).length + ' 网络\n\n';
        text += '= 元件 =\n';
        Array.from(comps).sort().forEach(function(d) { text += d + '\n'; });
        text += '\n= 网络 =\n';
        Object.keys(nets).sort().forEach(function(n) {
            text += n + ': ' + (nets[n] || []).join(' ') + '\n';
        });

        // 5. 文件保存
        try {
            var fn = '局部网表_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.txt';
            await (eda.sys_FileSystem as any).saveFile({ fileName: fn, content: text });
        } catch (_) {}

        // 6. Dialog (用延时确保不被清理)
        var msg = comps.size + ' 元件, ' + Object.keys(nets).length + ' 网络';
        setTimeout(function() { eda.sys_Dialog.showInformationMessage(msg); }, 500);

    } catch (e) {
        var err = e && (e as any).message || String(e);
        eda.sys_Dialog.showInformationMessage('分析出错: ' + err);
    }
}

