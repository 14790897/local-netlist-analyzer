var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var OUT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

async function probe() {
  var b = await chromium.connectOverCDP('http://localhost:9269');
  var p = b.contexts()[0].pages()[0];
  console.log('URL:', p.url());
  var frames = p.frames();
  console.log('frames:', frames.length);
  for (var i = 0; i < frames.length; i++) {
    try {
      var u = frames[i].url();
      var info = await frames[i].evaluate(function() {
        var out = { hasEda: typeof eda };
        if (typeof eda !== 'undefined' && eda) {
          out.schKeys = Object.keys(eda).filter(function(k){ return k.indexOf('sch') === 0; });
          out.hasSchSel = !!eda.sch_SelectControl;
        }
        return out;
      });
      console.log('frame[' + i + ']:', u.substring(0, 50), JSON.stringify(info));
    } catch (e) { console.log('frame[' + i + '] err:', e.message); }
  }
  await b.close();
}

async function fullWorkflow() {
  var b = await chromium.connectOverCDP('http://localhost:9269');
  var p = b.contexts()[0].pages()[0];

  // wait for sch
  console.log('\nWaiting for sch frame (60s)...');
  var sch = null;
  for (var i = 0; i < 120; i++) {
    var frames = p.frames();
    for (var j = 0; j < frames.length; j++) {
      try {
        var ok = await frames[j].evaluate(function() { return !!(eda && eda.sch_SelectControl); });
        if (ok) { sch = frames[j]; break; }
      } catch (e) {}
    }
    if (sch) break;
    await p.waitForTimeout(500);
  }
  if (!sch) { console.log('NO sch'); await b.close(); return; }
  console.log('sch OK');

  // Selection
  var sel = await sch.evaluate(async function() {
    await eda.sch_SelectControl.doSelectAll();
    var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
    return ids.length;
  });
  console.log('Selected:', sel);

  // Netlist
  var nl = await sch.evaluate(async function() {
    var f = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
    var t = await f.text();
    return t.length;
  });
  console.log('Netlist bytes:', nl);

  // Click 局部网表 menu
  var menu = p.locator('text=局部网表').first();
  var bb = await menu.boundingBox();
  console.log('menu bbox:', JSON.stringify(bb));
  if (bb) {
    await p.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2);
    await p.waitForTimeout(800);
    await p.mouse.down();
    await p.waitForTimeout(100);
    await p.mouse.up();
    await p.waitForTimeout(2000);
  }

  var aiMenu = p.locator('text=AI 分析局部网表').first();
  console.log('AI menu count:', await aiMenu.count());
  if (await aiMenu.count() > 0) {
    try { await aiMenu.click({ timeout: 3000 }); console.log('AI clicked'); } catch (e) { console.log('AI err:', e.message); }
  }
  await p.waitForTimeout(5000);

  // Find chat frame
  var chatFrame = null;
  for (var i = 0; i < 30; i++) {
    for (var f of p.frames()) {
      try {
        var ok = await f.evaluate(function() {
          var t = document.body && document.body.innerText || '';
          return t.indexOf('AI') >= 0 && (t.indexOf('元件') >= 0 || t.indexOf('网络') >= 0);
        });
        if (ok) { chatFrame = f; break; }
      } catch (e) {}
    }
    if (chatFrame) break;
    await p.waitForTimeout(500);
  }
  if (!chatFrame) { console.log('NO chat'); await b.close(); return; }
  console.log('chat OK');

  var ta = chatFrame.locator('textarea').first();
  await ta.fill('电路的主要功能模块有哪些?100字内回答。');
  var btn = chatFrame.locator('button:has-text("发送")').first();
  await btn.click();
  console.log('sent');

  var last = '';
  for (var k = 0; k < 60; k++) {
    await p.waitForTimeout(1000);
    try {
      var text = await chatFrame.evaluate(function() { return document.body.innerText; });
      if (text !== last) {
        last = text;
        if (k % 5 === 0) console.log('  t=' + k + 's len=' + text.length);
      }
    } catch (e) {}
  }
  fs.writeFileSync(OUT + '/mcp4-final.txt', last, 'utf8');
  console.log('FINAL LEN:', last.length);

  await b.close();
}

(async function() {
  // first just probe
  await probe();
  console.log('\n=== full workflow ===');
  await fullWorkflow();
})();
