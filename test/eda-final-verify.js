'use strict';
/**
 * Comprehensive E2E test: clean chat reload, send question, wait properly
 * - Reload chat IFrame to get fresh state
 * - Send "U3 是不是 LDO" question
 * - Wait up to 60s for response (using MutationObserver-equivalent: poll innerText length)
 * - Capture screenshot
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

    // Find the LDO question (last user message) - just resend to verify
    console.log('--- Send final verification question ---');
    var question = 'Q2 是不是 PNP 三极管?';
    console.log('Question:', question);
    await chatFrame.fill('textarea', question);
    await p.waitForTimeout(800);
    await chatFrame.click('button:has-text("发送")', { timeout: 5000 });
    console.log('Clicked send at', new Date().toISOString());

    // Wait for either: response OR error OR "AI 思考中..." appears then disappears
    var startTime = Date.now();
    var maxWait = 60000;
    var lastLen = 0;
    var sawTyping = false;
    var sawFinal = false;
    var historyLen = 0;
    while (Date.now() - startTime < maxWait) {
        await p.waitForTimeout(1000);
        try {
            var info = await chatFrame.evaluate(function () {
                return {
                    len: document.body.innerText.length,
                    historyLen: typeof history !== 'undefined' ? history.length : 0,
                    isSending: typeof isSending !== 'undefined' ? isSending : null,
                    btnDisabled: document.getElementById('sendBtn') ? document.getElementById('sendBtn').disabled : null,
                    hasTyping: !!document.querySelector('.typing'),
                    hasError: !!document.querySelector('.error-msg'),
                    lastAssistant: typeof history !== 'undefined' ? (function () {
                        for (var i = history.length - 1; i >= 0; i--) {
                            if (history[i].role === 'assistant') return (history[i].content || '').substring(0, 100);
                        }
                        return null;
                    })() : null
                };
            });
            if (info.len !== lastLen) { lastLen = info.len; console.log('   t=' + Math.floor((Date.now() - startTime) / 1000) + 's, len=' + info.len + ', hist=' + info.historyLen + ', sending=' + info.isSending + ', typing=' + info.hasTyping + ', err=' + info.hasError); }
            if (info.hasTyping) sawTyping = true;
            if (info.historyLen > historyLen) { historyLen = info.historyLen; }
            // Done when not sending and (got assistant response or error)
            if (info.isSending === false && info.historyLen > historyLen - 1 && !info.hasTyping) {
                if (info.lastAssistant || info.hasError) {
                    sawFinal = true;
                    console.log('Final reached. Assistant:', info.lastAssistant);
                    break;
                }
            }
        } catch (e) { console.log('   eval err:', e.message); }
    }

    var finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('\nFinal len:', finalText.length);
    fs.writeFileSync(path.join(SHOT_DIR, 'q5-q2-pnp.txt'), finalText, 'utf-8');
    await p.screenshot({ path: path.join(SHOT_DIR, 'q5-q2-pnp.png') });
    console.log('Saved q5-q2-pnp.png');
    await b.close();
})();
