'use strict';
/**
 * Comprehensive: try many things to wake EDA sch API
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);

    console.log('Title:', await p.title());
    console.log('URL:', p.url().substring(0, 80));

    // Force the page to focus by clicking on canvas first
    console.log('Focus canvas...');
    var c = await p.evaluate(() => {
        var list = [];
        for (var cc of document.querySelectorAll('canvas')) {
            var b = cc.getBoundingClientRect();
            if (b.width > 200 && b.height > 200) list.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
        return list[0];
    });
    if (c) {
        // Click in the center of schematic (on a wire or empty area)
        await p.mouse.click(c.x + c.w * 0.5, c.y + c.h * 0.95);
        console.log('  clicked (500, 95%)');
        await p.waitForTimeout(500);
        // Press Escape to ensure no modal
        await p.keyboard.press('Escape');
        await p.waitForTimeout(500);
        // Try Ctrl+A to select all
        await p.keyboard.press('Control+a');
        await p.waitForTimeout(3000);
    }

    // Now check all frames
    var frames = p.frames();
    console.log('Frames:', frames.length);
    for (var f of frames) {
        try {
            var info = await f.evaluate(() => {
                return {
                    hasEda: typeof window.eda !== 'undefined',
                    sch: typeof (window.eda && window.eda.sch_SelectControl) !== 'undefined',
                    manu: typeof (window.eda && window.eda.sch_ManufactureData) !== 'undefined'
                };
            });
            console.log('  [' + f.url().substring(0, 40) + ']', JSON.stringify(info));
        } catch (e) {}
    }

    var mainEda = await p.evaluate(() => {
        if (typeof window.eda === 'undefined') return { hasEda: false };
        return {
            hasEda: true,
            sch: !!window.eda.sch_SelectControl,
            manu: !!window.eda.sch_ManufactureData,
            sysIFrame: !!window.eda.sys_IFrame,
            keys: Object.keys(window.eda)
        };
    });
    console.log('Main:', JSON.stringify(mainEda, null, 2));

    // Wait 30s in case init is slow
    console.log('\nWait 30s...');
    for (var t = 0; t < 30; t++) {
        await p.waitForTimeout(1000);
        var probe = await p.evaluate(() => ({
            sch: !!(window.eda && window.eda.sch_SelectControl),
            manu: !!(window.eda && window.eda.sch_ManufactureData),
            loading: document.querySelectorAll('[class*=eda-loading]').length
        }));
        if (probe.sch) { console.log('  READY at t=' + t + 's'); break; }
        if (t % 5 === 4) console.log('  t=' + (t+1) + 's:', JSON.stringify(probe));
    }

    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/after-wake.png' });
    await b.close();
})();
