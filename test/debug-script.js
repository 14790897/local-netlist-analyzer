// 独立调试脚本 v1.0.27 — 使用新 API sch_ManufactureData.getNetlistFile()
// 在嘉立创 EDA 控制台粘贴运行
(async function() {
    try {
        console.log('=== 1. 选中检测 ===');
        var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
        console.log('ids=' + ids.length);

        console.log('=== 2. 获取网表 (新API) ===');
        var file = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
        var nl = '';
        if (file) {
            nl = typeof file.text === 'function' ? await file.text() : String(file);
        }
        console.log('type=' + typeof nl);
        var raw = typeof nl === 'string' ? nl : JSON.stringify(nl);
        console.log('RAW(' + raw.length + 'c): ' + raw.substring(0, 500));

        console.log('=== 3. 格式检测 ===');
        var nets = {};
        var comps = new Set();
        var done = 0;

        // JSON .enet
        if (typeof nl === 'string') {
            try {
                var j = JSON.parse(nl);
                if (j && typeof j === 'object') {
                    Object.keys(j).forEach(function(d) {
                        var c = j[d]; if (!c || typeof c !== 'object') return;
                        comps.add((c.props && c.props.Designator) || d);
                        var pins = c.pins || {};
                        Object.keys(pins).forEach(function(p) {
                            var v = pins[p]; if (typeof v !== 'string') return;
                            if (!nets[v]) nets[v] = [];
                            nets[v].push(((c.props && c.props.Designator) || d) + '-' + p);
                        });
                    });
                    done = 1; console.log('MATCH: enet-JSON');
                }
            } catch(e) { console.log('JSON parse fail: ' + e.message); }
        }

        // Text format
        if (!done && typeof nl === 'string') {
            var found = false;
            nl.split('\n').forEach(function(l) {
                var t = l.trim();
                if (t.startsWith('(') && t.endsWith(')')) {
                    var a = t.slice(1,-1).split(/\s+/).filter(Boolean);
                    if (a.length >= 2) {
                        if (!nets[a[0]]) nets[a[0]] = [];
                        for (var i = 1; i < a.length; i++) {
                            var r = a[i], d = r.indexOf('-');
                            nets[a[0]].push(r);
                            comps.add(d > 0 ? r.substring(0, d) : r);
                        }
                        found = true;
                    }
                }
            });
            if (found) { done = 2; console.log('MATCH: text'); }
        }

        // Object with props/pins
        if (!done && nl && typeof nl === 'object') {
            var keys = Object.keys(nl);
            var sample = nl[keys[0]];
            if (sample && typeof sample === 'object' && (sample.props || sample.pins)) {
                keys.forEach(function(d) {
                    var c = nl[d]; if (!c) return;
                    comps.add((c.props && c.props.Designator) || d);
                    Object.keys(c.pins || {}).forEach(function(p) {
                        var v = c.pins[p]; if (!v) return;
                        if (!nets[v]) nets[v] = [];
                        nets[v].push(((c.props && c.props.Designator) || d) + '-' + p);
                    });
                });
                done = 3; console.log('MATCH: enet-obj');
            } else if (typeof sample === 'string') {
                keys.forEach(function(d) { comps.add(d); });
                done = 4; console.log('MATCH: hier-index (no nets), comps=' + keys.length);
            }
        }

        if (!done) console.log('MATCH: NONE');

        console.log('=== 4. 结果 ===');
        console.log('元件: ' + comps.size + ' | 网络: ' + Object.keys(nets).length);
        var ca = []; comps.forEach(function(d){ca.push(d)});
        console.log('元件列表: ' + ca.sort().join(', '));
        var na = Object.keys(nets); na.sort();
        na.forEach(function(n) { console.log('  ' + n + ': ' + nets[n].join(' ')); });

        var msg = ids.length + '选中 ' + comps.size + '元件 ' + Object.keys(nets).length + '网络';
        eda.sys_Dialog.showInformationMessage(msg);
        console.log('DONE');
    } catch(e) {
        console.log('ERROR: ' + e.message);
        eda.sys_Dialog.showInformationMessage('错误: ' + e.message);
    }
})();
