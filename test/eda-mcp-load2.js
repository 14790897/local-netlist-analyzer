var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('URL:', p.url());
    // wait a bit, then probe
    await p.waitForTimeout(15000);
    var info = await p.evaluate(function() {
      return {
        hasEda: typeof eda !== 'undefined',
        hasSchSel: !!(eda && eda.sch_SelectControl),
        schKeys: eda ? Object.keys(eda).filter(function(k){ return k.indexOf('sch') === 0; }) : [],
        loadingIcons: document.querySelectorAll('.icon-eda-loading, [class*=loading]').length
      };
    });
    console.log('page state:', JSON.stringify(info));

    var frames = p.frames();
    for (var i = 0; i < frames.length; i++) {
      try {
        var u = frames[i].url();
        if (u.indexOf('blob') >= 0) {
          var fi = await frames[i].evaluate(function() {
            return { hasEda: typeof eda, hasSchSel: !!(eda && eda.sch_SelectControl) };
          });
          console.log('blob frame[' + i + ']:', JSON.stringify(fi));
        }
      } catch (e) {}
    }
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-after-wait.png' });
    console.log('shot saved');
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
