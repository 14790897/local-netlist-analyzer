'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

async function main() {
    var b = await chromium.connectOverCDP('http://localhost:9273');
    var p = b.contexts()[0].pages()[0];

    var ms = [];
    p.on('console', function(m) {
        var t = m.text();
        if (t.includes('NETLIST') || t.toLowerCase().includes('error') || t.toLowerCase().includes('uncaught'))
            ms.push(t.substring(0, 300));
    });

    // 1. 首页
    console.log('1. Home page...');
    await p.goto('https://pro.lceda.cn/editor?cll=debug',
        { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(function(r) { setTimeout(r, 12000); });
    console.log('   Title:', (await p.title()).substring(0, 50));

    // 点 工程 tab (如果是「所有工程」面板)
    await p.evaluate(function() {
        var all = document.querySelectorAll('[class*=tab], div, span');
        for (var i = 0; i < all.length; i++) {
            if ((all[i].textContent || '').trim() === '所有工程' && all[i].offsetWidth < 100) {
                all[i].click(); return;
            }
        }
    });
    await new Promise(function(r) { setTimeout(r, 2000); });

    // 2. 第一层双击: 黄色项目文件夹 "墨鱼AI墨水屏"
    console.log('2. Double-click project folder...');
    var dbl1 = await p.evaluate(function() {
        var all = document.querySelectorAll('[class*=tree-node],[class*=tree-item],[class*=file-item],div,span');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t.startsWith('墨鱼AI墨水屏')) {
                all[i].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                return 'dblclick: ' + t.substring(0, 30);
            }
        }
        return 'not found';
    });
    console.log('   ' + dbl1);
    await new Promise(function(r) { setTimeout(r, 6000); });
    console.log('   Title:', (await p.title()).substring(0, 60));

    // 3. 第二层双击: Schematic1_3
    console.log('3. Double-click Schematic1_3...');
    var dbl2 = await p.evaluate(function() {
        var all = document.querySelectorAll('[class*=tree-node],[class*=tree-item],[class*=file-item],div,span');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === 'Schematic1_3' || t.startsWith('Schematic1')) {
                all[i].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                return 'dblclick: ' + t;
            }
        }
        return 'not found';
    });
    console.log('   ' + dbl2);
    await new Promise(function(r) { setTimeout(r, 6000); });
    console.log('   Title:', (await p.title()).substring(0, 60));

    // 4. 第三层双击: 1.P1 (打开原理图画布)
    console.log('4. Double-click 1.P1...');
    var dbl3 = await p.evaluate(function() {
        var all = document.querySelectorAll('[class*=tree-node],[class*=tree-item],[class*=file-item],div,span');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === '1.P1' || t.startsWith('1.P1') || t.match(/^1\.P\d/)) {
                all[i].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                return 'dblclick: ' + t;
            }
        }
        return 'not found';
    });
    console.log('   ' + dbl3);
    console.log('   Waiting 15s for canvas to load...');
    await new Promise(function(r) { setTimeout(r, 15000); });
    console.log('   Title:', (await p.title()).substring(0, 80));

    // 5. 检测 canvas
    var cvs = await p.evaluate(function() {
        return Array.from(document.querySelectorAll('canvas')).map(function(c) {
            var r = c.getBoundingClientRect();
            return { w: Math.floor(r.width), h: Math.floor(r.height),
                x: Math.floor(r.x), y: Math.floor(r.y), parent: (c.parentElement || {}).tagName || '?' };
        });
    });
    console.log('\n5. Canvases:', JSON.stringify(cvs));

    var big = cvs.find(function(c) { return c.w > 500; });
    if (!big) big = cvs.find(function(c) { return c.w > 300; });

    // 6. 检查菜单是否有 局部网表
    var menuX = 365; // 原理图编辑器菜单 x
    await p.mouse.click(menuX, 16);
    await new Promise(function(r) { setTimeout(r, 1500); });
    var menuItems = await p.evaluate(function() {
        return Array.from(document.querySelectorAll('[class*=eda-menu-item]'))
            .map(function(e) { return (e.textContent || '').trim().substring(0, 25); })
            .filter(function(t) { return t.length > 1; });
    });
    var unique = [...new Set(menuItems)];
    console.log('6. Menu items:', JSON.stringify(unique));
    var hasExt = unique.some(function(i) { return i.includes('局部网表'); });
    console.log('   Has 局部网表:', hasExt);
    await p.keyboard.press('Escape');
    await new Promise(function(r) { setTimeout(r, 500); });

    // 7. 如果 canvas 存在且有扩展，开始测试
    if (big && hasExt) {
        console.log('7. Selecting on canvas...');
        await p.mouse.move(big.x + 100, big.y + 100);
        await p.mouse.down();
        await new Promise(function(r) { setTimeout(r, 200); });
        await p.mouse.move(big.x + big.w - 100, big.y + big.h - 100, { steps: 10 });
        await new Promise(function(r) { setTimeout(r, 200); });
        await p.mouse.up();
        await new Promise(function(r) { setTimeout(r, 1000); });
        console.log('   Selected');

        // 点击菜单
        console.log('8. Clicking menu...');
        await p.mouse.click(menuX, 16);
        await new Promise(function(r) { setTimeout(r, 2000); });

        var sub = await p.evaluate(function() {
            return Array.from(document.querySelectorAll('[class*=eda-menu-item]')).map(function(e) {
                var r = e.getBoundingClientRect();
                return { text: (e.textContent || '').trim().substring(0, 25),
                    x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2) };
            });
        });
        console.log('   Dropdown:', JSON.stringify(sub.filter(function(s){return s.text})));

        var local = sub.find(function(s) { return s.text.includes('局部网表'); });
        var act = sub.find(function(s) { return s.text.includes('分析选中'); });

        if (local) {
            await p.mouse.move(local.x, local.y);
            await new Promise(function(r) { setTimeout(r, 1500); });

            var sub2 = await p.evaluate(function() {
                return Array.from(document.querySelectorAll('[class*=eda-menu-item]')).map(function(e) {
                    var r = e.getBoundingClientRect();
                    return { text: (e.textContent || '').trim().substring(0, 25),
                        x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2) };
                });
            });
            act = sub2.find(function(s) { return s.text.includes('分析选中'); });
        }
        if (act) {
            console.log('   Clicking:', act.text, '@', act.x, act.y);
            await p.mouse.click(act.x, act.y);
            await new Promise(function(r) { setTimeout(r, 8000); });
        }
    } else {
        console.log('7. SKIP - big=' + !!big + ' hasExt=' + hasExt);
    }

    // 9. 检查 iframe
    var iframes = await p.evaluate(function() {
        return Array.from(document.querySelectorAll('iframe')).map(function(f, i) {
            try {
                var d = f.contentDocument || f.contentWindow.document;
                if (d && d.body) return '#' + i + ': ' + (d.body.textContent || '').substring(0, 300);
            } catch (e) {}
            return '#' + i + ': blocked';
        });
    });
    console.log('\n9. IFrames:', iframes.length ? iframes[0] : 'none');

    console.log('\n=== NETLIST Logs ===');
    ms.forEach(function(m) { console.log(m.substring(0, 250)); });
    console.log('=== DONE ===');
}

main().catch(function(e) { console.error('FATAL:', e); process.exit(1); });
