'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);

    // Try various things to trigger EDA init

    // 1. Click in canvas center
    console.log('Click canvas center...');
    var c = await p.evaluate(() => {
        var list = [];
        for (var cc of document.querySelectorAll('canvas')) {
            var b = cc.getBoundingClientRect();
            if (b.width > 200 && b.height > 200) list.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
        return list[0];
    });
    if (c) {
        await p.mouse.click(c.x + c.w/2, c.y + c.h/2);
        console.log('  clicked at', c.x + c.w/2, c.y + c.h/2);
    }
    await p.waitForTimeout(3000);

    var state1 = await p.evaluate(() => ({
        hasEda: typeof window.eda !== 'undefined',
        loading: document.querySelectorAll('[class*=eda-loading]').length
    }));
    console.log('After canvas click:', JSON.stringify(state1));

    // 2. Try keyboard shortcut for menu (Alt+L for 局部网表)
    console.log('Try keyboard Alt+L...');
    await p.keyboard.press('Alt+l');
    await p.waitForTimeout(2000);

    var state2 = await p.evaluate(() => ({
        hasEda: typeof window.eda !== 'undefined',
        loading: document.querySelectorAll('[class*=eda-loading]').length
    }));
    console.log('After Alt+L:', JSON.stringify(state2));

    // 3. Force focus on the canvas
    if (c) {
        await p.mouse.move(c.x + 100, c.y + 100);
        await p.mouse.down();
        await p.mouse.up();
    }
    await p.waitForTimeout(3000);

    var state3 = await p.evaluate(() => ({
        hasEda: typeof window.eda !== 'undefined',
        loading: document.querySelectorAll('[class*=eda-loading]').length
    }));
    console.log('After canvas mouse down:', JSON.stringify(state3));

    // 4. Try clicking on a visible component (like U1 / esp32s3)
    console.log('Click on U1 (esp32s3) area...');
    // The esp32s3 chip is in the upper-middle of canvas
    if (c) {
        // U1 chip is at center-upper
        await p.mouse.click(c.x + c.w * 0.35, c.y + c.h * 0.2);
        await p.waitForTimeout(3000);
    }

    var state4 = await p.evaluate(() => ({
        hasEda: typeof window.eda !== 'undefined',
        loading: document.querySelectorAll('[class*=eda-loading]').length,
        schKeys: typeof window.eda !== 'undefined' ? Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).length : 0
    }));
    console.log('After U1 click:', JSON.stringify(state4));

    await b.close();
})();
