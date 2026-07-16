'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);

    // Find Schematic1_3 tab in breadcrumb
    var tabPos = await p.evaluate(() => {
        function walk(root, depth) {
            if (depth > 10) return null;
            try {
                var t = (root.textContent || '').trim();
                if (t === 'P1.Schematic1_3' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
                }
                for (var c of (root.children || [])) {
                    var f = walk(c, depth+1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('Sch tab pos:', JSON.stringify(tabPos));
    if (tabPos) {
        await p.mouse.click(tabPos.x, tabPos.y);
        console.log('Clicked Schematic1_3');
    }
    await p.waitForTimeout(5000);

    // Recheck
    var info = await p.evaluate(() => {
        return {
            hasEda: typeof window.eda !== 'undefined',
            schKeys: typeof window.eda !== 'undefined' ? Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).slice(0, 5) : null,
            loading: document.querySelectorAll('[class*=eda-loading]').length,
            activeTab: (function () {
                var t = document.querySelector('[class*=tab-active]');
                return t ? t.textContent.substring(0, 30) : 'none';
            })()
        };
    });
    console.log('After 5s:', JSON.stringify(info));

    // Wait more
    for (var t = 0; t < 30; t++) {
        await p.waitForTimeout(1000);
        var probe = await p.evaluate(() => {
            if (typeof window.eda === 'undefined') return { hasEda: false };
            return {
                hasEda: true,
                schSelectControl: !!(window.eda.sch_SelectControl),
                schManufactureData: !!(window.eda.sch_ManufactureData),
                schKeys: Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).length,
                loading: document.querySelectorAll('[class*=eda-loading]').length
            };
        });
        if (probe.schSelectControl && probe.schManufactureData) {
            console.log('  t=' + t + 's, EDA READY:', JSON.stringify(probe));
            break;
        }
        if (t % 5 === 0) console.log('  t=' + t + 's:', JSON.stringify(probe));
    }
    await b.close();
})();
