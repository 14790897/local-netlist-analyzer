# SCH_Netlist class

原理图 & 符号 / 网表类。获取、更新网表。

```typescript
class SCH_Netlist {
    /**
     * 获取网表
     * @public
     * @deprecated 请使用 SCH_ManufactureData.getNetlistFile 替代
     * @param type 网表格式 (ESYS_NetlistType)
     * @returns 网表数据 (字符串)
     */
    getNetlist(type?: ESYS_NetlistType): Promise<string>;

    /**
     * 更新网表
     * @beta
     */
    setNetlist(type: ESYS_NetlistType | undefined, netlist: string): Promise<void>;
}
```

## 使用示例

```typescript
// 获取 JLCEDA 格式网表
const netlist = await eda.sch_Netlist.getNetlist('JLCEDA');

// 解析网表行: (Signal_Name Designator-PinNumber)
// 示例: (VCC R1-1)
//      (GND C3-2)
//      (NET1 U2-1 R3-2)
for (const line of netlist.split('\n')) {
    const match = line.trim().match(/\(\s*(\S+)\s+(\S+)/);
    if (match) {
        const netName = match[1];    // "VCC"
        const nodeRef = match[2];    // "R1-1"
    }
}
```

来源: https://prodocs.lceda.cn/cn/api/reference/pro-api.sch_netlist.html
