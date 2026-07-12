/**
 * v1.0.7 — DOM 注入结果面板, 不依赖 EDA UI API
 */
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    // 辅助: 创建浮层结果面板
    function showPanel(html: string) {
        // 清除旧的
        var old = document.getElementById('__nl_result');
        if (old) old.remove();

        var div = document.createElement('div');
        div.id = '__nl_result';
        div.innerHTML = '<div style="position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:99999;'
            + 'background:#1e1e1e;color:#d4d4d4;border:1px solid #444;border-radius:8px;'
            + 'max-width:600px;max-height:500px;overflow:auto;padding:16px;font:12px/1.5 monospace;'
            + 'box-shadow:0 8px 32px rgba(0,0,0,0.5)">'
            + '<div style="display:flex;justify-content:space-between;margin-bottom:8px">'
            + '<span style="color:#569cd6;font-weight:bold">局部网表</span>'
            + '<span id="__nl_close" style="cursor:pointer;color:#888;font-size:16px">&times;</span></div>'
            + '<pre style="white-space:pre-wrap;margin:0">' + html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>'
            + '</div>';
        document.body.appendChild(div);

        // 关闭按钮
        document.getElementById('__nl_close')!.onclick = function() { div.remove(); };
    }

    try {
        // 1. 选中检测
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (e) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (e) {}
        if (!ids || !ids.length) {
            try {
                var raw = await (eda.sch_SelectControl as any).getSelectedPrimitives();
                if (Array.isArray(raw)) ids = raw.map(function(p: any) { return p.primitiveId || p.id || ''; }).filter(Boolean);
            } catch (e) {}
        }

        if (!ids || !ids.length) {
            showPanel('请先在原理图中框选需要分析的元件');
            return;
        }

        // 2. 网表
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}

        if (!nl) {
            showPanel('无法获取网表。请确保原理图已保存。');
            return;
        }

        // 3. 解析
        var nets = new Map<string, {des: string; pin: string}[]>();
        var comps = new Set<string>();
        var lines = nl.split('\n');
        for (var k = 0; k < lines.length; k++) {
            var t = lines[k].trim();
            if (!t.startsWith('(') || !t.endsWith(')')) continue;
            var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
            if (parts.length < 2) continue;
            var netName = parts[0];
            if (!nets.has(netName)) nets.set(netName, []);
            for (var m = 1; m < parts.length; m++) {
                var ref = parts[m];
                var dash = ref.indexOf('-');
                nets.get(netName)!.push({
                    des: dash > 0 ? ref.substring(0, dash) : ref,
                    pin: dash > 0 ? ref.substring(dash + 1) : '?'
                });
                comps.add(dash > 0 ? ref.substring(0, dash) : ref);
            }
        }

        // 4. 构建结果 HTML
        var text = '选中: ' + ids.length + ' 图元\n';
        text += '元件: ' + comps.size + ' | 网络: ' + nets.size + '\n\n';

        text += '=== 元件 (' + comps.size + ') ===\n';
        Array.from(comps).sort().forEach(function(d) { text += d + '\n'; });

        text += '\n=== 网络 (' + nets.size + ') ===\n';
        var names: string[] = [];
        nets.forEach(function(_, k) { names.push(k); });
        names.sort();
        names.forEach(function(name) {
            text += '\n[' + name + ']\n';
            var nodes = nets.get(name) || [];
            nodes.forEach(function(n) { text += '  ' + n.des + '-' + n.pin + '\n'; });
        });

        // 5. 注入面板
        showPanel(text);

        // 也尝试存 sessionStorage 给 IFrame
        var payload = {
            selectedCount: ids.length, components: comps.size, nets: nets.size,
            componentList: Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; }),
            netList: Object.fromEntries(nets)
        };
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (e) {}

        // 尝试 IFrame (不阻塞)
        try { await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' }); } catch (e) {}

    } catch (e: any) {
        showPanel('错误: ' + (e && e.message || String(e)));
    }
}
