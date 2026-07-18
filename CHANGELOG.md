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
