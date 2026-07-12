/**
 * v1.0.11 — ultimate fallback: try ALL EDA notification APIs
 */
var log: any = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function(){};
log('[NL] v1.0.11 loaded');

function show(msg: string) {
    // Try every possible EDA notification API
    var apis = [
        function() { (eda.sys_ToastMessage as any).showToastMessage(msg); },
        function() { (eda.sys_ToastMessage as any).show(msg); },
        function() { (eda.sys_Dialog as any).showInformationMessage(msg); },
        function() { (eda.sys_Dialog as any).showWarningMessage(msg); },
        function() { (eda.sys_Dialog as any).info(msg); },
        function() { (eda.sys_Dialog as any).warn(msg); },
        function() { (eda.sys_Dialog as any).show(msg); },
        function() { (eda.sys_Message as any).showToastMessage(msg); },
        function() { (eda.sys_Message as any).show(msg); },
    ];
    for (var i = 0; i < apis.length; i++) { try { apis[i](); log('[NL] show via api#' + i); return; } catch (_) {} }
    log('[NL] ALL show APIs failed');
}

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        log('[NL] start');

        // 1. 选中
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await (eda.sch_SelectControl as any).getSelectedPrimitives_PrimitiveId(); } catch (_) {}
        log('[NL] ids=' + (ids ? ids.length : 0));

        if (!ids || !ids.length) { show('请先在原理图中框选需要分析的元件'); return; }

        // 2. 网表
        log('[NL] getNetlist...');
        var nl: any = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (_) {}
        log('[NL] nl: ' + typeof nl + (typeof nl === 'string' ? ' ' + nl.length + 'c' : ''));

        if (!nl) { show('无法获取网表，请保存原理图'); return; }

        // 3. 解析 .enet JSON or text
        var nets: Record<string, {des: string; pin: string}[]> = {};
        var comps = new Set<string>();
        var data: any = nl;

        if (typeof nl === 'string') {
            try { data = JSON.parse(nl); log('[NL] JSON ' + Object.keys(data).length + 'k'); } catch (_) {
                log('[NL] text fallback');
                nl.split('\n').forEach(function(line: string) {
                    var t = line.trim();
                    if (!t.startsWith('(') || !t.endsWith(')')) return;
                    var parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
                    if (parts.length < 2) return;
                    var netName = parts[0]; if (!nets[netName]) nets[netName] = [];
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
        try {
            await (eda.sys_IFrame as any).openIFrame('/iframe/result.html', 550, 500, undefined, { title: '局部网表' });
            log('[NL] IFrame ok');
        } catch (e) {
            log('[NL] IFrame fail');
            // Fallback: build text message
            var text = comps.size + ' 元件, ' + Object.keys(nets).length + ' 网络\n';
            Array.from(comps).sort().slice(0, 15).forEach(function(d) { text += d + ' '; });
            if (comps.size > 15) text += '...';
            show(text);
        }

        log('[NL] done');
    } catch (e) { log('[NL] FATAL'); show('分析出错'); }
}
