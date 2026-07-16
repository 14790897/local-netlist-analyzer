var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('URL:', p.url());
    console.log('Title:', await p.title());
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-status.png' });
    console.log('shot saved');
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
