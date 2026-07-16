'use strict';
/**
 * Just wait 3 minutes for the AI response
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var ctx = b.contexts()[0];
    var pages = ctx.pages();
    var p = null;
    for (var i = 0; i < pages.length; i++) {
        if (pages[i].url().indexOf('pro.lceda.cn') >= 0 && pages[i].url().indexOf('cll=debug') < 0) {
            p = pages[i]; break;
        }
    }
    var frames = p.frames();
    var chat = null;
    for (var f of frames) {
        try {
            var t = await f.title();
            if (t && t.indexOf('AI') >= 0 && t.indexOf('电路') >= 0) { chat = f; break; }
        } catch (e) {}
    }
    if (!chat) { console.log('NO CHAT'); await b.close(); return; }

    // Wait 3 minutes, polling
    console.log('Wait up to 180s for response...');
    var start = Date.now();
    var lastLen = 0;
    for (var t = 0; t < 180; t++) {
        await p.waitForTimeout(1000);
        try {
            var info = await chat.evaluate(() => ({
                len: document.body.innerText.length,
                isSending: typeof isSending !== 'undefined' ? isSending : null,
                hasError: !!document.querySelector('.error-msg')
            }));
            if (info.len !== lastLen) {
                console.log('   t=' + t + 's, len=' + info.len + ', sending=' + info.isSending + ', err=' + info.hasError);
                lastLen = info.len;
            }
        } catch (e) {}
    }
    var finalText = await chat.evaluate(() => document.body.innerText);
    console.log('\nFinal len:', finalText.length);
    fs.writeFileSync(path.join(SHOT, 'z4-waited-3min.txt'), finalText, 'utf-8');
    await b.close();
})();
