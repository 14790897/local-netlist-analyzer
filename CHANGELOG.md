# 1.5.0

## 新增 (整图分析 + AI 一键分析)

之前 `analyzeSelection` 只能分析框选区域。v1.5.0 新增"整图分析"入口,直接读当前 sch 页的全集网表,不依赖 selection。

1. **`analyzeWholeSchematic()` (顶菜单)**: 不读 `sch_SelectControl`,直接 `getNetlistFile('netlist', 'JLCEDA')` → 拿全 sch 元件 → 出 dialog:
   ```
   整图分析: 57元件 95网络  ·  3V3(34pin) · GND(28pin) · EN(1pin) · GPIO9(2pin) · VBUS(2pin) · NET_PB8(1pin)
   U1: ESP32-C3-WROOM-02-N4 · 2.4GHz  ·  R1: 0603WAF1002T5E · 10kΩ  ·  C1: 100nF  ·  L1: 10uH  ·  Q1: AO3401A
   ```
   第一行用 "整图分析" 前缀,跟 `analyzeSelection` 的 "37选中 16元件" 明显区分。

2. **`aiAnalyzeWholeSchematic()` (顶菜单)**: 同上,但走 AI 路径,自动开 chat.html + 设 `__ai_prefill` 提示词,模板说"基于整张原理图"而不是"基于框选":
   ```
   请基于以下整张原理图(共 57 个元件、95 个网络), 用中文给出结构化分析。覆盖以下要点:
   1) 这张电路的主要功能(1-2 句话)和它大致在做什么产品/模块
   2) 涉及的电源轨(VCC/GND/特殊电压)
   3) 关键信号路径(输入→处理→输出), 识别主控/通信接口/传感器
   4) 整体元件分工: U/R/C/Q/L/LED/M 各起什么作用、是否齐全
   5) 任何值得注意的设计要点或潜在问题(缺件/未连接的 net/异常 value 等)
   ```
   compInfo 同样拼进 prompt(沿用 v1.4.0),AI 知道每个 desig 是什么型号。

3. **菜单** (3 处):
   - 顶菜单 `headerMenus.home` 加 2 项: "AI 分析整张原理图" / "分析整张原理图"
   - 顶菜单 `headerMenus.sch` 加 2 项 (同上)
   - 右键菜单 `contextMenus.sch` 加 1 项: "分析整张原理图"

4. **复用**:
   - `getNetlistText()` / `extractCompInfo()` / `compInfoShortLine()` / `buildCompInfoPrompt()` / `storeResult()` / `loadAIConfig()` / `loadFileConfig()` 全部复用
   - `iframe/chat.html` 0 改动 — `__nl_data.compInfo` 跟选中路径走同一条读取链路,手动提问也带 compInfo
   - `__file_config.saveToDisk` 沿用 v1.3.9 默认 false 语义, opt-in 才写 CSV/JSON

5. **不做** (明确):
   - ❌ 跨多 sch 页合并 — 只当前 sch 页
   - ❌ 大原理图性能阈值 — 直接全量
   - ❌ 新增 IFrame — 复用 chat.html

# 1.4.0

## 新增 (分析结果带器件型号, dialog/AI 都知道每个 desig 是什么)

之前 `analyzeSelection` 的 dialog 只显示 `R5, U1, C2` 这种 designator 引用编号,AI 收到的 prompt 也只有 desig 列表。AI 只能猜 "U 系列是 IC, R 是电阻",经常猜错型号 / 封装。

JLCEDA v2.0.0 网表 JSON 的 `props` 实际带有 30+ 字段(Dump 实测: `Value` / `DeviceName` / `Manufacturer` / `Manufacturer Part` / `Supplier Part` / `LCSC Part Name` / `Footprint` / `FootprintName` / `Description` / `Datasheet` ...)。`parseV2Netlist` 之前只读 `Designator`,其余全丢。

