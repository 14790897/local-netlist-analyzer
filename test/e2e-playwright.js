'use strict';
var chromium = require('playwright-core').chromium;

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9273');
    var ctx = b.contexts()[0];
    var pages = ctx.pages();
    console.log('Pages:', pages.length);
    for (var i = 0; i < pages.length; i++) {
        console.log(' [' + i + ']', await pages[i].title());
    }

    // 找到原理图页面
    var schPage = null;
    for (var j = 0; j < pages.length; j++) {
        if ((await pages[j].title()).includes('Schematic')) { schPage = pages[j]; break; }
    }
    if (!schPage) {
        // 刷新最后一个页面试试
        schPage = pages[pages.length - 1];
    }

    var logs = [];
    schPage.on('console', function (m) { logs.push(m.text().substring(0, 300)); });

    // 刷新原理图页面
    await schPage.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    console.log('\nSchematic reloaded:', await schPage.title());

    // 框选
    var big = await schPage.evaluate(function () {
        var cs = document.querySelectorAll('canvas');
        for (var i = 0; i < cs.length; i++) {
            var r = cs[i].getBoundingClientRect();
            if (r.width > 500) return { x: Math.floor(r.x), y: Math.floor(r.y), w: Math.floor(r.width), h: Math.floor(r.height) };
        }
        return null;
    });
    if (!big) { console.log('No canvas'); return; }

    var x1 = big.x + 200, y1 = big.y + 100;
    var x2 = big.x + big.w - 200, y2 = big.y + big.h - 100;
    await schPage.mouse.move(x1, y1);
    await schPage.mouse.down();
    await new Promise(r => setTimeout(r, 300));
    await schPage.mouse.move(x2, y2, { steps: 15 });
    await new Promise(r => setTimeout(r, 300));
    await schPage.mouse.up();
    await new Promise(r => setTimeout(r, 1500));
    console.log('Selected\n');

    // 高级→局部网表→分析选中
    await schPage.mouse.click(722, 16);   // 高级
    await new Promise(r => setTimeout(r, 1000));
    await schPage.mouse.click(774, 126);  // 局部网表
    await new Promise(r => setTimeout(r, 800));
    await schPage.mouse.click(928, 125);  // 分析选中
    await new Promise(r => setTimeout(r, 5000));
    console.log('Menu clicked\n');

    // IFrame
    var frames = schPage.frames();
    console.log('Frames:', frames.length);
    for (var k = 0; k < frames.length; k++) {
        try {
            if (frames[k].url().includes('blob') || frames[k].url() === 'about:blank') {
                var txt = await frames[k].evaluate(function () { return document.body.textContent || ''; });
                if (txt.length > 10) console.log('\n=== IFrame[' + k + '] ===\n' + txt.substring(0, 1500));
            }
        } catch (e) {}
    }

    var ext = logs.filter(function (l) {
        return l.includes('7bdb00') || l.includes('网表') || l.includes('元件') || l.includes('netlist');
    });
    console.log('\nLogs:', ext.join('\n') || '(none)');
    console.log('Done');
})();
