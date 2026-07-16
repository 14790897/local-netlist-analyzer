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

    // Capture worker console
    var consoleLogs = [];
    session.on('Runtime.consoleAPICalled', function (e) {
        consoleLogs.push({ type: e.type, args: (e.args || []).map(a => a.value || a.description).join(' ') });
    });
    await session.send('Runtime.enable', {}, sid);

    async function ev(expr) {
        var r = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
        if (r && r.exceptionDetails) return 'EXC';
        if (r && r.result && 'value' in r.result) return r.result.value;
        return 'NIL';
    }

    console.log('Initial eda:', await ev('typeof self.eda'));

    // Send a fake init message
    var post = await ev('postMessage({ type: "init", data: "test" })');
    console.log('postMessage returned:', post);
    await new Promise(r => setTimeout(r, 3000));
    console.log('After postMessage eda:', await ev('typeof self.eda'));

    // Try common EDA init patterns
    var patterns = [
        'eda = {}; typeof eda',
        'globalThis.eda = globalThis.eda || {}',
        'self.eda = self.eda || {}',
    ];
    for (var p2 of patterns) {
        var v = await ev(p2);
        console.log('  ', p2, '->', v);
    }

    console.log('\nConsole logs from sch worker:');
    consoleLogs.slice(-5).forEach(l => console.log('  ', l.type, ':', l.args));

    await b.close();
})();
