'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    for (var t of targets.targetInfos) {
        var u = t.url;
        if (u.indexOf('pro.lceda.cn') < 0) continue;
        if (t.type !== 'worker') continue;
        try {
            var att = await session.send('Target.attachToTarget', { targetId: t.targetId, flatten: false });
            var sid = att.sessionId;
            await session.send('Runtime.enable', {}, sid);

            // Use proper async function with result extraction
            async function ev(expr) {
                var r = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
                // Playwright CDPSession flatten=true: r = { result: RemoteObject, exceptionDetails? }
                if (r && r.exceptionDetails) return 'EXC: ' + r.exceptionDetails.text;
                if (r && r.result && 'value' in r.result) return r.result.value;
                if (r && r.result && r.result.subtype === 'error') return 'ERR: ' + r.result.description;
                return 'NIL: ' + JSON.stringify(r).substring(0, 100);
            }

            console.log('\n--- ' + u + ' ---');
            console.log('  1+1:', await ev('1+1'));
            console.log('  typeof self.eda:', await ev('typeof self.eda'));
            console.log('  self keys (count):', await ev('Object.getOwnPropertyNames(self).length'));
            console.log('  self has 任何 API:', await ev('Object.getOwnPropertyNames(self).slice(0, 20).join(",")'));
        } catch (e) { console.log('  err:', e.message.substring(0, 100)); }
    }
    await b.close();
})();
