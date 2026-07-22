/**
 * Whole-schematic analysis test — v1.5.0
 * Tests analyzeWholeSchematic + aiAnalyzeWholeSchematic end-to-end with a
 * mocked EDA. Also re-runs analyzeSelection to confirm we didn't regress the
 * selection-based path.
 *
 * Pattern mirrors test/mock-test.js: same global EDA mock, same IIFE eval
 * pattern for the built bundle, same CASE A (default) / CASE B (opt-in).
 */
'use strict';

const path = require('path');
const fs = require('fs');

// ====== Mock EDA Global ======
const mockDialogMsgs = [];
const mockToastMsgs = [];
const mockSavedFiles = [];
const mockStorage = {};

// 5-component netlist (covers IC, R, C, L, Q variety)
const mockNetlist = JSON.stringify({
    version: '2.0.0',
    components: {
        gge1: {
            props: {
                Designator: 'U1',
                DeviceName: 'ESP32-C3-WROOM-02-N4',
                Value: '2.4GHz',
                Manufacturer: 'ESPRESSIF(乐鑫)',
                'Manufacturer Part': 'ESP32-C3-WROOM-02-N4',
                'Supplier Part': 'C2934560',
            },
            pinInfoMap: { '1': { net: '3V3' }, '2': { net: 'GND' }, '3': { net: 'EN' }, '4': { net: 'GPIO9' } }
        },
        gge2: {
            props: {
                Designator: 'R1',
                DeviceName: '0603WAF1002T5E',
                Value: '10kΩ',
                'Supplier Part': 'C25804',
            },
            pinInfoMap: { '1': { net: 'EN' }, '2': { net: 'GND' } }
        },
        gge3: {
            props: {
                Designator: 'C1',
                Value: '100nF',
            },
            pinInfoMap: { '1': { net: '3V3' }, '2': { net: 'GND' } }
        },
        gge4: {
            props: {
                Designator: 'L1',
                Value: '10uH',
            },
            pinInfoMap: { '1': { net: '3V3' }, '2': { net: 'VBUS' } }
        },
        gge5: {
            props: {
                Designator: 'Q1',
                DeviceName: 'AO3401A',
                Manufacturer: 'AOS(万代)',
                'Supplier Part': 'C20917',
            },
            pinInfoMap: { '1': { net: 'GND' }, '2': { net: 'GPIO9' }, '3': { net: 'VBUS' } }
        }
    }
});

// 模拟 Blob
global.Blob = function (parts, opts) { return { _parts: parts, _type: opts && opts.type }; };

function makeFile(text) {
    return {
        text: async function () { return text; },
        arrayBuffer: async function () { return new TextEncoder().encode(text).buffer; },
    };
}

global.eda = {
    sch_SelectControl: {
        getAllSelectedPrimitives: async function () { return []; },
        getAllSelectedPrimitives_PrimitiveId: async function () { return []; },
        getSelectedPrimitives_PrimitiveId: async function () { return []; },
    },
    sch_ManufactureData: {
        getNetlistFile: async function (name, type) {
            return makeFile(mockNetlist);
        },
    },
    sys_FileSystem: {
        saveFile: async function (blob, fileName) {
            mockSavedFiles.push({ name: fileName, type: blob._type });
        },
    },
    sys_Storage: {
        setExtensionUserConfig: function (k, v) { mockStorage[k] = v; },
        getExtensionUserConfig: function (k) { return mockStorage[k]; },
    },
    sys_Dialog: {
        showInformationMessage: function (msg) { mockDialogMsgs.push('[INFO] ' + msg); },
    },
    sys_ToastMessage: {
        showToastMessage: function (msg) { mockToastMsgs.push(msg); },
    },
};

// ====== Load Plugin ======
var distCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.js'), 'utf-8');
var globalCode = distCode.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName');
var _eval = eval; (0, _eval)(globalCode);
var analyzeWholeSchematic = globalThis.edaEsbuildExportName.analyzeWholeSchematic;
var aiAnalyzeWholeSchematic = globalThis.edaEsbuildExportName.aiAnalyzeWholeSchematic;
var analyzeSelection = globalThis.edaEsbuildExportName.analyzeSelection;

