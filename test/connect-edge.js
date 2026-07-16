'use strict';
var { chromium } = require('playwright-core');
var http = require('http');

function get(url) {
    return new Promise(function (resolve, reject) {
        http.get(url, function (res) {
            var data = '';
            res.on('data', function (c) { data += c; });
            res.on('end', function () { resolve(data); });
        }).on('error', reject);
    });
}

(async function () {
    var browser = await chromium.connectOverCDP('http://localhost:9224');
    var context = browser.contexts()[0];
    var page = context.pages()[0];

    // Find iframe pos
    var box = await page.evaluate(function () {
        var iframes = Array.from(document.querySelectorAll('iframe'));
        for (var i = 0; i < iframes.length; i++) {
            if (iframes[i].src && iframes[i].src.indexOf('blob:') >= 0) {
                var r = iframes[i].getBoundingClientRect();
                return { x: r.left, y: r.top, w: r.width, h: r.height };
            }
        }
        return null;
    });
    if (!box) { console.log('No chat iframe'); return; }
    console.log('Chat iframe box:', box);

    // Scroll iframe into view
    await page.evaluate(function (b) { window.scrollTo(b.x, b.y); }, box);
    await page.waitForTimeout(500);

    // Try omitBackground
    try {
        await page.screenshot({
            path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/ai-analysis-success.png',
            clip: { x: box.x, y: box.y, width: box.w, height: box.h },
            timeout: 30000,
            animations: 'disabled',
            caret: 'hide'
        });
        console.log('Saved');
    } catch (e) {
        console.log('Error:', e.message);
        // Fallback: just take full
        try {
            await page.screenshot({
                path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/ai-analysis-success.png',
                timeout: 60000
            });
            console.log('Saved (full)');
        } catch (e2) {
            console.log('Full error:', e2.message);
        }
    }

    await browser.close();
})();