1. **`parseV2Netlist` → `extractCompInfo(props)`**: 新 helper 从 v2.0.0 `props` 抽公共字段到扁平 `ComponentInfo`(value/name/manufacturer/mfrPart/lcsc/lcscDesc/footprint/footprintName/description/datasheet)。每个 symbol 自带啥模板字段就抽啥,字段缺失不报错。`Name` 字段跳过 `={Value}` 模板占位符,真值走 `Value`。

2. **dialog 第二行加器件型号**:
   ```
   3选中 3元件 5网络 · 3V3(1pin) · GND(3pin) · NET_PB8(1pin) · NET_PB9(1pin) · VCC(1pin)
   U1: ESP32-C3-WROOM-02-N4 · 2.4GHz  ·  R1: 0603WAF1002T5E · 10kΩ  ·  R2: 0603WAF4701T5E · 4.7kΩ
   ```
   `compInfoShortLine` 优先 `DeviceName`(IC 看型号),后跟 `Value`(电阻/电容看值);再补 `Footprint` 区分封装。

3. **`__nl_data` 多存 `compInfo: Record<desig, ComponentInfo>`**:
   - AI 路径(aiAnalyzeSelection)的 `__ai_prefill` 会多塞一段"器件型号清单",格式:
     ```
     --- 器件型号清单（来自网表 props）---
     器件清单（按 Designator 排序）：
       R1: 10kΩ (UNI-ROYAL(厚声)) [LCSC: C25804] — 厚声 0603 10kΩ ±1% 1/10W
       U1: ESP32-C3-WROOM-02-N4 (ESPRESSIF(乐鑫)) [LCSC: C2934560] — 不带固件 2.4GHz Wi-Fi（802.11b/g/n）+ 蓝牙5模组
     ```
   - 手动 `AI 对话` 也吃到(chat.html 同样拼 compInfo 段进 system context),用户问"U1 是什么芯片?" 现在能答"ESP32-C3-WROOM-02-N4"。

4. **向后兼容**: `compInfo` 字段对旧 chat.html 透明(没找到字段就忽略,跟之前行为一致)。

# 1.3.9

## 调整 (文件保存默认关闭)

1. **`saveToDisk` 默认值从 `true` 改为 `false`**: 之前 v1.3.8 默认开, 新装扩展的用户首次分析时会在工程目录意外写 `local-netlist.csv` / `netlist-raw.json`, 体验上像是 bug。现在默认关闭, 用户在 settings.html 显式勾选 "分析后自动保存到本地" 才会写文件。

2. **settings.html**: checkbox 去掉 HTML `checked` 属性, 改用 JS 显式 `cb.checked = (fcfg.saveToDisk === true)` 控制。

# 1.3.8

## 新增 (文件保存配置开关)

1. **settings.html 加 "文件保存设置" 分组**: 跟 AI 设置并列, 一个 checkbox 控制 `__file_config.saveToDisk`。默认 `true` (保持 v1.3.7 行为), 关闭后 `analyzeSelection` 和 `aiAnalyzeSelection` 都不写 `local-netlist.csv` / `netlist-raw.json`, 只在 dialog/iframe 展示结果。

2. **`__file_config` 独立 storage key**: 跟 `__ai_config` 分开, 互不污染, 重置 AI 配置不会影响文件保存设置。

3. **`loadFileConfig()` helper**: 默认 `{ saveToDisk: true }`, 调用 `sys_Storage.getExtensionUserConfig('__file_config')`, 解析失败或不存在时回退默认。

# 1.3.7

## 修复 (analyzeSelection dialog 视觉混淆)

1. **dialog 分隔符 | 改成 ·**: 原来用 ASCII `|` 分隔 summary + detail, 但嘉立创 dialog 用的是中文字体, ASCII `|` 字符被渲染成"中"字形, 看上去像 "37选中中 54元件 40网络"(实际是 "37选中 | 54元件 40网络"), 用户疑惑。改为 `·` (中点) 作为分隔符, 任意中文字体都能正确显示。

