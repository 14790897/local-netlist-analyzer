'use strict';
/**
 * Probe main frame for EDA sch - maybe the API is on window after workers connect
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    var info = await p.evaluate(function () {
        var res = {
            edaType: typeof eda,
            globalKeys: Object.keys(window).filter(function(k){
                return k === 'eda' || k.indexOf('EDA') === 0 || k === '__eda' || k === 'extensionManager';
            }),
            // Check prototype pollution
            edaKeys: typeof eda !== 'undefined' ? Object.keys(eda) : null
        };
        return res;
    });
    console.log('Main info:', JSON.stringify(info, null, 2));

    // Look in iframes
    var frames = p.frames();
    console.log('Frames:');
    for (var i = 0; i < frames.length; i++) {
        console.log('  ['+i+']', frames[i].url().substring(0, 100));
    }

    // Try to list iframes in DOM
    var iframes = await p.evaluate(function () {
        var list = [];
        function walk(root, depth) {
            if (depth > 10 || !root) return;
            try {
                var ifs = root.querySelectorAll ? root.querySelectorAll('iframe') : [];
                for (var i = 0; i < ifs.length; i++) {
                    var r = ifs[i].getBoundingClientRect();
                    list.push({ src: (ifs[i].src || '').substring(0, 60), w: r.width, h: r.height });
                }
                // Shadow DOM
                if (root.shadowRoot) walk(root.shadowRoot, depth + 1);
                var c = root.children || [];
                for (var j = 0; j < c.length; j++) walk(c[j], depth + 1);
            } catch (e) {}
        }
        walk(document, 0);
        return list;
    });
    console.log('DOM iframes:', JSON.stringify(iframes));

    await b.close();
})();
