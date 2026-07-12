/**
 * v1.0.13 — console.log every step + triple popup + file save
 */
function popup(msg: string) {
    console.log('[NL] ' + msg);
    // 三道保险 — 直接调，不用 setTimeout
    try { (eda.sys_ToastMessage as any).showToastMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (_) {}
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
}

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        console.log('[NL] start');
        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        console.log('[NL] ids=' + (ids ? ids.length : 0) + ' (FULL EXPORT MODE)');

        // 跳过选中检测，直接导出全部网表用于调试

        // 2. 网表 (15s 超时)
        console.log('[NL] getNetlist...');
        var nl: any = '';
        try {
            nl = await Promise.race([
                eda.sch_Netlist.getNetlist('JLCEDA' as any),
                new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 15000); })
            ]);
        } catch (e) { console.log('[NL] netlist err: ' + (e && (e as any).message)); }

        // 3. 解析 — 结果存到 window 供 Console 手动查看
        console.log('[NL] raw type=' + typeof nl);
        if (typeof nl === 'string' && nl.length < 300) console.log('[NL] raw: ' + nl);
        (window as any).__nl_raw = nl;
        
        var nets: Record<string, string[]> = {};
        var comps = new Set<string>();

        if (typeof nl === 'string') {
            try {
                var j = JSON.parse(nl);
                Object.keys(j).forEach(function(d) {
                    var c = j[d]; if (!c) return;
                    var desig = (c.props && c.props.Designator) || d;
                    comps.add(desig);
                    Object.keys(c.pins || {}).forEach(function(n) {
                        var v = c.pins[n]; if (!v) return;
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
                        var r = a[i], d = r.indexOf('-');
                        nets[nm].push(d > 0 ? r : r);
                        comps.add(d > 0 ? r.substring(0, d) : r);
                    }
                });
            }
        } else if (nl && typeof nl === 'object') {
            Object.keys(nl).forEach(function(d) {
                var c = nl[d]; if (!c) return;
                var desig = (c.props && c.props.Designator) || d;
                comps.add(desig);
                Object.keys(c.pins || {}).forEach(function(n) {
                    var v = c.pins[n]; if (!v) return;
                    if (!nets[v]) nets[v] = [];
                    nets[v].push(desig + '-' + n);
                });
            });
        }

        var msg = ids.length + '选中 ' + comps.size + '元件 ' + Object.keys(nets).length + '网络';

        // 4. 文件保存（主输出）
        var text = msg + '\n\n= 元件 =\n';
        Array.from(comps).sort().forEach(function(d) { text += d + '\n'; });
        text += '\n= 网络 =\n';
        Object.keys(nets).sort().forEach(function(n) {
            text += n + ': ' + (nets[n] || []).join(' ') + '\n';
        });
        try {
            await (eda.sys_FileSystem as any).saveFile({
                fileName: '局部网表_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.txt',
                content: text
            });
        } catch (_) {}

        // 5. 通知 + 存 window 供 Console 查看
        (window as any).__nl_result = text;
        (window as any).__nl_rawdata = nl;
        console.log('[NL] check window.__nl_result in Console');
        popup(msg);

    } catch (e) {
        var err = e && (e as any).message || String(e);
        popup('分析出错: ' + err);
    }
}

