'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);
    var chat = p.frames().find(f => f.title && f.title().then ? null : null);
    // Use await
    var chat = null;
    for (var f of p.frames()) {
        try {
            var t = await f.title();
            if (t && t.indexOf('AI') >= 0 && t.indexOf('电路') >= 0) { chat = f; break; }
        } catch (e) {}
    }
    if (!chat) { console.log('NO CHAT'); await b.close(); return; }

    // Probe all globals
    var probe = await chat.evaluate(() => {
        return {
            historyLen: typeof history !== 'undefined' ? history.length : null,
            historyMessages: (function () { try { var h = history || []; return Array.from(h).map(function (m) { return { role: m ? m.role : 'undef', len: m && m.content ? m.content.length : 0 }; }); } catch (e) { return 'err'; } })(),
            isSending: typeof isSending !== 'undefined' ? isSending : null,
            sendBtnDisabled: document.getElementById('sendBtn') ? document.getElementById('sendBtn').disabled : null,
            cfg: typeof cfg !== 'undefined' ? { hasKey: !!cfg.key, model: cfg.model, endpoint: cfg.endpoint } : null,
            // Try test fetch from inside chat
            testFetch: 'skipped'
        };
    });
    console.log('Probe:', JSON.stringify(probe, null, 2));

    // Now try a real fetch from inside the chat
    var fetchResult = await chat.evaluate(async () => {
        try {
            var cfg = window.cfg;
            if (!cfg || !cfg.key) return 'no cfg';
            var endpoint = cfg.endpoint.replace(/\/+$/, '') + '/chat/completions';
            var start = Date.now();
            var r = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
                body: JSON.stringify({
                    model: cfg.model,
                    messages: [{ role: 'user', content: '测试' }],
                    max_tokens: 100
                })
            });
            var t = await r.text();
            return 'OK in ' + (Date.now() - start) + 'ms, status=' + r.status + ', body=' + t.substring(0, 200);
        } catch (e) { return 'err: ' + e.message; }
    });
    console.log('Test fetch from inside chat:', fetchResult);

    await b.close();
})();
