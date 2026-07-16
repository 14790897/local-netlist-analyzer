'use strict';
/**
 * Re-install the extension to user's Edge
 * This loads the local .eext via JLCEDA's extension manager
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var path = require('path');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // First, navigate to extension manager
    console.log('Navigate to extension manager...');
    await p.goto('https://pro.lceda.cn/extension-manager', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(8000);

    // Find the "local install" button
    var found = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var t = (root.textContent || '').trim();
                if ((t === '本地安装' || t === '导入扩展' || t === '安装本地扩展' || t === '从本地安装') && root.children.length < 2) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) {
                        return { x: r.x + r.width/2, y: r.y + r.height/2, text: t };
                    }
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var f = walk(c[i], depth + 1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('Local install button:', JSON.stringify(found));

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/x1-ext-mgr.png' });
    console.log('Saved x1-ext-mgr.png');
    await b.close();
})();
