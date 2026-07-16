'use strict';
/**
 * Check chat frame console logs and network state
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

    // Check state
    var state = await chatFrame.evaluate(function () {
        return {
            textarea: document.getElementById('userInput') ? document.getElementById('userInput').value : 'NULL',
            sendBtnDisabled: document.getElementById('sendBtn') ? document.getElementById('sendBtn').disabled : 'NULL',
            typing: document.querySelector('.typing') ? document.querySelector('.typing').textContent : 'NONE',
            isSending: typeof isSending !== 'undefined' ? isSending : 'undef',
            cfg: typeof cfg !== 'undefined' ? { endpoint: cfg.endpoint, hasKey: !!cfg.key, model: cfg.model } : 'undef',
            historyLen: typeof history !== 'undefined' ? history.length : 'undef',
            lastHistory: typeof history !== 'undefined' && history.length > 0 ? (function () { try { return JSON.stringify(history[history.length - 1] || {}).substring(0, 200); } catch (e) { return 'err:' + e.message; } })() : ''
        };
    });
    console.log('CHAT STATE:', JSON.stringify(state, null, 2));

    // Try clicking send again (perhaps it was stuck)
    console.log('\n--- Try sending again with shorter question ---');
    await chatFrame.fill('textarea', '简单回答:U3 是不是 LDO?');
    await p.waitForTimeout(500);
    await chatFrame.click('button:has-text("发送")', { timeout: 5000 });
    console.log('Clicked');

    // Wait 90s
    var lastLen = 0;
    for (var t = 0; t < 90; t++) {
        await p.waitForTimeout(1000);
        try {
            var cur = await chatFrame.evaluate(function () { return document.body.innerText.length; });
            if (cur !== lastLen) { lastLen = cur; console.log('   t=' + t + 's, len=' + cur); }
            if (t > 60 && lastLen === cur) break;
        } catch (e) {}
    }

    var finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('Final len:', finalText.length);
    fs.writeFileSync(path.join(SHOT_DIR, 'q4-ldo-test.txt'), finalText, 'utf-8');
    await p.screenshot({ path: path.join(SHOT_DIR, 'q4-ldo-test.png') });
    await b.close();
})();
