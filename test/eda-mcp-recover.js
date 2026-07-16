var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
(async function() {
  try {
    var b = await chromium.connectOverCDP('http://localhost:9269');
    var p = b.contexts()[0].pages()[0];
    console.log('URL:', p.url());
    // Try reload to recover from stuck state
    console.log('Reloading page to recover...');
    try { await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }); console.log('  reloaded'); }
    catch (e) { console.log('  reload err:', e.message); }
    await p.waitForTimeout(15000);
    console.log('  URL after reload:', p.url());
    try {
      await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/mcp-recovered.png', timeout: 10000 });
      console.log('  shot OK');
    } catch (e) { console.log('  shot err:', e.message); }
    await b.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
