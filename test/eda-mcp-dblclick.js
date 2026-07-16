var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs'), path = require('path');
var OUT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';
var b, p;

async function shot(name) {
  if (!p) return;
  var out = path.join(OUT, name);
  await p.screenshot({ path: out, fullPage: false });
  console.log('  saved:', name);
}

async function findSchFrame() {
  for (var i = 0; i < 60; i++) {
    var frames = p.frames();
    for (var j = 0; j < frames.length; j++) {
      try {
        var ok = await frames[j].evaluate(function() { return !!(window.eda && window.eda.sch_SelectControl); });
        if (ok) return frames[j];
      } catch (e) {}
    }
    if (i === 0) console.log('  waiting for sch frame (30s max)...');
    await p.waitForTimeout(500);
  }
  return null;
}

(async function() {
  try {
    b = await chromium.connectOverCDP('http://localhost:9269');
    p = b.contexts()[0].pages()[0];
    console.log('URL:', p.url());

    // Try double-click the project
    console.log('\n=== Open project (dbl-click) ===');
    var proj = p.locator('text=墨鱼AI墨水屏').first();
    await proj.dblclick();
    await p.waitForTimeout(10000);
    console.log('  URL after dblclick:', p.url());
    await shot('w2-after-dblclick.png');

    // If still home, try recent design link
    if (p.url().indexOf('#') < 0) {
      console.log('  no # in URL, trying click "打开" link');
      var opens = await p.locator('a:has-text("墨鱼AI墨水屏")').all();
      for (var o of opens) {
        try { await o.click({ timeout: 2000, force: true }); break; } catch (e) {}
      }
      await p.waitForTimeout(10000);
    }
    console.log('  URL now:', p.url());
    await shot('w2-after-open.png');

    var sch = await findSchFrame();
    if (!sch) { console.log('NO sch frame after all attempts'); await b.close(); return; }
    console.log('  sch frame OK');

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
      return (await f.text()).length;
    });
    console.log('Netlist bytes:', nl);

    await shot('w2-selected.png');

    // Click 局部网表 menu
    console.log('\n=== click 局部网表 ===');
    var menu = p.locator('text=局部网表').first();
    var bb = await menu.boundingBox();
    console.log('  bbox:', JSON.stringify(bb));
    if (bb) {
      await p.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2);
      await p.waitForTimeout(800);
      await p.mouse.down();
      await p.waitForTimeout(100);
      await p.mouse.up();
      await p.waitForTimeout(1500);
    }
    await shot('w2-menu-open.png');

    // Click AI 分析局部网表
    console.log('\n=== click AI 分析局部网表 ===');
    var items = await p.locator('text=AI 分析局部网表').all();
    console.log('  AI menu count:', items.length);
    for (var it of items) {
      try { if (await it.isVisible()) { await it.click(); console.log('  clicked'); break; } } catch (e) {}
    }
    await p.waitForTimeout(3000);
    await shot('w2-chat-open.png');

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
    if (!chatFrame) { console.log('NO chat frame'); await b.close(); return; }
    console.log('  chat frame OK');

    var ta = chatFrame.locator('textarea').first();
    await ta.fill('电路的主要功能模块有哪些?100字内回答。');
    await shot('w2-q-typed.png');

    var btn = chatFrame.locator('button:has-text("发送")').first();
    await btn.click();
    console.log('  sent');
    await shot('w2-q-sent.png');

    var last = '';
    for (var k = 0; k < 60; k++) {
      await p.waitForTimeout(1000);
      var text = await chatFrame.evaluate(function() { return document.body.innerText; });
      if (text !== last) {
        last = text;
        if (k % 5 === 0) console.log('  t=' + k + 's len=' + text.length);
      }
    }
    fs.writeFileSync(path.join(OUT, 'mcp2-final.txt'), last, 'utf8');
    await shot('w2-final.png');
    console.log('FINAL LEN:', last.length);

    await b.close();
  } catch (e) { console.log('ERR:', e.message); console.log(e.stack); }
})();
