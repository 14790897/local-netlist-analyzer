'use strict';
/**
 * Use mcp dev-plugin logic but against the user's already-logged-in Edge
 * (CDP port 9224) — doImport() flow but on the existing page.
 */
var { chromium } = require('C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/extension-dev-mcp-tools/node_modules/playwright-core');
var path = require('path');
var fs = require('fs');

var PLUGIN = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/pro-api-sdk/build/dist/local-netlist-analyzer_v1.1.0.eext';
var SHOT = 'C:/Users/13963/WorkBuddy/2026-07-12-00-12-10/outputs/eda-tests';

async function shot(p, name) {
    try { await p.screenshot({ path: path.join(SHOT, name) }); console.log('  [shot]', name); }
    catch (e) { console.log('  [shot-fail]', name, e.message.substring(0, 60)); }
}

(async function () {
    if (!fs.existsSync(PLUGIN)) { console.log('Plugin not found:', PLUGIN); return; }
    var b = await chromium.connectOverCDP('http://localhost:9224');
    var p = b.contexts()[0].pages()[0];
    console.log('PAGE:', await p.title());

    // Step 1: navigate to extension manager (高级 → 扩展管理器)
    // The mcp tool's doImport logic:
    //   - click 高级 menu (or via "更多")
    //   - click 扩展管理器
    //   - modal opens → click 导入 → setFiles(pluginPath)
    console.log('\n--- Step 1: Open 高级 menu ---');
    // The user is already on schematic page, so let's click "高级"
    try {
        var advanced = p.locator('span[data-test="Advanced"]');
        await advanced.click({ timeout: 3000 });
        console.log('  Clicked 高级');
    } catch (e) {
        console.log('  Direct click failed:', e.message.substring(0, 80));
        // Try via 更多
        try {
            var moreBtn = p.locator('.tool-bottom-menu-more_SoDfO');
            await moreBtn.click();
            await p.waitForTimeout(500);
            var advancedInMore = p.locator('.tool-bottom-menu-more-container_NmJv7 span[data-test="Advanced"]');
            await advancedInMore.evaluate(function (el) { el.click(); });
            console.log('  Clicked 高级 via 更多');
        } catch (e2) {
            console.log('  更多 click also failed:', e2.message.substring(0, 80));
        }
    }
    await p.waitForTimeout(500);
    await shot(p, 'i1-advanced-menu.png');

    // Step 2: click 扩展管理器
    console.log('\n--- Step 2: Open extension manager ---');
    try {
        await p.getByText('扩展管理器', { exact: false }).click({ timeout: 5000 });
        console.log('  Clicked 扩展管理器');
        await p.waitForTimeout(1000);
    } catch (e) {
        console.log('  Failed:', e.message.substring(0, 100));
    }
    await shot(p, 'i2-ext-manager.png');

    // Step 3: click 导入 button in modal
    console.log('\n--- Step 3: Click 导入 ---');
    try {
        var modal = p.locator("[class*='lc_modal_dialog']").first();
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        const [fileChooser] = await Promise.all([
            p.waitForEvent('filechooser', { timeout: 10000 }),
            modal.locator('button', { hasText: '导入' }).click()
        ]);
        console.log('  File chooser opened');
        await fileChooser.setFiles(PLUGIN);
        console.log('  Set files:', path.basename(PLUGIN));
        await p.waitForTimeout(3000);
    } catch (e) {
        console.log('  Failed:', e.message.substring(0, 150));
    }
    await shot(p, 'i3-after-import.png');

    // Step 4: close modal
    console.log('\n--- Step 4: Close modal ---');
    try {
        var modal = p.locator("[class*='lc_modal_dialog']").first();
        var closeBtn = modal.locator("[class*='close']").first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            console.log('  Closed via X');
        } else {
            await p.keyboard.press('Escape');
            console.log('  Closed via Escape');
        }
    } catch (e) { console.log('  Close:', e.message); }
    await p.waitForTimeout(1000);
    await shot(p, 'i4-after-close.png');

    // Step 5: verify 局部网表 menu appears
    console.log('\n--- Step 5: Verify menu ---');
    var menuInfo = await p.evaluate(function () {
        function walk(root, depth) {
            if (depth > 10 || !root) return null;
            try {
                var t = (root.textContent || '').trim();
                if (t === '局部网表' && root.children.length < 3) {
                    var r = root.getBoundingClientRect();
                    if (r.width > 0) return { x: r.x, y: r.y, w: r.width, h: r.height };
                }
                var c = root.children || [];
                for (var i = 0; i < c.length; i++) {
                    var f = walk(c[i], depth + 1);
                    if (f) return f;
                }
            } catch (e) {}
            return null;
        }
        return walk(document.body, 0);
    });
    console.log('  局部网表 menu:', JSON.stringify(menuInfo));

    await b.close();
    console.log('\n=== DONE ===');
})();
