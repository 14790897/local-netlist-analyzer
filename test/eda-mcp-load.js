var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('Waiting 20s for project data to load...');
    await p.waitForTimeout(20000);
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-loaded.png' });

    // Check menu
    var menu = p.locator('text=局部网表');
    console.log('menu count:', await menu.count());
    var menu2 = p.locator('text=Local Netlist');
    console.log('Local Netlist count:', await menu2.count());
    var allMenus = await p.locator('header, [class*=toolbar], [class*=menubar]').first().textContent().catch(function() { return ''; });
    console.log('top bar text:', (allMenus || '').substring(0, 200));

    // Check sch frame
    var frames = p.frames();
    console.log('frames:', frames.length);
    for (var i = 0; i < frames.length; i++) {
      try {
        var u = frames[i].url();
        if (u.indexOf('blob') >= 0 || u.indexOf('sch') >= 0) {
          var eda = await frames[i].evaluate(function() { return typeof eda; });
          console.log('  frame[' + i + ']:', u.substring(0, 60), 'eda:', eda);
        }
      } catch (e) {}
    }

    // Try click Schematic1_3 to wake sch
    console.log('\nClicking Schematic1_3...');
    var sch_tab = p.locator('text=Schematic1_3').first();
    if (await sch_tab.count() > 0) {
      await sch_tab.click();
      console.log('  clicked');
    }
    await p.waitForTimeout(10000);
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-sch-active.png' });

    // Check sch again
    var frames2 = p.frames();
    console.log('frames after tab click:', frames2.length);
    for (var i = 0; i < frames2.length; i++) {
      try {
        var u = frames2[i].url();
        if (u.indexOf('blob') >= 0 || u.indexOf('sch') >= 0) {
          var info = await frames2[i].evaluate(function() {
            return { hasEda: typeof eda, hasSchSel: !!(eda && eda.sch_SelectControl) };
          });
          console.log('  frame[' + i + ']:', u.substring(0, 60), JSON.stringify(info));
        }
      } catch (e) {}
    }
    // Main page eda
    var mainInfo = await p.evaluate(function() {
      return { hasEda: typeof eda, hasSchSel: !!(eda && eda.sch_SelectControl), schKeys: eda ? Object.keys(eda).filter(k => k.indexOf('sch') === 0) : [] };
    });
    console.log('main page:', JSON.stringify(mainInfo));

    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
