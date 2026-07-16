var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('URL:', p.url());
    // wait for fonts to clear
    await p.waitForTimeout(3000);
    // try click Schematic1_3
    var tabs = await p.locator('text=Schematic1_3').all();
    console.log('tabs found:', tabs.length);
    for (var t of tabs) {
      try {
        var vis = await t.isVisible();
        if (vis) { await t.click({ timeout: 5000 }); console.log('clicked visible'); break; }
      } catch (e) { console.log('  err:', e.message.substring(0, 80)); }
    }
    await p.waitForTimeout(15000);
    // now look for sch frame
    var frames = p.frames();
    console.log('frames after tab click:', frames.length);
    for (var i = 0; i < frames.length; i++) {
      try {
        var u = frames[i].url();
        if (u.indexOf('blob') >= 0) {
          var info = await frames[i].evaluate(function() {
            return { hasEda: typeof eda, hasSchSel: !!(eda && eda.sch_SelectControl) };
          });
          console.log('  frame[' + i + ']:', u.substring(0, 60), JSON.stringify(info));
        }
      } catch (e) {}
    }
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-sch-clicked.png', timeout: 10000 }).catch(e => console.log('shot err:', e.message));
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
