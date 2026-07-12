/**
 * v1.0.7 — 修复选中 + 详细日志
 */
console.log('[NETLIST] v1.0.7 loaded');
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        console.log('[NETLIST] === analyzeSelection start ===');

        // 1. 检查选中
        var ids: string[] = [];

        try {
            ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId();
            console.log('[NETLIST] BETA API: ' + ids.length + ' ids');
        } catch (e) { console.log('[NETLIST] BETA API failed'); }

        if (!ids || !ids.length) {
            try {
                ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
                console.log('[NETLIST] deprecated API: ' + ids.length + ' ids');
            } catch (e) { console.log('[NETLIST] deprecated API failed'); }
        }

        if (!ids || !ids.length) {
            try {
                var raw = await (eda.sch_SelectControl as any).getSelectedPrimitives();
                if (Array.isArray(raw)) {
                    ids = raw.map(function(p: any) { return p.primitiveId || p.id || ''; }).filter(Boolean);
                    console.log('[NETLIST] raw API: ' + ids.length + ' ids');
                }
            } catch (e) { console.log('[NETLIST] raw API failed'); }
        }

        if (!ids || !ids.length) {
            console.log('[NETLIST] NO selection');
            showMsg('请先在原理图中框选需要分析的元件');
            return;
        }
        console.log('[NETLIST] Total selected: ' + ids.length);

        // 2. 获取网表
        console.log('[NETLIST] Getting netlist...');
        var nl = '';
        try {
            var t0 = Date.now();
            nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any);
            console.log('[NETLIST] JLCEDA netlist: ' + nl.length + ' chars in ' + (Date.now()-t0) + 'ms');
        } catch (e) { console.log('[NETLIST] JLCEDA failed: ' + e); }
        if (!nl) {
            try {
                nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any);
                console.log('[NETLIST] EasyEDA netlist: ' + nl.length + ' chars');
            } catch (e) { console.log('[NETLIST] EasyEDA failed: ' + e); }
        }

        if (!nl) {
            console.log('[NETLIST] NO netlist');
            showMsg('无法获取网表。请确保原理图已保存。');
            return;
        }

        // 3. 解析
        console.log('[NETLIST] Parsing netlist...');
        var nets = new Map<string, {des: string; pin: string}[]>();
        var componentSet = new Set<string>();

        var lines = nl.split('\n');
        var matched = 0;
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
            matched++;
        }
        console.log('[NETLIST] Parsed: ' + matched + ' nets, ' + componentSet.size + ' components');

        // 4. 构建结果
        var compList: {des: string; name: string}[] = [];
        componentSet.forEach(function(d) {
            compList.push({des: d, name: ''});
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

        console.log('[NETLIST] Result: ' + compList.length + ' comps, ' + nets.size + ' nets');

        // 5. sessionStorage
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (e) {
            console.log('[NETLIST] sessionStorage failed: ' + e);
        }

        // 6. IFrame
        console.log('[NETLIST] Opening IFrame...');
        try {
            await (eda.sys_IFrame as any).openIFrame(
                '/iframe/result.html', 550, 500, undefined,
                { title: '局部网表分析' }
            );
            console.log('[NETLIST] IFrame opened');
        } catch (e: any) {
            console.log('[NETLIST] IFrame failed: ' + (e.message || e));
            showMsg('分析完成: ' + compList.length + ' 元件, ' + nets.size + ' 网络');
        }

        console.log('[NETLIST] === analyzeSelection done ===');
    } catch (e: any) {
        console.log('[NETLIST] FATAL: ' + (e.message || String(e)));
        showMsg('出错: ' + (e.message || String(e)));
    }
}

function showMsg(msg: string) {
    console.log('[NETLIST] ' + msg);
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (e) {}
    try { eda.sys_ToastMessage.showToastMessage(msg); } catch (e) {}
}
