/**
 * v1.0.6 — 纯 netlist 方案，不崩
 *   - 只用 getSelectedPrimitives_PrimitiveId (stable)
 *   - get netlist → 解析元件和网络
 *   - openIFrame 显示结果
 */
console.log('[NETLIST] loaded');
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        // 1. 检查选中
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

        // 2. 获取网表
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}

        if (!nl) {
            showMsg('无法获取网表。请确保原理图已保存。');
            return;
        }

        // 3. 解析网表: (netname des-pin des-pin ...)
        var nets = new Map<string, {des: string; pin: string}[]>();
        var componentSet = new Set<string>();
        var componentNames = new Map<string, string>();

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
                var des = dash > 0 ? ref.substring(0, dash) : ref;
                var pin = dash > 0 ? ref.substring(dash + 1) : '?';
                nets.get(netName)!.push({des: des, pin: pin});
                componentSet.add(des);
            }
        }

        // 4. 构建结果
        var compList: {des: string; name: string}[] = [];
        componentSet.forEach(function(d) {
            compList.push({des: d, name: componentNames.get(d) || ''});
        });

        var netObj: Record<string, {des: string; pin: string}[]> = {};
        nets.forEach(function(v, k) { netObj[k] = v; });

        var payload = {
            selectedCount: ids.length,
            components: compList.length,
            nets: nets.size,
            componentList: compList,
            netList: netObj
        };

        // 5. 用 sessionStorage 传数据到 iframe
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (e) {}

        // 6. 打开 iframe
        try {
            await (eda.sys_IFrame as any).openIFrame(
                '/iframe/result.html', 550, 500, undefined,
                { title: '局部网表分析' }
            );
        } catch (e: any) {
            // fallback: 纯文本
            showMsg('分析完成: ' + compList.length + ' 元件, ' + nets.size + ' 网络');
        }

    } catch (e: any) {
        showMsg('出错: ' + (e.message || String(e)));
    }
}

function showMsg(msg: string) {
    console.log('[NETLIST] ' + msg);
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (e) {}
    try { eda.sys_ToastMessage.showToastMessage(msg); } catch (e) {}
}
