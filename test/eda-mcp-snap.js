var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs'), path = require('path');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('URL:', p.url());
    console.log('Title:', await p.title());
    var out = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-snap.png';
    await p.screenshot({ path: out, fullPage: false });
    console.log('Saved:', out);
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
