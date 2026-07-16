'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Check main frame for EDA
    var info = await p.evaluate(function () {
        // Try various detection methods
        var checks = {
            windowEda: typeof window.eda,
            windowEdaProto: typeof window.EDA,
            iframeCount: document.querySelectorAll('iframe').length,
            shadowRootCount: document.querySelectorAll('*').length,
            // Look for global vars related to EDA
            globalEda: Object.keys(window).filter(function(k){ return k.toLowerCase().indexOf('eda') === 0; }).slice(0, 5)
        };
        return checks;
    });
    console.log('Checks:', JSON.stringify(info, null, 2));

    // Find any frame with EDA anywhere
    var allFrames = p.frames();
    for (var i = 0; i < allFrames.length; i++) {
        try {
            var has = await allFrames[i].evaluate(function () {
                var found = false;
                try {
                    if (window.eda) found = true;
                } catch (e) {}
                return found;
            });
            if (has) console.log('  Frame['+i+'] has eda');
        } catch (e) {}
    }
    console.log('Total frames:', allFrames.length);

    // Try clicking on canvas to trigger
    var canvas = p.locator('canvas').first();
    var box = await canvas.boundingBox();
    if (box) {
        console.log('Canvas box:', JSON.stringify(box));
        await p.mouse.move(box.x + box.width/2, box.y + box.height/2);
        await p.waitForTimeout(2000);
    }

    // Re-check after click
    var afterClick = await p.evaluate(function () {
        return { windowEda: typeof window.eda, globalEda: Object.keys(window).filter(function(k){ return k.toLowerCase().indexOf('eda') === 0; }).slice(0, 5) };
    });
    console.log('After canvas click:', JSON.stringify(afterClick));

    await b.close();
})();
