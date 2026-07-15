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
const mockIFrames = [];

// 模拟原理图: R1, R2, U1
const mockComponents = [
    { designator: 'R1', name: '10k Resistor', pins: [{ pinNumber: '1', pinName: 'A' }, { pinNumber: '2', pinName: 'B' }] },
    { designator: 'R2', name: '1k Resistor',  pins: [{ pinNumber: '1', pinName: 'A' }, { pinNumber: '2', pinName: 'B' }] },
    { designator: 'U1', name: 'STM32F103C8T6', pins: [
        { pinNumber: '1', pinName: 'PB8' },
        { pinNumber: '2', pinName: 'PB9' },
        { pinNumber: '3', pinName: 'VDD' },
    ]},
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

// 模拟 Blob 文本 -> File 对象 (新版 API 返回 File)
function makeFile(text) {
    return {
        text: async function () { return text; },
        arrayBuffer: async function () {
            return new TextEncoder().encode(text).buffer;
        },
    };
}

global.eda = {
    sch_SelectControl: {
        getAllSelectedPrimitives_PrimitiveId: async function () {
            return mockComponents.map(function (comp) { return 'id_' + comp.designator; });
        },
        getSelectedPrimitives_PrimitiveId: async function () {
            return mockComponents.map(function (comp) { return 'id_' + comp.designator; });
        },
    },
    // Official API: sch_ManufactureData.getNetlistFile() (per prodocs.lceda.cn)
    sch_ManufactureData: {
        getNetlistFile: async function (fileName, netlistType) {
            console.log('  [mock] sch_ManufactureData.getNetlistFile() called, type=' + (netlistType || 'default'));
            return makeFile(mockNetlist);
        },
    },
    sys_Dialog: {
        showInformationMessage: function (msg) { mockDialogMsgs.push('[INFO] ' + msg); },
    },
    sys_ToastMessage: {
        showToastMessage: function (msg) { mockToastMsgs.push(msg); },
    },
    sys_IFrame: {
        showIFrame: function (opts) { mockIFrames.push(opts); },
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

    mockDialogMsgs.length = 0;
    mockToastMsgs.length = 0;
    mockIFrames.length = 0;

    await analyzeSelection();

    console.log('Toast:', mockToastMsgs);
    console.log('Dialog:', mockDialogMsgs);

    if (mockIFrames.length > 0) {
        var html = mockIFrames[0].htmlContent;
        console.log('\n=== FULL HTML (first 2000 chars) ===');
        console.log(html.substring(0, 2000));
        console.log('=== END ===');
        var hasR1 = html.includes('R1');
        var hasU1 = html.includes('U1');
        var hasVCC = html.includes('VCC');
        var hasGND = html.includes('GND');
        var hasNET = html.includes('NET_PB8');

        console.log('\nIFrame checks:');
        console.log('  R1:', hasR1 ? '✅' : '❌');
        console.log('  U1:', hasU1 ? '✅' : '❌');
        console.log('  VCC:', hasVCC ? '✅' : '❌');
        console.log('  GND:', hasGND ? '✅' : '❌');
        console.log('  NET_PB8:', hasNET ? '✅' : '❌');

        var allPass = hasR1 && hasU1 && hasVCC && hasGND && hasNET;

        // 提取网表文本
        var m = html.match(/<pre>([\s\S]*?)<\/pre>/);
        if (m) {
            var text = m[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
            console.log('\n--- 生成的网表 ---');
            console.log(text);
        }

        console.log('\n' + (allPass ? '✅ ALL PASS' : '❌ SOME FAILED'));
    } else {
        console.log('❌ No IFrame output');
        if (mockDialogMsgs.length > 0) {
            console.log('Dialogs:', mockDialogMsgs);
        }
    }
    console.log('');
}

runTest().catch(function (err) {
    console.error('Test crashed:', err);
    process.exit(1);
});
