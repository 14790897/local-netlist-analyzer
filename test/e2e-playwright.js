'use strict';
var path = require('path');
var fs = require('fs');
var { chromium } = require('playwright-core');

/** E2E test - supports both local interactive and CI automated modes */
(async function () {
    console.log('=== E2E Test ===\n');

    var AUTH_FILE = path.join(__dirname, 'auth.json');
    var hasAuth = fs.existsSync(AUTH_FILE);

    var context;
    if (hasAuth) {
        // CI mode: load stored auth
        console.log('CI mode: loading stored auth');
        var authState = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
        context = await chromium.launchPersistentContext('', {
            headless: false,
            channel: 'msedge',
            storageState: authState,
        });
    } else {
        // Local mode: fresh browser, user scans QR
        console.log('Local mode: fresh Edge, login required');
        context = await chromium.launchPersistentContext('', {
            headless: false,
            channel: 'msedge',
        });
    }

    var page = context.pages()[0] || await context.newPage();
    var logs = [];
    page.on('console', function (m) {
        var t = m.text();
        if (t.includes('NETLIST') || t.includes('error') || t.includes('Error') || t.includes('pro-api'))
            logs.push(t.substring(0, 300));
    });

    // Open EDA
    await page.goto('https://pro.lceda.cn/editor?cll=debug', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    console.log('Loaded:', (await page.title()).substring(0, 60));

    // Check login: look for user info instead of "登录"
    var needsLogin = await page.evaluate(function () {
        var body = document.body.textContent || '';
        // True login shows projects, not login button
        return body.includes('注册') && body.includes('登录') && !body.includes('工作区');
    });
    if (needsLogin) {
        console.log('\nPlease SCAN QR CODE in the Edge window to log in.');
        console.log('Waiting 120s for login...');
        await page.waitForFunction(function () {
            var b = document.body.textContent || '';
            return b.includes('工作区');
        }, { timeout: 120000 }).catch(function () {
            console.log('Login timeout - continuing anyway');
        });
        await page.waitForTimeout(5000);
    } else if (hasAuth) {
        console.log('(auth loaded, checking...)');
        await page.waitForTimeout(5000);
    }
    console.log('Logged in\n');

    // Import extension via MCP-compatible approach
    // Go to extension manager: 高级 -> 扩展管理器
    await page.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if ((all[i].textContent || '').trim() === '高级') { all[i].click(); return; }
        }
    });
    await page.waitForTimeout(1000);

    await page.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if ((all[i].textContent || '').trim().includes('扩展管理器')) { all[i].click(); return; }
        }
    });
    await page.waitForTimeout(3000);

    // File upload
    var PLUGIN = path.join(__dirname, '..', 'build', 'dist', 'local-netlist-analyzer_v1.0.5.eext');
    var fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
        // Try clicking import button
        await page.evaluate(function () {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if (t === '导入扩展' || t === '导入') { all[i].click(); return; }
            }
        });
        await page.waitForTimeout(2000);
        fileInput = await page.$('input[type="file"]');
    }
    if (fileInput) {
        await fileInput.setInputFiles(PLUGIN);
        await page.waitForTimeout(5000);
        console.log('Extension imported\n');
    } else {
        console.log('Could not find file input - extension may need manual import');
    }

    // Reload EDA
    await page.goto('https://pro.lceda.cn/editor?cll=debug', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(10000);
    console.log('EDA reloaded\n');

    // Check extension
    var extLogs = logs.filter(function (l) { return l.includes('NETLIST') || l.includes('pro-api'); });
    console.log('Extension logs:', extLogs.join('\n') || '(none)');

    // Check dropdown
    await page.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if ((all[i].textContent || '').trim() === '高级') { all[i].click(); return; }
        }
    });
    await page.waitForTimeout(1500);

    var dd = await page.evaluate(function () {
        return [].map.call(document.querySelectorAll('[class*="eda-menu-item-text_ClFKm"]'), function (e) {
            return (e.textContent || '').trim();
        });
    });
    console.log('Dropdown:', JSON.stringify(dd));

    // Find 局部网表
    var hasNetlist = dd.some(function (x) { return x === '局部网表'; });
    console.log('Has 局部网表:', hasNetlist);

    if (hasNetlist) {
        console.log('\n✅ Extension loaded! Now testing...');
        // Click 局部网表
        await page.evaluate(function () {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').trim() === '局部网表') { all[i].click(); return; }
            }
        });
        await page.waitForTimeout(1000);

        // Click 分析选中
        await page.evaluate(function () {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').trim().includes('分析选中')) { all[i].click(); return; }
            }
        });
        await page.waitForTimeout(5000);

        // Check for IFrame or dialog
        var ui = await page.evaluate(function () {
            var r = [];
            document.querySelectorAll('iframe, [class*="dialog"], [class*="modal"]').forEach(function (e) {
                if (e.offsetHeight > 20) r.push((e.textContent || '').substring(0, 300));
            });
            return r;
        });
        console.log('UI:', JSON.stringify(ui));
    }

    await page.screenshot({ path: path.join(__dirname, 'edge-test.png') });
    console.log('\nScreenshot: edge-test.png');

    console.log('\nAll logs:');
    console.log(logs.join('\n'));
    console.log('\n=== Done ===');

    // Keep open
    // await browser.close();
})();
