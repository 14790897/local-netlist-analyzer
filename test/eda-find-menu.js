'use strict';
/**
 * Locate the 局部网表 toolbar menu in the JLCEDA page
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    // Find ALL elements that contain "局部网表" or "AI 分析" text
    var found = await p.evaluate(function () {
        var results = [];
        function walk(root, depth) {
            if (depth > 10 || !root) return;
            try {
                var tw = (root.textContent || '').trim();
                if ((tw === '局部网表' || tw === 'AI 分析局部网表' || tw === '分析选中区域网表' || tw === 'AI 设置' || tw === 'AI 对话') && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    var tag = root.tagName;
                    results.push({ tag: tag, text: tw, x: r.x, y: r.y, w: r.width, h: r.height });
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) walk(c[i], depth + 1);
            } catch (e) {}
        }
        walk(document.body, 0);
        return results;
    });
    console.log('FOUND:');
    found.forEach(function (f) { console.log(' ', JSON.stringify(f)); });

    // Screenshot current page
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/m1-toolbar-find.png' });
    console.log('Saved m1-toolbar-find.png');

    await b.close();
})();
