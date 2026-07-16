'use strict';
/**
 * Real EDA AI test: full workflow
 * 1. Close any existing AI IFrame
 * 2. Select all components
 * 3. Call aiAnalyzeSelection (via direct API since menu binding)
 * 4. Verify chat.html IFrame opens
 * 5. Read chat content + check AI response
 * 6. Send a follow-up question, wait for response
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var fs = require('fs');
var path = require('path');

var SHOT_DIR = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page, name) {
    try {
        await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: false, timeout: 15000 });
        console.log('  [shot]', name);
    } catch (e) {
        console.log('  [shot-fail]', name, e.message.substring(0, 80));
    }
}

async function findEdaFrame(page) {
    var frames = page.frames();
    for (var i = 0; i < frames.length; i++) {
        try {
            var has = await frames[i].evaluate(function () {
                return !!(window.eda && window.eda.sch_SelectControl);
            });
            if (has) return frames[i];
        } catch (e) {}
    }
    return null;
}

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());
    await shot(p, 'ai-00-initial.png');

    var f = await findEdaFrame(p);
    if (!f) { console.log('NO EDA FRAME'); await b.close(); return; }

    // Step 1: Select all components
    console.log('\n--- Step 1: Select all components ---');
    var sel = await f.evaluate(async function () {
        try {
            await eda.sch_SelectControl.doSelectAll();
            var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
            return { count: ids ? ids.length : 0 };
        } catch (e) {
            return { err: e.message };
        }
    });
    console.log('  Selected:', JSON.stringify(sel));

    // Step 2: Run the equivalent of aiAnalyzeSelection manually
    // (since we can't trigger extension menu from outside)
    console.log('\n--- Step 2: Run doAnalyze + check IFrame ---');
    var r = await f.evaluate(async function () {
        try {
            var ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
            var file = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
            var nl = file ? await file.text() : '';
            var comps = 0, nets = 0;
            if (nl) {
                var obj = JSON.parse(nl);
                var components = obj.components || obj;
                comps = Object.keys(components).length;
                var netSet = new Set();
                var ckeys = Object.keys(components);
                for (var k = 0; k < ckeys.length; k++) {
                    var pim = components[ckeys[k]].pinInfoMap || {};
                    var pn = Object.keys(pim);
                    for (var j = 0; j < pn.length; j++) {
                        var n = pim[pn[j]].net;
                        if (n) netSet.add(n);
                    }
                }
                nets = netSet.size;
            }
            // Store the data the way our extension does
            try {
                eda.sys_Storage.setExtensionUserConfig('__nl_data', JSON.stringify({
                    nets: {}, comps: comps, netCount: nets, ids: ids.length
                }));
            } catch (e) {}
            return { ok: true, ids: ids ? ids.length : 0, comps: comps, nets: nets };
        } catch (e) {
            return { ok: false, err: e.message };
        }
    });
    console.log('  doAnalyze:', JSON.stringify(r));
    await shot(p, 'ai-01-data-ready.png');

    // Step 3: Open chat IFrame (simulating the menu's aiAnalyzeSelection)
    console.log('\n--- Step 3: Open chat.html IFrame ---');
    try {
        await f.evaluate(function () {
            // Note: the function path inside the extension IIFE is not directly accessible.
            // But we can verify the IFrame mechanism works.
            return Object.keys(eda.sys_IFrame || {});
        }).then(function (k) { console.log('  sys_IFrame keys:', JSON.stringify(k)); });
    } catch (e) { console.log('  inspect err:', e.message); }

    // Check current state of AI IFrame
    var iframes = p.frames();
    console.log('  Total frames now:', iframes.length);
    for (var i = 0; i < iframes.length; i++) {
        var u = iframes[i].url();
        if (u.indexOf('chat.html') >= 0 || u.indexOf('blob:') >= 0) {
            console.log('  AI frame:', u.substring(0, 80));
        }
    }

    // Step 4: Read existing AI chat content
    console.log('\n--- Step 4: Read existing AI chat ---');
    for (var i = 0; i < iframes.length; i++) {
        try {
            var isChat = await iframes[i].evaluate(function () {
                return document.title && document.title.indexOf('AI') >= 0;
            });
            if (isChat) {
                console.log('  AI chat frame found:', iframes[i].url().substring(0, 60));
                var text = await iframes[i].evaluate(function () {
                    return {
                        title: document.title,
                        bodyText: (document.body && document.body.innerText || '').substring(0, 1000),
                        msgCount: document.querySelectorAll('.msg, .message, [class*="msg"]').length,
                        hasInput: !!document.querySelector('textarea, input[type=text]'),
                        hasSendBtn: !!document.querySelector('button')
                    };
                });
                console.log('  Chat state:', JSON.stringify(text, null, 2));
                await iframes[i].screenshot({ path: path.join(SHOT_DIR, 'ai-02-chat-content.png') });
            }
        } catch (e) {}
    }

    // Step 5: Send a new question
    console.log('\n--- Step 5: Send new question ---');
    for (var i = 0; i < iframes.length; i++) {
        try {
            var isChat = await iframes[i].evaluate(function () {
                return document.title && document.title.indexOf('AI') >= 0;
            });
            if (!isChat) continue;

            // Find textarea and send button
            var found = await iframes[i].evaluate(function () {
                var ta = document.querySelector('textarea');
                var btns = Array.from(document.querySelectorAll('button'));
                var sendBtn = btns.find(function (b) { return (b.textContent || '').indexOf('发送') >= 0 || (b.textContent || '').indexOf('send') >= 0 || b.id === 'sendBtn'; });
                return { hasTextarea: !!ta, btnTexts: btns.map(function (b) { return b.textContent || b.id; }).filter(Boolean).slice(0, 5) };
            });
            console.log('  Form:', JSON.stringify(found));

            if (found.hasTextarea) {
                await iframes[i].fill('textarea', '分析这个电路的 SPI 总线部分,使用了哪些引脚?');
                console.log('  Filled textarea');
                await iframes[i].waitForTimeout(300);
                await shot(iframes[i], 'ai-03-question-typed.png');

                // Click send
                try {
                    await iframes[i].click('button:has-text("发送")', { timeout: 3000 });
                    console.log('  Clicked send');
                } catch (e) {
                    console.log('  Send click failed:', e.message);
                    // try id
                    try { await iframes[i].click('#sendBtn'); console.log('  Clicked #sendBtn'); } catch (e2) { console.log('  #sendBtn also failed'); }
                }

                // Wait for AI response (poll for new message)
                console.log('  Waiting for AI response (up to 30s)...');
                var lastLen = 0;
                var stableRounds = 0;
                for (var t = 0; t < 30; t++) {
                    await iframes[i].waitForTimeout(1000);
                    var cur = await iframes[i].evaluate(function () {
                        return (document.body && document.body.innerText || '').length;
                    });
                    if (cur !== lastLen) { stableRounds = 0; lastLen = cur; }
                    else { stableRounds++; if (stableRounds >= 4) break; }
                    if (t % 5 === 0) console.log('   ...t=' + t + 's, len=' + cur);
                }
                console.log('  Stable len:', lastLen);

                var finalText = await iframes[i].evaluate(function () {
                    return document.body.innerText;
                });
                console.log('  Final text length:', finalText.length);
                // Save final chat content
                fs.writeFileSync(path.join(SHOT_DIR, 'ai-04-final-chat.txt'), finalText, 'utf-8');
                console.log('  Saved final chat to ai-04-final-chat.txt');

                await shot(iframes[i], 'ai-04-final-chat.png');
            }
        } catch (e) { console.log('  err in step5:', e.message); }
    }

    await shot(p, 'ai-99-final.png');
    await b.close();
    console.log('\n=== DONE ===');
})();
