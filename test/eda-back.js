'use strict';
/**
 * Go back to project and re-install extension
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Go back to project
    console.log('Go to project...');
    await p.goto('https://pro.lceda.cn/editor?cll=debug#id=d2a1d9e755cf45178d301791fb88a7d8,tab=*9718072c423d1642@d2a1d9e755cf45178d301791fb88a7d8', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(15000);
    console.log('Title:', await p.title());

    // Check if extension menu "局部网表" exists
    var menuExists = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return false;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return true;
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) if (walk(c[i], depth+1)) return true;
            } catch (e) {}
            return false;
        }
        return walk(document.body, 0);
    });
    console.log('  局部网表 menu exists:', menuExists);

    // Check EDA sch frame
    var schFound = null;
    var frames = p.frames();
    for (var i = 0; i < frames.length; i++) {
        try {
            var has = await frames[i].evaluate(function () { return !!(window.eda && window.eda.sch_SelectControl); });
            if (has) { schFound = frames[i]; console.log('  EDA sch frame['+i+']:', frames[i].url().substring(0,80)); break; }
        } catch (e) {}
    }
    if (!schFound) console.log('  EDA sch frame NOT found');

    // Take screenshot
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/x2-back-to-proj.png' });
    await b.close();
})();
