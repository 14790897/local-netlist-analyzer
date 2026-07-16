'use strict';
/**
 * Reconnect and find EDA sch frame
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    // List all frames
    var frames = p.frames();
    console.log('  Frames:', frames.length);
    for (var i = 0; i < frames.length; i++) {
        var u = frames[i].url();
        console.log('  ['+i+']', u.substring(0, 100));
    }

    // Check main frame for EDA
    var mainHas = await p.evaluate(function () {
        return { hasEda: typeof window.eda !== 'undefined', keys: typeof window.eda !== 'undefined' ? Object.keys(window.eda).filter(function(k){return k.indexOf('sch')===0;}).slice(0,5) : [] };
    });
    console.log('  Main EDA:', JSON.stringify(mainHas));

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/w1-current.png' });
    await b.close();
})();
