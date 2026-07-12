/**
 * 独立脚本 — 快速验证 API 可用性
 *
 * 用法:
 * 1. 打开嘉立创 EDA → 打开一个原理图 → 框选几个元件
 * 2. V2: 顶部菜单 → 设置 → 扩展 → 独立脚本
 *    V3: 顶部菜单 → 高级 → 运行脚本
 * 3. 粘贴此脚本 → 点击运行
 * 4. 查看输出
 */

(async function () {
    const log = [];

    // 1. 测试 getAllSelectedPrimitives
    try {
        const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        log.push(`✅ getAllSelectedPrimitives: ${primitives?.length || 0} 个图元`);
        if (primitives?.length) {
            for (const p of primitives) {
                const type = p.getState_PrimitiveType();
                const id = p.getState_PrimitiveId();
                log.push(`   - ${type} [${id}]`);

                if (type === 'Component') {
                    try {
                        const comp = p; // cast
                        const d = comp.getState_Designator?.();
                        const name = comp.getState_Name?.();
                        log.push(`     位号: ${d}, 名称: ${name}`);

                        const pins = await comp.getAllPins?.();
                        log.push(`     引脚数: ${pins?.length || 0}`);
                    } catch (e) {
                        log.push(`     ⚠️ 获取元件信息失败: ${e.message}`);
                    }
                }
            }
        }
    } catch (e) {
        log.push(`❌ getAllSelectedPrimitives: ${e.message}`);
    }

    // 2. 测试 getNetlist
    for (const fmt of ['JLCEDA', 'EasyEDA']) {
        try {
            const text = await eda.sch_Netlist.getNetlist(fmt);
            log.push(`✅ getNetlist(${fmt}): ${text?.length || 0} 字节`);
            // 打印前 3 行
            const lines = text.split('\n').slice(0, 3);
            for (const line of lines) {
                log.push(`   ${line.trim()}`);
            }
            break;
        } catch (e) {
            log.push(`❌ getNetlist(${fmt}): ${e.message}`);
        }
    }

    // 3. 测试 sys_Dialog
    try {
        eda.sys_Dialog.showInformationMessage?.('独立脚本测试完成！查看控制台输出');
        log.push('✅ sys_Dialog.showInformationMessage');
    } catch (e) {
        log.push(`❌ sys_Dialog: ${e.message}`);
    }

    // 输出到控制台
    console.log('=== API 测试结果 ===');
    console.log(log.join('\n'));
    console.log('====================');
})();
