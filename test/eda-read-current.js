'use strict';
/**
 * Read current AI chat content (whatever user is doing)
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');

var SHOT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);
    if (!p) { console.log('NO PAGE'); await b.close(); return; }

    // Find AI chat
    var chat = null;
    for (var f of p.frames()) {
        try {
            var t = await f.title();
            if (t && t.indexOf('AI') >= 0 && t.indexOf('电路') >= 0) { chat = f; break; }
        } catch (e) {}
    }
    if (!chat) { console.log('NO CHAT'); await b.close(); return; }

    var content = await chat.evaluate(() => document.body.innerText);
    console.log('=== CURRENT CHAT CONTENT ===');
    console.log('Length:', content.length);
    console.log('---');
    console.log(content);
    console.log('---');
    fs.writeFileSync(SHOT + '/current.txt', content, 'utf-8');
    console.log('Saved to current.txt');
    await b.close();
})();
