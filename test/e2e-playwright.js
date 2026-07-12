'use strict';
var chromium = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core').chromium;
var fs = require('fs');
var path = require('path');

var TEST_CODE = fs.readFileSync(path.join(__dirname, 'standalone-test.js'), 'utf-8');
var SCHEMATIC_URL = 'https://pro.lceda.cn/editor#id=d2a1d9e755cf45178d301791fb88a7d8,tab=*9718072c423d1642@d2a1d9e755cf45178d301791fb88a7d8';

(async function () {
    console.log('=== Functional Test ===\n');

    var authPath = path.join(__dirname, 'auth.json');
    var hasAuth = fs.existsSync(authPath);

    var context;
    if (hasAuth) {
        context = await chromium.launchPersistentContext('', {
            headless: false, channel: 'msedge',
            storageState: JSON.parse(fs.readFileSync(authPath, 'utf-8')),
        });
    } else {
        context = await chromium.launchPersistentContext('', {
            headless: false, channel: 'msedge',
        });
    }

    var page = context.pages()[0] || await context.newPage();
    var results = [];
    page.on('console', function (m) {
        var t = m.text();
        if (t.includes('[R]')) {
            console.log('>>', t.substring(0, 200));
            results.push(t);
        }
    });
    page.on('dialog', async function (d) {
        console.log('DIALOG:', d.message());
        results.push('DIALOG: ' + d.message());
        await d.dismiss();
    });

    // 1. 打开原理图
    console.log('1. Opening schematic...');
    await page.goto(SCHEMATIC_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    console.log('   Title:', (await page.title()).substring(0, 60));

    // 2. 检查是否登录
    var body = await page.evaluate(function () { return document.body.textContent || ''; });
    if (!body.includes('工作区') && !body.includes('14790897abc')) {
        console.log('   Need login... waiting 60s');
        await page.waitForFunction(function () {
            return (document.body.textContent || '').includes('工作区');
        }, { timeout: 60000 }).catch(function () {});
        await page.waitForTimeout(5000);
    }

    // 3. 框选元件
    console.log('\n2. Selecting components...');
    var canvas = await page.evaluate(function () {
        var cs = document.querySelectorAll('canvas');
        for (var i = 0; i < cs.length; i++) {
            var r = cs[i].getBoundingClientRect();
            if (r.width > 500) return { x: Math.floor(r.x), y: Math.floor(r.y), w: Math.floor(r.width), h: Math.floor(r.height) };
        }
        return null;
    });
    if (canvas) {
        await page.mouse.move(canvas.x + 200, canvas.y + 100);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.move(canvas.x + canvas.w - 200, canvas.y + canvas.h - 100, { steps: 10 });
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.waitForTimeout(1000);
        console.log('   Selected on canvas');
    } else {
        console.log('   No canvas — continuing anyway');
    }

    // 4. 打开运行脚本
    console.log('\n3. Opening 运行脚本...');
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
            var t = (all[i].textContent || '').trim();
            if (t.includes('运行脚本')) { all[i].click(); return; }
        }
    });
    await page.waitForTimeout(3000);

    // 5. 找代码编辑器并粘贴
    console.log('4. Pasting code...');

    // 尝试 Monaco editor
    var pasted = await page.evaluate(function (code) {
        // Method 1: Monaco
        var monaco = document.querySelector('.monaco-editor');
        if (monaco) {
            monaco.click();
            var lines = code.split('\n');
            var model = window.monaco && window.monaco.editor.getModels()[0];
            if (model) {
                model.setValue(code);
                return 'monaco-setValue';
            }
        }
        // Method 2: textarea
        var ta = document.querySelector('textarea');
        if (ta) {
            ta.focus();
            ta.value = code;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            return 'textarea';
        }
        // Method 3: contenteditable
        var ce = document.querySelector('[contenteditable="true"]');
        if (ce) {
            ce.focus();
            ce.textContent = code;
            return 'contenteditable';
        }
        return 'none';
    }, TEST_CODE);
    console.log('   Paste method:', pasted);
    await page.waitForTimeout(1000);

    // 6. 点运行按钮
    console.log('\n5. Clicking Run...');
    await page.evaluate(function () {
        var all = document.querySelectorAll('button, [role="button"], [class*="btn"]');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === '运行' || t === 'Run') { all[i].click(); return; }
        }
        // fallback: click any visible button
        for (var j = 0; j < all.length; j++) {
            if (all[j].offsetHeight > 0) { all[j].click(); return; }
        }
    });
    await page.waitForTimeout(5000);

    // 7. 结果
    console.log('\n=== Results ===');
    console.log('Console outputs:', results.length);
    for (var k = 0; k < results.length; k++) console.log(' ', results[k]);

    if (results.length === 0) {
        // 截图看状态
        await page.screenshot({ path: path.join(__dirname, 'final-run.png') });
        console.log('Screenshot saved: final-run.png');
    }

    console.log('\nDone');
})();
