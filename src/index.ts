/**
 * v1.0.8 — fixes: use parent.document (extension runs in iframe sandbox)
 */
console.log('[NETLIST] v1.0.8 loaded');
var _parent: any = typeof parent !== 'undefined' ? parent : self;
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    function showResult(html: string) {
        var doc = _parent.document;
        var win = _parent;

        // 0. Write to parent window (F12 Console accessible)
        try { win.__netlist_output = html; } catch (_) {}
        console.log('[NETLIST] output ready');

        // 1. DOM panel on parent document
        try {
            if (!doc || !doc.body) throw new Error('no body');
            var old = doc.getElementById('__nl_result');
            if (old) old.remove();
            var div = doc.createElement('div');
            div.id = '__nl_result';
            div.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:99999;'
                + 'background:#1e1e1e;color:#d4d4d4;border:2px solid #569cd6;border-radius:8px;'
                + 'max-width:620px;max-height:520px;overflow:auto;padding:16px;'
                + 'font:12px/1.5 Consolas,monospace;box-shadow:0 8px 32px rgba(0,0,0,0.7)';
            div.innerHTML = ''
                + '<div style="display:flex;justify-content:space-between;margin-bottom:10px">'
                + '<span style="color:#569cd6;font-weight:bold;font-size:14px">局部网表</span>'
                + '<span id="__nl_close" style="cursor:pointer;color:#aaa;font-size:18px;line-height:1">&times;</span>'
                + '</div>'
                + '<pre style="white-space:pre-wrap;margin:0;color:#ccc">' + html.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>';
            doc.body.appendChild(div);
            var cb = doc.getElementById('__nl_close');
            if (cb) cb.onclick = function() { div.remove(); };
            console.log('[NETLIST] panel shown');
            return;
        } catch (e) {
            console.log('[NETLIST] panel err: ' + (e && (e as any).message));
        }

        // 2. Alert
        try { alert('局部网表\n\n' + html.substring(0, 500)); return; } catch (_) {}

        // 3. Fallback: just console
        console.log('[NETLIST] === RESULT ===\n' + html);
    }

    try {
        console.log('[NETLIST] start');

        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (e) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (e) {}
        if (!ids || !ids.length) {
            try {
                var raw = await (eda.sch_SelectControl as any).getSelectedPrimitives();
                if (Array.isArray(raw)) ids = raw.map(function(p: any) { return p.primitiveId || p.id || ''; }).filter(Boolean);
            } catch (e) {}
        }
        console.log('[NETLIST] ids=' + (ids ? ids.length : 0));

        if (!ids || !ids.length) {
            showResult('请先在原理图中框选需要分析的元件');
            return;
        }

        // 2. 网表
        console.log('[NETLIST] getNetlist...');
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}
        console.log('[NETLIST] netlist=' + (nl ? nl.length : 0));

        if (!nl) { showResult('无网表数据。请保存原理图后重试。'); return; }

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
                nets.get(netName)!.push({ des: dash > 0 ? ref.substring(0, dash) : ref, pin: dash > 0 ? ref.substring(dash + 1) : '?' });
                comps.add(dash > 0 ? ref.substring(0, dash) : ref);
            }
        }
        console.log('[NETLIST] parsed ' + comps.size + 'c ' + nets.size + 'n');

        // 4. 结果文本
        var text = '选中: ' + ids.length + ' 图元  |  元件: ' + comps.size + '  |  网络: ' + nets.size + '\n\n';
        text += '=== 元件 (' + comps.size + ') ===\n';
        Array.from(comps).sort().forEach(function(d) { text += d + '\n'; });
        text += '\n=== 网络 (' + nets.size + ') ===\n';
        var names: string[] = [];
        nets.forEach(function(_, k) { names.push(k); });
        names.sort();
        names.forEach(function(name) {
            text += '\n[' + name + ']\n';
            (nets.get(name) || []).forEach(function(n) { text += '  ' + n.des + '-' + n.pin + '\n'; });
        });

        showResult(text);

        // sessionStorage + IFrame (non-blocking)
        try { sessionStorage.setItem('__netlist_result', JSON.stringify({
            selectedCount: ids.length, components: comps.size, nets: nets.size,
            componentList: Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; }),
            netList: Object.fromEntries(nets)
        })); } catch (e) {}
        try { await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' }); } catch (e) {}

    } catch (e: any) {
        showResult('错误: ' + (e && e.message || String(e)));
    }
}
