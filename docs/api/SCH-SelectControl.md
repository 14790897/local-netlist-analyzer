# SCH_SelectControl class

原理图 & 符号 / 选择控制类。获取或操作选择的元素。

## 方法

```typescript
class SCH_SelectControl {
    /**
     * 查询所有已选中图元的图元对象
     * @beta
     */
    getAllSelectedPrimitives(): Promise<Array<ISCH_Primitive>>;

    /**
     * 查询所有已选中图元的图元 ID
     * @beta
     */
    getAllSelectedPrimitives_PrimitiveId(): Promise<Array<string>>;

    /**
     * 查询选中图元的图元 ID
     * @public
     * @deprecated 请用 getAllSelectedPrimitives_PrimitiveId 替代
     */
    getSelectedPrimitives_PrimitiveId(): Promise<Array<string>>;

    /**
     * 查询选中图元的所有参数
     * @beta
     * @deprecated 请用 getAllSelectedPrimitives 替代
     */
    getSelectedPrimitives(): Promise<Array<Object>>;

    /**
     * 使用图元 ID 选中图元
     * @public
     */
    doSelectPrimitives(primitiveIds: string | Array<string>): Promise<boolean>;

    /**
     * 进行交叉选择
     * @public
     */
    doCrossProbeSelect(
        components?: Array<string>,
        pins?: Array<string>,
        nets?: Array<string>,
        highlight?: boolean,
        select?: boolean
    ): boolean;

    /**
     * 清除选中
     * @public
     */
    clearSelected(): boolean;

    /**
     * 获取当前鼠标在画布上的位置
     * @beta
     */
    getCurrentMousePosition(): Promise<{ x: number; y: number } | undefined>;
}
```

## 使用示例

```typescript
// 获取框选的元件
const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();

// 筛选器件类型
for (const p of primitives) {
    if (p.getState_PrimitiveType() === 'Component') {
        // p 可以转型为 ISCH_PrimitiveComponent
        const comp = p as any;
        const designator = comp.getState_Designator();
        const name = comp.getState_Name();
        // ...
    }
}
```

来源: https://prodocs.lceda.cn/cn/api/reference/pro-api.sch_selectcontrol.html
