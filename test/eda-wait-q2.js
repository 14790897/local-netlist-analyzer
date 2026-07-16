'use strict';
/**
 * Final AI test: wait long enough for AI to answer Q2
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

    // Just wait long for the Q2 response
    console.log('Waiting for Q2 response (up to 90s)...');
    var lastLen = 0;
    var stableRounds = 0;
    var finalText = '';
    for (var t = 0; t < 90; t++) {
        await p.waitForTimeout(1000);
        try {
            var cur = await chatFrame.evaluate(function () { return document.body.innerText.length; });
            if (cur !== lastLen) { lastLen = cur; stableRounds = 0; console.log('   t=' + t + 's, len=' + cur); }
            else { stableRounds++; if (stableRounds >= 8) break; }
        } catch (e) {}
    }
    finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('Final len:', finalText.length);
    fs.writeFileSync(path.join(SHOT_DIR, 'q2-final-v2.txt'), finalText, 'utf-8');
    await p.screenshot({ path: path.join(SHOT_DIR, 'q3-final-v2.png') });
    console.log('Saved q2-final-v2.txt and q3-final-v2.png');
    await b.close();
})();
