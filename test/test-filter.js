// 单元测试 v1.3.2 doAnalyze 过滤逻辑
// 用真实 sch 状态重建一份 minimal 但有代表性的网表作为 ground truth
// (基于之前在 9269 Edge 看到的 __nl_data 和 raw netlist)

const fs = require('fs');

// 从之前测试保存的 netlist_raw 重建 minimal netlist
const netlist = {
  version: '2.0.0',
  components: {
    // U1: 19 pins (墨鱼墨水屏主控)
    u1: {
      props: { Designator: 'U1', Name: 'EPD_CTRL' },
      pinInfoMap: {
        1:  { number: '1',  net: '3V3' },
        2:  { number: '2',  net: 'EN' },
        3:  { number: '3',  net: 'CLK' },
        4:  { number: '4',  net: 'IO5' },
        5:  { number: '5',  net: 'DIN' },
        6:  { number: '6',  net: 'CS' },
        7:  { number: '7',  net: '3V3' },
        8:  { number: '8',  net: 'IO9' },
        9:  { number: '9',  net: 'GND' },
        10: { number: '10', net: 'BUSY' },
        11: { number: '11', net: 'RXD' },
        12: { number: '12', net: '3V3' },
        17: { number: '17', net: 'DC' },
        19: { number: '19', net: 'GND' },
      }
    },
    // FPC1: FPC connector
    fpc1: {
      props: { Designator: 'FPC1' },
      pinInfoMap: {
        5:  { number: '5',  net: 'RXD' },
        9:  { number: '9',  net: 'BUSY' },
        10: { number: '10', net: 'IO2' },
        11: { number: '11', net: 'DC' },
        12: { number: '12', net: 'CS' },
        13: { number: '13', net: 'CLK' },
        14: { number: '14', net: 'DIN' },
        15: { number: '15', net: '3V3' },
        25: { number: '25', net: 'GND' },
      }
    },
    // R1, R2, R3: 电阻
    r1: { props: { Designator: 'R1' }, pinInfoMap: { 1: {number:'1', net:'LED1'}, 2: {number:'2', net:'IO3'} } },
    r2: { props: { Designator: 'R2' }, pinInfoMap: { 1: {number:'1', net:'GND'}, 2: {number:'2', net:'RESE'} } },
    r3: { props: { Designator: 'R3' }, pinInfoMap: { 1: {number:'1', net:'GND'}, 2: {number:'2', net:'GDR'} } },
    // U3, U4
    u3: { props: { Designator: 'U3' }, pinInfoMap: { 2: {number:'2', net:'GND'}, 5: {number:'5', net:'3V3'} } },
    u4: { props: { Designator: 'U4' }, pinInfoMap: { 1: {number:'1', net:'GND'}, 2: {number:'2', net:'+5V'} } },
    // 还有一个伪元件 (之前的污染)
    polluted: { props: { Designator: '分析这个电路的SPI总线部分,使用了哪些引脚1' }, pinInfoMap: {} },
  }
};

const components = netlist.components;
console.log('Total components:', Object.keys(components).length);

// v1.3.2 过滤逻辑 (从 index.ts 抽出)
const REF_DES = /^[A-Za-z][A-Za-z0-9_]*\d+$/;
function isValidDesig(d) {
  return d && d.length <= 10 && REF_DES.test(d);
}

function doAnalyze(selDesigs, selPinsByComp, selectedNets) {
  const includeDesigs = new Set([...selDesigs, ...Object.keys(selPinsByComp || {})]);
  const nets = {};
  const comps = new Set();

  for (const k of Object.keys(components)) {
    const c = components[k];
    if (!c || typeof c !== 'object') continue;
    const desig = (c.props && c.props.Designator) || '';
    if (!isValidDesig(desig)) continue;

    let includeThis = false;
    if (includeDesigs.size > 0) {
      includeThis = includeDesigs.has(desig);
    } else if (selectedNets.size > 0) {
      includeThis = false;
    } else {
      return { error: '请先在原理图中框选需要分析的元件（或引脚/连线）' };
    }

    const pim = c.pinInfoMap || c.pins || c.pinMap || {};
    for (const pk of Object.keys(pim)) {
      const pin = pim[pk];
      if (!pin || typeof pin !== 'object') continue;
      const pnet = pin.net || '';
      const pnum = pin.number || pk;
      if (pnet && selectedNets.has(pnet) && includeDesigs.size === 0) {
        includeThis = true;
      }
      if (pnet && pnum) {
        if (!nets[pnet]) nets[pnet] = [];
        nets[pnet].push(desig + '-' + pnum);
      }
    }
    if (includeThis) comps.add(desig);
  }

  if (comps.size === 0) {
    return { error: '所选区域未匹配到任何元件' };
  }

  return { comps: [...comps].sort(), netCount: Object.keys(nets).length, nets };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  ✅ PASS: ' + name); pass++; }
  else { console.log('  ❌ FAIL: ' + name + (extra ? ' (' + extra + ')' : '')); fail++; }
}

