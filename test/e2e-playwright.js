'use strict';
var path = require('path');
var spawn = require('child_process').spawn;
var chromium = require('playwright-core').chromium;

var CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var DATA = path.join(__dirname, '.test-browser-data');
var URL = 'https://pro.lceda.cn/editor?cll=debug';
var PLUGIN = path.join(__dirname, '..', 'build', 'dist', 'local-netlist-analyzer_v1.0.4.eext');
var PORT = 9393;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
    console.log('=== Standalone Full Auto Test ===\n');

    // 不杀 Chrome — 用独立 port 和 user-data-dir

    // 启动 Chrome
    console.log('Starting Chrome...');
    var chrome = spawn(CHROME, [
        '--remote-debugging-port=' + PORT,
        '--user-data-dir=' + DATA,
        '--no-first-run', '--no-default-browser-check',
        URL,
    ], { stdio: 'ignore', detached: true });
    chrome.unref();
    await sleep(8000);
    console.log('Chrome started\n');

    // 连接
    var browser, page;
    try {
        browser = await chromium.connectOverCDP('http://localhost:' + PORT);
        page = browser.contexts()[0].pages()[0];
        await sleep(3000);
        console.log('Connected\n');

        // 收集日志
        var logs = [];
        page.on('console', function (m) {
            logs.push('[' + m.type() + '] ' + m.text().substring(0, 150));
        });

        // 等 EDA 加载完
        await page.waitForFunction(function () {
            return document.querySelectorAll('*').length > 100;
        }, { timeout: 30000 }).catch(function () {});
        await sleep(3000);
        console.log('EDA loaded\n');

        // 点高级菜单
        await page.evaluate(function () {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').trim() === '高级') {
                    all[i].click(); return;
                }
            }
        });
        await sleep(2000);

        // 查菜单
        var menus = await page.evaluate(function () {
            var found = [];
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').replace(/\s+/g, ' ').trim();
                if (t === '局部网表' || t === 'TEST' || t === '分析选中区域网表'
                    || t.includes('扩展管理器') || t.includes('运行脚本') || t.includes('脚本列表')
                    || t === 'Kimi AI 助手' || t === 'About...' || (t.includes('扩展') && t.length < 10)) {
                    found.push(all[i].tagName + ':' + t);
                }
            }
            return found;
        });
        console.log('高级菜单:', JSON.stringify(menus));

        // extension 日志
        var extLogs = logs.filter(function (l) {
            return l.includes('pro-api') || l.includes('7bdb0024') || l.includes('error') || l.includes('Error');
        });
        console.log('\n日志:', extLogs.join('\n') || '(none)');
        console.log('\n=== Done ===');

    } catch (e) {
        console.error('Fatal:', e.message);
    } finally {
        // 不关 browser，让用户能看到结果
        console.log('Browser stays open for review');
    }
})();