# 1.3.6

## 修复 (deepseek-v4-pro reasoning 超时)

1. **chat.html AbortController timeout 从 60s 改为 180s**: 实测 `deepseek-v4-pro` (reasoning model) 在 `max_tokens=4000` + 包含 16 元件 13 网络 system context 的完整网表分析 prompt 下, 真实响应时间是 60-120s(76s 实测). 60s AbortController 太短, 总是 abort 后才拿到 200 OK, 报"请求超时(60s)". 改 180s 给 reasoning 模型充足时间。

2. **错误信息具体化**: "请求超时(60s),请检查网络或 API 配置" → "请求超时(180s)。deepseek-v4-pro 等推理模型思考时间较长,如频繁超时请检查网络或换更快的模型"。

# 1.3.5

## 修复 (嘉立创 V3.2 沙箱兼容)

1. **枚举值改用 V3.2 字符串**: `getState_PrimitiveType()` 在 V3.2 返回 `'Component' / 'ComponentPin' / 'Wire'`(字符串, 见 prodocs ESCH_PrimitiveType 枚举), 旧代码用 `'COMPONENT' / 6` 等数字/大写全部静默不匹配. 改为同时接受 `'Component' / 'COMPONENT' / 6` 三种形式.

2. **Pin owner 反查改用 `getAllPinsByPrimitiveId`**: V3.2 的 `ISCH_PrimitivePin / ISCH_PrimitiveComponentPin` 父类根本没有 `getState_OwnerComponentDesignator()` 方法 (pro-api-types 0.3.6 类型定义中也没有). 改为: 先记下选中 pin 的 primitiveId, 再 `eda.sch_PrimitiveComponent.getAll()` + `getAllPinsByPrimitiveId(primitiveId)` 反查 owner designator.

3. **空选区时区分"没选"vs"API 不可用"**: 之前 ids 为空时一律报"请先在原理图中框选". 现在先检查 `eda.sch_SelectControl.getAllSelectedPrimitives` 是否真的存在(可能在 V3.2 沙箱初始化失败时不存在), 如果 API 不可用, 报"当前环境未提供 sch_SelectControl API。请在原理图页面打开,或刷新编辑器重试 (V3.2 沙箱需要 sch canvas 已激活)".

4. **右键菜单注册**: extension.json 缺 `contextMenus` 字段, 右键菜单从来没注册. 加上 `contextMenus.sch.local-netlist-ctx`(分析选中区域网表 / AI 分析选中区域网表). V3.2 推荐同时在 `activate()` 里调 `eda.sys_RightClickMenu.changeMenu()` 二次注册.

# 1.3.4

## 修复 (installV32Shim 三档判定)

`installV32Shim` v1.3.3 在 V3.2 sandbox 里 alias `eda = _EXTAPI_ROOT_`, 但 sandbox 自己的 eda 已经是 V3.0 兼容, 覆盖反而破坏. 改为 tier-based: V3.0/3.1 不动, V3.2 sandbox 不动, 只在 V3.2 main page 缺 eda 时才 shim.

# 1.3.3

## 修复 (V3.2 防御性兼容 shim)

V3.2 把 `eda` 从 `window.eda` 移到 `_EXTAPI_SCRIPT_SPACES_[uuid].eda` 沙箱, primitive 从 getter (`getState_*`) 改为 plain property. 加 `installV32Shim()` 自动探测: V3.0/3.1 沙箱不动; V3.2 沙箱 alias eda 到 root; V3.2 主页面缺 eda 时同样 alias + 包装 4 个 primitive 返回方法 (getAllSelectedPrimitives / getSelectedPrimitives / getPrimitivesByPrimitiveId / getPrimitiveByPrimitiveId) 把 plain property 适配回 getter.

# 1.3.2

## 修复

