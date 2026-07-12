# 局部网表分析器 — Local Netlist Analyzer

嘉立创 EDA 专业版扩展插件。框选原理图区域，自动提取选中元件关联的局部网表，用于 AI 电路分析或人工快速查看连接关系。

## 为什么需要这个插件

现有 EDA AI 插件要么只能查全量网表（数据太多），要么只能查单个元件（粒度太粗）。这个插件填补了中间地带——**只导出你关心的那片电路的网表**。

## 功能

- 🖱️ 原理图中框选元件 → 自动识别所有选中器件
- 🔗 提取选中元件之间的网络连接关系
- 📋 结构化展示：元件列表 + 网络名称 → 引脚对应关系
- 📤 一键复制网表文本，直接粘贴到 AI 对话中分析
- 🏙️ 暗色主题 UI，与 EDA 编辑器风格一致

## 安装

1. 下载最新的 `.eext` 文件（见 [下载最新版本](https://github.com/14790897/local-netlist-analyzer/actions/workflows/ci.yml?query=branch%3Amain) → 点击最新运行 → 拉到底部下载 `extension-package` 工件)）
2. 打开嘉立创 EDA 专业版
3. 顶部菜单 → **设置** → **扩展** → **扩展管理器** → **导入扩展**
4. 选择 `.eext` 文件即可

## 使用

1. 打开一个原理图
2. 框选你想要分析的一片电路（必须包含器件）
3. 顶部菜单 → **局部网表** → **分析选中区域网表**
4. 在弹出的面板中查看结果，点击"复制网表文本"
5. 粘贴到 Kimi、ChatGPT 等 AI 工具中，进行电路分析

## 技术栈

- **TypeScript** + 嘉立创 EDA Pro API SDK
- 使用的核心 API：
  - `SCH_SelectControl.getSelectedPrimitives()` — 获取框选元件
  - `SCH_Netlist.getNetlist()` — 获取全量网表
  - `SCH_PrimitiveComponent.getAllPins()` — 获取元件引脚
  - `SCH_PrimitiveComponent.getState_*()` — 获取元件属性

## 开发

```bash
# 克隆 SDK
git clone https://github.com/easyeda/pro-api-sdk.git

# 安装依赖
npm install

# 开发
修改 src/index.ts

# 构建
npm run build
# 输出: build/dist/local-netlist-analyzer_vX.X.X.eext
```

## License

Apache-2.0
