'use strict';
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];

    // List all eda keys
    var keys = await p.evaluate(() => {
        if (typeof window.eda === 'undefined') return 'no eda';
        return Object.keys(window.eda).filter(k => k.indexOf('sch') === 0 || k.indexOf('Select') === 0 || k.indexOf('Manufacture') === 0).join(', ');
    });
    console.log('EDA sch/manu/select keys:', keys);

    // Look in all frames
    var frames = p.frames();
    for (var f of frames) {
        try {
            var info = await f.evaluate(() => {
                if (typeof window.eda === 'undefined') return 'no eda';
                return { hasSch: !!window.eda.sch_SelectControl, schKeys: Object.keys(window.eda).filter(k => k.indexOf('sch') === 0).slice(0, 10) };
            });
            console.log('  Frame', f.url().substring(0, 50), ':', JSON.stringify(info));
        } catch (e) {}
    }

    // Try calling sch_ManufactureData directly (it might exist even without sch_SelectControl)
    var mfg = await p.evaluate(() => {
        if (typeof window.eda === 'undefined' || !window.eda.sch_ManufactureData) return 'no sch_ManufactureData';
        return Object.keys(window.eda.sch_ManufactureData).join(', ');
    });
    console.log('sch_ManufactureData keys:', mfg);

    // Try calling getNetlistFile
    var netlist = await p.evaluate(async () => {
        if (typeof window.eda === 'undefined' || !window.eda.sch_ManufactureData) return 'no';
        try {
            var f = await window.eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
            if (!f) return 'no file';
            var t = await f.text();
            return t ? t.length + ' bytes' : 'empty text';
        } catch (e) { return 'err: ' + e.message; }
    });
    console.log('Netlist:', netlist);

    await b.close();
})();
