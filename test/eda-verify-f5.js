'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    var frames = p.frames();
    console.log('Frames:', frames.length);
    for (var i = 0; i < frames.length; i++) {
        console.log('  ['+i+']', frames[i].url().substring(0, 80));
    }

    // Check main frame
    var mainInfo = await p.evaluate(function () {
        return { hasEda: typeof window.eda !== 'undefined' };
    });
    console.log('Main EDA:', JSON.stringify(mainInfo));

    // For each frame, check
    for (var i = 0; i < frames.length; i++) {
        try {
            var info = await frames[i].evaluate(function () {
                return { hasEda: typeof window.eda !== 'undefined' };
            });
            console.log('  Frame['+i+']:', JSON.stringify(info));
        } catch (e) { console.log('  Frame['+i+'] err:', e.message.substring(0, 60)); }
    }

    // Check if extension menu is present
    var menu = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10) return false;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return true;
                }
                for (var c of (root.children || [])) if (walk(c, depth+1)) return true;
            } catch (e) {}
            return false;
        }
        return walk(document.body, 0);
    });
    console.log('Menu 局部网表 exists:', menu);

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/r1-after-f5.png' });
    console.log('Saved r1-after-f5.png');
    await b.close();
})();
