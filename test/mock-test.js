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

// JLCEDA 格式网表
var mockNetlist = [
    '(VCC U1-3)',
    '(GND R1-1)',
    '(GND R2-1)',
    '(NET_PB8 U1-1 R1-2)',
    '(NET_PB9 U1-2 R2-2)',
].join('\n');

global.eda = {
    sch_SelectControl: {
        getAllSelectedPrimitives: async function () {
            return mockComponents.map(function (comp) {
                return {
                    getState_PrimitiveType: function () { return 'Component'; },
                    getState_PrimitiveId: function () { return 'id_' + comp.designator; },
                    getState_Designator: function () { return comp.designator; },
                    getState_Name: function () { return comp.name; },
                    getState_Manufacturer: function () { return comp.designator === 'U1' ? 'STMicro' : ''; },
                    getState_ManufacturerId: function () { return comp.designator === 'U1' ? 'C8734' : ''; },
                    getAllPins: async function () {
                        return comp.pins.map(function (p) {
                            return { pinNumber: p.pinNumber, pinName: p.pinName };
                        });
                    },
                };
            });
        },
    },
    sch_Netlist: {
        getNetlist: async function () {
            return mockNetlist;
        },
    },
    sys_Dialog: {
        showInformationMessage: function (msg) { mockDialogMsgs.push('[INFO] ' + msg); },
        showWarningMessage: function (msg) { mockDialogMsgs.push('[WARN] ' + msg); },
    },
    sys_ToastMessage: {
        showToastMessage: function (msg) { mockToastMsgs.push(msg); },
    },
    sys_IFrame: {
        showIFrame: function (opts) { mockIFrames.push(opts); },
    },
};

// ====== Load Plugin ======
var distCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.js'), 'utf-8');
eval(distCode);

// esbuild IIFE format: var edaEsbuildExportName = (()=>{...})()
// 替换为直接导出
var exportCode = distCode.replace(
    /var edaEsbuildExportName = \(\(\) => \{/,
    'module.exports = (() => {'
);
var analyzeSelection = eval(exportCode).analyzeSelection;

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
