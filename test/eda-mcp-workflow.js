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
  for (var i = 0; i < 30; i++) {
    var frames = p.frames();
    for (var j = 0; j < frames.length; j++) {
      try {
        var ok = await frames[j].evaluate(function() { return !!(window.eda && window.eda.sch_SelectControl); });
        if (ok) return frames[j];
      } catch (e) {}
    }
    if (i === 0) console.log('  waiting for sch frame... (10s max)');
    await p.waitForTimeout(500);
  }
  return null;
}

(async function() {
  try {
    b = await chromium.connectOverCDP('http://localhost:9269');
    p = b.contexts()[0].pages()[0];
    console.log('Initial URL:', p.url());
    await shot('w-init.png');

    // Step 1: open "墨鱼AI墨水屏" project
    console.log('\n=== Step 1: open project ===');
    var proj = await p.locator('text=墨鱼AI墨水屏').first();
    if (await proj.count() > 0) {
      await proj.click();
      console.log('  clicked project link');
    } else {
      console.log('  project not found, trying recent design');
      var recent = await p.locator('text=墨鱼AI墨水屏').first();
      if (await recent.count() > 0) await recent.click();
    }
    await p.waitForTimeout(8000);
    console.log('  new URL:', p.url());
    await shot('w-project.png');

    // Step 2: find sch frame
    console.log('\n=== Step 2: find sch frame ===');
    var sch = await findSchFrame();
    if (!sch) {
      console.log('  NO sch frame, trying click Schematic1_3');
      // try clicking schematic tab
      var tabs = await p.locator('text=Schematic1_3').all();
      for (var t of tabs) {
        try { await t.click({ timeout: 2000 }); break; } catch (e) {}
      }
      await p.waitForTimeout(5000);
      sch = await findSchFrame();
    }
    if (!sch) { console.log('STILL NO sch frame'); await b.close(); return; }
    console.log('  sch frame found');

    // Step 3: doSelectAll
    console.log('\n=== Step 3: doSelectAll ===');
    var sel = await sch.evaluate(async function() {
      try {
        await eda.sch_SelectControl.doSelectAll();
        var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
        return { ok: true, count: ids.length };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    console.log('  selection:', JSON.stringify(sel));
    await shot('w-selected.png');

    // Step 4: get netlist
    console.log('\n=== Step 4: getNetlistFile ===');
    var net = await sch.evaluate(async function() {
      try {
        var file = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
        var text = await file.text();
        return { ok: true, bytes: text.length };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    console.log('  netlist:', JSON.stringify(net));

    // Step 5: click 局部网表 menu
    console.log('\n=== Step 5: click 局部网表 menu ===');
    var menu = await p.locator('text=局部网表').first();
    var bbox = await menu.boundingBox();
    console.log('  menu bbox:', JSON.stringify(bbox));
    if (bbox) {
      await p.mouse.move(bbox.x + bbox.width/2, bbox.y + bbox.height/2);
      await p.waitForTimeout(500);
      await p.mouse.click(bbox.x + bbox.width/2, bbox.y + bbox.height/2);
      await p.waitForTimeout(1500);
      await shot('w-menu-open.png');
    }

    // Step 6: click "AI 分析局部网表"
    console.log('\n=== Step 6: click AI 分析局部网表 ===');
    var aiMenu = await p.locator('text=AI 分析局部网表').first();
    if (await aiMenu.count() > 0) {
      await aiMenu.click();
      console.log('  clicked AI menu');
    } else {
      console.log('  AI menu not visible, listing menu items:');
      var items = await p.locator('[class*=menuItem], [class*=MenuItem], li, [role=menuitem]').allTextContents();
      console.log('  items:', items.slice(0, 20));
    }
    await p.waitForTimeout(3000);
    await shot('w-ai-chat.png');

    // Step 7: find AI chat iframe, send question
    console.log('\n=== Step 7: find chat IFrame + ask ===');
    var chatFrame = null;
    for (var i = 0; i < 30; i++) {
      for (var f of p.frames()) {
        try {
          var has = await f.evaluate(function() {
            return document.body && document.body.innerText && document.body.innerText.indexOf('AI') >= 0 && document.body.innerText.indexOf('元件') >= 0;
          });
          if (has) { chatFrame = f; break; }
        } catch (e) {}
      }
      if (chatFrame) break;
      await p.waitForTimeout(500);
    }
    if (!chatFrame) { console.log('  NO chat frame'); await b.close(); return; }
    console.log('  chat frame found');

    var ta = await chatFrame.locator('textarea').first();
    await ta.fill('电路中有哪些主要的电源网络?简单说明每个网络的作用。');
    console.log('  question typed');
    await shot('w-q-typed.png');

    var btn = await chatFrame.locator('button:has-text("发送")').first();
    if (await btn.count() > 0) {
      await btn.click();
      console.log('  sent');
    }
    await shot('w-q-sent.png');

    // Step 8: wait for AI response
    console.log('\n=== Step 8: wait for AI response (max 60s) ===');
    var lastText = '';
    for (var k = 0; k < 60; k++) {
      await p.waitForTimeout(1000);
      var text = await chatFrame.evaluate(function() { return document.body.innerText; });
      if (text !== lastText) {
        lastText = text;
        if (k % 5 === 0) console.log('  t=' + k + 's len=' + text.length);
        if (k === 20) await shot('w-q-20s.png');
        if (k === 40) await shot('w-q-40s.png');
      }
    }
    fs.writeFileSync(path.join(OUT, 'mcp-final.txt'), lastText, 'utf8');
    await shot('w-final.png');
    console.log('  final len:', lastText.length);

    await b.close();
  } catch (e) { console.log('ERR:', e.message, e.stack); }
})();
