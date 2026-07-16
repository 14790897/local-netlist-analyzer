'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('Wait 60s for EDA sch API to inject...');
    for (var t = 0; t < 60; t++) {
        await p.waitForTimeout(1000);
        if (t % 10 === 9) {
            var found = null;
            var frames = p.frames();
            for (var i = 0; i < frames.length; i++) {
                try {
                    var has = await frames[i].evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
                    if (has) { found = frames[i]; break; }
                } catch (e) {}
            }
            console.log('  t=' + (t+1) + 's, frames=' + frames.length + ', EDA sch ' + (found ? 'FOUND' : 'not found'));
            if (found) break;
        }
    }
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/x4-after-wait.png' });
    await b.close();
})();
