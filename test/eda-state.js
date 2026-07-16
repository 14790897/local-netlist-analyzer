'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    var info = await p.evaluate(() => {
        // Look for any "ready" indicator
        var status = {};
        status.docReady = document.readyState;
        status.hasEda = typeof window.eda !== 'undefined';
        // Look for UI elements that indicate EDA is ready
        var els = document.querySelectorAll('[class*=status], [class*=loading], [class*=ready]');
        status.statusClasses = Array.from(els).slice(0, 5).map(e => e.className.substring(0, 30));
        // Look for canvas count and active tab
        status.canvasCount = document.querySelectorAll('canvas').length;
        status.activeTab = (function () {
            var t = document.querySelector('[class*=tab][class*=active], [class*=active]');
            return t ? t.textContent.substring(0, 30) : 'none';
        })();
        return status;
    });
    console.log('Page state:', JSON.stringify(info, null, 2));

    // Send a message to sch worker (simulate main thread init)
    // Actually we can use Target.sendMessageToTarget
    var session = await p.context().newCDPSession(p);
    var targets = await session.send('Target.getTargets');
    var schTarget = targets.targetInfos.find(t => t.url.indexOf('sch-worker') >= 0);
    console.log('sch target id:', schTarget.targetId);
    // Note: we can't easily send from main to sch worker via CDP
    // But we can dispatch DOM events on the main page that might trigger init

    // Try clicking on the page body
    await p.mouse.click(800, 400);
    await p.waitForTimeout(2000);

    // Recheck sch worker
    var att = await session.send('Target.attachToTarget', { targetId: schTarget.targetId, flatten: false });
    var sid = att.sessionId;
    await session.send('Runtime.enable', {}, sid);
    var r = await session.send('Runtime.evaluate', { expression: 'typeof self.eda', returnByValue: true }, sid);
    console.log('After click, eda in sch worker:', r.result.result.value);

    await b.close();
})();
