'use strict';
/**
 * REAL workflow test: close existing chat, mouse-select area in schematic,
 * click 局部网表 → AI 分析局部网表 menu, verify chat opens.
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

    // Step 1: find sch frame first (do NOT close any iframe, EDA sch lives in blob frame)
    console.log('\n--- Step 1: Find EDA sch frame ---');
    var frames = p.frames();
    var schFrame = null;
    for (var i = 0; i < frames.length; i++) {
        try {
            var has = await frames[i].evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
            if (has) { schFrame = frames[i]; break; }
        } catch (e) {}
    }
    if (!schFrame) { console.log('NO EDA FRAME'); await b.close(); return; }
    console.log('  Sch frame found');

    // Close any existing AI chat iframes (those are separate from sch blob)
    var closedCount = await p.evaluate(function () {
        var iframes = Array.from(document.querySelectorAll('iframe'));
        var n = 0;
        for (var i = 0; i < iframes.length; i++) {
            try {
                var src = iframes[i].src || '';
                // Only remove IFrames that have a src containing chat.html
                if (src.indexOf('chat.html') >= 0 || src.indexOf('result.html') >= 0) {
                    iframes[i].remove();
                    n++;
                }
            } catch (e) {}
        }
        return n;
    });
    console.log('  Removed', closedCount, 'chat iframes');
    await p.waitForTimeout(500);

    // Step 2: Locate schematic canvas area
    console.log('\n--- Step 2: Find canvas area ---');
    var canvasInfo = await p.evaluate(function () {
        // Find the schematic canvas
        var canvases = Array.from(document.querySelectorAll('canvas'));
        var results = [];
        for (var i = 0; i < canvases.length; i++) {
            var r = canvases[i].getBoundingClientRect();
            if (r.width > 200 && r.height > 200) {
                results.push({ idx: i, x: r.x, y: r.y, w: r.width, h: r.height, classes: canvases[i].className.substring(0, 50) });
            }
        }
        return results;
    });
    console.log('  Canvases:', JSON.stringify(canvasInfo));

    // Find sch_SelectControl frame first
    var schFrameAlready = false;
    // (already found above)

    // Step 3: Mouse-drag selection on canvas
    console.log('\n--- Step 3: Mouse-drag selection ---');
    // Use the main schematic area (skip sidebars)
    // Looking at the screenshot, schematic is roughly x: 100-900, y: 70-400
    if (canvasInfo.length > 0) {
        var c = canvasInfo[0];
        var startX = c.x + 50, startY = c.y + 50;
        var endX = c.x + c.w * 0.6, endY = c.y + c.h * 0.6;
        console.log('  Drag from (' + startX + ',' + startY + ') to (' + endX + ',' + endY + ')');
        await p.mouse.move(startX, startY);
        await p.mouse.down();
        await p.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 10 });
        await p.mouse.move(endX, endY, { steps: 10 });
        await p.mouse.up();
        await p.waitForTimeout(800);
    } else {
        // Fallback: use EDA API to select all
        await schFrame.evaluate(async function () {
            try { await eda.sch_SelectControl.doSelectAll(); } catch (e) {}
        });
    }
    await shot(p, 'm2-after-drag.png');

    // Verify selection
    var sel = await schFrame.evaluate(async function () {
        try {
            var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
            return { count: ids ? ids.length : 0 };
        } catch (e) { return { err: e.message }; }
    });
    console.log('  Selection:', JSON.stringify(sel));

    // Step 4: Click "局部网表" menu in toolbar
    console.log('\n--- Step 4: Click 局部网表 toolbar menu ---');
    // Menu location from earlier scan: x=896, y=5
    var menuPos = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var tw = (root.textContent || '').trim();
                if (tw === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var found = walk(c[i], depth + 1);
                    if (found) return found;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('  Menu position:', JSON.stringify(menuPos));

    if (!menuPos) { console.log('NO MENU FOUND'); await b.close(); return; }
    await p.mouse.click(menuPos.x, menuPos.y);
    await p.waitForTimeout(800);
    await shot(p, 'm3-menu-open.png');

    // Step 5: Click "AI 分析局部网表" submenu
    console.log('\n--- Step 5: Click AI 分析局部网表 ---');
    var subPos = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var tw = (root.textContent || '').trim();
                if (tw === 'AI 分析局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) {
                        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                    }
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var found = walk(c[i], depth + 1);
                    if (found) return found;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('  Submenu position:', JSON.stringify(subPos));

    if (!subPos) {
        // List all visible items in current dropdown
        var allItems = await p.evaluate(function () {
            function walk(root, depth, list) {
                if (depth > 10 || !root) return;
                try {
                    var r = root.getBoundingClientRect();
                    if (r.width > 30 && r.height > 5 && r.width < 400 && r.y > 0 && r.y < 800) {
                        var t = (root.textContent || '').trim();
                        if (t.length > 0 && t.length < 30 && root.children.length < 3) {
                            list.push({ t: t, x: r.x, y: r.y, w: r.width, h: r.height });
                        }
                    }
                    var c = root.children || [];
                    for (var i = 0; i < c.length; i++) walk(c[i], depth + 1, list);
                } catch (e) {}
            }
            var list = [];
            walk(document.body, 0, list);
            return list;
        });
        console.log('  Visible items (first 30):');
        allItems.slice(0, 30).forEach(function (i) { console.log('   ', i.t, '|', Math.floor(i.x), Math.floor(i.y), i.w, 'x', i.h); });
        await b.close();
        return;
    }
    await p.mouse.click(subPos.x, subPos.y);
    console.log('  Clicked AI 分析局部网表');

    // Step 6: Wait for IFrame to open
    console.log('\n--- Step 6: Wait for chat IFrame ---');
    var newChatFound = false;
    for (var t = 0; t < 30; t++) {
        await p.waitForTimeout(500);
        var f = p.frames();
        for (var i = 0; i < f.length; i++) {
            try {
                var title = await f[i].title();
                if (title && title.indexOf('AI') >= 0 && title.indexOf('电路') >= 0) {
                    newChatFound = true;
                    console.log('  AI chat opened:', title);
                    break;
                }
            } catch (e) {}
        }
        if (newChatFound) break;
    }

    await shot(p, 'm4-after-ai-click.png');
    if (!newChatFound) {
        console.log('  AI chat NOT opened - check screenshots');
        await b.close();
        return;
    }

    // Step 7: Wait for the AI's auto first response (or just read content)
    console.log('\n--- Step 7: Read chat content ---');
    var chatFrame = null;
    for (var i = 0; i < f.length; i++) {
        try {
            var title = await f[i].title();
            if (title && title.indexOf('AI') >= 0 && title.indexOf('电路') >= 0) {
                chatFrame = f[i];
                break;
            }
        } catch (e) {}
    }
    if (!chatFrame) { await b.close(); return; }

    // Read the initial content
    var content = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('  Initial chat text len:', content.length);
    console.log('  First 500 chars:', content.substring(0, 500));
    fs.writeFileSync(path.join(SHOT, 'm5-initial-chat.txt'), content, 'utf-8');

    // Step 8: Type a question and send
    console.log('\n--- Step 8: Type & send question ---');
    var question = '这个网表是哪个电路的?请 100 字介绍。';
    await chatFrame.fill('textarea', question);
    await p.waitForTimeout(500);
    // Click send ONCE
    await chatFrame.evaluate(function () {
        var btns = Array.from(document.querySelectorAll('button'));
        var sendBtn = btns.find(function (b) { return (b.textContent || '').indexOf('发送') >= 0; });
        if (sendBtn) sendBtn.click();
    });
    console.log('  Question sent:', question);

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
            if (info.isSending === false && stableRounds >= 4) break;
        } catch (e) {}
    }

    var finalText = await chatFrame.evaluate(function () { return document.body.innerText; });
    console.log('  Final text len:', finalText.length);
    fs.writeFileSync(path.join(SHOT, 'm6-final-chat.txt'), finalText, 'utf-8');
    await shot(p, 'm6-final-chat.png');
    console.log('  Saved m6-final-chat.txt + .png');

    await b.close();
    console.log('\n=== DONE ===');
})();
