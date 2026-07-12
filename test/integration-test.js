/**
 * v1.0.17 Integration test — uses real JLCEDA NET: format
 */
'use strict';
var fs = require('fs');
var path = require('path');
var distPath = path.join(__dirname, '..', 'dist', 'index.js');
var code = fs.readFileSync(distPath, 'utf-8');

async function run() {
    console.log('=== Integration Test: v1.0.17 ===\n');

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

    global.eda = {
        sch_SelectControl: {
            getAllSelectedPrimitives_PrimitiveId: async function() { return ['p1','p2','p3'];}
        },
        sch_Netlist: {
            getNetlist: async function() { return realNetlist; }
        },
        sys_IFrame: {
            openIFrame: async function() { return true; }
        },
        sys_Dialog: {
            showInformationMessage: function() {},
            showWarningMessage: function() {}
        },
        sys_ToastMessage: { showToastMessage: function() {} },
        sys_FileSystem: { saveFile: async function() {} }
    };
    global.sessionStorage = { setItem:function(){}, getItem:function(){} };

    console.log('1. Loading...');
    eval(code.replace('var edaEsbuildExportName','globalThis.edaEsbuildExportName'));
    console.log('   OK\n');

    console.log('2. Full analysis...');
    await edaEsbuildExportName.analyzeSelection();
    console.log('   PASS\n');
    console.log('=== DONE ===');
}
run().catch(function(e){console.error(e);process.exit(1)});
