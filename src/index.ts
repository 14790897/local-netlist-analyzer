/**
 * v1.0.10 — pure EDA APIs only, no DOM/manipulation
 */
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try {
            var raw = await (eda.sch_SelectControl as any).getSelectedPrimitives();
            if (Array.isArray(raw)) ids = raw.map(function(p: any) { return p.primitiveId || p.id || ''; }).filter(Boolean);
        } catch (_) {}

        if (!ids || !ids.length) { eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件'); return; }

        // 2. 网表
        var nl = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (_) {}
        if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (_) {}
        if (!nl) { eda.sys_Dialog.showWarningMessage('无法获取网表，请保存原理图'); return; }

        // 3. 解析
        var nets: Record<string, {des: string; pin: string}[]> = {};
        var comps = new Set<string>();
        nl.split('\n').forEach(function(line) {
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

        var compList = Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; });
        var payload = { selectedCount: ids.length, components: comps.size, nets: Object.keys(nets).length, componentList: compList, netList: nets };

        // 4. Save to sessionStorage + open IFrame
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (_) {}
        try { await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' }); return; } catch (_) {}

        // 5. Fallback: Dialog
        var text = comps.size + ' 元件, ' + Object.keys(nets).length + ' 网络';
        eda.sys_Dialog.showInformationMessage(text);

    } catch (_) {
        eda.sys_Dialog.showWarningMessage('分析出错');
    }
}
