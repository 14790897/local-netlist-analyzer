'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function () {
    try {
        var b = await chromium.connectOverCDP('http://localhost:9224');
        var ctx = b.contexts()[0];
        var pages = ctx.pages();
        console.log('PAGES:', pages.length);
        for (var i = 0; i < pages.length; i++) {
            var u = pages[i].url();
            var t = await pages[i].title().catch(function(){return '?';});
            console.log('  ['+i+']', t, '|', u.substring(0, 100));
        }
        var p = pages[0];
        var has = await p.evaluate(function() {
            return { hasEda: typeof window.eda !== 'undefined', hasSelection: typeof (eda && eda.sch_SelectControl) !== 'undefined' };
        });
        console.log('EDA:', JSON.stringify(has));
        await b.close();
    } catch (e) { console.log('ERR:', e.message); }
})();
