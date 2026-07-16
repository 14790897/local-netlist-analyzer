'use strict';
/**
 * Real EDA AI test: send a follow-up question to existing AI chat
 * - find the AI chat blob frame
 * - fill textarea + click send
 * - wait for response
 * - capture screenshot
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT_DIR = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    // Take a "before" screenshot of the whole page
    try {
        await p.screenshot({ path: path.join(SHOT_DIR, 'q1-before-question.png'), fullPage: false });
        console.log('  [shot] q1-before-question.png');
    } catch (e) { console.log('  shot err:', e.message); }

    var frames = p.frames();
    console.log('  Total frames:', frames.length);

    // Find AI chat frame (title contains 'AI')
    var chatFrame = null;
    for (var i = 0; i < frames.length; i++) {
        try {
            var title = await frames[i].title();
            if (title && title.indexOf('AI') >= 0 && title.indexOf('电路') >= 0) {
                chatFrame = frames[i];
                console.log('  AI chat frame:', frames[i].url().substring(0, 60), '|', title);
                break;
            }
        } catch (e) {}
    }
    if (!chatFrame) {
        console.log('  No AI chat frame found!');
        await b.close();
        return;
    }

    // Fill textarea in the chat frame
    console.log('\n--- Send a new question ---');
    var question = '电路中的 Q2 三极管起什么作用?';
    try {
        await chatFrame.fill('textarea', question);
        console.log('  Filled:', question);
    } catch (e) {
        console.log('  Fill err:', e.message);
    }
    await p.waitForTimeout(500);

    // Click send button
    try {
        // try by text
        await chatFrame.click('button:has-text("发送")', { timeout: 5000 });
        console.log('  Clicked 发送');
    } catch (e) {
        console.log('  Click by text failed:', e.message);
        // try by selector
        try {
            await chatFrame.evaluate(function () {
                var btns = Array.from(document.querySelectorAll('button'));
                var sendBtn = btns.find(function (b) { return (b.textContent || '').indexOf('发送') >= 0; });
                if (sendBtn) sendBtn.click();
            });
            console.log('  Clicked via evaluate');
        } catch (e2) {
            console.log('  Click via evaluate failed:', e2.message);
        }
    }

    // Wait for AI response
    console.log('  Waiting for response (up to 60s)...');
    var lastLen = 0;
    var stableRounds = 0;
    var finalText = '';
    for (var t = 0; t < 60; t++) {
        await p.waitForTimeout(1000);
        try {
            var cur = await chatFrame.evaluate(function () { return document.body.innerText.length; });
            if (cur !== lastLen) { lastLen = cur; stableRounds = 0; }
            else { stableRounds++; }
            if (stableRounds >= 5) {
                console.log('  Stable after', t, 's, len=', lastLen);
                break;
            }
            if (t % 5 === 0) console.log('   ...t=' + t + 's, len=' + cur);
        } catch (e) {}
    }

    finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('  Final text length:', finalText.length);
    fs.writeFileSync(path.join(SHOT_DIR, 'q2-final-chat.txt'), finalText, 'utf-8');
    console.log('  Saved to q2-final-chat.txt');

    // Screenshot the chat frame area
    try {
        var box = await chatFrame.boundingBox();
        if (box) {
            await p.screenshot({ path: path.join(SHOT_DIR, 'q3-final-chat.png'), clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
            console.log('  [shot] q3-final-chat.png');
        }
    } catch (e) {
        console.log('  clip err:', e.message);
        try {
            await p.screenshot({ path: path.join(SHOT_DIR, 'q3-final-chat.png') });
            console.log('  [shot] q3-final-chat.png (full)');
        } catch (e2) { console.log('  full shot err:', e2.message); }
    }

    // Also take whole page screenshot
    try {
        await p.screenshot({ path: path.join(SHOT_DIR, 'q4-final-page.png') });
        console.log('  [shot] q4-final-page.png');
    } catch (e) {}

    await b.close();
    console.log('\n=== DONE ===');
})();
