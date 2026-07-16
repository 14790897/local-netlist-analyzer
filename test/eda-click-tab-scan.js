'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // Find and click the Schematic1_3 tab in the breadcrumb
    var tabPos = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10) return null;
            try {
                var t = (root.textContent || '').trim();
                if (t === 'P1.Schematic1_3' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
                }
                for (var c of (root.children || [])) {
                    var f = walk(c, depth+1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('Sch tab pos:', JSON.stringify(tabPos));
    if (tabPos) {
        await p.mouse.click(tabPos.x, tabPos.y);
        console.log('Clicked');
    }
    await p.waitForTimeout(3000);

    // Now re-scan
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    var found = false;
    for (var t of targets.targetInfos) {
        if (t.type !== 'page' && t.type !== 'service_worker' && t.type !== 'worker') continue;
        try {
            var att = await session.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
            var sid = att.sessionId;
            await session.send('Runtime.enable', {}, sid);
            var ev = await session.send('Runtime.evaluate', {
                expression: 'typeof eda + " | " + (eda && eda.sch_SelectControl ? "has sch" : "no sch")',
                returnByValue: true
            }, sid);
            if (ev && ev.result && ev.result.result && ev.result.result.value && ev.result.result.value.indexOf('|') >= 0) {
                var v = ev.result.result.value;
                if (v.indexOf('undefined') < 0 || v.indexOf('has sch') >= 0) {
                    console.log('  [' + t.type + ']', t.url.substring(0, 70), '|', v);
                    if (v.indexOf('has sch') >= 0) found = true;
                }
            }
        } catch (e) {}
    }
    if (!found) console.log('Still no sch API found');

    // Also check main page frames
    var frames = p.frames();
    for (var f of frames) {
        try {
            var info = await f.evaluate(function () {
                return { hasEda: typeof window.eda !== 'undefined', hasSch: !!(window.eda && window.eda.sch_SelectControl) };
            });
            console.log('  frame:', f.url().substring(0, 60), '|', JSON.stringify(info));
        } catch (e) {}
    }

    await b.close();
})();
