/**
 * v1.0.7 — 修复: openIFrame 加 timeout，纯文本兜底
 */
console.log('[NETLIST] v1.0.7 loaded');
export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        console.log('[NETLIST] start');

        // 1. 检查选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (e) {}
        if (!ids || !ids.length) {
            try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (e) {}
        }
        if (!ids || !ids.length) {
            try {
                var raw = await (eda.sch_SelectControl as any).getSelectedPrimitives();
                if (Array.isArray(raw)) ids = raw.map(function(p: any) { return p.primitiveId || p.id || ''; }).filter(Boolean);
            } catch (e) {}
        }
        console.log('[NETLIST] ids: ' + (ids ? ids.length : 0));

        if (!ids || !ids.length) {
            showMsg('请先在原理图中框选需要分析的元件');
            return;
        }

        // 2. 获取网表 (加 timeout)
        console.log('[NETLIST] getNetlist...');
        var nl = '';
        try {
            nl = await Promise.race([
                eda.sch_Netlist.getNetlist('JLCEDA' as any),
                new Promise<string>(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 15000); })
            ]) as string;
        } catch (e) {
            console.log('[NETLIST] JLCEDA: ' + (e && (e as any).message));
        }
        if (!nl) {
            try {
                nl = await Promise.race([
                    eda.sch_Netlist.getNetlist('EasyEDA' as any),
                    new Promise<string>(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 15000); })
                ]) as string;
            } catch (e) {
                console.log('[NETLIST] EasyEDA: ' + (e && (e as any).message));
            }
        }

        console.log('[NETLIST] netlist: ' + (nl ? nl.length : 0) + ' chars');

        if (!nl) {
            showMsg('无法获取网表，请保存原理图后重试');
            return;
        }

        // 3. 解析
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
                nets.get(netName)!.push({
                    des: dash > 0 ? ref.substring(0, dash) : ref,
                    pin: dash > 0 ? ref.substring(dash + 1) : '?'
                });
                componentSet.add(dash > 0 ? ref.substring(0, dash) : ref);
            }
            matched++;
        }
        console.log('[NETLIST] parsed: ' + matched + ' nets, ' + componentSet.size + ' comps');

        // 4. 构建纯文本结果
        var text = '局部网表分析\n';
        text += '= 选中: ' + ids.length + ' 图元 | 元件: ' + componentSet.size + ' | 网络: ' + nets.size + '\n\n';

        var compList: string[] = [];
        componentSet.forEach(function(d) { compList.push(d); });
        compList.sort();

        text += '== 元件 (' + compList.length + ') ==\n';
        compList.forEach(function(d) { text += d + '\n'; });

        text += '\n== 网络 (' + nets.size + ') ==\n';
        var netNames: string[] = [];
        nets.forEach(function(_, k) { netNames.push(k); });
        netNames.sort();
        netNames.forEach(function(name) {
            text += '\n[' + name + ']\n';
            var nodes = nets.get(name) || [];
            nodes.forEach(function(n) { text += '  ' + n.des + '-' + n.pin + '\n'; });
        });

        console.log('[NETLIST] result length: ' + text.length);

        // 5. 按优先级尝试显示: IFrame → Dialog → Toast → console
        var shown = false;

        // 5a. IFrame
        var payload = {
            selectedCount: ids.length,
            components: compList.length,
            nets: nets.size,
            componentList: compList.map(function(d) { return {des: d, name: ''}; }),
            netList: Object.fromEntries(nets)
        };
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (e) {}

        try {
            var result = await (eda.sys_IFrame as any).openIFrame(
                '/iframe/result.html', 550, 500, 'netlist-result',
                { title: '局部网表分析' }
            );
            if (result) shown = true;
            console.log('[NETLIST] IFrame: ' + result);
        } catch (e) {
            console.log('[NETLIST] IFrame error: ' + (e && (e as any).message));
        }

        // 5b. 纯文本弹窗兜底
        if (!shown) {
            try {
                eda.sys_Dialog.showInformationMessage(text.substring(0, 500));
                shown = true;
                console.log('[NETLIST] Dialog shown');
            } catch (e) { console.log('[NETLIST] Dialog failed'); }
        }

        // 5c. 最终保底: console 输出全部
        console.log('[NETLIST] === RESULT ===\n' + text);
        console.log('[NETLIST] done');

    } catch (e: any) {
        console.log('[NETLIST] FATAL: ' + (e && e.message));
        try { eda.sys_Dialog.showInformationMessage('出错: ' + (e && e.message)); } catch (_) {}
    }
}

function showMsg(msg: string) {
    console.log('[NETLIST] ' + msg);
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (e) {}
}
