'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    var schTarget = targets.targetInfos.find(function (t) { return t.url.indexOf('sch-worker') >= 0; });
    var att = await session.send('Target.attachToTarget', { targetId: schTarget.targetId, flatten: false });
    var sid = att.sessionId;
    await session.send('Runtime.enable', {}, sid);

    async function ev(expr) {
        var r = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
        if (r && r.exceptionDetails) return 'EXC: ' + r.exceptionDetails.text;
        if (r && r.result && 'value' in r.result) return r.result.value;
        return 'NIL: ' + JSON.stringify(r).substring(0, 100);
    }

    // Check what EDA-related things exist in sch worker scope
    console.log('typeof sch:', await ev('typeof sch'));
    console.log('typeof __sch:', await ev('typeof __sch'));
    console.log('typeof onmessage:', await ev('typeof onmessage'));
    console.log('self.PRO_EDITOR_MODE:', await ev('self.PRO_EDITOR_MODE'));
    console.log('self.PRO_EDITOR_VERSION:', await ev('self.PRO_EDITOR_VERSION'));
    console.log('self.PRO_COMPRESS_BUILDDATE:', await ev('self.PRO_COMPRESS_BUILDDATE'));

    // Check functions named 'sch_*'
    var schFns = await ev('Object.getOwnPropertyNames(self).filter(k => k.indexOf("sch") === 0 || k.indexOf("Select") === 0).join(",")');
    console.log('sch_* / Select_* functions:', schFns);

    // Check globalThis
    console.log('globalThis.eda:', await ev('typeof globalThis.eda'));
    console.log('globalThis.__eda:', await ev('typeof globalThis.__eda'));

    // Maybe in a closure / module scope
    console.log('Symbol.for(eda):', await ev('typeof Symbol.for("eda")'));

    // Get self keys with 'sch' in them
    var keys = await ev('Object.getOwnPropertyNames(self).filter(k => k.toLowerCase().indexOf("sch") >= 0 || k.toLowerCase().indexOf("eda") >= 0).join(",")');
    console.log('keys with sch/eda:', keys);

    // Wait 10s and recheck
    console.log('\nWait 15s and recheck...');
    await new Promise(r => setTimeout(r, 15000));
    console.log('typeof self.eda:', await ev('typeof self.eda'));
    console.log('sch_* fns:', await ev('Object.getOwnPropertyNames(self).filter(k => k.indexOf("sch") === 0).join(",")'));

    await b.close();
})();
