/**
 * v1.0.8 Integration test: 模拟 EDA API + document，完整测试全链路
 */
'use strict';

var fs = require('fs');
var path = require('path');

var distPath = path.join(__dirname, '..', 'dist', 'index.js');
var code = fs.readFileSync(distPath, 'utf-8');

async function run() {
    console.log('=== Integration Test: v1.0.8 ===\n');

    // Mock EDA API
    global.eda = {
        sch_SelectControl: {
            getAllSelectedPrimitives_PrimitiveId: async function () {
                return ['prim_001', 'prim_002', 'prim_003'];
            },
            getSelectedPrimitives_PrimitiveId: async function () {
                return []; // fallback — shouldn't be called
            }
        },
        sch_Netlist: {
            getNetlist: async function () {
                return [
                    '(Net-PWR  U1-8  U2-8  U3-8)',
                    '(Net-GND  U1-4  U2-4  U3-4)',
                    '(Net-SCL  U1-6  J1-6)',
                    '(Net-SDA  U1-5  J1-5)',
                    '(Net-NC  U3-1)'
                ].join('\n');
            }
        },
        sys_IFrame: {
            openIFrame: async function (htmlFile, width, height, id, props) {
                console.log('  IFrame:', htmlFile, width + 'x' + height, props ? props.title : '');
                return true;
            }
        },
        sys_Dialog: {
            showInformationMessage: function () {},
            showWarningMessage: function () {}
        },
        sys_ToastMessage: {
            showToastMessage: function () {}
        }
    };

    // Mock document + parent + top (multi-fallback in v1.0.9)
    var _panels = [];
    var _closeBtn = { onclick: null };
    var _mockDoc = {
        getElementById: function (id) {
            if (id === '__nl_close') return _closeBtn;
            return _panels.find(function (p) { return p.id === id; }) || null;
        },
        createElement: function (tag) {
            var el = { tag: tag, id: '', innerHTML: '', style: {}, onclick: null, textContent: '', _removed: false, cssText: '' };
            el.remove = function () { el._removed = true; };
            return el;
        },
        body: {
            appendChild: function (el) { el.id = el.id || '__nl_result'; _panels.push(el); }
        }
    };
    global.document = _mockDoc;
    global.parent = { document: _mockDoc };
    global.top = { document: _mockDoc };

    var _store = {};
    global.sessionStorage = {
        setItem: function (k, v) { _store[k] = v; },
        getItem: function (k) { return _store[k]; }
    };

    // Load extension
    console.log('1. Loading extension...');
    try {
        var modifiedCode = code.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName');
        eval(modifiedCode);
        console.log('   OK\n');
    } catch (e) {
        console.error('   FAIL:', e.message);
        process.exit(1);
    }

    // Test 1: No selection
    console.log('2. No selection...');
    eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function () { return []; };
    _panels = [];
    _closeBtn.onclick = null;
    await edaEsbuildExportName.analyzeSelection();
    var panelText = '';
    for (var pi = 0; pi < _panels.length; pi++) {
        if (_panels[pi].id === '__nl_result') { panelText = _panels[pi].innerHTML || ''; break; }
    }
    var hasHint = panelText.includes('框选');
    console.log('   ' + (hasHint ? 'PASS' : 'FAIL') + ': panel shows hint\n');

    // Test 2: Full analysis
    console.log('3. Full analysis...');
    _store = {};
    _panels = [];
    _closeBtn.onclick = null;
    eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId = async function () { return ['p1', 'p2', 'p3']; };
    await edaEsbuildExportName.analyzeSelection();

    // Check DOM panel content
    panelText = '';
    for (var pi = 0; pi < _panels.length; pi++) {
        if (_panels[pi].id === '__nl_result') { panelText = _panels[pi].innerHTML || ''; break; }
    }
    var panelOk = panelText.includes('Net-PWR') && panelText.includes('U1-8');

    // Check sessionStorage backup
    var data = JSON.parse(_store['__netlist_result'] || '{}');
    var storageOk = data.components === 4 && data.nets === 5;
    var hasU1 = (data.componentList || []).some(function (c) { return c.des === 'U1'; });
    var hasJ1 = (data.componentList || []).some(function (c) { return c.des === 'J1'; });

    console.log('   Components:', data.components, '(U1 U2 U3 J1)');
    console.log('   Nets:', data.nets, '(Net-PWR Net-GND Net-SCL Net-SDA Net-NC)');
    console.log('   DOM panel:', panelOk ? 'OK' : 'MISSING');
    console.log('   sessionStorage:', storageOk ? 'OK' : 'FAIL');

    var allPass = storageOk && hasU1 && hasJ1 && panelOk;
    console.log('\n   ' + (allPass ? 'ALL PASS' : 'SOME FAILED'));
    console.log('\n=== DONE ===');
    if (!allPass) process.exit(1);
}

run().catch(function (e) { console.error(e); process.exit(1); });
