/**
 * 最简稳定测试 — V3 高级→运行脚本 粘贴执行
 */
(async function () {
    // 用 stable API: getSelectedPrimitives_PrimitiveId
    var ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
    console.log('[R] IDs:', ids ? ids.length : 0);
    
    if (!ids || !ids.length) {
        eda.sys_Dialog.showInformationMessage('未选中任何图元。请在原理图中框选元件后重试。');
        return;
    }

    // 用 doSelectPrimitives 重新选中
    await eda.sch_SelectControl.doSelectPrimitives(ids);

    // 再用 getAllSelectedPrimitives（可能会崩，所以包住）
    var primitives = [];
    try {
        primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        console.log('[R] 全量:', primitives.length);
    } catch (e) {
        console.log('[R] getAllSelectedPrimitives 不可用: ' + e.message);
    }

    // 网表
    var nl = '';
    try { nl = await eda.sch_Netlist.getNetlist('JLCEDA'); } catch (e) {}
    if (!nl) try { nl = await eda.sch_Netlist.getNetlist('EasyEDA'); } catch (e) {}
    console.log('[R] 网表: ' + (nl ? nl.length : 0) + ' 字节');
    console.log('[R] 前500字: ' + (nl ? nl.substring(0, 500) : '(空)'));

    // Dialog
    eda.sys_Dialog.showInformationMessage(
        '已选中 ' + ids.length + ' 个图元\n网表 ' + (nl ? nl.length : 0) + ' 字节\n详见Console'
    );
})();
