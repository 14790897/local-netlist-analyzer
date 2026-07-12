/**
 * Browser E2E test — real Chromium, real DOM, mock EDA API
 * No login required. Catches browser-specific bugs (Array.from, window, etc.)
 */
'use strict';
var { chromium } = require('playwright-core');
var fs = require('fs');
var path = require('path');

var netlistData = [
    'NET: VCC_3V3',
    '  U1-1',
    '  C1-1',
    '  R1-1',
    'NET: GND',
    '  U1-14',
    '  C1-2',
    '  R1-2',
    '  C2-2',
    'NET: SCL',
    '  U1-6',
    '  J1-6',
    'NET: SDA',
    '  U1-5',
    '  J1-5',
    'NET: NC',
    '  U3-1'
].join('\n');

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
    // Navigate to a real page so sessionStorage works
    await page.goto('data:text/html,<html><body></body></html>');

    // Step 1: Inject mock EDA API + mock storage into browser context
    // Must mock sessionStorage before extension loads (data: URL blocks it)
    console.log('1. Inject mock EDA API...');
    await page.evaluate(function (netlist) {
        // Mock storage (extension calls sessionStorage.setItem)
        window.___store = {};
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                setItem: function (k, v) { window.___store[k] = v; },
                getItem: function (k) { return window.___store[k]; },
            },
            writable: true, configurable: true
        });
        window.eda = {
            sch_SelectControl: {
                getAllSelectedPrimitives_PrimitiveId: async function () { return ['p1', 'p2', 'p3']; },
                getSelectedPrimitives_PrimitiveId: async function () { return []; }
            },
            sch_Netlist: {
                getNetlist: async function (fmt) { return netlist; }
            },
            sys_ToastMessage: {
                showToastMessage: function (m) { window.__toast = m; }
            },
            sys_Dialog: {
                showWarningMessage: function (m) { window.__warn = m; },
                showInformationMessage: function (m) { window.__info = m; }
            },
            sys_IFrame: {
                openIFrame: async function (file, w, h, id, props) {
                    window.__iframeFile = file;
                    window.__iframeProps = props;
                }
            },
            sys_FileSystem: {
                saveFile: async function (opts) {
                    window.__savedFile = opts.fileName;
                    window.__savedContent = opts.content;
                }
            }
        };
        window.__toast = '';
        window.__warn = '';
        window.__info = '';
        window.__iframeFile = '';
        window.__iframeProps = null;
    }, netlistData);

    // Step 2: Load extension code in browser
    // esbuild creates "var edaEsbuildExportName = ..." — patch to window.
    console.log('2. Load extension code...');
    await page.evaluate(function (code) {
        code = code.replace('var edaEsbuildExportName = ', 'window.edaEsbuildExportName = ');
        (0, eval)(code);
    }, extCode);

    // Step 3: Verify extension loaded
    console.log('3. Verify extension API...');
    var hasFn = await page.evaluate(function () {
        return typeof window.edaEsbuildExportName === 'object' &&
               typeof window.edaEsbuildExportName.analyzeSelection === 'function';
    });
    test('Extension exported analyzeSelection', hasFn);
    if (!hasFn) {
        console.log('FATAL: extension not loaded');
        await browser.close();
        process.exit(1);
    }

    // Step 4: Run analyzeSelection with 3 selected components
    console.log('4. Test: 3 selected components...');
    await page.evaluate(async function () {
        await window.edaEsbuildExportName.analyzeSelection();
    });

    var toast = await page.evaluate(function () { return window.__toast; });
    var warn = await page.evaluate(function () { return window.__warn; });
    var info = await page.evaluate(function () { return window.__info; });
    var iframeFile = await page.evaluate(function () { return window.__iframeFile; });
    var iframeProps = await page.evaluate(function () { return window.__iframeProps ? window.__iframeProps.title : ''; });
    var sessionData = await page.evaluate(function () { return window.___store.__netlist_result; });

    test('Toast popup fired', toast.length > 0);
    test('Warning dialog fired', warn.length > 0);
    test('Info dialog fired', info.length > 0);

    // Step 5: Verify netlist parsing results
    console.log('5. Verify netlist results...');
    if (sessionData) {
        var data = JSON.parse(sessionData);
        console.log('  sessionData components=' + data.components + ' nets=' + data.nets);
        test('6 components parsed', data.components === 6);
        test('5 nets parsed', data.nets === 5);
        test('Component U1 exists', data.componentList.indexOf('U1') >= 0);
        test('Component J1 exists', data.componentList.indexOf('J1') >= 0);
        test('Net SCL has U1-6', data.netList['SCL'] && data.netList['SCL'].indexOf('U1-6') >= 0);
    } else {
        test('sessionStorage saved', false);
    }

    // Step 6: Test empty selection
    console.log('6. Test: empty selection...');
    await page.evaluate(function () {
        window.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function () { return []; };
        window.__toast = '';
        window.__warn = '';
    });
    await page.evaluate(async function () {
        await window.edaEsbuildExportName.analyzeSelection();
    });
    toast = await page.evaluate(function () { return window.__toast; });
    warn = await page.evaluate(function () { return window.__warn; });
    test('Empty selection fires warning', toast.includes('框选') || warn.includes('框选'));

    // Step 7: Test without Array.from (desktop EDA ES5 quirk)
    console.log('7. Test: ES5 compatibility...');
    var es5Ok = await page.evaluate(async function () {
        try {
            var saveFrom = Array.from;
            Array.from = undefined; // Simulate ES5 desktop EDA
            await window.edaEsbuildExportName.analyzeSelection();
            Array.from = saveFrom;
            return !!window.__toast; // Should still work without Array.from
        } catch (e) {
            if (typeof saveFrom !== 'undefined') Array.from = saveFrom;
            return false;
        }
    });
    test('Works without Array.from (desktop EDA compat)', es5Ok);

    await browser.close();

    // Report
    console.log('\n=== Results: ' + passed + '/' + (passed + failed) + ' passed ===');
    if (failed > 0) process.exit(1);
})();
