'use strict';
var chromium = require('playwright-core').chromium;

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9273');
    var ctx = b.contexts()[0];
    var pages = ctx.pages();

    console.log('Pages:', pages.length);
    for (var i = 0; i < pages.length; i++) {
        console.log(' [' + i + ']', pages[i].url().substring(0, 80));
    }

    // 用最后一个页面（可能是导入完成后的新页面，加载了扩展）
    var p = pages[pages.length - 1];
    var t = await p.title();
    console.log('\nUsing page:', t.substring(0, 60));

    var logs = [];
    p.on('console', function (m) { if (m.text().includes('NETLIST')) logs.push(m.text().substring(0, 300)); });

    // 刷新
    await p.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 10000));
    console.log('Reloaded');

    // 检查扩展是否加载
    var extLog = await p.evaluate(function () {
        return 'body has ' + (document.body ? 1 : 0) + ' elements, localStorage: ' + Object.keys(localStorage).length;
    });
    console.log('Page state:', extLog);

    // 框选 + 菜单
    try {
        await p.mouse.move(600, 200);
        await p.mouse.down();
        await new Promise(r => setTimeout(r, 300));
        await p.mouse.move(1200, 500, { steps: 10 });
        await new Promise(r => setTimeout(r, 300));
        await p.mouse.up();
        await new Promise(r => setTimeout(r, 1000));

        await p.mouse.click(722, 16);   // 高级
        await new Promise(r => setTimeout(r, 1000));
        await p.mouse.click(774, 126);  // 局部网表
        await new Promise(r => setTimeout(r, 800));
        await p.mouse.click(928, 125);  // 分析选中
        await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
        console.log('Click error:', e.message);
    }

    console.log('\n=== [NETLIST] logs ===');
    console.log(logs.join('\n') || '(nothing)');
    console.log('\nDone');
})();
