'use strict';
var chromium = require('playwright-core').chromium;

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9273');
    var p = b.contexts()[0].pages()[0];

    var logs = [];
    p.on('console', function (m) { logs.push(m.text().substring(0, 200)); });

    await p.goto('https://pro.lceda.cn/editor?cll=debug', { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));

    // 新建原理图: 文件→新建→原理图
    await p.mouse.click(85, 16);  // 文件
    await new Promise(r => setTimeout(r, 1000));
    // 找并点"新建"或"原理图"
    await p.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === '新建' || t === '新建(N)') { all[i].click(); break; }
        }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await p.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === '原理图' || t === '原理图(S)') { all[i].click(); break; }
        }
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log('New schematic created\n');

    // 找大 canvas
    var bc = await p.evaluate(function () {
        return [].map.call(document.querySelectorAll('canvas'), function(c) { var r=c.getBoundingClientRect(); return {w:Math.floor(r.width),h:Math.floor(r.height)}; });
    });
    console.log('Canvases:', JSON.stringify(bc));

    // 在空白原理图上放置两个元件
    // 点左侧"常用库"
    await p.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if ((all[i].textContent || '').trim() === '常用库') { all[i].click(); break; }
        }
    });
    await new Promise(r => setTimeout(r, 2000));

    // 找元件列表中的 R 电阻并放置
    var placed = await p.evaluate(function () {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === 'R_0805' || t === 'R 0805' || (t.startsWith('R_') && t.length < 10)) {
                all[i].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                return t;
            }
        }
        return 'no resistor found';
    });
    console.log('Place:', placed);
    await new Promise(r => setTimeout(r, 2000));

    // 在画布上点击放置
    var bigC = await p.evaluate(function () {
        var cs = document.querySelectorAll('canvas');
        for (var i = 0; i < cs.length; i++) {
            var r = cs[i].getBoundingClientRect();
            if (r.width > 500) return { x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2) };
        }
        return null;
    });
    if (bigC) {
        await p.mouse.click(bigC.x, bigC.y);
        await new Promise(r => setTimeout(r, 500));
        await p.mouse.click(bigC.x + 100, bigC.y + 100);
        console.log('Components placed at:', bigC.x, bigC.y, '\n');
        await new Promise(r => setTimeout(r, 1000));
    }

    // 框选
    if (bigC) {
        await p.mouse.move(bigC.x - 50, bigC.y - 50);
        await p.mouse.down();
        await new Promise(r => setTimeout(r, 200));
        await p.mouse.move(bigC.x + 200, bigC.y + 200, { steps: 10 });
        await new Promise(r => setTimeout(r, 200));
        await p.mouse.up();
        await new Promise(r => setTimeout(r, 1000));
        console.log('Selected\n');
    }

    // 菜单
    await p.mouse.click(365, 16);
    await new Promise(r => setTimeout(r, 1000));
    await p.mouse.click(408, 125);
    await new Promise(r => setTimeout(r, 800));
    await p.mouse.click(590, 124);
    await new Promise(r => setTimeout(r, 3000));
    console.log('Menu clicked\n');

    // 结果
    var ui = await p.evaluate(function () {
        var r = [];
        document.querySelectorAll('iframe, [class*="dialog"], [class*="modal"], [class*="toast"]').forEach(function (e) {
            if (e.offsetHeight > 20) r.push((e.textContent || '').substring(0, 300));
        });
        return r;
    });
    console.log('UI:', JSON.stringify(ui));
    console.log('\nDone');
})();