console.log('\n========== 单元测试 v1.3.2 doAnalyze ==========\n');

// Test 1: 选中 U1 + U3 components
let r = doAnalyze(new Set(['U1', 'U3']), {}, new Set());
console.log('Test 1: 选 U1 + U3 (两个 component)');
console.log('  comps:', r.comps, '| nets:', r.netCount);
check('只输出 U1, U3', r.comps.length === 2 && r.comps.includes('U1') && r.comps.includes('U3'));
check('不包含 R1/R2/R3', !r.comps.includes('R1'));

// Test 2: 选中 U1-3 pin
r = doAnalyze(new Set(), { U1: new Set(['3']) }, new Set());
console.log('\nTest 2: 选 U1-3 pin (CLK 引脚)');
console.log('  comps:', r.comps, '| nets:', r.netCount);
check('只输出 U1', r.comps.length === 1 && r.comps[0] === 'U1');
check('U1-3 出现在输出 nets 的 CLK 中', r.nets.CLK && r.nets.CLK.includes('U1-3'));

// Test 3: 选中 CLK wire (无 component/pin)
r = doAnalyze(new Set(), {}, new Set(['CLK']));
console.log('\nTest 3: 选 CLK wire');
console.log('  comps:', r.comps, '| nets:', r.netCount);
check('包含 U1 + FPC1 (在 CLK net 上)', r.comps.includes('U1') && r.comps.includes('FPC1'));
check('不包含 U3, U4 (不在 CLK 上)', !r.comps.includes('U3') && !r.comps.includes('U4'));
check('不包含 R1', !r.comps.includes('R1'));

// Test 4: 啥都没选
r = doAnalyze(new Set(), {}, new Set());
console.log('\nTest 4: 空选区');
console.log('  result:', r);
check('返回错误而非静默退回全表', !!r.error);

// Test 5: 选 U1 + CS wire
r = doAnalyze(new Set(['U1']), {}, new Set(['CS']));
console.log('\nTest 5: 选 U1 component + CS wire');
console.log('  comps:', r.comps, '| nets:', r.netCount);
check('包含 U1', r.comps.includes('U1'));
check('包含 FPC1 (在 CS net 上)', r.comps.includes('FPC1'));
check('不包含 R1, R2, R3', !r.comps.includes('R1'));

// Test 6: 选 R1, R2, R3
r = doAnalyze(new Set(['R1', 'R2', 'R3']), {}, new Set());
console.log('\nTest 6: 选 R1, R2, R3');
console.log('  comps:', r.comps, '| nets:', r.netCount);
check('只输出 R1, R2, R3', r.comps.length === 3 && r.comps.every(c => c.startsWith('R')));

// Test 7: 旧 bug 复现
console.log('\n========== 旧 bug (v1.2.0) 复现对比 ==========\n');
const oldComps = new Set();
for (const k of Object.keys(components)) {
  const c = components[k];
  if (!c) continue;
  const d = (c.props && c.props.Designator) || '';
  if (!d || d.length > 20) continue;
  if (!/^[A-Za-z]+\d+/.test(d)) continue;
  oldComps.add(d);
}
console.log('旧逻辑: 0 选区 → 输出', oldComps.size, '个元件 (全表)');
console.log('这就是"我框选 5 个图元但网表包含 7 个元件"的 bug');

// Test 8: 验证 v1.2.2 修复 (污染元件过滤)
console.log('\n========== v1.2.2 过滤验证 ==========\n');
const finalComps = new Set();
for (const k of Object.keys(components)) {
  const c = components[k];
  if (!c) continue;
  const d = (c.props && c.props.Designator) || '';
  if (!isValidDesig(d)) continue;
  finalComps.add(d);
}
console.log('v1.3.2 过滤后保留 component:', [...finalComps].sort().join(', '));
check('伪元件被过滤 (Designator "分析..." 长度 20 > 10)', !finalComps.has('分析这个电路的SPI总线部分,使用了哪些引脚1'));
check('正常元件保留', finalComps.has('U1') && finalComps.has('FPC1') && finalComps.has('R1') && finalComps.has('U3') && finalComps.has('U4'));

console.log('\n========== 总结 ==========\n');
console.log('PASS:', pass, '/ FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
