'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    var schTarget = targets.targetInfos.find(function (t) { return t.url.indexOf('sch-worker') >= 0; });
    var att = await session.send('Target.attachToTarget', { targetId: schTarget.targetId, flatten: true });
    var sid = att.sessionId;
    await session.send('Runtime.enable', {}, sid);

    async function ev(expr) {
        var r = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
        if (r.result && r.result.result) return r.result.result.value;
        if (r.result && r.result.exceptionDetails) return 'ERR: ' + r.result.exceptionDetails.text;
        return 'NIL';
    }

    console.log('self.eda:', await ev('self.eda ? "has" : "no"'));
    console.log('self.sch:', await ev('self.sch ? "has" : "no"'));
    console.log('typeof self:', await ev('typeof self'));
    console.log('Object.getOwnPropertyNames(self).slice(0,30).join(","):', await ev('Object.getOwnPropertyNames(self).slice(0,30).join(",")'));
    console.log('globalThis keys:', await ev('Object.getOwnPropertyNames(globalThis).slice(0,30).join(",")'));

    // Try postMessage to EDA
    console.log('try send message to eda system:');
    console.log('  onmessage:', await ev('typeof onmessage'));

    await b.close();
})();
