'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');

async function main() {
    var b = await chromium.connectOverCDP('http://localhost:9273');
    var p = b.contexts()[0].pages()[0];

    // Read the standalone test script
    var script = fs.readFileSync(__dirname + '/standalone-test.js', 'utf-8');

    // 1. 导航到原理图
    var title = await p.title();
    if (!title.includes('P1.Schematic')) {
        var proj = await p.evaluate(function() {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if (t.startsWith('墨鱼AI墨水屏')) {
                    var r = all[i].getBoundingClientRect();
                    if (r.width > 100) return {x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2)};
                }
            }
            return null;
        });
        if (proj) { await p.mouse.click(proj.x, proj.y, {clickCount: 2}); await new Promise(r => setTimeout(r, 8000)); }

        var sch = await p.evaluate(function() {
            var all = document.querySelectorAll('[class*=tree-title]');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').trim() === 'Schematic1_3') {
                    var r = all[i].getBoundingClientRect();
                    return {x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2)};
                }
            }
            return null;
        });
        if (sch) { await p.mouse.click(sch.x, sch.y, {clickCount: 2}); await new Promise(r => setTimeout(r, 8000)); }

        var p1 = await p.evaluate(function() {
            var all = document.querySelectorAll('[class*=tree-title]');
            for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if (t === '1.P1' || t === '1. P1') {
                    var r = all[i].getBoundingClientRect();
                    return {x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2)};
                }
            }
            return null;
        });
        if (p1) { await p.mouse.click(p1.x, p1.y, {clickCount: 2}); await new Promise(r => setTimeout(r, 10000)); }
    }
    console.log('Page:', (await p.title()).substring(0, 60));

    // 监控 console
    p.on('console', function(m) { console.log('[CONSOLE]', m.text().substring(0, 200)); });

    // 2. 打开运行脚本: 高级 → 运行脚本
    await p.mouse.click(688, 16); await new Promise(r => setTimeout(r, 1500));
    await p.mouse.click(764, 41); await new Promise(r => setTimeout(r, 4000));

    // 3. 找 textarea
    var textarea = await p.evaluate(function() {
        var areas = document.querySelectorAll('textarea');
        for (var i = 0; i < areas.length; i++) {
            var r = areas[i].getBoundingClientRect();
            if (r.width > 200 && r.height > 100) return i;
        }
        return -1;
    });
    console.log('Textarea index:', textarea);

    if (textarea >= 0) {
        // 直接用 setInputFiles-like approach: type into the textarea
        var ta = p.locator('textarea').nth(textarea);
        await ta.click();
        await new Promise(r => setTimeout(r, 500));
        await ta.fill('');
        await ta.type(script, { delay: 5 });
        console.log('Script pasted');
        await new Promise(r => setTimeout(r, 2000));
    } else {
        console.log('No textarea found');
        // Take screenshot to see what's open
        await p.screenshot({ path: __dirname + '/run-script-dialog.png' });
        console.log('Screenshot saved');
        return;
    }

    // 4. Click 运行 button
    var runBtn = await p.evaluate(function() {
        var btns = document.querySelectorAll('button, [role=button]');
        for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].textContent || '').trim();
            if (t === '运行' || t === '开始运行') { btns[i].click(); return t; }
        }
        return null;
    });
    console.log('Run button:', runBtn);
    if (!runBtn) await p.keyboard.press('Control+Enter');

    await new Promise(r => setTimeout(r, 20000));

    // 5. Check alert
    var dialog = await p.evaluate(function() {
        var d = document.querySelector('[class*=dialog], [class*=modal], [class*=alert]');
        return d ? (d.textContent || '').substring(0, 200) : null;
    });
    console.log('Dialog:', dialog || 'none');
}

main().catch(function(e) { console.error(e); process.exit(1); });
