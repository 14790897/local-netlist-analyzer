/**
 * v1.0.11 — .enet JSON + safe API wrappers + full logging
 */
var log: any = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function(){};
log('[NL] v1.0.11 loaded');

function warn(msg: string) {
    try { var d = eda.sys_Dialog as any; if (d && d.showWarningMessage) d.showWarningMessage(msg); else if (d && d.showInformationMessage) d.showInformationMessage(msg); } catch (_) {}
}
function info(msg: string) {
    try { var d = eda.sys_Dialog as any; if (d && d.showInformationMessage) d.showInformationMessage(msg); } catch (_) {}
}

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        log('[NL] === start ===');

        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); log('[NL] BETA: ' + ids.length); } catch (e) { log('[NL] BETA err'); }
        if (!ids || !ids.length) { try { ids = await (eda.sch_SelectControl as any).getSelectedPrimitives_PrimitiveId(); log('[NL] deprecated: ' + ids.length); } catch (e) { log('[NL] dep err'); } }

        if (!ids || !ids.length) { log('[NL] no sel'); warn('请先在原理图中框选需要分析的元件'); return; }
        log('[NL] sel=' + ids.length);

        // 2. 网表
        log('[NL] getNetlist...');
        var nl: any = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) { log('[NL] nl err: ' + e); }
        log('[NL] nl: ' + typeof nl + (typeof nl === 'string' ? ' len=' + nl.length : ''));
        if (!nl) { warn('无法获取网表'); return; }

        // 3. 解析
        log('[NL] parse...');
        var nets: Record<string, {des: string; pin: string}[]> = {};
        var comps = new Set<string>();
        var data: any = nl;

        if (typeof nl === 'string') {
            try { data = JSON.parse(nl); log('[NL] JSON keys=' + Object.keys(data).length); } catch (_) {
                log('[NL] text fallback');
                nl.split('\n').forEach(function(line: string) {
                    var t = line.trim();
                    if (!t.startsWith('(') || !t.endsWith(')')) return;
                    var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
                    if (parts.length < 2) return;
                    var netName = parts[0];
                    if (!nets[netName]) nets[netName] = [];
                    for (var m = 1; m < parts.length; m++) {
                        var ref = parts[m], dash = ref.indexOf('-');
                        nets[netName].push({des: dash > 0 ? ref.substring(0, dash) : ref, pin: dash > 0 ? ref.substring(dash + 1) : '?'});
                        comps.add(dash > 0 ? ref.substring(0, dash) : ref);
                    }
                });
            }
        }

        if (data && typeof data === 'object' && !Array.isArray(data)) {
            Object.keys(data).forEach(function(des) {
                var c = data[des]; if (!c) return;
                var props = c.props || c;
                var desig = props.Designator || props.designator || des;
                var pins = c.pins || {};
                comps.add(desig);
                Object.keys(pins).forEach(function(p) {
                    var n = pins[p]; if (!n || typeof n !== 'string') return;
                    if (!nets[n]) nets[n] = [];
                    nets[n].push({des: desig, pin: p});
                });
            });
        }

        log('[NL] ' + comps.size + 'c ' + Object.keys(nets).length + 'n');

        // 4. IFrame
        var payload = { selectedCount: ids.length, components: comps.size, nets: Object.keys(nets).length,
            componentList: Array.from(comps).sort().map(function(d) { return {des: d, name: ''}; }), netList: nets };
        try { sessionStorage.setItem('__netlist_result', JSON.stringify(payload)); } catch (_) {}

        log('[NL] IFrame...');
        try { await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' }); log('[NL] IFrame ok'); } catch (e) {
            log('[NL] IFrame err: ' + e);
            info(comps.size + ' 元件, ' + Object.keys(nets).length + ' 网络');
        }

        log('[NL] === done ===');
    } catch (e) { log('[NL] FATAL: ' + e); warn('出错'); }
}
