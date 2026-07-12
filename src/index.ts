/**
 * v1.0.12 — simplest possible: just call API, show text result
 */
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    // 1. 选中
    var ids: string[] = [];
    try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}

    if (!ids || !ids.length) {
        eda.sys_Dialog.showInformationMessage('请先在原理图中框选需要分析的元件');
        try { alert('请先在原理图中框选需要分析的元件'); } catch (_) {}
        return;
    }

    // 2. 网表
    var nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any);

    // 3. 解析 (enet JSON 或 text)
    var nets: Record<string, string[]> = {};
    var comps = new Set<string>();

    if (typeof nl === 'string') {
        try {
            var data = JSON.parse(nl);
            Object.keys(data).forEach(function(des) {
                var c = data[des]; if (!c) return;
                var desig = (c.props && c.props.Designator) || des;
                comps.add(desig);
                var pins = c.pins || {};
                Object.keys(pins).forEach(function(p) {
                    var n = pins[p]; if (!n) return;
                    if (!nets[n]) nets[n] = [];
                    nets[n].push(desig + '-' + p);
                });
            });
        } catch (_) {
            // Text fallback
            nl.split('\n').forEach(function(line) {
                var t = line.trim();
                if (!t.startsWith('(') || !t.endsWith(')')) return;
                var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
                if (parts.length < 2) return;
                var netName = parts[0];
                if (!nets[netName]) nets[netName] = [];
                for (var i = 1; i < parts.length; i++) {
                    var ref = parts[i], dash = ref.indexOf('-');
                    var des = dash > 0 ? ref.substring(0, dash) : ref;
                    nets[netName].push(dash > 0 ? ref : ref);
                    comps.add(des);
                }
            });
        }
    } else if (nl && typeof nl === 'object') {
        // Direct object
        var data2 = nl;
        Object.keys(data2).forEach(function(des) {
            var c = data2[des]; if (!c) return;
            var desig = (c.props && c.props.Designator) || des;
            comps.add(desig);
            var pins = c.pins || {};
            Object.keys(pins).forEach(function(p) {
                var n = pins[p]; if (!n) return;
                if (!nets[n]) nets[n] = [];
                nets[n].push(desig + '-' + p);
            });
        });
    }

    // 4. 文本结果 (截断到 400 字, dialog 有长度限制)
    var text = comps.size + ' 元件 | ' + Object.keys(nets).length + ' 网络\n\n';
    text += '= 元件 =\n';
    Array.from(comps).sort().slice(0, 30).forEach(function(d) { text += d + ' '; });
    if (comps.size > 30) text += '...共' + comps.size + '个';

    text += '\n\n= 网络 =\n';
    Object.keys(nets).sort().slice(0, 20).forEach(function(n, i) {
        text += n + ': ' + (nets[n] || []).slice(0, 5).join(' ') + '\n';
    });
    if (Object.keys(nets).length > 20) text += '...共' + Object.keys(nets).length + '个网络';

    // 5. 显示 — showInformationMessage + alert 双保险
    eda.sys_Dialog.showInformationMessage(text.substring(0, 400));
    // alert 在 Electron 桌面版也能弹
    try { alert(text.substring(0, 500)); } catch (_) {}
}
