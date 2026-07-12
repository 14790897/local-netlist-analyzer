# 局部网表分析器 — API 参考文档

> 开发时使用的嘉立创 EDA 专业版扩展 API 参考。
> 来源: `https://prodocs.lceda.cn/cn/api/reference/` 和 SDK 类型定义 `@jlceda/pro-api-types`

## 使用的 API 清单

| API | 方法 | 状态 | 用途 |
|-----|------|------|------|
| `SCH_SelectControl` | `getAllSelectedPrimitives()` | BETA | 获取框选的原理图图元 |
| `SCH_SelectControl` | `getSelectedPrimitives_PrimitiveId()` | public (deprecated) | 获取选中图元的 ID |
| `ISCH_Primitive` | `getState_PrimitiveType()` | public | 判断图元类型（Component/Wire/Pin...） |
| `ISCH_PrimitiveComponent` | `getState_Designator()` | public | 获取位号（R1, C3, U1...） |
| `ISCH_PrimitiveComponent` | `getAllPins()` | BETA | 获取器件所有引脚 |
| `ISCH_PrimitiveComponent` | `getState_Name()` | public | 获取器件名称 |
| `ISCH_PrimitiveComponent` | `getState_Manufacturer()` | public | 获取制造商 |
| `ISCH_PrimitiveComponent` | `getState_ManufacturerId()` | public | 获取制造商编号 |
| `ISCH_PrimitiveComponentPin` | `pinNumber` | public | 引脚编号 |
| `ISCH_PrimitiveComponentPin` | `pinName` | public | 引脚名称 |
| `SCH_Netlist` | `getNetlist(type?)` | **deprecated** | 获取网表文本 |
| `SCH_ManufactureData` | `getNetlistFile(name?, type?)` | BETA | 获取网表文件（替代方案） |
| `ESYS_NetlistType` | `JLCEDA_PRO` | enum | JLCEDA 网表格式 |
| `ESYS_NetlistType` | `EASYEDA_PRO` | enum | EasyEDA 网表格式 |
| `SYS_IFrame` | `showIFrame(options)` | public | 弹出展示面板 |
| `SYS_Dialog` | `showWarningMessage(msg)` | public | 警告弹窗 |
| `SYS_ToastMessage` | `showToastMessage(msg)` | public | 轻提示 |

## 类型层级关系

```
ISCH_Primitive (interface)
  ├── ISCH_PrimitiveComponent (class, implements ISCH_Primitive)
  │     ├── getState_Designator(): string
  │     ├── getState_Name(): string
  │     ├── getState_Manufacturer(): string
  │     ├── getState_ManufacturerId(): string
  │     └── getAllPins(): Promise<ISCH_PrimitiveComponentPin[]>
  ├── ISCH_PrimitiveWire
  ├── ISCH_PrimitivePin
  └── ...其他图元类型
```

## 关键注意事项

1. **`getAllSelectedPrimitives()` 返回 `ISCH_Primitive[]`**，不是 `ISCH_PrimitiveComponent[]`。
   必须先用 `getState_PrimitiveType() === 'Component'` 过滤，再转型。

2. **`ESCH_PrimitiveType` 是字符串枚举**：
   - `COMPONENT = "Component"`
   - `WIRE = "Wire"`
   - `PIN = "Pin"`
   - ...

3. **`getNetlist()` 虽然 deprecated，但返回字符串**，比 `getNetlistFile()`（返回 File 对象）更直接。

4. **`ISCH_Primitive` 没有 `getState_Designator()` 等方法**——这些只在 `ISCH_PrimitiveComponent` 上。
   类型收窄后需要 `as any` 转型调用。

## 网表格式 (JLCEDA)

```
(Signal_Name Component-PinNumber)
(VCC R1-1)
(VCC U2-8)
(GND R1-2)
(GND C3-1)
(NET1 U2-1 R3-2)
```

## 参考链接

- [嘉立创 EDA 扩展 API 参考](https://prodocs.lceda.cn/cn/api/reference/)
- [如何开始开发扩展](https://prodocs.lceda.cn/cn/api/guide/how-to-start.html)
- [扩展广场](https://jlc-ext.com/)
- [SDK (GitHub)](https://github.com/easyeda/pro-api-sdk)
- [SDK (Gitee)](https://gitee.com/jlceda/pro-api-sdk)
