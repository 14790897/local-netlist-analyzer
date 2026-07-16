'use strict';
/**
 * Wait up to 120s for the U3 response
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT_DIR = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var frames = p.frames();
    var chatFrame = null;
    for (var i = 0; i < frames.length; i++) {
        try {
            var title = await frames[i].title();
            if (title && title.indexOf('AI') >= 0 && title.indexOf('电路') >= 0) {
                chatFrame = frames[i];
                break;
            }
        } catch (e) {}
    }
    if (!chatFrame) { console.log('NO AI'); await b.close(); return; }

    console.log('Wait up to 120s for response...');
    var lastLen = 0;
    var stableRounds = 0;
    for (var t = 0; t < 120; t++) {
        await p.waitForTimeout(1000);
        try {
            var cur = await chatFrame.evaluate(function () { return document.body.innerText.length; });
            if (cur !== lastLen) { lastLen = cur; stableRounds = 0; console.log('   t=' + t + 's, len=' + cur); }
            else { stableRounds++; if (stableRounds >= 10) { console.log('Stable after', t, 's'); break; } }
        } catch (e) {}
    }

    var finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('Final len:', finalText.length);
    fs.writeFileSync(path.join(SHOT_DIR, 'q3-u3-v2.txt'), finalText, 'utf-8');
    await p.screenshot({ path: path.join(SHOT_DIR, 'q3-u3-v2.png') });
    console.log('Saved');
    await b.close();
})();
