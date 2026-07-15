/**
 * 最简稳定测试 — V3 高级→运行脚本 粘贴执行
 * v1.0.27 — 使用新 API sch_ManufactureData.getNetlistFile()
 */
(async function () {
    var ids = await eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
    console.log('[R] IDs:', ids ? ids.length : 0);

    if (!ids || !ids.length) {
        eda.sys_Dialog.showInformationMessage('未选中任何图元。请在原理图中框选元件后重试。');
        return;
    }

    await eda.sch_SelectControl.doSelectPrimitives(ids);

    var primitives = [];
    try {
        primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
        console.log('[R] 全量:', primitives.length);
    } catch (e) {
        console.log('[R] getAllSelectedPrimitives 不可用: ' + e.message);
    }

    // 网表 — 新 API
    var nl = '';
    var file = await eda.sch_ManufactureData.getNetlistFile('netlist', 'JLCEDA');
    if (file && typeof file.text === 'function') {
        nl = await file.text();
    }
    if (!nl) {
        file = await eda.sch_ManufactureData.getNetlistFile();
        if (file && typeof file.text === 'function') nl = await file.text();
    }
    console.log('[R] 网表: ' + (nl ? nl.length : 0) + ' 字节');
    console.log('[R] 前500字: ' + (nl ? nl.substring(0, 500) : '(空)'));

    eda.sys_Dialog.showInformationMessage(
        '已选中 ' + ids.length + ' 个图元\n网表 ' + (nl ? nl.length : 0) + ' 字节\n详见Console'
    );
})();
