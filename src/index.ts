/**
 * v1.0.6 — getSelectedPrimitives_PrimitiveId 为主，不崩
 */
console.log('[NETLIST] loaded');
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        // 用 stable API: 先拿 ID
        var ids: string[] = [];
        try {
            ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
        } catch (e) {
            showMsg('无法获取选中图元');
            return;
        }
        if (!ids || !ids.length) {
            showMsg('请先在原理图中框选需要分析的元件');
            return;
        }

        // 尝试获取对象详情
        var primitives: any[] = [];
        try {
            primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        } catch (e) { /* BETA API may crash */ }

        // 收集器件信息
        var designators = new Set<string>();
        var info = new Map<string, string>();

        if (primitives.length > 0) {
            for (var i = 0; i < primitives.length; i++) {
                try {
                    var p = primitives[i];
                    if (p.getState_PrimitiveType() !== 'Component') continue;
                    var comp = p as any;
                    var d = comp.getState_Designator();
                    if (!d) continue;
                    designators.add(d);
                    info.set(d, comp.getState_Name?.() || comp.name || '');
                } catch (e) { continue; }
            }
        }

        // 如果对象模式失败，从网表反向查找
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}

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

                    // 如果没有对象信息，从网表也能确定哪些元件被选中
                    // 网表中的元件就是原理图上所有的
                    if (info.size === 0) {
                        designators.add(des);
                        if (!info.has(des)) info.set(des, '');
                    }

                    if (!designators.has(des)) continue;
                    if (!nets.has(netName)) nets.set(netName, []);
                    nets.get(netName)!.push({ des: des, pin: pin });
                }
            }
        }

        // 生成文本
        var text = '# 局部网表\n> ' + info.size + ' 元件, ' + nets.size + ' 网络\n';
        if (info.size > 0) {
            text += '\n## 元件\n';
            info.forEach(function (v: string, k: string) {
                text += '- ' + k + (v ? ': ' + v : '') + '\n';
            });
        }
        if (nets.size > 0) {
            text += '\n## 网络\n';
            nets.forEach(function (nodes: any, name: string) {
                text += '\n### ' + name + '\n';
                nodes.forEach(function (n: any) { text += '- ' + n.des + '-' + n.pin + '\n'; });
            });
        }

        // 如果没有网表但有点击，显示基本信息
        if (nets.size === 0) {
            text += '\n> 未获取到网络连接。请确保原理图已保存且有导线。\n';
        }

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
        } catch (e: any) {
            showMsg('结果:\n' + text);
        }

    } catch (e: any) {
        showMsg('出错: ' + (e.message || String(e)));
    }
}

function showMsg(msg: string) {
    console.log('[NETLIST] ' + msg);
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (e) {}
    try { eda.sys_ToastMessage.showToastMessage(msg); } catch (e) {}
}
