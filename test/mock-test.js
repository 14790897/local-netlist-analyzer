/**
 * EDA Mock Test — Node.js 中验证插件逻辑
 * 用法: node test/mock-test.js
 */
'use strict';

const path = require('path');
const fs = require('fs');

// ====== Mock EDA Global ======
const mockDialogMsgs = [];
const mockToastMsgs = [];
const mockSavedFiles = [];
const mockStorage = {};

// 模拟原理图: R1, R2, U1
const mockComponents = [
    { designator: 'U1', name: 'STM32F103C8T6', pins: [
        { pinNumber: '1', pinName: 'PB8' },
        { pinNumber: '2', pinName: 'PB9' },
        { pinNumber: '3', pinName: 'VDD' },
    ]},
    { designator: 'R1', name: '10k Resistor', pins: [{ pinNumber: '1', pinName: 'A' }, { pinNumber: '2', pinName: 'B' }] },
    { designator: 'R2', name: '1k Resistor',  pins: [{ pinNumber: '1', pinName: 'A' }, { pinNumber: '2', pinName: 'B' }] },
];

// JLCEDA v2.0.0 格式网表 (真实 JSON 格式)
var mockNetlist = JSON.stringify({
    version: '2.0.0',
    components: {
        gge1: {
            props: { Designator: 'U1' },
            pinInfoMap: { '1': { net: '3V3' }, '2': { net: 'GND' }, '3': { net: 'VCC' } }
        },
        gge2: {
            props: { Designator: 'R1' },
            pinInfoMap: { '1': { net: 'GND' }, '2': { net: 'NET_PB8' } }
        },
        gge3: {
            props: { Designator: 'R2' },
            pinInfoMap: { '1': { net: 'GND' }, '2': { net: 'NET_PB9' } }
        }
    }
});

// 模拟 Blob
global.Blob = function (parts, opts) { return { _parts: parts, _type: opts && opts.type }; };

// 模拟 File 对象 (getNetlistFile 返回)
function makeFile(text) {
    return {
        text: async function () { return text; },
        arrayBuffer: async function () { return new TextEncoder().encode(text).buffer; },
    };
}

global.eda = {
    sch_SelectControl: {
        // Structured API: returns primitives with getState_PrimitiveType / getState_Designator
        getAllSelectedPrimitives: async function () {
            return mockComponents.map(function (comp) {
                return {
                    getState_PrimitiveType: function () { return 'COMPONENT'; },
                    getState_Designator: function () { return comp.designator; }
                };
            });
        },
        getAllSelectedPrimitives_PrimitiveId: async function () {
            return mockComponents.map(function (comp) { return 'id_' + comp.designator; });
        },
        getSelectedPrimitives_PrimitiveId: async function () {
            return mockComponents.map(function (comp) { return 'id_' + comp.designator; });
        },
    },
    sch_ManufactureData: {
        getNetlistFile: async function (fileName, netlistType) {
            console.log('  [mock] sch_ManufactureData.getNetlistFile() called, type=' + (netlistType || 'default'));
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

// ====== Load Plugin (IIFE → globalThis) ======
var distCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.js'), 'utf-8');
// Replace 'var edaEsbuildExportName' with 'globalThis.edaEsbuildExportName' so indirect eval works
var globalCode = distCode.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName');
var _eval = eval; (0, _eval)(globalCode);
var analyzeSelection = globalThis.edaEsbuildExportName.analyzeSelection;

// ====== Run Test ======
async function runTest() {
    console.log('\n=== EDA Extension Mock Test ===\n');

    // ---------- CASE A: default (saveToDisk=false in v1.3.9) ----------
    mockDialogMsgs.length = 0;
    mockToastMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });

    await analyzeSelection();

    console.log('--- CASE A: default (no __file_config set) ---');
    console.log('Dialog:', mockDialogMsgs.join('\n'));
    console.log('Saved files:', mockSavedFiles.map(function (f) { return f.name; }).join(', ') || '(none)');
    console.log('Storage keys:', Object.keys(mockStorage).join(', '));

    var dialogA = mockDialogMsgs[0] || '';
    var hasCompsA = dialogA.indexOf('3元件') >= 0;
    var hasNetsA = dialogA.indexOf('5网络') >= 0;
    var hasVCCA = dialogA.indexOf('3V3') >= 0;
    var hasGNDA = dialogA.indexOf('GND') >= 0;
    var csvSavedA = mockSavedFiles.some(function (f) { return f.name === 'local-netlist.csv'; });
    var jsonSavedA = mockSavedFiles.some(function (f) { return f.name === 'netlist-raw.json'; });
    var storageOkA = !!mockStorage.__nl_data;

    console.log('\n  Found 3 components:', hasCompsA ? '\u2705' : '\u274c');
    console.log('  Found 5 networks:', hasNetsA ? '\u2705' : '\u274c');
    console.log('  Has 3V3 net:', hasVCCA ? '\u2705' : '\u274c');
    console.log('  Has GND net:', hasGNDA ? '\u2705' : '\u274c');
    console.log('  No file written (default):', (!csvSavedA && !jsonSavedA) ? '\u2705' : '\u274c');
    console.log('  Storage data:', storageOkA ? '\u2705' : '\u274c');

    var caseApass = hasCompsA && hasNetsA && hasVCCA && hasGNDA && !csvSavedA && !jsonSavedA && storageOkA;

    // ---------- CASE B: user opts in via __file_config.saveToDisk=true ----------
    mockDialogMsgs.length = 0;
    mockSavedFiles.length = 0;
    Object.keys(mockStorage).forEach(function (k) { delete mockStorage[k]; });
    mockStorage.__file_config = JSON.stringify({ saveToDisk: true });

    await analyzeSelection();

    console.log('\n--- CASE B: __file_config.saveToDisk=true (user opt-in) ---');
    console.log('Dialog:', mockDialogMsgs.join('\n'));
    console.log('Saved files:', mockSavedFiles.map(function (f) { return f.name; }).join(', '));

    var csvSavedB = mockSavedFiles.some(function (f) { return f.name === 'local-netlist.csv'; });
    var jsonSavedB = mockSavedFiles.some(function (f) { return f.name === 'netlist-raw.json'; });
    var storageOkB = !!mockStorage.__nl_data;

    console.log('\n  CSV saved:', csvSavedB ? '\u2705' : '\u274c');
    console.log('  JSON saved:', jsonSavedB ? '\u2705' : '\u274c');
    console.log('  Storage data:', storageOkB ? '\u2705' : '\u274c');

    var caseBpass = csvSavedB && jsonSavedB && storageOkB;

    var allPass = caseApass && caseBpass;
    console.log('\n' + (allPass ? '\u2705 ALL PASS (CASE A default + CASE B opt-in)' : '\u274c SOME FAILED'));
    if (!allPass) process.exit(1);
}

runTest().catch(function (err) {
    console.error('Test crashed:', err);
    process.exit(1);
});
