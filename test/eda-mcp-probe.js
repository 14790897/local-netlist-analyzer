var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    var frames = p.frames();
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
        console.log('frame[' + i + ']:', u.substring(0, 60), JSON.stringify(info));
      } catch (e) { console.log('frame[' + i + '] err:', e.message); }
    }
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
