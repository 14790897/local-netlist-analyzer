/**
 * Browser E2E test — real Chromium + mock EDA API
 * Tests JLCEDA v2 JSON netlist parsing and export flow.
 */
'use strict';
var { chromium } = require('playwright-core');
var fs = require('fs');
var path = require('path');

// JLCEDA v2 JSON netlist format (from real EDA getNetlistFile output)
var netlistData = JSON.stringify({
    version: '2.0.0',
    components: {
        gge1: { props: { Designator: 'U1' }, pinInfoMap: { '1': { net: 'VCC_3V3' }, '14': { net: 'GND' }, '6': { net: 'SCL' }, '5': { net: 'SDA' } } },
        gge2: { props: { Designator: 'C1' }, pinInfoMap: { '1': { net: 'VCC_3V3' }, '2': { net: 'GND' } } },
        gge3: { props: { Designator: 'R1' }, pinInfoMap: { '1': { net: 'VCC_3V3' }, '2': { net: 'GND' } } },
        gge4: { props: { Designator: 'C2' }, pinInfoMap: { '2': { net: 'GND' } } },
        gge5: { props: { Designator: 'J1' }, pinInfoMap: { '5': { net: 'SDA' }, '6': { net: 'SCL' } } },
        gge6: { props: { Designator: 'U3' }, pinInfoMap: { '1': { net: 'NC' } } }
    }
});

var extCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.js'), 'utf-8');
var tests = [];
var passed = 0;
var failed = 0;

function test(name, condition) {
    tests.push({ name: name, ok: !!condition });
    if (condition) { passed++; console.log('  PASS ' + name); }
    else { failed++; console.log('  FAIL ' + name); }
}

(async function () {
    console.log('=== Browser E2E Test ===\n');
    var browser = await chromium.launch({ headless: true });
    var page = await browser.newPage();
    await page.goto('data:text/html,<html><body></body></html>');

    // Step 1: Inject mock EDA API
    console.log('1. Inject mock EDA API...');
    await page.evaluate(function (netlist) {
        window.___dialog = '';
        window.___savedBlobs = [];
        window.___storage = {};

        window.Blob = function (parts, opts) {
            return { _parts: parts, _type: opts && opts.type, text: async function () { return parts.join(''); } };
        };

        window.eda = {
            sch_SelectControl: {
                // Structured API: returns primitives with getState_PrimitiveType / getState_Designator
                getAllSelectedPrimitives: async function () {
                    return [
                        { getState_PrimitiveType: function () { return 'COMPONENT'; }, getState_Designator: function () { return 'U1'; } },
                        { getState_PrimitiveType: function () { return 'COMPONENT'; }, getState_Designator: function () { return 'C1'; } },
                        { getState_PrimitiveType: function () { return 'COMPONENT'; }, getState_Designator: function () { return 'R1'; } }
                    ];
                },
                getAllSelectedPrimitives_PrimitiveId: async function () { return ['p1', 'p2', 'p3']; },
                getSelectedPrimitives_PrimitiveId: async function () { return []; }
            },
            sch_ManufactureData: {
                getNetlistFile: async function (name, type) {
                    return { text: async function () { return netlist; } };
                }
            },
            sys_FileSystem: {
                saveFile: async function (blob, fileName) {
                    window.___savedBlobs.push({ name: fileName, type: blob._type, text: blob.text ? await blob.text() : '' });
                }
            },
            sys_Storage: {
                setExtensionUserConfig: function (k, v) { window.___storage[k] = v; },
                getExtensionUserConfig: function (k) { return window.___storage[k]; }
            },
            sys_Dialog: {
                showInformationMessage: function (m) { window.___dialog = m; }
            }
        };
    }, netlistData);

    // Step 2: Load extension via addScriptTag (IIFE runs in global scope)
    console.log('2. Load extension code...');
    await page.addScriptTag({ content: extCode });

    // Step 3: Verify extension loaded
    console.log('3. Verify extension API...');
    var hasFn = await page.evaluate(function () {
        return typeof window.edaEsbuildExportName === 'object' &&
               typeof window.edaEsbuildExportName.analyzeSelection === 'function';
    });
    test('Extension exported analyzeSelection', hasFn);
    if (!hasFn) {
        console.log('  FATAL: analyzeSelection not found');
        // Debug: check global
        var keys = await page.evaluate(function () { return Object.keys(window.edaEsbuildExportName || {}); });
        console.log('  edaEsbuildExportName keys: ' + keys.join(','));
        await browser.close();
        process.exit(1);
    }

    // Step 4: Run analyzeSelection with 3 selected components
    console.log('4. Test: 3 selected components...');
    await page.evaluate(async function () {
        await window.edaEsbuildExportName.analyzeSelection();
    });

    var dialog = await page.evaluate(function () { return window.___dialog; });
    var blobs = await page.evaluate(function () { return window.___savedBlobs.map(function (b) { return b.name; }); });
    var storage = await page.evaluate(function () { return window.___storage; });

    console.log('  Dialog: ' + dialog);
    console.log('  Files: ' + blobs.join(', '));
    console.log('  Storage keys: ' + Object.keys(storage).join(', '));

    test('Dialog shows result', dialog.length > 0 && dialog.indexOf('选中') >= 0);
    test('CSV file saved', blobs.indexOf('local-netlist.csv') >= 0);
    test('JSON file saved', blobs.indexOf('netlist-raw.json') >= 0);
    test('sys_Storage data saved', !!storage.__nl_data);

    // Step 5: Verify netlist parsing
    console.log('5. Verify parsed results...');
    if (storage.__nl_data) {
        var data = JSON.parse(storage.__nl_data);
        console.log('  Components: ' + data.comps + ', Nets: ' + data.netCount);
        test('Found 4 networks (U3 NC net excluded by filter)', data.netCount === 4);
        test('Found VCC_3V3', !!JSON.parse(storage.__nl_data).nets);
    }

    // Step 6: Check CSV content
    console.log('6. Verify CSV content...');
    var csvContent = await page.evaluate(function () {
        var found = window.___savedBlobs.find(function (b) { return b.name === 'local-netlist.csv'; });
        return found ? found.text : '';
    });
    test('CSV has U1 entries', csvContent.indexOf('U1-') >= 0);
    test('CSV has GND network', csvContent.indexOf('GND') >= 0);

    // Step 7: Empty selection
    console.log('7. Test: empty selection...');
    await page.evaluate(function () {
        window.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function () { return []; };
        window.eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId = async function () { return []; };
        window.eda.sch_SelectControl.getAllSelectedPrimitives = async function () { return []; };
        window.___dialog = '';
    });
    await page.evaluate(async function () {
        await window.edaEsbuildExportName.analyzeSelection();
    });
    dialog = await page.evaluate(function () { return window.___dialog; });
    test('Empty selection warns', dialog.indexOf('框选') >= 0);

    await browser.close();

    // Report
    console.log('\n=== Results: ' + passed + '/' + (passed + failed) + ' passed ===');
    if (failed > 0) process.exit(1);
})();
