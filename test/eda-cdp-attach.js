'use strict';
/**
 * Use Playwright's CDPSession to attach to sch worker target.
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var ctx = b.contexts()[0];
    var p = ctx.pages()[0];

    // Browser-level CDP session (this can do Target.*)
    var browserSession = await ctx.newCDPSession(p);
    var targets = await browserSession.send('Target.getTargets');
    console.log('Total targets:', targets.targetInfos.length);
    var schTarget = targets.targetInfos.find(function (t) { return t.url.indexOf('sch-worker') >= 0; });
    if (!schTarget) {
        console.log('No sch-worker target. All targets:');
        targets.targetInfos.forEach(function (t) {
            console.log('  [' + t.type + ']', t.url.substring(0, 80));
        });
        process.exit(1);
    }
    console.log('Attaching to sch-worker:', schTarget.targetId);
    var att = await browserSession.send('Target.attachToTarget', { targetId: schTarget.targetId, flatten: true });
    var sessionId = att.sessionId;

    // Now use the sessionId to evaluate
    var ev = await browserSession.send('Runtime.evaluate', {
        expression: 'typeof eda + " | " + (eda && eda.sch_SelectControl ? "has sch_SelectControl" : "no sch")',
        returnByValue: true
    }, sessionId);
    console.log('sch-worker eval:', JSON.stringify(ev, null, 2));

    // If we got it, try full getAllSelectedPrimitives
    if (ev && ev.result && ev.result.result && ev.result.result.value && ev.result.result.value.indexOf('has sch') >= 0) {
        var sel = await browserSession.send('Runtime.evaluate', {
            expression: 'eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId().then(ids => ids ? ids.length : 0)',
            awaitPromise: true,
            returnByValue: true
        }, sessionId);
        console.log('Selection count via sch-worker:', JSON.stringify(sel.result, null, 2));
    }

    await b.close();
})().catch(e => console.log('ERR:', e.message));
