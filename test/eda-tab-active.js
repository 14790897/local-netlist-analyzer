'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // First check current tab state
    var beforeState = await p.evaluate(() => {
        return {
            hasEda: typeof window.eda !== 'undefined',
            hasSch: typeof (window.eda && window.eda.sch_SelectControl) !== 'undefined',
            activeTab: (function () {
                var t = document.querySelector('[class*=active]');
                return t ? t.textContent.substring(0, 30) : 'none';
            })(),
            // Find Schematic1_3 tab
            schTab: (function () {
                function walk(root, depth) {
                    if (depth > 10) return null;
                    var t = (root.textContent || '').trim();
                    if (t === 'P1.Schematic1_3' && root.children.length < 3) {
                        var r = root.getBoundingClientRect();
                        if (r.width > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
                    }
                    for (var c of (root.children || [])) {
                        var f = walk(c, depth+1);
                        if (f) return f;
                    }
                    return null;
                }
                return walk(document.body, 0);
            })()
        };
    });
    console.log('Before:', JSON.stringify(beforeState));

    // Click Schematic1_3 tab
    if (beforeState.schTab) {
        await p.mouse.click(beforeState.schTab.x, beforeState.schTab.y);
        console.log('Clicked Schematic1_3');
    }
    await p.waitForTimeout(5000);

    // Check after
    var afterState = await p.evaluate(() => {
        return {
            hasEda: typeof window.eda !== 'undefined',
            hasSch: typeof (window.eda && window.eda.sch_SelectControl) !== 'undefined',
            activeTab: (function () {
                var t = document.querySelector('[class*=active]');
                return t ? t.textContent.substring(0, 30) : 'none';
            })()
        };
    });
    console.log('After 5s:', JSON.stringify(afterState));

    await p.waitForTimeout(5000);
    var afterState2 = await p.evaluate(() => {
        return {
            hasSch: typeof (window.eda && window.eda.sch_SelectControl) !== 'undefined'
        };
    });
    console.log('After 10s total:', JSON.stringify(afterState2));

    // Take a screenshot
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/sch-active.png' });

    await b.close();
})();
