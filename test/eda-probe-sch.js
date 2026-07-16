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

    // List global vars
    var ev = await session.send('Runtime.evaluate', {
        expression: 'Object.keys(self).filter(k => k.length < 25).join(", ")',
        returnByValue: true
    }, sid);
    console.log('sch-worker globals:', ev.result && ev.result.result && ev.result.result.value);
    if (ev.result && ev.result.exceptionDetails) console.log('  err:', JSON.stringify(ev.result.exceptionDetails));

    // Look for globalThis / self
    var ev2 = await session.send('Runtime.evaluate', {
        expression: 'self.constructor.name + " | " + typeof importScripts + " | " + typeof postMessage',
        returnByValue: true
    }, sid);
    console.log('sch-worker type:', ev2.result.result.value);

    // Look for window.eda, self.eda, globalThis.eda
    var ev3 = await session.send('Runtime.evaluate', {
        expression: '["eda","EDA","_eda","__eda","onmessage","onmessageerror"].map(k => k + "=" + (typeof self[k])).join(", ")',
        returnByValue: true
    }, sid);
    console.log('sch-worker keys:', ev3.result.result.value);

    await b.close();
})();
