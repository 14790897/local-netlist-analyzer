'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Get all pages including workers
    var ctx = b.contexts()[0];
    var allPages = ctx.pages();
    console.log('Pages:', allPages.length);
    for (var i = 0; i < allPages.length; i++) {
        console.log('  ['+i+']', allPages[i].url().substring(0, 80), '| type:', allPages[i].constructor.name);
    }

    // Get workers
    var workers = ctx.serviceWorkers ? ctx.serviceWorkers() : [];
    console.log('Service workers:', workers.length);
    for (var i = 0; i < workers.length; i++) {
        console.log('  ['+i+']', workers[i].url().substring(0, 80));
    }

    // Try evaluate on each page
    for (var i = 0; i < allPages.length; i++) {
        try {
            var info = await allPages[i].evaluate(function () {
                var res = { hasEda: typeof window.eda !== 'undefined' };
                if (res.hasEda) {
                    res.hasSch = !!(window.eda.sch_SelectControl);
                    res.hasManu = !!(window.eda.sch_ManufactureData);
                }
                return res;
            });
            console.log('  page['+i+']:', JSON.stringify(info));
        } catch (e) { console.log('  page['+i+'] err:', e.message.substring(0, 80)); }
    }

    await b.close();
})();
