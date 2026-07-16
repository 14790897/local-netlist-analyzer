'use strict';
/**
 * FINAL real workflow test after re-import:
 * 1. Mouse-drag select a region on schematic
 * 2. Click 局部网表 → AI 分析局部网表 menu
 * 3. Verify AI chat IFrame opens with correct title
 * 4. Type a question, send, verify response
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

async function shot(p, name) {
    try { await p.screenshot({ path: path.join(SHOT, name) }); console.log('  [shot]', name); }
    catch (e) { console.log('  [shot-fail]', name, e.message.substring(0, 60)); }
}

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    // Step 1: Find schematic canvas
    console.log('\n--- Step 1: Find canvas ---');
    var canvasInfo = await p.evaluate(function () {
        var canvases = Array.from(document.querySelectorAll('canvas'));
        var r = [];
        for (var i = 0; i < canvases.length; i++) {
            var b = canvases[i].getBoundingClientRect();
            if (b.width > 200 && b.height > 200) r.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
        return r;
    });
    console.log('  Canvases:', JSON.stringify(canvasInfo));
    if (canvasInfo.length === 0) { console.log('NO CANVAS'); await b.close(); return; }
    var c = canvasInfo[0];

    // Step 2: Find EDA sch frame (with retry/wait)
    console.log('\n--- Step 2: Find EDA sch frame ---');
    var schFrame = null;
    for (var waitT = 0; waitT < 30; waitT++) {
        for (var f of p.frames()) {
            try {
                var has = await f.evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
                if (has) { schFrame = f; break; }
            } catch (e) {}
        }
        if (schFrame) break;
        console.log('  t=' + waitT + 's, waiting for EDA sch...');
        await p.waitForTimeout(1000);
    }
    if (!schFrame) { console.log('NO EDA SCH FRAME (waited 30s)'); await b.close(); return; }
    console.log('  EDA sch frame found');

    // Step 3: Mouse-drag selection in the center area
    console.log('\n--- Step 3: Mouse-drag selection ---');
    var sx = c.x + c.w * 0.2, sy = c.y + c.h * 0.2;
    var ex = c.x + c.w * 0.7, ey = c.y + c.h * 0.7;
    console.log('  Drag (' + Math.floor(sx) + ',' + Math.floor(sy) + ') → (' + Math.floor(ex) + ',' + Math.floor(ey) + ')');
    await p.mouse.move(sx, sy);
    await p.mouse.down();
    for (var t = 0; t < 20; t++) {
        await p.mouse.move(sx + (ex - sx) * t / 20, sy + (ey - sy) * t / 20);
        await p.waitForTimeout(20);
    }
    await p.mouse.up();
    await p.waitForTimeout(800);

    // Verify selection
    var sel = await schFrame.evaluate(async function () {
        try {
            var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
            return { count: ids ? ids.length : 0 };
        } catch (e) { return { err: e.message }; }
    });
    console.log('  Selection:', JSON.stringify(sel));
    await shot(p, 'w1-after-drag.png');

    // Step 4: Click 局部网表 menu
    console.log('\n--- Step 4: Click 局部网表 menu ---');
    var menuPos = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var f = walk(c[i], depth + 1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('  Menu position:', JSON.stringify(menuPos));
    if (!menuPos) { console.log('NO MENU'); await b.close(); return; }

    await p.mouse.click(menuPos.x, menuPos.y);
    await p.waitForTimeout(800);
    await shot(p, 'w2-menu-open.png');

    // Step 5: Click "AI 分析局部网表" submenu
    console.log('\n--- Step 5: Click AI 分析局部网表 ---');
    var subPos = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var t = (root.textContent || '').trim();
                if (t === 'AI 分析局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0 && r.y > 0 && r.y < 800) {
                        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                    }
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var f = walk(c[i], depth + 1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('  Submenu position:', JSON.stringify(subPos));
    if (!subPos) {
        // List all visible items
        var items = await p.evaluate(function () {
            var r = [];
            function walk(root, depth) {
                if (depth > 10) return;
                try {
                    var b = root.getBoundingClientRect();
                    var t = (root.textContent || '').trim();
                    if (b.width > 30 && b.width < 400 && b.height > 5 && b.y > 0 && b.y < 800 && t.length > 0 && t.length < 30 && root.children.length < 3) {
                        r.push({ t, x: Math.floor(b.x), y: Math.floor(b.y), w: b.width, h: b.height });
                    }
                    var c = root.children || [];
                    for (var i = 0; i < c.length; i++) walk(c[i], depth + 1);
                } catch (e) {}
            }
            walk(document.body, 0);
            return r;
        });
        console.log('  All items in viewport:');
        items.slice(0, 30).forEach(function (i) { console.log('   ', i.t, '|', i.x, i.y, i.w, 'x', i.h); });
        await b.close();
        return;
    }

    await p.mouse.click(subPos.x, subPos.y);
    console.log('  Clicked AI 分析局部网表');
    await p.waitForTimeout(1500);

    // Step 6: Wait for AI chat IFrame
    console.log('\n--- Step 6: Wait for chat IFrame ---');
    var chatFrame = null;
    for (var t = 0; t < 30; t++) {
        await p.waitForTimeout(500);
        for (var f of p.frames()) {
            try {
                var title = await f.title();
                if (title && title.indexOf('AI') >= 0 && title.indexOf('电路') >= 0) {
                    chatFrame = f;
                    console.log('  AI chat opened:', title);
                    break;
                }
            } catch (e) {}
        }
        if (chatFrame) break;
    }
    await shot(p, 'w3-after-menu-click.png');

    if (!chatFrame) {
        console.log('  AI chat NOT opened');
        await b.close();
        return;
    }

    // Step 7: Read initial content
    console.log('\n--- Step 7: Read initial chat ---');
    var content = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('  Initial len:', content.length);
    console.log('  First 300 chars:', content.substring(0, 300));
    fs.writeFileSync(path.join(SHOT, 'w4-initial.txt'), content, 'utf-8');

    // Step 8: Send a question
    console.log('\n--- Step 8: Send question ---');
    var question = '这是什么类型的电路?100 字内回答。';
    await chatFrame.fill('textarea', question);
    await p.waitForTimeout(500);
    await chatFrame.evaluate(function () {
        var btns = Array.from(document.querySelectorAll('button'));
        var sendBtn = btns.find(function (b) { return (b.textContent || '').indexOf('发送') >= 0; });
        if (sendBtn) sendBtn.click();
    });
    console.log('  Sent:', question);

    // Wait for response
    var startTime = Date.now();
    var lastLen = 0;
    var stableRounds = 0;
    while (Date.now() - startTime < 60000) {
        await p.waitForTimeout(1500);
        try {
            var info = await chatFrame.evaluate(function () {
                return {
                    len: document.body.innerText.length,
                    isSending: typeof isSending !== 'undefined' ? isSending : null,
                    hasError: !!document.querySelector('.error-msg')
                };
            });
            if (info.len !== lastLen) {
                console.log('   t=' + Math.floor((Date.now() - startTime) / 1000) + 's, len=' + info.len + ', sending=' + info.isSending + ', err=' + info.hasError);
                lastLen = info.len;
                stableRounds = 0;
            } else {
                stableRounds++;
            }
            if (info.isSending === false && stableRounds >= 4) {
                console.log('  Done after', Math.floor((Date.now() - startTime) / 1000), 's');
                break;
            }
        } catch (e) {}
    }

    var finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('  Final len:', finalText.length);
    fs.writeFileSync(path.join(SHOT, 'w5-final.txt'), finalText, 'utf-8');
    await shot(p, 'w5-final.png');
    console.log('  Saved w5-final.txt + .png');

    await b.close();
    console.log('\n=== ALL DONE ===');
})();
