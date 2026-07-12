'use strict';
var path = require('path');
var fs = require('fs');
var { chromium } = require('playwright-core');

var EEXT = path.resolve(__dirname, '..', 'build', 'dist', 'local-netlist-analyzer_v1.0.6.eext');
var AUTH = path.resolve(__dirname, 'auth.json');

if (!fs.existsSync(EEXT)) { console.error('EEXT missing'); process.exit(1); }
if (!fs.existsSync(AUTH)) { console.error('AUTH missing'); process.exit(1); }

async function main() {
    console.log('=== EDGE E2E: v1.0.6 ===\n');

    // 1. Launch Edge with auth
    console.log('1. Launching Edge...');
    var authState = JSON.parse(fs.readFileSync(AUTH, 'utf-8'));
    var ctx = await chromium.launchPersistentContext('', {
        channel: 'msedge',
        headless: false,
        storageState: authState,
        viewport: { width: 1440, height: 900 }
    });
    var page = ctx.pages()[0] || await ctx.newPage();

    // Monitor
    page.on('console', function(m) {
        var t = m.text();
        if (t.includes('NETLIST')) console.log('[N]', t.substring(0, 250));
    });

    try {
        // 2. Open EDA
        console.log('2. Opening EDA...');
        await page.goto('https://pro.lceda.cn/editor?cll=debug',
            { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(function(r) { setTimeout(r, 12000); });
        console.log('   Title:', (await page.title()).substring(0, 50));

        // 3. Check if logged in
        var body = await page.evaluate(function() {
            return (document.body.textContent || '').substring(0, 200);
        });
        var needsLogin = body.includes('请登录') || body.includes('立即登录');
        if (needsLogin) {
            console.log('   NEEDS LOGIN - scan QR in Edge!');
            await page.waitForFunction(function() {
                return !(document.body.textContent || '').includes('请登录');
            }, { timeout: 120000 }).catch(function() {});
            console.log('   Logged in');
            await new Promise(function(r) { setTimeout(r, 5000); });
        }

        // 4. Open extension manager
        console.log('3. Extension Manager...');
        // Click 高级
        await page.mouse.click(340, 16);
        await new Promise(function(r) { setTimeout(r, 2000); });

        // Find and click 扩展管理器
        var extMgrPos = await page.evaluate(function() {
            var items = document.querySelectorAll('[class*=eda-menu-item]');
            for (var i = 0; i < items.length; i++) {
                var t = (items[i].textContent || '').trim();
                if (t.includes('扩展管理器')) {
                    var r = items[i].getBoundingClientRect();
                    return { x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2) };
                }
            }
            return null;
        });
        if (!extMgrPos) {
            // Fallback to known coordinates
            extMgrPos = { x: 418, y: 98 };
        }
        console.log('   Clicking 扩展管理器 at', JSON.stringify(extMgrPos));
        await page.mouse.click(extMgrPos.x, extMgrPos.y);
        await new Promise(function(r) { setTimeout(r, 5000); });

        // 5. Look for 导入 button
        var importBtn = await page.evaluate(function() {
            var btns = document.querySelectorAll('button, [role=button], span');
            for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').trim();
                var r = btns[i].getBoundingClientRect();
                if ((t === '导入' || t.includes('导入扩展')) && r.width > 0) {
                    return { x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2) };
                }
            }
            return null;
        });

        if (importBtn) {
            console.log('   Import button at', JSON.stringify(importBtn));

            // Set up file chooser listener BEFORE clicking
            var filePromise = page.waitForEvent('filechooser', { timeout: 10000 });
            await page.mouse.click(importBtn.x, importBtn.y);
            await new Promise(function(r) { setTimeout(r, 1000); });

            try {
                var chooser = await filePromise;
                console.log('   File chooser opened');
                await chooser.setFiles(EEXT);
                console.log('   File set');
                await new Promise(function(r) { setTimeout(r, 8000); });
                console.log('   Extension imported!');
            } catch (e) {
                console.log('   File chooser failed:', String(e).substring(0, 100));
                // Try direct input method
                var inputs = await page.$$('input[type=file]');
                console.log('   Direct inputs found:', inputs.length);
                if (inputs.length > 0) {
                    await inputs[inputs.length - 1].setInputFiles(EEXT);
                    console.log('   Direct upload done');
                    await new Promise(function(r) { setTimeout(r, 5000); });
                }
            }
        } else {
            console.log('   Import button NOT found');
        }

        // Close extension manager
        await page.keyboard.press('Escape');
        await new Promise(function(r) { setTimeout(r, 3000); });

        // 6. Navigate to schematic
        console.log('4. Opening schematic...');

        // 工程 tab
        await page.evaluate(function() {
            var all = document.querySelectorAll('[class*=tab], div, span');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').trim() === '工程' && all[i].offsetWidth < 100) {
                    all[i].click(); return;
                }
            }
        });
        await new Promise(function(r) { setTimeout(r, 3000); });

        // Click project
        await page.evaluate(function() {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').trim().startsWith('墨鱼AI墨水屏')) {
                    all[i].click(); return;
                }
            }
        });
        await new Promise(function(r) { setTimeout(r, 4000); });

        // Double click schematic
        await page.evaluate(function() {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if (t === '原理图') {
                    all[i].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                    return;
                }
            }
        });
        console.log('   Waiting 20s for schematic render...');
        await new Promise(function(r) { setTimeout(r, 20000); });
        console.log('   Title:', (await page.title()).substring(0, 60));

        // 7. Check canvases
        var cvs = await page.evaluate(function() {
            return Array.from(document.querySelectorAll('canvas')).map(function(c) {
                var r = c.getBoundingClientRect();
                return { w: Math.floor(r.width), h: Math.floor(r.height),
                    x: Math.floor(r.x), y: Math.floor(r.y), parent: c.parentElement ? c.parentElement.tagName : '?' };
            });
        });
        console.log('   Canvases:', JSON.stringify(cvs));

        // 8. Check if 局部网表 is in menu
        await page.mouse.click(365, 16);
        await new Promise(function(r) { setTimeout(r, 1500); });
        var menuItems = await page.evaluate(function() {
            return Array.from(document.querySelectorAll('[class*=eda-menu-item]'))
                .map(function(e) { return (e.textContent || '').trim().substring(0, 20); })
                .filter(function(t) { return t.length > 0; });
        });
        console.log('   Menu:', JSON.stringify([...new Set(menuItems)]));
        await page.keyboard.press('Escape');
        await new Promise(function(r) { setTimeout(r, 500); });

        var hasExt = [...new Set(menuItems)].some(function(i) { return i.includes('局部网表'); });
        if (!hasExt) {
            console.log('   ERROR: Extension not loaded in schematic view!');
            console.log('   The EDA extension system may require page reload.');
            // Try reload
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(function(r) { setTimeout(r, 15000); });
            await page.mouse.click(365, 16);
            await new Promise(function(r) { setTimeout(r, 1500); });
            menuItems = await page.evaluate(function() {
                return Array.from(document.querySelectorAll('[class*=eda-menu-item]'))
                    .map(function(e) { return (e.textContent || '').trim().substring(0, 20); })
                    .filter(function(t) { return t.length > 0; });
            });
            console.log('   After reload:', JSON.stringify([...new Set(menuItems)]));
            await page.keyboard.press('Escape');
            await new Promise(function(r) { setTimeout(r, 500); });
        }

        // 9. Select and test
        var big = cvs.find(function(c) { return c.w > 400; });
        if (!big) big = cvs.find(function(c) { return c.w > 200; });
        if (big) {
            console.log('   Selecting on canvas', JSON.stringify(big));
            await page.mouse.move(big.x + 50, big.y + 50);
            await page.mouse.down();
            await new Promise(function(r) { setTimeout(r, 200); });
            await page.mouse.move(big.x + big.w - 50, big.y + big.h - 50, { steps: 10 });
            await new Promise(function(r) { setTimeout(r, 200); });
            await page.mouse.up();
            await new Promise(function(r) { setTimeout(r, 1000); });

            // Click menu
            await page.mouse.click(365, 16);
            await new Promise(function(r) { setTimeout(r, 1500); });
            await page.mouse.move(408, 126);
            await new Promise(function(r) { setTimeout(r, 1000); });
            await page.mouse.click(562, 125);
            await new Promise(function(r) { setTimeout(r, 8000); });
        }

        // 10. Results
        var iframes = await page.evaluate(function() {
            return Array.from(document.querySelectorAll('iframe')).map(function(f, i) {
                try {
                    var d = f.contentDocument || f.contentWindow.document;
                    if (d && d.body) return (d.body.textContent || '').substring(0, 300);
                } catch (e) { return '#' + i + ': blocked'; }
            });
        });
        console.log('\n=== Results ===');
        console.log('IFrames:', iframes.length ? iframes[0] : 'none');

    } finally {
        console.log('\nKeeping browser open 15s...');
        await new Promise(function(r) { setTimeout(r, 15000); });
        await ctx.close();
    }
    console.log('DONE');
}

main().catch(function(e) { console.error('FATAL:', e); process.exit(1); });
