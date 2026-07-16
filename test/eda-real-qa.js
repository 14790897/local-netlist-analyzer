'use strict';
/**
 * Real end-to-end: send a question to the existing AI chat
 * and verify the answer comes back.
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
    if (!p) { console.log('NO PAGE'); await b.close(); return; }

    // Find AI chat frame
    var frames = p.frames();
    var chat = null;
    for (var f of frames) {
        try {
            var t = await f.title();
            if (t && t.indexOf('AI') >= 0 && t.indexOf('电路') >= 0) { chat = f; break; }
        } catch (e) {}
    }
    if (!chat) { console.log('NO CHAT'); await b.close(); return; }
    console.log('AI chat found:', await chat.title());

    // Type and send a question
    var question = '电路中有哪些电源网络?简单说明。';
    console.log('\nSending question:', question);
    await chat.fill('textarea', question);
    await p.waitForTimeout(500);
    await chat.evaluate(() => {
        var btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').indexOf('发送') >= 0);
        if (btn) btn.click();
    });
    console.log('Clicked send');

    // Wait for response
    var start = Date.now();
    var lastLen = 0, stableRounds = 0;
    while (Date.now() - start < 60000) {
        await p.waitForTimeout(1500);
        try {
            var info = await chat.evaluate(() => ({
                len: document.body.innerText.length,
                isSending: typeof isSending !== 'undefined' ? isSending : null,
                hasError: !!document.querySelector('.error-msg')
            }));
            if (info.len !== lastLen) {
                console.log('   t=' + Math.floor((Date.now() - start) / 1000) + 's, len=' + info.len + ', sending=' + info.isSending + ', err=' + info.hasError);
                lastLen = info.len; stableRounds = 0;
            } else stableRounds++;
            if (info.isSending === false && stableRounds >= 4) { console.log('Done after', Math.floor((Date.now() - start) / 1000), 's'); break; }
        } catch (e) {}
    }

    var finalText = await chat.evaluate(() => document.body.innerText);
    console.log('\nFinal len:', finalText.length);
    fs.writeFileSync(path.join(SHOT, 'z2-final-qa.txt'), finalText, 'utf-8');
    await p.screenshot({ path: path.join(SHOT, 'z2-final-qa.png') });
    console.log('Saved z2-final-qa.txt + .png');

    // Also screenshot the chat frame area
    try {
        // Find chat frame bounding box via evaluate
        var box = await chat.evaluate(() => {
            var r = document.body.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        // Get parent page position of chat frame
        var parentBox = await p.evaluate(() => {
            var iframes = document.querySelectorAll('iframe');
            for (var i = 0; i < iframes.length; i++) {
                try {
                    var src = iframes[i].src || '';
                    if (src.indexOf('blob:') >= 0) {
                        var r = iframes[i].getBoundingClientRect();
                        if (r.width > 100) return { x: r.x, y: r.y, w: r.width, h: r.height };
                    }
                } catch (e) {}
            }
            return null;
        });
        if (parentBox) {
            await p.screenshot({
                path: path.join(SHOT, 'z3-chat-clip.png'),
                clip: parentBox
            });
            console.log('Saved z3-chat-clip.png (clip of chat area)');
        }
    } catch (e) { console.log('clip err:', e.message); }

    await b.close();
})();
