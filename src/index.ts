/**
 * v1.0.7 — Toast + Dialog + console 三重输出，保底必见
 */
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    var log = function(msg: string) {
        console.log('[N] ' + msg);
        try { eda.sys_ToastMessage.showToastMessage(msg); } catch (e) {}
    };

    try {
        log('start');

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

        log('ids=' + (ids ? ids.length : 0));
        if (!ids || !ids.length) {
            try { eda.sys_Dialog.showWarningMessage('请先在原理图中框选元件'); } catch (e) {}
            return;
        }

        // 2. 网表
        log('getting netlist...');
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}

        log('netlist=' + (nl ? nl.length : 0) + 'c');
        if (!nl) {
            try { eda.sys_Dialog.showWarningMessage('无网表数据，请先保存原理图'); } catch (e) {}
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
        log('done: ' + comps.size + 'c ' + nets.size + 'n');

        // 4. 显示: IFrame 优先, Dialog 兜底
        var payload = {
            selectedCount: ids.length,
            components: comps.size,
            nets: nets.size,
            componentList: Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; }),
            netList: Object.fromEntries(nets)
        };
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (e) {}

        var shown = false;
        try {
            await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' });
            shown = true;
        } catch (e) {}

        if (!shown) {
            var text = '局部网表: ' + comps.size + ' 元件, ' + nets.size + ' 网络\n';
            Array.from(comps).sort().forEach(function(d) { text += d + ' '; });
            try { eda.sys_Dialog.showInformationMessage(text.substring(0, 400)); } catch (e) {
                log(text.substring(0, 200));
            }
        }

        log('done');
    } catch (e: any) {
        var msg = '错误: ' + (e && e.message || String(e));
        try { eda.sys_Dialog.showWarningMessage(msg); } catch (_) {}
        console.log('[N] ' + msg);
    }
}
