# 局部网表分析器 — 测试计划

## 测试矩阵

| 层级 | 文件 | 环境 | 耗时 | CI |
|------|------|------|------|-----|
| 单元 — 网表解析 | `test/mock-test.js` | Node.js | <5s | ✅ auto |
| 集成 — 全链路 mock | `test/integration-test.js` | Node.js | <5s | ✅ auto |
| 浏览器 — DOM/API | `test/browser-test.js` | Chromium | <30s | ✅ auto |
| E2E — Playwright MCP | `test/e2e-playwright.js` | MCP Chrome | ~3min | ❌ 手动 |
| 实机 — 运行脚本 | `test/debug-script.js` | EDA 桌面版 | ~3min | ❌ 手动 |

---

## 1. 单元测试 `test/mock-test.js`

**目标**：验证网表文本解析（`NET:` 格式）

**mock 数据**：
```text
NET: VCC_3V3
  U1-1
  C1-1
NET: GND
  U1-14
  C1-2
```

**验收标准**：

| # | 测试点 | 预期结果 |
|---|--------|---------|
| 1.1 | 解析 NET: 格式 | 正确识别 2 网络 (VCC_3V3, GND) |
| 1.2 | 解析元件名 | 提取 U1, C1 |
| 1.3 | 解析引脚号 | U1-1 → des=U1, pin=1 |
| 1.4 | 空输入处理 | 0 元件 0 网络 |
| 1.5 | 异常格式容错 | 不崩溃,返回空结果 |
| 1.6 | 大小写网表名 | 正确处理 `Net:`, `net:` 等变体 |

**运行**：`node test/mock-test.js`

---

## 2. 集成测试 `test/integration-test.js`

**目标**：mock 所有 EDA API,验证 `analyzeSelection()` 全链路

**mock API**：
- `eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId()` → `['p1','p2','p3']`
- `eda.sch_Netlist.getNetlist('JLCEDA')` → 5 网络 `NET:` 文本
- `eda.sys_IFrame.openIFrame()` / `eda.sys_Dialog.*` / `eda.sys_ToastMessage.*`

**验收标准**：

| # | 测试点 | 预期 |
|---|--------|------|
| 2.1 | 扩展加载 | `[NL] loaded` |
| 2.2 | 选中 3 元件 | ids=3 |
| 2.3 | 网表解析 | 6 components, 5 nets |
| 2.4 | U1 正确解析 | U1 exists in componentList |
| 2.5 | J1 正确解析 | J1 exists in componentList |
| 2.6 | Net SCL → U1-6 | netList['SCL'] includes 'U1-6' |
| 2.7 | 无选中警告 | popup 包含 "框选" |
| 2.8 | `sessionStorage` 数据 | 存储了 `__netlist_result` |
| 2.9 | `popup` 三通道触发 | Toast + Warning + Info |

**运行**：`node test/integration-test.js`

---

## 3. 浏览器测试 `test/browser-test.js`

**目标**：在真实 Chromium DOM 环境验证扩展

**关键区别**：Node.js 无 DOM,此测试揭露 `document`/`Array.from`/`window` 等浏览器 API 问题

| # | 测试点 | 预期 |
|---|--------|------|
| 3.1 | 扩展导出 | `window.edaEsbuildExportName.analyzeSelection` 可调用 |
| 3.2 | Toast 弹窗 | `showToastMessage` 被调用 |
| 3.3 | Warning 弹窗 | `showWarningMessage` 被调用 |
| 3.4 | Info 弹窗 | `showInformationMessage` 被调用 |
| 3.5 | 元件数解析 | 6 components |
| 3.6 | 网络数解析 | 5 nets |
| 3.7 | U1 存在 | componentList 含 U1 |
| 3.8 | J1 存在 | componentList 含 J1 |
| 3.9 | Net SCL | U1-6 在网络 SCL 中 |
| 3.10 | 空选中警告 | 弹窗含 "框选" |
| 3.11 | ES5 兼容 | `Array.from = undefined` 后仍正常 |

**运行**：`node test/browser-test.js`

---

## 4. Playwright MCP E2E 测试 `test/e2e-playwright.js`

**目标**：在 MCP Chrome (带扩展的 EDA) 中测试菜单点击和函数触发

**前置条件**：MCP Chrome 已启动 (port 9273),扩展已导入

| # | 步骤 | 验证点 |
|---|------|--------|
| 4.1 | 主页点 高级 | 菜单展开 |
| 4.2 | 点 局部网表 | 子菜单出现 |
| 4.3 | 点 分析选中 | `analyzeSelection` 被调用 |
| 4.4 | 原理图编辑器 reload | 扩展加载 (`[NETLIST] loaded`) |
| 4.5 | 原理图点菜单 | 菜单含 局部网表 |
| 4.6 | 触发分析 | `showInformationMessage` 弹窗 |
| 4.7 | 截图存档 | test/*.png |

**运行**：`node test/e2e-playwright.js`

---

## 5. 实机调试 `test/debug-script.js`

**目标**：在 EDA 桌面版中直接调 API 诊断问题

**用法**：EDA → 高级(A) → 运行脚本(S) → 粘贴代码 → 运行

**输出**：Console 中 `RAW=` 开头打印原始网表数据

---

## CI 流水线

```
每次 push/PR:
  ┌─ Build (npm ci + npm run build)
  ├─ mock-test.js       ← 单元测试
  ├─ integration-test.js ← 集成测试
  └─ browser-test.js    ← 浏览器测试 (Chromium headless)

tag v*:
  └─ 发布 GitHub Release (artifact: *.eext)
```

---

## 开发流程

```
编写代码 → npm run build → 本地跑全部测试 → git push
                                    │
                          ┌─────────┼──────────┐
                          ▼         ▼          ▼
                    mock-test  integration  browser-test
                          │         │          │
                          └─────────┼──────────┘
                                    ▼
                              CI 全绿 → npm run build → tag vX.Y.Z → 发布
```

## 故障排查

| 症状 | 先跑 | 定位 |
|------|------|------|
| 网表解析不对 | `mock-test.js` | 检查 NET: 格式 parser |
| 函数调用无输出 | `integration-test.js` | 检查 popup/sessionStorage 调用 |
| 浏览器环境崩 | `browser-test.js` | 检查 Array.from/ES5 问题 |
| EDA 菜单不出现 | e2e MCP | 检查 extension.json headerMenus |
| 桌面版无反应 | debug-script.js | 打印原始 netlist 格式 |