// ====== Run Test ======
async function runTest() {
    console.log('\n=== Whole-schematic Mock Test (v1.5.0) ===\n');

    var pass = 0, fail = 0;
    function t(name, cond) {
        if (cond) { pass++; console.log('  PASS ' + name); }
        else { fail++; console.log('  FAIL ' + name); }
    }

    // ---------- CASE A: whole-sch, default saveToDisk=false ----------
    mockDialogMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });

    await analyzeWholeSchematic();

    console.log('--- CASE A: whole-sch, default (no __file_config) ---');
    console.log('Dialog:', mockDialogMsgs.join('\n'));

    var dialogA = mockDialogMsgs[0] || '';
    t('A: dialog marked "整图分析"', /整图分析/.test(dialogA));
    t('A: dialog has 5元件', /5元件/.test(dialogA));
    // 5 nets from the mock: 3V3(U1.1, C1.1, L1.1), GND(U1.2, R1.2, C1.2, Q1.1),
    //                      EN(U1.3, R1.1), GPIO9(U1.4, Q1.2), VBUS(L1.2, Q1.3)
    t('A: dialog has 5网络', /5网络/.test(dialogA));
    t('A: no file written (default)', mockSavedFiles.length === 0);
    t('A: storage __nl_data set', !!mockStorage.__nl_data);

    var nlDataA = mockStorage.__nl_data ? JSON.parse(mockStorage.__nl_data) : null;
    var compInfoA = nlDataA && nlDataA.compInfo ? nlDataA.compInfo : {};
    t('A: compInfo covers all 5 desigs', Object.keys(compInfoA).length === 5);
    t('A: U1 has DeviceName', compInfoA.U1 && compInfoA.U1.name === 'ESP32-C3-WROOM-02-N4');
    t('A: R1 has Value 10kΩ', compInfoA.R1 && /10k/.test(compInfoA.R1.value));
    t('A: C1 has Value 100nF', compInfoA.C1 && /100nF/.test(compInfoA.C1.value));
    t('A: L1 has Value 10uH', compInfoA.L1 && /10uH/.test(compInfoA.L1.value));
    t('A: Q1 has manufacturer 万代', compInfoA.Q1 && /万代/.test(compInfoA.Q1.manufacturer));
    t('A: 2nd line shows U1 with model', /U1:.*ESP32/.test(dialogA));
    t('A: 2nd line shows R1 with 10kΩ', /R1:.*10k/.test(dialogA));

    // ---------- CASE B: whole-sch, opt-in saveToDisk=true ----------
    mockDialogMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });
    mockStorage.__file_config = JSON.stringify({ saveToDisk: true });

    await analyzeWholeSchematic();

    console.log('\n--- CASE B: whole-sch, saveToDisk=true ---');
    console.log('Saved files:', mockSavedFiles.map(function (f) { return f.name; }).join(', '));

    var csvSavedB = mockSavedFiles.some(function (f) { return f.name === 'local-netlist.csv'; });
    var jsonSavedB = mockSavedFiles.some(function (f) { return f.name === 'netlist-raw.json'; });
    t('B: CSV saved', csvSavedB);
    t('B: JSON saved', jsonSavedB);
    t('B: compInfo still in storage', Object.keys(JSON.parse(mockStorage.__nl_data).compInfo).length === 5);

    // ---------- CASE C: aiAnalyzeWholeSchematic with no API key ----------
    mockDialogMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });
    // No __ai_config → loadAIConfig returns default { key: '' }
    await aiAnalyzeWholeSchematic();

    console.log('\n--- CASE C: AI whole-sch without API key ---');
    var dialogC = mockDialogMsgs[0] || '';
    t('C: prompts to configure API key', /请先配置 AI API Key/.test(dialogC));
    t('C: no AI prefill set', !mockStorage.__ai_prefill);

    // ---------- CASE D: AI whole-sch WITH API key ----------
    mockDialogMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });
    mockStorage.__ai_config = JSON.stringify({ endpoint: 'https://api.openai.com/v1', key: 'sk-test', model: 'gpt-4o-mini' });
    await aiAnalyzeWholeSchematic();

    console.log('\n--- CASE D: AI whole-sch WITH API key ---');
    t('D: __ai_prefill set', !!mockStorage.__ai_prefill);
    var prefillD = mockStorage.__ai_prefill || '';
    t('D: prefill says "整张原理图"', /整张原理图/.test(prefillD));
    t('D: prefill has 器件清单', /器件清单/.test(prefillD));
    t('D: prefill has 5 元件 count', /5 个元件/.test(prefillD));
    t('D: prefill has 5 网络 count', /5 个网络/.test(prefillD));

    // ---------- REGRESSION: analyzeSelection still works ----------
    mockDialogMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });
    // Switch mock: pretend user selected 2 components (U1 + R1)
    global.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function () { return ['p1', 'p2']; };
    global.eda.sch_SelectControl.getAllSelectedPrimitives = async function () {
        return [
            { getState_PrimitiveType: function () { return 'Component'; }, getState_Designator: function () { return 'U1'; } },
            { getState_PrimitiveType: function () { return 'Component'; }, getState_Designator: function () { return 'R1'; } }
        ];
    };
    await analyzeSelection();

    console.log('\n--- REGRESSION: analyzeSelection still 2-comp output ---');
    var dialogR = mockDialogMsgs[0] || '';
    console.log('Dialog:', dialogR);
    t('R: analyzeSelection still works', /2选中/.test(dialogR) && /2元件/.test(dialogR));
    t('R: selection path uses "选中" not "整图"', /整图/.test(dialogR) === false);

    console.log('\n=== Results: ' + pass + '/' + (pass + fail) + ' passed ===');
    if (fail > 0) process.exit(1);
}

runTest().catch(function (err) {
    console.error('Test crashed:', err);
    process.exit(1);
});
