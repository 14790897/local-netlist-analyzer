'use strict';
/**
 * LIVE WORKFLOW on user's actual page:
 * 1. Find sch frame
 * 2. Do real mouse drag selection on canvas
 * 3. Click 局部网表 menu -> AI 分析局部网表
 * 4. Wait for AI IFrame
 * 5. Send a real question
 * 6. Wait for response
 * 7. Screenshot at each step
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

async function shot(p, name) {
    try { await p.screenshot({ path: path.join(SHOT, name) }); console.log('  [shot]', name); }
    catch (e) { console.log('  [shot-fail]', name, e.message.substring(0, 60)); }
}

function findByText(p, text) {
    return p.evaluate(function (t) {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var tt = (root.textContent || '').trim();
                if (tt === t && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height };
                }
                for (var c of (root.children || [])) {
                    var f = walk(c, depth+1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    }, text);
}

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var pages = b.contexts()[0].pages();
    var p = pages.find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);
    if (!p) {
        for (var pg of pages) {
            if (pg.url().indexOf('pro.lceda.cn') >= 0) { p = pg; break; }
        }
    }
    if (!p) { console.log('NO LCEDA PAGE'); await b.close(); return; }
    console.log('Page:', p.url().substring(0, 80));
    console.log('Title:', await p.title());

    // Wait for EDA to be ready
    console.log('\n--- Wait for EDA sch API ---');
    var schFrame = null;
    for (var t = 0; t < 20; t++) {
        for (var f of p.frames()) {
            try {
                var has = await f.evaluate(() => !!(window.eda && window.eda.sch_SelectControl && window.eda.sch_ManufactureData));
                if (has) { schFrame = f; break; }
            } catch (e) {}
        }
        if (schFrame) break;
        await p.waitForTimeout(1000);
    }
    if (!schFrame) { console.log('No EDA sch frame after 20s'); process.exit(1); }
    console.log('Sch frame:', schFrame.url().substring(0, 50));

    // Step 1: Real mouse drag selection
    console.log('\n--- Step 1: Real mouse drag selection ---');
    var canvasInfo = await p.evaluate(function () {
        var list = [];
        for (var c of document.querySelectorAll('canvas')) {
            var b = c.getBoundingClientRect();
            if (b.width > 200 && b.height > 200) list.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
        return list;
    });
    console.log('  Canvases:', JSON.stringify(canvasInfo));
    var c = canvasInfo[0];
    // Drag a wider area to capture most components
    var sx = c.x + c.w * 0.05, sy = c.y + c.h * 0.05;
    var ex = c.x + c.w * 0.95, ey = c.y + c.h * 0.95;
    console.log('  Drag from (' + Math.floor(sx) + ',' + Math.floor(sy) + ') to (' + Math.floor(ex) + ',' + Math.floor(ey) + ')');
    await p.mouse.move(sx, sy);
    await p.mouse.down();
    for (var t = 0; t <= 30; t++) {
        await p.mouse.move(sx + (ex - sx) * t / 30, sy + (ey - sy) * t / 30);
        await p.waitForTimeout(15);
    }
    await p.mouse.up();
    await p.waitForTimeout(1000);

    var sel = await schFrame.evaluate(async () => {
        var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
        var file = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
        var nl = file ? await file.text() : '';
        var comps = 0, nets = 0;
        if (nl) {
            try {
                var obj = JSON.parse(nl);
                comps = Object.keys(obj.components || obj).length;
                var netSet = new Set();
                var keys = Object.keys(obj.components || obj);
                for (var k = 0; k < keys.length; k++) {
                    var pim = (obj.components || obj)[keys[k]].pinInfoMap || {};
                    var pks = Object.keys(pim);
                    for (var j = 0; j < pks.length; j++) {
                        var n = pim[pks[j]].net;
                        if (n) netSet.add(n);
                    }
                }
                nets = netSet.size;
            } catch (e) {}
        }
        return { ids: ids ? ids.length : 0, netlistBytes: nl.length, comps: comps, nets: nets };
    });
    console.log('  Selection:', JSON.stringify(sel));
    await shot(p, 'live-1-drag.png');

    // Step 2: Click 局部网表 menu
    console.log('\n--- Step 2: Click 局部网表 menu ---');
    var menuPos = await findByText(p, '局部网表');
    console.log('  Menu pos:', JSON.stringify(menuPos));
    if (!menuPos) { console.log('NO MENU'); process.exit(1); }
    await p.mouse.click(menuPos.x, menuPos.y);
    await p.waitForTimeout(800);
    await shot(p, 'live-2-menu-open.png');

    // Step 3: Click AI 分析局部网表
    console.log('\n--- Step 3: Click AI 分析局部网表 ---');
    var subPos = await findByText(p, 'AI 分析局部网表');
    console.log('  Submenu pos:', JSON.stringify(subPos));
    if (!subPos) {
        // Dump all visible items
        var items = await p.evaluate(() => {
            var list = [];
            function walk(root, depth) {
                if (depth > 10) return;
                var b = root.getBoundingClientRect();
                var t = (root.textContent || '').trim();
                if (b.width > 30 && b.width < 400 && b.height > 5 && b.y > 0 && b.y < 800
                    && t.length > 0 && t.length < 30 && root.children.length < 3) {
                    list.push({ t, x: Math.floor(b.x), y: Math.floor(b.y), w: b.width, h: b.height });
                }
                for (var c of (root.children || [])) walk(c, depth + 1);
            }
            walk(document.body, 0);
            return list;
        });
        console.log('  Visible items:');
        items.slice(0, 20).forEach(i => console.log('   ', i.t, '|', i.x, i.y, i.w, 'x', i.h));
        process.exit(2);
    }
    await p.mouse.click(subPos.x, subPos.y);
    console.log('  Clicked AI 分析局部网表');
    await p.waitForTimeout(2000);
    await shot(p, 'live-3-after-menu.png');

    // Step 4: Wait for AI IFrame
    console.log('\n--- Step 4: Wait for AI IFrame ---');
    var chat = null;
    for (var t = 0; t < 30; t++) {
        for (var f of p.frames()) {
            try {
                var ti = await f.title();
                if (ti && ti.indexOf('AI') >= 0 && ti.indexOf('电路') >= 0) { chat = f; break; }
            } catch (e) {}
        }
        if (chat) break;
        await p.waitForTimeout(500);
    }
    if (!chat) { console.log('NO AI IFRAME'); process.exit(3); }
    console.log('  AI IFrame:', await chat.title());
    await shot(p, 'live-4-chat-open.png');

    // Read initial content
    var initial = await chat.evaluate(() => document.body.innerText);
    console.log('  Initial len:', initial.length);
    fs.writeFileSync(SHOT + '/live-initial.txt', initial, 'utf-8');

    // Step 5: Type a question
    console.log('\n--- Step 5: Type & send question ---');
    var question = 'U3 是什么芯片?起什么作用?';
    await chat.fill('textarea', question);
    await p.waitForTimeout(500);
    await shot(p, 'live-5-typed.png');

    // Click send ONCE
    await chat.evaluate(() => {
        var b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').indexOf('发送') >= 0);
        if (b) b.click();
    });
    console.log('  Clicked 发送 ONCE');
    console.log('  Waiting for response (up to 90s)...');

    // Wait for response — watch for new message in chat
    var start = Date.now();
    var lastLen = 0;
    var stableRounds = 0;
    while (Date.now() - start < 90000) {
        await p.waitForTimeout(1500);
        try {
            var info = await chat.evaluate(() => {
                return {
                    len: document.body.innerText.length,
                    isSending: typeof isSending !== 'undefined' ? isSending : null,
                    hasError: !!document.querySelector('.error-msg'),
                    hasTyping: !!document.querySelector('.typing')
                };
            });
            if (info.len !== lastLen) {
                console.log('   t=' + Math.floor((Date.now() - start) / 1000) + 's, len=' + info.len + ', sending=' + info.isSending + ', typing=' + info.hasTyping + ', err=' + info.hasError);
                lastLen = info.len; stableRounds = 0;
            } else {
                stableRounds++;
            }
            // Done when: not sending AND no typing AND len stable for 4 rounds
            if (info.isSending === false && !info.hasTyping && stableRounds >= 4 && lastLen > 200) {
                console.log('  Done after ' + Math.floor((Date.now() - start) / 1000) + 's');
                break;
            }
        } catch (e) {}
    }

    var finalText = await chat.evaluate(() => document.body.innerText);
    console.log('\n=== FINAL CONTENT (len ' + finalText.length + ') ===');
    console.log(finalText);
    fs.writeFileSync(SHOT + '/live-final.txt', finalText, 'utf-8');
    await shot(p, 'live-6-final.png');

    // Try to capture just the chat area
    try {
        var box = await p.evaluate(() => {
            var iframes = document.querySelectorAll('iframe');
            for (var i = 0; i < iframes.length; i++) {
                try {
                    var src = iframes[i].src || '';
                    if (src.indexOf('blob:') >= 0) {
                        var r = iframes[i].getBoundingClientRect();
                        if (r.width > 200) return { x: r.x, y: r.y, w: r.width, h: r.height };
                    }
                } catch (e) {}
            }
            return null;
        });
        if (box) {
            await p.screenshot({ path: SHOT + '/live-7-chat-clip.png', clip: box });
            console.log('Saved live-7-chat-clip.png');
        }
    } catch (e) {}

    await b.close();
    console.log('\n=== DONE ===');
})();
