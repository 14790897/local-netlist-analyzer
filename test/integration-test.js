/**
 * v1.0.26 Integration test — new sch_ManufactureData.getNetlistFile() API
 */
'use strict';
var fs = require('fs');
var path = require('path');
var distPath = path.join(__dirname, '..', 'dist', 'index.js');
var code = fs.readFileSync(distPath, 'utf-8');

async function run() {
    console.log('=== Integration Test: v1.0.26 ===\n');

    // Real JLCEDA NET: format netlist
    var realNetlist = [
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

    // Simulate File object returned by new API
    function makeFile(text) {
        return {
            text: async function () { return text; },
            arrayBuffer: async function () { return new TextEncoder().encode(text).buffer; },
        };
    }

    global.eda = {
        sch_SelectControl: {
            getAllSelectedPrimitives_PrimitiveId: async function() { return ['p1','p2','p3'];}
        },
        // Official API (per prodocs.lceda.cn)
        sch_ManufactureData: {
            getNetlistFile: async function(fileName, netlistType) {
                console.log('  [itest] getNetlistFile called, type=' + (netlistType || 'default'));
                return makeFile(realNetlist);
            }
        },
        sys_IFrame: {
            openIFrame: async function() { return true; }
        },
        sys_Dialog: {
            showInformationMessage: function() {}
        },
        sys_ToastMessage: { showToastMessage: function() {} },
        sys_FileSystem: { saveFile: async function() {} }
    };
    global.sessionStorage = { setItem:function(){}, getItem:function(){} };

    console.log('1. Loading...');
    var globalCode = code.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName');
    var _eval = eval; (0, _eval)(globalCode);
    console.log('   OK\n');

    console.log('2. Full analysis...');
    await globalThis.edaEsbuildExportName.analyzeSelection();
    console.log('   PASS\n');
    console.log('=== DONE ===');
}
run().catch(function(e){console.error(e);process.exit(1)});
