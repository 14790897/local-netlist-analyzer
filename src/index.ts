/**
 * v1.0.5 — 容错版
 */
console.log('[NETLIST] script loaded');

export function activate(): void {
    console.log('[NETLIST] activate called');
}

export async function analyzeSelection(): Promise<void> {
    try {
        var primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        console.log('[NETLIST] primitives:', primitives ? primitives.length : 0);

        if (!primitives || !primitives.length) {
            showMsg('请先在原理图中框选元件');
            return;
        }

        var selected = new Set<string>();
        var info = new Map<string, any>();

        for (var i = 0; i < primitives.length; i++) {
            var p = primitives[i];
            try {
                if (p.getState_PrimitiveType() !== 'Component') continue;
                var comp = p as any;
                var d = comp.getState_Designator();
                if (!d) continue;
                selected.add(d);
                console.log('[NETLIST] component:', d, comp.getState_Name?.() || '');
                info.set(d, { name: comp.getState_Name?.() || '', mfr: comp.getState_Manufacturer?.() || '' });
            } catch (e) { continue; }
        }

        console.log('[NETLIST] components:', info.size);

        if (info.size === 0) {
            showMsg('选中的图元中没有器件');
            return;
        }

        // 网表
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) { console.log('[NETLIST] getNetlist fail:', e); }
        console.log('[NETLIST] netlist len:', nl ? nl.length : 0);

        // 解析
        var nets = new Map<string, any[]>();
        if (nl) {
            var lines = nl.split('\n');
            for (var k = 0; k < lines.length; k++) {
                var t = lines[k].trim();
                if (!t.startsWith('(') || !t.endsWith(')')) continue;
                var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
                if (parts.length < 2) continue;
                var netName = parts[0];
                for (var m = 1; m < parts.length; m++) {
                    var ref = parts[m];
                    var dash = ref.indexOf('-');
                    var des = dash > 0 ? ref.substring(0, dash) : ref;
                    var pin = dash > 0 ? ref.substring(dash + 1) : '?';
                    if (!selected.has(des)) continue;
                    if (!nets.has(netName)) nets.set(netName, []);
                    nets.get(netName)!.push({ des: des, pin: pin });
                }
            }
        }

        // 生成文本
        var text = '# 局部网表\n> ' + info.size + ' 元件, ' + nets.size + ' 网络\n\n## 元件\n';
        info.forEach(function (v: any, k: string) {
            text += '- ' + k + ': ' + (v.name || '-') + '\n';
        });
        if (nets.size > 0) {
            text += '\n## 网络\n';
            nets.forEach(function (nodes: any, name: string) {
                text += '\n### ' + name + '\n';
                nodes.forEach(function (n: any) { text += '- ' + n.des + '-' + n.pin + '\n'; });
            });
        }
        console.log('[NETLIST] output:\n' + text);

        // IFrame 展示
        var esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        var js = JSON.stringify(text);
        try {
            (eda.sys_IFrame as any).showIFrame({
                htmlContent: '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
                    + '*{margin:0;padding:0}body{font:13px system-ui,sans-serif;background:#1e1e1e;color:#d4d4d4;padding:16px}'
                    + 'h2{font-size:16px;color:#e0e0e0;margin-bottom:8px}'
                    + 'pre{background:#252526;border:1px solid #333;border-radius:6px;padding:12px;overflow:auto;max-height:360px;font:12px/1.5 Consolas,monospace;white-space:pre-wrap}'
                    + '.btn{padding:6px 14px;border:1px solid #1177bb;background:#0e639c;color:#fff;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:12px}'
                    + '</style></head><body><h2>局部网表</h2>'
                    + '<button class="btn" onclick="navigator.clipboard.writeText(t)">复制</button>'
                    + '<pre>' + esc + '</pre><script>var t=' + js + '</script></body></html>',
                title: '局部网表分析',
                closeOnClickOutside: false,
                topInPx: 60, leftInPx: 100, width: 550, height: 500,
            });
            console.log('[NETLIST] IFrame shown');
        } catch (e: any) {
            console.log('[NETLIST] IFrame fail:', e.message || e);
            showMsg('结果请看Console:\n' + text.split('\n').slice(0, 10).join('\n'));
        }

    } catch (e: any) {
        console.log('[NETLIST] fatal:', e.message || e);
        showMsg('出错: ' + (e.message || e));
    }
}

function showMsg(msg: string) {
    console.log('[NETLIST] ' + msg);
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (e) {}
    try { eda.sys_ToastMessage.showToastMessage(msg); } catch (e) {}
}
