'use strict';
/**
 * Run the final workflow on the no-cll-debug tab
 * (the one that has fully initialized EDA)
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
    var ctx = b.contexts()[0];
    var pages = ctx.pages();
    console.log('Total pages:', pages.length);
    for (var i = 0; i < pages.length; i++) {
        var u = pages[i].url();
        if (u.indexOf('lceda') >= 0) {
            console.log('  ['+i+']', u.substring(0, 100));
        }
    }

    // Find the page WITHOUT cll=debug (presumably fully initialized EDA)
    var p = null;
    for (var i = 0; i < pages.length; i++) {
        if (pages[i].url().indexOf('pro.lceda.cn') >= 0 && pages[i].url().indexOf('cll=debug') < 0) {
            p = pages[i];
            console.log('Using page WITHOUT cll=debug');
            break;
        }
    }
    if (!p) {
        // fallback: use any lceda page
        for (var i = 0; i < pages.length; i++) {
            if (pages[i].url().indexOf('pro.lceda.cn') >= 0) { p = pages[i]; break; }
        }
    }
    if (!p) { console.log('NO LCEDA PAGE'); await b.close(); return; }
    console.log('Using page:', p.url().substring(0, 100));
    console.log('Title:', await p.title());

    // Step 1: check EDA sch API in main + frames
    console.log('\n--- Step 1: Find EDA sch API ---');
    var schInfo = await p.evaluate(() => {
        if (typeof window.eda === 'undefined') return { hasEda: false };
        var schKeys = Object.keys(window.eda).filter(k => k.indexOf('sch') === 0 || k.indexOf('Select') === 0 || k.indexOf('Manufacture') === 0);
        return { hasEda: true, schKeys: schKeys, allKeys: Object.keys(window.eda).length };
    });
    console.log('Main EDA:', JSON.stringify(schInfo));

    var frames = p.frames();
    console.log('Frames:', frames.length);
    var schFrame = null;
    for (var f of frames) {
        try {
            var info = await f.evaluate(() => {
                if (typeof window.eda === 'undefined') return null;
                return { hasSch: !!window.eda.sch_SelectControl, schKeys: Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).slice(0, 5) };
            });
            if (info && info.hasSch) { schFrame = f; console.log('  EDA sch in frame:', f.url().substring(0, 60)); break; }
        } catch (e) {}
    }
    if (!schFrame && schInfo.hasEda && schInfo.schKeys && schInfo.schKeys.length > 0) {
        // Maybe sch IS in main page now
        schFrame = p;
        console.log('  Using main page as sch frame');
    }
    if (!schFrame) { console.log('  No sch frame/API'); }

    // Step 2: check menu visibility
    console.log('\n--- Step 2: Check menu ---');
    var menu = await p.evaluate(() => {
        function walk(root, depth) {
            if (depth > 10) return false;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return true;
                }
                for (var c of (root.children || [])) if (walk(c, depth+1)) return true;
            } catch (e) {}
            return false;
        }
        return walk(document.body, 0);
    });
    console.log('  局部网表 menu:', menu);

    if (!menu) { console.log('NO MENU - need to import extension'); await b.close(); return; }

    // Step 3: find AI IFrame (user already opened one)
    console.log('\n--- Step 3: Find AI IFrame ---');
    var chat = null;
    var chatInfo = [];
    for (var f of frames) {
        try {
            var info = await f.evaluate(() => {
                return {
                    title: document.title,
                    url: location.href.substring(0, 50),
                    bodyLen: document.body ? document.body.innerText.length : 0,
                    firstLine: document.body ? document.body.innerText.substring(0, 100) : ''
                };
            });
            chatInfo.push(info);
            if (info.title && (info.title.indexOf('AI') >= 0 || info.title.indexOf('分析') >= 0)) {
                chat = f;
            }
        } catch (e) {}
    }
    chatInfo.forEach(i => console.log('  Frame:', JSON.stringify(i)));
    if (chat) console.log('AI chat frame found:', await chat.title());

    // Step 4: Take screenshot of the chat content
    if (chat) {
        var content = await chat.evaluate(() => document.body.innerText);
        console.log('\nChat content len:', content.length);
        console.log('First 400 chars:');
        console.log(content.substring(0, 400));
        fs.writeFileSync(path.join(SHOT, 'z1-real-chat.txt'), content, 'utf-8');
    }
    await shot(p, 'z1-real-page.png');

    await b.close();
})();
