/**
 * v1.0.10 Integration test — pure EDA API, no DOM
 */
'use strict';
var fs = require('fs');
var path = require('path');
var distPath = path.join(__dirname, '..', 'dist', 'index.js');
var code = fs.readFileSync(distPath, 'utf-8');

async function run() {
    console.log('=== Integration Test: v1.0.10 ===\n');

    var _dialogMsgs = [];
    global.eda = {
        sch_SelectControl: {
            getAllSelectedPrimitives_PrimitiveId: async function () {
                return ['prim_001', 'prim_002', 'prim_003'];
            },
            getSelectedPrimitives_PrimitiveId: async function () { return []; }
        },
        sch_Netlist: {
            getNetlist: async function () {
                return '(Net-PWR  U1-8  U2-8  U3-8)\n(Net-GND  U1-4  U2-4  U3-4)\n(Net-SCL  U1-6  J1-6)\n(Net-SDA  U1-5  J1-5)\n(Net-NC  U3-1)';
            }
        },
        sys_IFrame: {
            openIFrame: async function (file, w, h, id, props) {
                console.log('  IFrame:', file, w + 'x' + h, props ? props.title : '');
                return true;
            }
        },
        sys_Dialog: {
            showInformationMessage: function (msg) { _dialogMsgs.push('info:' + msg); },
            showWarningMessage: function (msg) { _dialogMsgs.push('warn:' + msg); }
        }
    };

    var _store = {};
    global.sessionStorage = { setItem: function(k,v){_store[k]=v}, getItem:function(k){return _store[k]} };

    // Load
    console.log('1. Loading...');
    eval(code.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName'));
    console.log('   OK\n');

    // Test 1: No selection
    console.log('2. No selection...');
    global.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function() { return []; };
    _dialogMsgs = [];
    await edaEsbuildExportName.analyzeSelection();
    console.log('   ' + (_dialogMsgs.some(function(m){return m.includes('框选')}) ? 'PASS' : 'FAIL') + '\n');

    // Test 2: Full analysis
    console.log('3. Full analysis...');
    _store = {};
    _dialogMsgs = [];
    global.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function() { return ['p1','p2','p3']; };
    await edaEsbuildExportName.analyzeSelection();

    var data = JSON.parse(_store['__netlist_result'] || '{}');
    var pass = data.components === 4 && data.nets === 5;

    console.log('   Comps:', data.components, 'Nets:', data.nets);
    console.log('   IFrame opened:', !!data.components);
    console.log('   sessionStorage:', pass ? 'OK' : 'FAIL');
    console.log('\n   ' + (pass ? 'ALL PASS' : 'FAIL'));
    if (!pass) process.exit(1);
    console.log('=== DONE ===');
}
run().catch(function(e){console.error(e);process.exit(1)});
