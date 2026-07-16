'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var ctx = b.contexts()[0];
    var p = ctx.pages()[0];
    var session = await ctx.newCDPSession(p);
    var targets = await session.send('Target.getTargets');

    // Try every target that might have eda
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
            if (ev && ev.result && ev.result.result && ev.result.result.value !== 'undefined') {
                console.log('  EDA FOUND in ' + t.type + ' |', t.url.substring(0, 80), '|', ev.result.result.value);
                // try to get sch
                var ev2 = await session.send('Runtime.evaluate', {
                    expression: 'eda && eda.sch_SelectControl ? "has sch" : "no sch"',
                    returnByValue: true
                }, sid);
                console.log('    sch:', ev2.result.result.value);
                // save session for later use
                console.log('    sessionId:', sid);
            }
        } catch (e) { /* skip */ }
    }
    await b.close();
})();
