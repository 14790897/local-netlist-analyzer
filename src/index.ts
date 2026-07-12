/**
 * v1.0.10 — parse JLCEDA .enet JSON format
 */
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) {
            eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件');
            return;
        }

        // 2. 网表 — JLCEDA 返回 .enet JSON 格式
        var nl: any = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (_) {}

        if (!nl) {
            eda.sys_Dialog.showWarningMessage('无法获取网表，请保存原理图');
            return;
        }

        // 3. 解析：JLCEDA 格式是 JSON { "R1": { props:{Designator:"R1"}, pins:{"1":"Net1",...} }, ... }
        // 转成: { netName: [{des: "R1", pin: "1"}, ...] }
        var nets: Record<string, {des: string; pin: string}[]> = {};
        var comps = new Set<string>();

        // 如果是 string，尝试 parse JSON
        var data: any = nl;
        if (typeof nl === 'string') {
            try { data = JSON.parse(nl); } catch (_) {
                // 可能是旧版文本格式 (net ref-pin)，兜底解析
                nl.split('\n').forEach(function(line: string) {
                    var t = line.trim();
                    if (!t.startsWith('(') || !t.endsWith(')')) return;
                    var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
                    if (parts.length < 2) return;
                    var netName = parts[0];
                    if (!nets[netName]) nets[netName] = [];
                    for (var m = 1; m < parts.length; m++) {
                        var ref = parts[m], dash = ref.indexOf('-');
                        var des = dash > 0 ? ref.substring(0, dash) : ref;
                        var pin = dash > 0 ? ref.substring(dash + 1) : '?';
                        nets[netName].push({des: des, pin: pin});
                        comps.add(des);
                    }
                });
            }
        }

        // JSON .enet 格式解析
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(function(des) {
                var c = data[des];
                // 跳过非元件属性
                if (!c || typeof c !== 'object') return;
                var props = c.props || c;
                var desig = props.Designator || props.designator || des;
                var pins = c.pins || {};
                comps.add(desig);
                Object.keys(pins).forEach(function(pinNum) {
                    var netName = pins[pinNum];
                    if (!netName || typeof netName !== 'string') return;
                    if (!nets[netName]) nets[netName] = [];
                    nets[netName].push({des: desig, pin: pinNum});
                });
            });
        }

        // 4. 构建结果
        var compList = Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; });
        var payload = {
            selectedCount: ids.length,
            components: compList.length,
            nets: Object.keys(nets).length,
            componentList: compList,
            netList: nets
        };

        // 5. sessionStorage + IFrame
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (_) {}
        try {
            await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' });
        } catch (_) {
            var text = compList.length + ' 元件, ' + Object.keys(nets).length + ' 网络';
            eda.sys_Dialog.showInformationMessage(text);
        }

    } catch (_) {
        eda.sys_Dialog.showWarningMessage('分析出错');
    }
}
