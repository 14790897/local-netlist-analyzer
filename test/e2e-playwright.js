'use strict';
var chromium = require('playwright-core').chromium;

var PORT = 9273;

(async function () {
    console.log('=== EDA Cache Reset ===\n');
    var browser = await chromium.connectOverCDP('http://localhost:' + PORT);
    var page = browser.contexts()[0].pages()[0];

    await page.goto('https://pro.lceda.cn/editor?cll=debug', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 清除存储
    await page.evaluate(function () {
        localStorage.clear();
        sessionStorage.clear();
        console.log('[TEST] storage cleared');
    });
    console.log('Storage cleared\n');

    // 截图
    await page.screenshot({ path: __dirname + '/test-screenshot.png' });
    console.log('Screenshot saved\n');

    console.log('Done. Now re-import the extension via MCP.');
})();
