/**
 * v1.0.6 — 修复 getAllSelectedPrimitives 崩溃
 */
console.log('[NETLIST] loaded');

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        // getAllSelectedPrimitives 在编辑器中可能崩溃，先试备用 API
        var primitives: any[] = [];
        try {
            primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        } catch (e) {
            // BETA API crash, fallback: 用 ID 方式
            try {
                var ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
                if (ids && ids.length > 0) {
                    // 有选中但无法获取对象，用简化模式
                    showMsg('已选中 ' + ids.length + ' 个图元\n(API降级模式：仅显示数量，无法获取详情)');
                    return;
                }
            } catch (e2) {
                showMsg('选择API不可用，请确保已框选元件后重试');
                return;
            }
        }

        if (!primitives || !primitives.length) {
            showMsg('请先在原理图中框选需要分析的元件');
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
                info.set(d, {
                    name: comp.getState_Name?.() || comp.name || '',
                    mfr: comp.getState_Manufacturer?.() || '',
                    mfrId: comp.getState_ManufacturerId?.() || '',
                });
            } catch (e) { continue; }
        }

        if (info.size === 0) {
            showMsg('选中的图元中没有器件，请框选包含器件的区域');
            return;
        }

        // 网表
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) { try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {} }

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

        // 生成展示
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
            showMsg('结果见Console:\n' + text);
        }

    } catch (e: any) {
        showMsg('分析出错: ' + (e.message || String(e)));
    }
}

function showMsg(msg: string) {
    console.log('[NETLIST] ' + msg);
    try { eda.sys_Dialog.showWarningMessage(msg); } catch (e) {}
    try { eda.sys_ToastMessage.showToastMessage(msg); } catch (e) {}
}
