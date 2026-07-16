'use strict';
/**
 * Click on Schematic1_3 tab to re-trigger sch API injection
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Click on Schematic1_3 tab to re-activate
    var tabPos = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10) return null;
            try {
                var t = (root.textContent || '').trim();
                if (t === 'P1.Schematic1_3' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var f = walk(c[i], depth + 1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('Schematic tab:', JSON.stringify(tabPos));
    if (tabPos) {
        await p.mouse.click(tabPos.x, tabPos.y);
        console.log('Clicked');
    }
    await p.waitForTimeout(3000);

    // Now check EDA
    var schFrame = null;
    for (var f of p.frames()) {
        try {
            var has = await f.evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
            if (has) { schFrame = f; console.log('EDA found in', f.url().substring(0, 60)); break; }
        } catch (e) {}
    }
    if (!schFrame) console.log('Still no EDA sch');

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/click-tab.png' });
    await b.close();
})();
