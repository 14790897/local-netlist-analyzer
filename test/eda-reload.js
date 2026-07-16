'use strict';
/**
 * Reload JLCEDA page to recover EDA state
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('Reloading...');
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Reloaded, waiting 20s for EDA init...');
    await p.waitForTimeout(20000);
    console.log('PAGE:', await p.title());

    // Find EDA sch frame
    var frames = p.frames();
    console.log('Frames:', frames.length);
    var schFound = null;
    for (var i = 0; i < frames.length; i++) {
        try {
            var has = await frames[i].evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
            if (has) { schFound = frames[i]; console.log('  EDA in frame['+i+']:', frames[i].url().substring(0, 80)); break; }
        } catch (e) {}
    }
    if (!schFound) {
        console.log('  Main frame check:');
        var m = await p.evaluate(function () { return { hasEda: typeof window.eda !== 'undefined' }; });
        console.log('  ', JSON.stringify(m));
    }
    await b.close();
})();
