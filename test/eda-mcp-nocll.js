var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('Current URL:', p.url());
    // navigate to same URL but without cll=debug
    var newUrl = p.url().replace('?cll=debug', '').replace('&cll=debug', '');
    console.log('Navigating to:', newUrl);
    await p.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(20000);
    console.log('After nav URL:', p.url());
    // probe
    var frames = p.frames();
    console.log('frames:', frames.length);
    for (var i = 0; i < frames.length; i++) {
      try {
        var u = frames[i].url();
        if (u.indexOf('blob') >= 0) {
          var info = await frames[i].evaluate(function() {
            return { hasEda: typeof eda, hasSchSel: !!(eda && eda.sch_SelectControl) };
          });
          console.log('  blob[' + i + ']:', u.substring(0, 60), JSON.stringify(info));
        }
      } catch (e) {}
    }
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-nocll.png', timeout: 10000 }).catch(e => console.log('shot err:', e.message));
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
