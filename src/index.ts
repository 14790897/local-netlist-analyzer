/**
 * v1.0.11 — .enet JSON parsing + full logging
 */
var log: any = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function(){};
log('[NL] v1.0.11 loaded');

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        log('[NL] === start ===');

        // 1. 选中
        var ids: string[] = [];
        try {
            ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId();
            log('[NL] BETA API got ' + ids.length + ' ids');
        } catch (e) { log('[NL] BETA API error: ' + e); }

        if (!ids || !ids.length) {
            try {
                ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
                log('[NL] deprecated API got ' + ids.length + ' ids');
            } catch (e) { log('[NL] deprecated API error: ' + e); }
        }

        if (!ids || !ids.length) {
            log('[NL] no selection → show warning');
            eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件');
            return;
        }
        log('[NL] selected: ' + ids.length);

        // 2. 网表
        log('[NL] getNetlist JLCEDA...');
        var nl: any = '';
        try {
            nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any);
            log('[NL] netlist type: ' + typeof nl + ', string?' + (typeof nl === 'string') + ', len=' + (typeof nl === 'string' ? nl.length : 'N/A'));
        } catch (e) {
            log('[NL] JLCEDA netlist error: ' + e);
        }

        if (!nl) {
            log('[NL] empty netlist → show warning');
            eda.sys_Dialog.showWarningMessage('无法获取网表，请保存原理图');
            return;
        }

        // 3. 解析
        log('[NL] parsing...');
        var nets: Record<string, {des: string; pin: string}[]> = {};
        var comps = new Set<string>();

        // Parse JSON .enet
        var data: any = nl;
        if (typeof nl === 'string') {
            try { data = JSON.parse(nl); log('[NL] JSON parsed, keys=' + Object.keys(data).length); } catch (_) {
                log('[NL] not JSON, trying text format');
                // Text fallback
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

        if (data && typeof data === 'object' && !Array.isArray(data)) {
            log('[NL] parsing .enet JSON...');
            Object.keys(data).forEach(function(des) {
                var c = data[des];
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

        log('[NL] result: ' + comps.size + ' comps, ' + Object.keys(nets).length + ' nets');

        // 4. 构建
        var compList = Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; });
        var payload = {
            selectedCount: ids.length,
            components: compList.length,
            nets: Object.keys(nets).length,
            componentList: compList,
            netList: nets
        };

        // 5. 输出
        log('[NL] saving sessionStorage...');
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (_) {}

        log('[NL] opening IFrame...');
        try {
            await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' });
            log('[NL] IFrame opened');
        } catch (e) {
            log('[NL] IFrame failed: ' + e + ' → dialog fallback');
            var text = compList.length + ' 元件, ' + Object.keys(nets).length + ' 网络';
            eda.sys_Dialog.showInformationMessage(text);
        }

        log('[NL] === done ===');

    } catch (e) {
        log('[NL] FATAL: ' + e);
        eda.sys_Dialog.showWarningMessage('分析出错: ' + (e && (e as any).message || String(e)));
    }
}
