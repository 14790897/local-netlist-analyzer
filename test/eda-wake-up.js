'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var session = await p.context().newCDPSession(p);

    async function scan() {
        var targets = await session.send('Target.getTargets');
        for (var t of targets.targetInfos) {
            if (t.type !== 'page' && t.type !== 'service_worker' && t.type !== 'worker') continue;
            try {
                var att = await session.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
                var sid = att.sessionId;
                await session.send('Runtime.enable', {}, sid);
                var ev = await session.send('Runtime.evaluate', {
                    expression: 'typeof eda',
                    returnByValue: true
                }, sid);
                var v = ev && ev.result && ev.result.result && ev.result.result.value;
                if (v && v !== 'undefined') {
                    console.log('  [' + t.type + ']', t.url.substring(0, 70), '| eda type:', v);
                }
            } catch (e) {}
        }
    }

    // Initial scan
    console.log('--- Before canvas click ---');
    await scan();

    // Click on canvas (schematic area)
    var canvas = await p.evaluate(function () {
        var list = [];
        for (var c of document.querySelectorAll('canvas')) {
            var b = c.getBoundingClientRect();
            if (b.width > 200 && b.height > 200) list.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
        return list;
    });
    console.log('Canvas:', JSON.stringify(canvas));
    if (canvas.length > 0) {
        var c = canvas[0];
        await p.mouse.click(c.x + c.w/2, c.y + c.h/2);
        console.log('Clicked canvas center');
    }
    await p.waitForTimeout(3000);

    console.log('\n--- After canvas click ---');
    await scan();

    // Also try a real select-all
    console.log('\n--- Try keyboard Ctrl+A ---');
    await p.keyboard.press('Control+a');
    await p.waitForTimeout(2000);
    await scan();

    await b.close();
})();
