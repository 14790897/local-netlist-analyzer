/**
 * v1.0.10 Integration test — .enet JSON format
 */
'use strict';
var fs = require('fs');
var path = require('path');
var distPath = path.join(__dirname, '..', 'dist', 'index.js');
var code = fs.readFileSync(distPath, 'utf-8');

async function run() {
    console.log('=== Integration Test: v1.0.10 ===\n');

    // .enet format JSON
    var enetJson = {
        "U1": { props: { Designator: "U1" }, pins: { "8": "Net-PWR", "4": "Net-GND", "6": "Net-SCL", "5": "Net-SDA" } },
        "U2": { props: { Designator: "U2" }, pins: { "8": "Net-PWR", "4": "Net-GND" } },
        "U3": { props: { Designator: "U3" }, pins: { "8": "Net-PWR", "4": "Net-GND", "1": "Net-NC" } },
        "J1": { props: { Designator: "J1" }, pins: { "6": "Net-SCL", "5": "Net-SDA" } }
    };

    global.eda = {
        sch_SelectControl: {
            getAllSelectedPrimitives_PrimitiveId: async function() { return ['p1','p2','p3']; },
            getSelectedPrimitives_PrimitiveId: async function() { return []; }
        },
        sch_Netlist: {
            getNetlist: async function() { return JSON.stringify(enetJson); }
        },
        sys_IFrame: {
            openIFrame: async function(file, w, h, id, props) {
                console.log('  IFrame:', file, w + 'x' + h, props ? props.title : '');
                return true;
            }
        },
        sys_Dialog: {
            showInformationMessage: function() {},
            showWarningMessage: function() {}
        }
    };

    var _store = {};
    global.sessionStorage = { setItem: function(k,v){_store[k]=v}, getItem:function(k){return _store[k]} };

    console.log('1. Loading...');
    eval(code.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName'));
    console.log('   OK\n');

    // Test: No selection
    console.log('2. No selection...');
    global.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function() { return []; };
    await edaEsbuildExportName.analyzeSelection();
    console.log('   PASS\n');

    // Test: Full analysis
    console.log('3. Full analysis...');
    _store = {};
    global.eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function() { return ['p1','p2','p3']; };
    await edaEsbuildExportName.analyzeSelection();

    var data = JSON.parse(_store['__netlist_result'] || '{}');
    console.log('   Comps:', data.components, '(U1 U2 U3 J1)');
    console.log('   Nets:', data.nets, '(Net-PWR Net-GND Net-SCL Net-SDA Net-NC)');

    var pass = data.components === 4 && data.nets === 5;
    console.log('\n   ' + (pass ? 'ALL PASS' : 'FAIL'));
    if (!pass) process.exit(1);
    console.log('=== DONE ===');
}
run().catch(function(e){console.error(e);process.exit(1)});
