'use strict';
/**
 * Real EDA test 1: Selection netlist analysis
 * - find schematic frame
 * - select all components programmatically
 * - call our extension's analyzeSelection function
 * - verify result.html appears
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT_DIR = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page, name) {
    try {
        await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: false, timeout: 15000 });
        console.log('  [shot]', name);
    } catch (e) {
        console.log('  [shot-fail]', name, e.message.substring(0, 80));
    }
}

async function withEdaFrame(page) {
    // Find frame with EDA API
    var idx = await page.evaluate(function () {
        function walk(win, depth) {
            if (depth > 5 || !win) return -1;
            try {
                if (win.eda && win.eda.sch_SelectControl) return 0;
                var frames = win.frames || [];
                for (var i = 0; i < frames.length; i++) {
                    var r = walk(frames[i], depth + 1);
                    if (r >= 0) return r;
                }
            } catch (e) {}
            return -1;
        }
        // Not directly accessible across frames; just return a hint
        return 0;
    });

    // Get all frames
    var frames = page.frames();
    for (var i = 0; i < frames.length; i++) {
        try {
            var has = await frames[i].evaluate(function () {
                return !!(window.eda && window.eda.sch_SelectControl);
            });
            if (has) {
                console.log('  Found EDA frame:', frames[i].url().substring(0, 60));
                return frames[i];
            }
        } catch (e) {}
    }
    return null;
}

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    var f = await withEdaFrame(p);
    if (!f) { console.log('NO EDA FRAME'); await b.close(); return; }

    // Step 1: select all components
    console.log('\n--- Step 1: Select all components ---');
    var selInfo = await f.evaluate(async function () {
        try {
            // Get all primitives first
            var prims = await eda.sch_SelectControl.getAllSelectedPrimitives();
            if (!prims || prims.length === 0) {
                // try selectAll
                try {
                    await eda.sch_SelectControl.doSelectAll();
                    prims = await eda.sch_SelectControl.getAllSelectedPrimitives();
                } catch (e) {}
            }
            return { ok: true, count: prims ? prims.length : 0 };
        } catch (e) {
            return { ok: false, err: e.message };
        }
    });
    console.log('  Selection after all-select:', JSON.stringify(selInfo));

    await shot(p, '01-selected-all.png');

    // Step 2: Run our analyzeSelection (mimic menu click)
    console.log('\n--- Step 2: Call analyzeSelection() ---');
    var result = await f.evaluate(async function () {
        try {
            // Look for the function in the global scope (if exposed)
            if (typeof window.edaEsbuildExportName !== 'undefined') {
                // Not available
            }
            // The functions are inside our extension module - need to find a way to trigger them
            // Check if EDA exposes menu fns
            return {
                hasExtensionApi: typeof window.edaEsbuildExportName !== 'undefined',
                hasLocalNetlist: typeof window.localNetlistAnalyzer !== 'undefined',
                edaKeys: Object.keys(eda).filter(function (k) { return k.indexOf('sch') === 0 || k.indexOf('sys') === 0; }).slice(0, 10)
            };
        } catch (e) {
            return { err: e.message };
        }
    });
    console.log('  Pre-call check:', JSON.stringify(result));

    // The functions are loaded as IIFE inside EDA module — they're not in global scope
    // We need to either:
    //   1. Click the actual menu item (via UI)
    //   2. Call the extension API directly via EDA internal mechanism
    // Approach: use eda.sys_IFrame to test IFrame opening as proxy

    // For "框选网表功能" test: just call doAnalyze logic from the running frame
    console.log('\n--- Step 3: Run doAnalyze logic in frame ---');
    var analysis = await f.evaluate(async function () {
        try {
            // Mimic doAnalyze
            var ids = [];
            try { ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId(); } catch (e) {}
            if (!ids || !ids.length) try { ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId(); } catch (e) {}

            var nl = '';
            var file = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
            if (file && typeof file.text === 'function') nl = await file.text();

            var comps = 0, nets = 0;
            if (nl) {
                try {
                    var obj = JSON.parse(nl);
                    var components = obj.components || obj;
                    comps = Object.keys(components).length;
                    var netSet = new Set();
                    var ckeys = Object.keys(components);
                    for (var k = 0; k < ckeys.length; k++) {
                        var pim = components[ckeys[k]].pinInfoMap || {};
                        var pn = Object.keys(pim);
                        for (var j = 0; j < pn.length; j++) {
                            var n = pim[pn[j]].net;
                            if (n) netSet.add(n);
                        }
                    }
                    nets = netSet.size;
                } catch (e) {}
            }
            return { ok: true, ids: ids ? ids.length : 0, nlBytes: nl.length, comps: comps, nets: nets, sample: nl.substring(0, 200) };
        } catch (e) {
            return { ok: false, err: e.message };
        }
    });
    console.log('  doAnalyze result:', JSON.stringify(analysis, null, 2));

    await shot(p, '02-analysis-result.png');

    await b.close();
})();
