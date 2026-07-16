'use strict';
/**
 * Reload project tab and wait for EDA sch API
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('Reloading project tab...');
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Wait for EDA sch API...');
    for (var t = 0; t < 60; t++) {
        await p.waitForTimeout(1000);
        var found = false;
        var frames = p.frames();
        for (var i = 0; i < frames.length; i++) {
            try {
                var has = await frames[i].evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
                if (has) { found = true; console.log('  t=' + t + 's, EDA in frame['+i+']'); break; }
            } catch (e) {}
        }
        if (found) break;
        if (t % 10 === 9) console.log('  t=' + (t+1) + 's, still waiting...');
    }
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/x5-reload-wait.png' });
    console.log('Final state saved to x5-reload-wait.png');
    await b.close();
})();
