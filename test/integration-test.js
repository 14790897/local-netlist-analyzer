/**
 * Integration test: 模拟 EDA API，完整测试 analyzeSelection 全链路
 * 包括: 选中检测 → 网表获取 → 网表解析 → sessionStorage 写入 → openIFrame 调用
 */
'use strict';

var fs = require('fs');
var path = require('path');

// 加载编译后的扩展代码
var distPath = path.join(__dirname, '..', 'dist', 'index.js');
var code = fs.readFileSync(distPath, 'utf-8');

async function run() {
    console.log('=== Integration Test: v1.0.6 ===\n');

    // --- Mock EDA API ---
    global.eda = {
        sch_SelectControl: {
            getSelectedPrimitives_PrimitiveId: async function () {
                return ['prim_001', 'prim_002', 'prim_003'];
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
            showInformationMessage: function (msg) {},
            showWarningMessage: function (msg) {}
        },
        sys_ToastMessage: {
            showToastMessage: function (msg) {}
        }
    };

    var _store = {};
    global.sessionStorage = {
        setItem: function (k, v) { _store[k] = v; },
        getItem: function (k) { return _store[k]; }
    };

    // 加载扩展 - 替换 var edaEsbuildExportName 为 globalThis.edaEsbuildExportName
    console.log('1. Loading extension...');
    try {
        var modifiedCode = code.replace('var edaEsbuildExportName', 'globalThis.edaEsbuildExportName');
        eval(modifiedCode);
        console.log('   OK\n');
    } catch (e) {
        console.error('   FAIL:', e.message);
        process.exit(1);
    }

    // Test 1: 无选中
    console.log('2. No selection...');
    eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId = async function () { return []; };
    await edaEsbuildExportName.analyzeSelection();
    console.log('   PASS\n');

    // Test 2: 完整分析
    console.log('3. Full analysis...');
    _store = {};
    eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId = async function () { return ['p1', 'p2', 'p3']; };
    await edaEsbuildExportName.analyzeSelection();

    var data = JSON.parse(_store['__netlist_result'] || '{}');
    console.log('   Selected count:', data.selectedCount);
    console.log('   Components:', data.components, '(U1 U2 U3 J1)');
    console.log('   Nets:', data.nets, '(Net-PWR Net-GND Net-SCL Net-SDA Net-NC)');

    var pass = data.components === 4 && data.nets === 5;
    var comps = data.componentList || [];
    var nets = data.netList || {};
    pass = pass && comps.some(function(c) { return c.des === 'U1'; });
    pass = pass && comps.some(function(c) { return c.des === 'J1'; });

    console.log('\n   ' + (pass ? 'ALL PASS' : 'FAIL'));
    console.log('\n=== DONE ===');
    if (!pass) process.exit(1);
}

run().catch(function(e) { console.error(e); process.exit(1); });
