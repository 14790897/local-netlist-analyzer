'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    var schTarget = targets.targetInfos.find(function (t) { return t.url.indexOf('sch-worker') >= 0; });
    console.log('Attaching to sch-worker...');
    var att = await session.send('Target.attachToTarget', { targetId: schTarget.targetId, flatten: false });
    console.log('Attach result:', JSON.stringify(att).substring(0, 300));
    var sid = att.sessionId;
    await session.send('Runtime.enable', {}, sid);

    // Try simple eval
    var r = await session.send('Runtime.evaluate', {
        expression: '1+1',
        returnByValue: true
    }, sid);
    console.log('1+1:', JSON.stringify(r, null, 2).substring(0, 500));

    // Try with awaitPromise
    var r2 = await session.send('Runtime.evaluate', {
        expression: 'Promise.resolve("hello")',
        returnByValue: true,
        awaitPromise: true
    }, sid);
    console.log('promise:', JSON.stringify(r2, null, 2).substring(0, 500));

    // Try without returnByValue
    var r3 = await session.send('Runtime.evaluate', {
        expression: 'self.eda ? Object.keys(self.eda).slice(0,10).join(",") : "no eda"'
    }, sid);
    console.log('r3 (no returnByValue):', JSON.stringify(r3, null, 2).substring(0, 600));

    await b.close();
})();
