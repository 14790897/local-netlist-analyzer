'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    for (var t of targets.targetInfos) {
        var u = t.url;
        if (u.indexOf('worker') < 0) continue;
        if (t.type !== 'worker' && t.type !== 'service_worker') continue;
        try {
            var att = await session.send('Target.attachToTarget', { targetId: t.targetId, flatten: false });
            var sid = att.sessionId;
            await session.send('Runtime.enable', {}, sid);
            var r = await session.send('Runtime.evaluate', {
                expression: 'self.eda ? "HAS EDA: " + Object.keys(self.eda).filter(k=>k.indexOf("sch")===0).join(",") : "no eda"',
                returnByValue: true
            }, sid);
            var v = r.result && r.result.result && r.result.result.value;
            console.log('  [' + t.type + ']', u.substring(0, 60), '|', v);
        } catch (e) { console.log('  [' + t.type + ']', u.substring(0, 60), 'err:', e.message.substring(0, 50)); }
    }
    await b.close();
})();
