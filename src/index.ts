/**
 * 生产版本 — 完整网表分析器
 */

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        var primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        if (!primitives || !primitives.length) {
            eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件');
            return;
        }

        var selectedDesignators = new Set<string>();
        var componentInfo = new Map<string, { name: string; mfr: string; mfrId: string; pins: Map<string, string> }>();

        for (var i = 0; i < primitives.length; i++) {
            var p = primitives[i];
            try {
                if (p.getState_PrimitiveType() !== 'Component') continue;
                var comp = p as any;
                var designator = comp.getState_Designator();
                if (!designator) continue;
                selectedDesignators.add(designator);

                var pinMap = new Map<string, string>();
                try {
                    var pins = await comp.getAllPins();
                    if (Array.isArray(pins)) {
                        for (var j = 0; j < pins.length; j++) {
                            if (pins[j].pinNumber) pinMap.set(pins[j].pinNumber, pins[j].pinName || '');
                        }
                    }
                } catch (e) { /* BETA API may fail */ }

                componentInfo.set(designator, {
                    name: comp.getState_Name?.() || comp.name || '',
                    mfr: comp.getState_Manufacturer?.() || '',
                    mfrId: comp.getState_ManufacturerId?.() || '',
                    pins: pinMap,
                });
            } catch (e) { continue; }
        }

        if (componentInfo.size === 0) {
            eda.sys_Dialog.showWarningMessage('选中了 ' + primitives.length + ' 个图元但没有器件。请在原理图中框选含器件的区域');
            return;
        }

        // 获取网表
        var netlistText = '';
        try { netlistText = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!netlistText) {
            try { netlistText = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}
        }

        // 解析网表
        var netNodesMap = new Map<string, { netName: string; designator: string; pinNumber: string; pinName: string }[]>();
        if (netlistText) {
            var lines = netlistText.split('\n');
            for (var k = 0; k < lines.length; k++) {
                var t = lines[k].trim();
                if (!t.startsWith('(') || !t.endsWith(')')) continue;
                var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
                if (parts.length < 2) continue;
                var netName = parts[0];
                for (var m = 1; m < parts.length; m++) {
                    var nodeRef = parts[m];
                    var dash = nodeRef.indexOf('-');
                    var ref = dash > 0 ? nodeRef.substring(0, dash) : nodeRef;
                    var pin = dash > 0 ? nodeRef.substring(dash + 1) : '?';
                    if (!selectedDesignators.has(ref)) continue;
                    var info = componentInfo.get(ref);
                    if (!netNodesMap.has(netName)) netNodesMap.set(netName, []);
                    netNodesMap.get(netName)!.push({
                        netName: netName, designator: ref, pinNumber: pin,
                        pinName: info?.pins.get(pin) || '',
                    });
                }
            }
        }

        // 生成文本
        var text = '# 局部网表分析\n> ' + componentInfo.size + ' 元件, ' + netNodesMap.size + ' 网络\n\n';
        text += '## 元件\n';
        componentInfo.forEach(function (v: any, k: string) {
            var s = k + ': ' + (v.name || '-');
            if (v.mfr) s += ' (' + v.mfr + ' ' + v.mfrId + ')';
            text += '- ' + s + '\n';
        });
        if (netNodesMap.size > 0) {
            text += '\n## 网络\n';
            netNodesMap.forEach(function (nodes: any, name: string) {
                text += '\n### ' + name + '\n';
                nodes.forEach(function (node: any) {
                    var p = node.designator + '-' + node.pinNumber;
                    if (node.pinName) p += ' (' + node.pinName + ')';
                    text += '- ' + p + '\n';
                });
            });
        }

        var esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        var js = JSON.stringify(text);

        // IFrame 展示
        (eda.sys_IFrame as any).showIFrame({
            htmlContent: '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
                + '*{margin:0;padding:0}body{font:13px system-ui,sans-serif;background:#1e1e1e;color:#d4d4d4;padding:16px}'
                + 'h2{font-size:16px;color:#e0e0e0;margin-bottom:8px}'
                + 'pre{background:#252526;border:1px solid #333;border-radius:6px;padding:12px;overflow:auto;max-height:360px;font:12px/1.5 Consolas,monospace;white-space:pre-wrap}'
                + '.btn{padding:6px 14px;border:1px solid #1177bb;background:#0e639c;color:#fff;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:12px}'
                + '.btn:hover{background:#1177bb}'
                + '</style></head><body><h2>局部网表分析</h2>'
                + '<button class="btn" onclick="navigator.clipboard.writeText(t)">复制</button>'
                + '<pre>' + esc + '</pre><script>var t=' + js + '</script></body></html>',
            title: '局部网表分析',
            closeOnClickOutside: false,
            topInPx: 60, leftInPx: 100, width: 550, height: 500,
        });

    } catch (e: any) {
        eda.sys_Dialog.showWarningMessage('分析出错: ' + (e.message || String(e)));
    }
}
