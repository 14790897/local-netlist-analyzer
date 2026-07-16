'use strict';
/**
 * Re-import extension into user's active page (the no-cll-debug tab)
 * This might also re-trigger EDA sch API
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');

(async function () {
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages().find(x => x.url().indexOf('pro.lceda.cn') >= 0 && x.url().indexOf('cll=debug') < 0);

    // First check menu
    var hasMenu = await p.evaluate(() => {
        function walk(root, depth) {
            if (depth > 10) return false;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return true;
                }
                for (var c of (root.children || [])) if (walk(c, depth+1)) return true;
            } catch (e) {}
            return false;
        }
        return walk(document.body, 0);
    });
    console.log('Menu 局部网表 exists:', hasMenu);
    if (hasMenu) { console.log('Already installed'); await b.close(); return; }

    // Click 高级
    console.log('Click 高级...');
    try {
        var advanced = p.locator('span[data-test="Advanced"]');
        await advanced.click({ timeout: 2000 });
    } catch (e) {
        await p.locator('.tool-bottom-menu-more_SoDfO').click();
        await p.waitForTimeout(500);
        await p.locator('.tool-bottom-menu-more-container_NmJv7 span[data-test="Advanced"]')
            .evaluate(el => el.click());
    }
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/live-advanced.png' });

    // Click 扩展管理器
    console.log('Click 扩展管理器...');
    await p.getByText('扩展管理器', { exact: false }).click({ timeout: 10000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/live-ext-mgr.png' });

    // Click 导入
    console.log('Click 导入...');
    var modal = p.locator("[class*='lc_modal_dialog']").first();
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    const [chooser] = await Promise.all([
        p.waitForEvent('filechooser', { timeout: 10000 }),
        modal.locator('button', { hasText: '导入' }).click()
    ]);
    await chooser.setFiles('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/pro-api-sdk/build/dist/local-netlist-analyzer_v1.1.0.eext');
    console.log('Set file');
    await p.waitForTimeout(3000);

    // Close
    await modal.locator("[class*='close']").first().click().catch(() => p.keyboard.press('Escape'));
    await p.waitForTimeout(2000);
    await p.screenshot({ path: 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests/live-after-import.png' });

    // Verify menu
    var newMenu = await p.evaluate(() => {
        function walk(root, depth) {
            if (depth > 10) return false;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return { x: r.x, y: r.y, w: r.width, h: r.height };
                }
                for (var c of (root.children || [])) {
                    var f = walk(c, depth+1);
                    if (f) return f;
                }
            } catch (e) {}
            return false;
        }
        return walk(document.body, 0);
    });
    console.log('Menu after import:', JSON.stringify(newMenu));
    await b.close();
})();
