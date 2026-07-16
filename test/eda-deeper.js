'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var frames = p.frames();
    console.log('Frames:', frames.length);
    for (var i = 0; i < frames.length; i++) {
        var u = frames[i].url();
        console.log('  ['+i+']', u.substring(0, 100));
    }

    // For each, try various checks
    for (var i = 0; i < frames.length; i++) {
        try {
            var info = await frames[i].evaluate(function () {
                var res = { hasEda: false, hasSchSelect: false, hasSchManu: false, hasExt: false, keys: [] };
                try {
                    res.hasEda = typeof window.eda !== 'undefined';
                    if (res.hasEda) {
                        res.hasSchSelect = !!(window.eda.sch_SelectControl);
                        res.hasSchManu = !!(window.eda.sch_ManufactureData);
                        res.keys = Object.keys(window.eda).filter(function(k){return k.indexOf('sch')===0 || k.indexOf('sys')===0;}).slice(0, 5);
                    }
                    res.hasExt = !!document.querySelector('extension-host, eda-extension');
                } catch (e) { res.err = e.message; }
                return res;
            });
            console.log('  Frame['+i+']:', JSON.stringify(info));
        } catch (e) { console.log('  Frame['+i+'] err:', e.message.substring(0, 80)); }
    }

    // Main check
    var main = await p.evaluate(function () {
        return {
            hasEda: typeof window.eda !== 'undefined',
            docTitle: document.title,
            edaRoot: typeof window.eda !== 'undefined' ? 'has eda' : 'no eda',
            // Look for shadow DOM
            hasShadow: !!document.querySelector('*[/shadow], [shadowroot]')
        };
    });
    console.log('Main:', JSON.stringify(main));

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/x3-back.png' });
    await b.close();
})();
