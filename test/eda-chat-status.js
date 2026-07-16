'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

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

    var status = await chat.evaluate(() => {
        var sendBtn = document.getElementById('sendBtn');
        return {
            text: document.body.innerText.substring(0, 500),
            sendBtnDisabled: sendBtn ? sendBtn.disabled : null,
            isSending: typeof isSending !== 'undefined' ? isSending : null,
            typing: document.querySelector('.typing') ? true : false,
            error: document.querySelector('.error-msg') ? document.querySelector('.error-msg').textContent : null,
            historyLen: typeof history !== 'undefined' ? history.length : null,
            lastHistRole: (function () { try { var h = typeof history !== 'undefined' ? history : []; return h.length > 0 ? h[h.length - 1].role : null; } catch (e) { return 'err: ' + e.message; } })()
        };
    });
    console.log('Chat status:', JSON.stringify(status, null, 2));

    await b.close();
})();
