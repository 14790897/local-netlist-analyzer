'use strict';
/**
 * Force F5 on the no-cll-debug tab and wait for EDA ready
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);

    console.log('F5 the no-cll-debug tab...');
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Reloaded, waiting 30s for EDA...');

    for (var t = 0; t < 30; t++) {
        await p.waitForTimeout(1000);
        var probe = await p.evaluate(() => ({
            hasEda: typeof window.eda !== 'undefined',
            schKeys: typeof window.eda !== 'undefined' ? Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).length : 0,
            loading: document.querySelectorAll('[class*=eda-loading]').length
        }));
        if (probe.schKeys > 0) {
            console.log('  t=' + t + 's, EDA READY:', JSON.stringify(probe));
            break;
        }
        if (t % 5 === 4) console.log('  t=' + (t+1) + 's:', JSON.stringify(probe));
    }
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/post-f5.png' });
    await b.close();
})();
