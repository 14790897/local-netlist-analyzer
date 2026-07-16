'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);

    // All frames and eda state
    var frames = p.frames();
    console.log('Frames:', frames.length);
    for (var f of frames) {
        try {
            var info = await f.evaluate(() => {
                var res = { hasEda: typeof window.eda !== 'undefined' };
                if (res.hasEda) {
                    var schKeys = Object.keys(window.eda).filter(k => k.indexOf('sch') === 0 || k.indexOf('Select') === 0);
                    res.schKeys = schKeys;
                    res.totalKeys = Object.keys(window.eda).length;
                }
                return res;
            });
            console.log('  [' + f.url().substring(0, 50) + ']', JSON.stringify(info));
        } catch (e) { console.log('  err:', e.message.substring(0, 60)); }
    }

    // Main page eda keys
    var mainEda = await p.evaluate(() => {
        if (typeof window.eda === 'undefined') return 'no eda';
        return {
            schKeys: Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).slice(0, 5),
            sysKeys: Object.keys(window.eda).filter(k => k.indexOf('sys') === 0).slice(0, 5),
            total: Object.keys(window.eda).length
        };
    });
    console.log('Main eda:', JSON.stringify(mainEda));

    // Active tab
    var active = await p.evaluate(() => {
        var t = document.querySelector('[class*=tab-active], [class*=active]');
        return t ? t.textContent.substring(0, 30) : 'none';
    });
    console.log('Active tab:', active);

    // Check 'icon-eda-loading'
    var loading = await p.evaluate(() => {
        return document.querySelectorAll('[class*=eda-loading]').length;
    });
    console.log('icon-eda-loading count:', loading);

    await b.close();
})();
