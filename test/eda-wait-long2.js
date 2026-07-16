'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Check eda keys at intervals
    for (var t = 0; t < 60; t++) {
        var info = await p.evaluate(() => {
            if (typeof window.eda === 'undefined') return { hasEda: false };
            var schKeys = Object.keys(window.eda).filter(k => k.indexOf('sch') === 0);
            return { hasEda: true, schKeys: schKeys, allKeys: Object.keys(window.eda).length };
        });
        if (t % 5 === 0) console.log('t=' + t + 's:', JSON.stringify(info));
        if (info.schKeys && info.schKeys.length > 0) {
            console.log('  FOUND sch keys!');
            break;
        }
        await p.waitForTimeout(1000);
    }
    await b.close();
})();