1. **框选失效，默认包含全部元件**：原 `doAnalyze` 只收集"完整 component"作为过滤依据（`getState_PrimitiveType() === 'COMPONENT'`）。如果用户框选时只覆盖到了引脚/连线（没选到 component 主体），`selectedDesigs` 集合为空，旧代码 `if (selectedDesigs.size > 0 && !selectedDesigs.has(desig))` 会**直接跳过过滤**，结果整张网表的所有元件都被当成"选中"，看似"默认全部"。

   新的过滤逻辑同时识别三种选区：
   - **component 主体**：直接按 Designator 收录
   - **pin**：通过 `getState_OwnerComponentDesignator + getState_PinNumber` 反推所属 component
   - **wire**：通过 `getState_Net` 收集网络，再反推"任何引脚落在这些网络上的 component"
   - 如果只选了 wire（没 component/pin），includeDesigs 为空，自动切到"按网络反推 component"模式
   - 如果完全没有任何可用信息（空选区），直接报错"请先框选"，不再静默退回全表

# 1.3.1

## 新增

1. **显示 AI 思考过程**：deepseek-v4-pro 等 reasoning 模型在 API 返回的 `message.reasoning_content` 字段里有完整的思考链，之前 chat.html 只读了 `content`，把思考过程丢掉了。现在每次 AI 回复会在回复上方插入一个可折叠的 `<details>` 块（短思考<200字符默认展开，长思考默认折叠），样式淡灰色 + 💭 图标 + 字符数统计，点击"思考过程"展开/收起。完成后正常显示打字机效果。

# 1.3.0

## 新增

1. **AI 回复打字机效果**：AI 消息不再一次性全部渲染，而是按字符（中文 1 字符/14ms，英文 2 字符/14ms）逐字显示，让用户能看到 AI "正在写"。完成后自动切换到完整 Markdown 渲染（包含代码块/表格/列表）。

2. **AI 分析局部网表 预设提示**：点击 "局部网表 → AI 分析局部网表" 后，会基于当前选中的元件数和网络数生成结构化的中文分析 prompt（功能、电源轨、信号路径、元件分工、潜在问题），自动填入对话框并发送。用户不再需要手写问题。

   实现方式：菜单函数把预填文本写入 `__ai_prefill` storage，chat.html init 时检测到非空就自动填充 textarea + 触发 doSend()，并清空 prefill 防止重开重复发送。

# 1.2.2

## 修复

1. **网表解析过滤过宽**：原 `parseV2Netlist` 用 `desig.length > 20` 过滤过宽，导致原理图里如果存在 Designator 是长文本的元件（比如"分析这个电路的SPI总线部分,使用了哪些引脚1"，刚好 20 字符）会被误当成真实元件加入网表，并把子部分（1-1、1-2、1-3...）作为引脚加入网络。AI 看到这种异常的 Designator 就会胡说八道。改为 `length > 10` + 严格正则 `^[A-Za-z][A-Za-z0-9_]*\d+$`，任何不符合标准 refdes 格式（U1/R16/C5 这类）的字符串一律过滤。

# 1.2.1

## 修复

1. **AI 对话无回复**：`iframe/chat.html` 里的局部变量 `history` 覆盖了浏览器的 `window.history`（History API），导致 `history.push()` 抛 TypeError。doSend 走到用户消息入队时就崩溃，后面的 fetch 没发、按钮永远 disabled。改为 `chatMessages` 避免冲突。

# 1.2.0

## 变更

1. 使用纯 ESLint 的代码格式化方式
2. 打包时额外进行压缩，可以获得更小的扩展包

# 1.1.1

## 变更

1. 为了符合隐私政策，禁止在 extension.json、README.md、CHANGELOG.md、LICENSE 内添加电子邮箱地址作为联系方式

# 1.1.0

## 新增

1. 新增扩展注册头部菜单的多语言翻译支持
2. 新增更新日志（CHANGELOG.md）

## 变更

1. 替换已弃用的方法（SYS_Dialog.showInformationMessage）

# 1.0.0

初始版本
