/**
 * 存储 EDA 登录态到文件，供 CI 使用
 * 运行: node test/save-auth.js
 * 输出: test/auth.json
 */
var { chromium } = require('playwright-core');
var path = require('path');
var fs = require('fs');

(async function () {
    console.log('Opening browser for EDA login...\n');
    var context = await chromium.launchPersistentContext('', {
        headless: false,
        channel: 'msedge',
    });
    var page = context.pages()[0] || await context.newPage();

    await page.goto('https://pro.lceda.cn/editor?cll=debug', { waitUntil: 'networkidle', timeout: 30000 });

    console.log('Please LOG IN to EDA in the opened Edge window.');
    console.log('Waiting for login (max 120s)...\n');

    // 等登录完成
    try {
        await page.waitForFunction(function () {
            return !(document.body.textContent || '').includes('登录');
        }, { timeout: 120000 });
    } catch (e) {
        console.log('Login timeout - saving anyway');
    }

    // 保存 storage state
    var state = await context.storageState();
    var outPath = path.join(__dirname, 'auth.json');
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    console.log('Auth saved to:', outPath);
    console.log('Upload this file as GitHub Secret: EDA_AUTH_STATE\n');

    await context.close();
})();
