/**
 * v1.0.20 — use EDA dialog as first output (not console)
 */
try { eda.sys_Dialog.showInformationMessage('[NL] v1.0.20 loaded'); } catch (_) {}

export function activate(): void {}

export async function analyzeSelection(): Promise<void> {
    try {
        var ids: string[] = [];
        try { ids = await (eda.sch_SelectControl as any).getAllSelectedPrimitives_PrimitiveId(); } catch (_) {}
        if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (_) {}

        if (!ids || !ids.length) {
            eda.sys_Dialog.showInformationMessage('请先在原理图中框选需要分析的元件');
            return;
        }

        var nl: any = '';
        try { nl = await eda.sch_Netlist.getNetlist('JLCEDA' as any); } catch (e) {}
        if (!nl || (typeof nl === 'string' && !nl.trim())) {
            try { nl = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch (e) {}
        }

        var nets: Record<string, string[]> = {};
        var comps = new Set<string>();
        var REFPIN = /([A-Za-z]+\d+)-(\d+)/g;

        if (typeof nl === 'string' && nl.length > 40) {
            var lines = nl.split('\n');
            for (var li = 0; li < lines.length; li++) {
                var t = lines[li].trim();
                if (t.startsWith('NET:')) {
                    var netName = t.substring(4).trim();
                    if (!nets[netName]) nets[netName] = [];
                    for (var nj = li + 1; nj < lines.length; nj++) {
                        var sub = lines[nj].trim();
                        if (sub.startsWith('NET:') || sub === '') break;
                        if (sub.indexOf('-') > 0) { nets[netName].push(sub); comps.add(sub.substring(0, sub.indexOf('-'))); }
                    }
                }
            }
            if (comps.size === 0) {
                var allHits: {des: string; pin: string; line: number}[] = [];
                for (var lk = 0; lk < lines.length; lk++) {
                    REFPIN.lastIndex = 0; var m;
                    while ((m = REFPIN.exec(lines[lk])) !== null) { allHits.push({des: m[1], pin: m[2], line: lk}); comps.add(m[1]); }
                }
                if (allHits.length > 0) {
                    var currentNet = '_NET1'; var lastLine = -2;
                    for (var hi = 0; hi < allHits.length; hi++) {
                        if (allHits[hi].line - lastLine > 1) currentNet = '_NET' + (Object.keys(nets).length + 1);
                        if (!nets[currentNet]) nets[currentNet] = [];
                        nets[currentNet].push(allHits[hi].des + '-' + allHits[hi].pin);
                        lastLine = allHits[hi].line;
                    }
                }
            }
        }

        eda.sys_Dialog.showInformationMessage(ids.length + '选中 ' + comps.size + '元件 ' + Object.keys(nets).length + '网络');
    } catch (e) {
        eda.sys_Dialog.showInformationMessage('分析出错: ' + (e && (e as any).message || String(e)));
    }
}
