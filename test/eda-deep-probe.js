'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    // Wait 30s
    console.log('Wait 30s for EDA to fully init...');
    await p.waitForTimeout(30000);

    var frames = p.frames();
    console.log('Frames:', frames.length);
    for (var i = 0; i < frames.length; i++) {
        var u = frames[i].url();
        console.log('  ['+i+']', u.substring(0, 100));
    }

    // For each frame, try to detect EDA
    for (var i = 0; i < frames.length; i++) {
        try {
            var info = await frames[i].evaluate(function () {
                return {
                    hasEda: typeof window.eda !== 'undefined',
                    hasSch: typeof (window.eda && window.eda.sch_SelectControl) !== 'undefined',
                    location: window.location.href.substring(0, 60),
                    keys: typeof window.eda !== 'undefined' ? Object.keys(window.eda).filter(function(k){return k.indexOf('sch')===0 || k.indexOf('sys')===0;}).slice(0, 5) : []
                };
            });
            console.log('  Frame['+i+']:', JSON.stringify(info));
        } catch (e) { console.log('  Frame['+i+'] err:', e.message.substring(0, 80)); }
    }

    // Check main frame direct
    var mainInfo = await p.evaluate(function () {
        return {
            hasEda: typeof window.eda !== 'undefined',
            // look for iframe in DOM
            iframeCount: document.querySelectorAll('iframe').length,
            iframeSrcs: Array.from(document.querySelectorAll('iframe')).map(function(f){return (f.src || '').substring(0, 50);})
        };
    });
    console.log('Main:', JSON.stringify(mainInfo));

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/w3-deep-probe.png' });
    await b.close();
})();
