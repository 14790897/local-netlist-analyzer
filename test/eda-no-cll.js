'use strict';
/**
 * Try navigating to project WITHOUT cll=debug to see if EDA APIs come back
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Get current URL
    var current = p.url();
    console.log('Current URL:', current);

    // Try opening NEW tab with same project but no cll=debug
    var newUrl = current.replace('cll=debug', '');
    console.log('New URL:', newUrl);

    // Open in new tab (don't navigate current)
    var newPage = await b.contexts()[0].newPage();
    await newPage.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await newPage.waitForTimeout(15000);
    console.log('New page title:', await newPage.title());

    // Check eda
    var info = await newPage.evaluate(() => {
        return {
            hasEda: typeof window.eda !== 'undefined',
            edaKeys: typeof window.eda !== 'undefined' ? Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).slice(0, 5) : null
        };
    });
    console.log('New page eda:', JSON.stringify(info));

    // Check sch frame
    var frames = newPage.frames();
    console.log('Frames:', frames.length);
    for (var f of frames) {
        try {
            var has = await f.evaluate(() => !!(window.eda && window.eda.sch_SelectControl));
            if (has) console.log('  EDA in', f.url().substring(0, 60));
        } catch (e) {}
    }

    await b.close();
})();
