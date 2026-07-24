# extension.json 字段规范

> 本文档逐字段列出 [嘉立创 EDA `extension.json` 官方规范](https://prodocs.lceda.cn/cn/api/guide/extension-json.html) 的约束,标注每个字段的类型/必填性/取值范围/示例/本项目实际值,以及踩坑记录。
>
> **适用对象**: 任何 JLCEDA 专业版扩展开发者,特别是首次发布时被驳回想要"知道每个字段到底允许什么"的人。
>
> **最后更新**: 2026-07-24 (基于 prodocs.lceda.cn 官方文档与本项目 v1.5.2 通过案例)

---

## 目录

- [完整字段列表](#完整字段列表)
- [必填字段 (8 个)](#必填字段)
- [强烈建议字段 (4 个)](#强烈建议字段)
- [可选字段 (8 个)](#可选字段)
- [headerMenus 子结构](#headermenus-子结构)
- [完整模板](#完整模板)

---

## 完整字段列表

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `name` | string | ✅ | — | 扩展名 |
| `uuid` | string | ✅ | — | 唯一 ID |
| `displayName` | string | ✅ | — | 展示名 |
| `description` | string | ✅ | — | 描述 |
| `version` | string | ✅ | — | 版本号 |
| `publisher` | string | ✅ | — | 开发者信息 |
| `engines` | object | ✅ | — | 适配引擎 |
| `engines.eda` | string | ✅ | — | 适配的 EDA 版本 |
| `license` | string | ✅ | — | 开源协议 |
| `repository` | object | ⚠️ | — | 源代码仓库 |
| `repository.type` | string | ⚠️ | — | 仓库类型 |
| `repository.url` | string | ⚠️ | — | 仓库 URL |
| `categories` | string\|string[] | ✅ | `Other` | 扩展分类 |
| `keywords` | string[] | ⭕ | `[]` | 关键词 |
| `images` | object | ✅ | — | 展示图 |
| `images.logo` | string | ✅ | — | 图标路径 |
| `images.banner` | string | ⚠️ | — | 横幅路径 |
| `homepage` | string | ⭕ | `""` | 主页 |
| `bugs` | string | ⭕ | `""` | 漏洞反馈渠道 |
| `activationEvents` | object | ⭕ | `{}` | 激活事件 |
| `entry` | string | ✅ | `./dist/index` | 入口文件 |
| `dependentExtensions` | object | ⭕ | `{}` | 依赖扩展 |
| `headerMenus` | object | ⭕ | `{}` | 头部菜单 |
| `contextMenus` | object | ⭕ | `{}` | 右键菜单 (非官方字段, 实战可用) |

图例: ✅ 必填 / ⚠️ 强烈建议 / ⭕ 可选

---

## 必填字段

### `name` — 扩展名

- **类型**: string
- **必填**: ✅
- **约束**:
  - 长度 5-30 字符
  - **只能**包含: `a-z` (小写英文字母) / `0-9` (数字) / `-` (中划线)
  - **不能**包含: 大写字母 / 下划线 `_` / 空格 / 中文 / 特殊字符
- **示例**: ✅ `local-netlist-analyzer` ❌ `Local_Netlist_Analyzer` ❌ `local_netlist` ❌ `LNA工具`
- **本项目**: `local-netlist-analyzer`
- **踩坑**:
  - 用 `Local_Netlist_Analyzer` → 后端正则不匹配, 驳回 "扩展名格式错误"
  - 用 `LNA` (3 字符) → 长度 < 5, 驳回
  - 用 `local netlist analyzer` (带空格) → 包含空格, 驳回

### `uuid` — 唯一标识

- **类型**: string
- **必填**: ✅
- **约束**:
  - **严格 32 字符** (不是带横线的 UUID, 而是去掉横线后的 32 位)
  - **只能**包含: `a-z` (小写英文字母) / `0-9` (数字)
  - **不能**包含: 横线 `-` / 大写字母 / 任何其它字符
- **示例**:
  - ✅ `7bdb0024e09b43129fe600321240eb6d` (32 字符)
  - ❌ `7bdb0024-e09b-4312-9fe6-00321240eb6d` (带横线, 36 字符)
  - ❌ `7BDB0024E09B43129FE600321240EB6D` (大写)
- **本项目**: `7bdb0024e09b43129fe600321240eb6d`
- **踩坑**:
  - 直接复制 `crypto.randomUUID()` (带横线) → 36 字符不过, 驳回
  - 用大写生成 (某些库默认大写) → 驳回
- **自动生成 (Node.js)**:
  ```js
  crypto.randomUUID().replaceAll('-', '').toLowerCase()
  ```

### `displayName` — 展示名

- **类型**: string
- **必填**: ✅
- **约束**: 自由
- **示例**: ✅ `局部网表分析器` ✅ `Local Netlist Analyzer` ✅ `LNA`
- **本项目**: `局部网表分析器`
- **踩坑**: —

### `description` — 描述

- **类型**: string
- **必填**: ✅
- **约束**:
  - 长度建议 96-200 字符
  - **不能**纯营销话术 (如"最强!最智能!一键搞定!")
  - **不能**堆砌 emoji
  - 建议**首句点明核心功能**
- **示例**:
  - ✅ `AI 电路分析 + 局部网表导出。框选原理图区域, 导出选中元件关联的网表 (CSV/JSON), 并由 AI 分析电路功能、电源轨、信号路径与潜在风险, 自动识别器件型号与 LCSC 编号。` (96 字符)
  - ❌ `最强的 AI 工具! 🚀 一键搞定! 快来下载!` (营销话术 + emoji)
- **本项目**: 96 字符
- **踩坑**:
  - 太短 (< 50 字) → 商店页 SEO 差, 搜索不到
  - 太长 (> 300 字) → 在商店页被截断显示
  - 全英文 → 中文用户为主的平台上评分低

### `version` — 版本号

- **类型**: string
- **必填**: ✅
- **约束**:
  - 严格 semver: `major.minor.patch` 三段
  - 每段是非负整数
  - **不能**带 `v` 前缀 (那是 tag, 不是 version)
  - **不能**只两段 (如 `1.5`)
  - **不能**含 pre-release 标识 (如 `1.5.0-beta`)
- **示例**:
  - ✅ `1.5.2`
  - ❌ `v1.5.2` (含 `v`)
  - ❌ `1.5` (只两段)
  - ❌ `1.5.2-beta` (含 pre-release)
- **本项目**: `1.5.2`
- **踩坑**:
  - 用了 `v1.5.2` → 商店显示成 `vv1.5.2` 或报错

### `publisher` — 开发者信息

- **类型**: string
- **必填**: ✅
- **约束**:
  - 自由但**不能含 PII** (个人可识别信息)
  - 邮箱 `<xxx@qq.com>` → 隐私检测
  - 真名 + 邮箱 → 高风险
  - 建议用: 中性名 (公司/团队/化名)
- **示例**:
  - ✅ `OSHWHub` (推荐, 中性)
  - ✅ `EasyEDA` (官方团队)
  - ✅ `Pro-API-Team`
  - ❌ `liuweiqing <liuweiqing147@gmail.com>` (PII)
  - ❌ `张三 13800138000` (PII)
- **本项目**: `OSHWHub` (从 `liuweiqing` 改来, 避免隐私误判)
- **踩坑**:
  - 真名 + 邮箱组合 → 商店自动审核的 PII 检测器命中, 直接驳回
  - 即使只是 `<xxx@example.com>` 这种看起来无害的, 也建议换

### `engines.eda` — 适配 EDA 版本

- **类型**: string (semver range)
- **必填**: ✅
- **约束**: 标准 semver range 语法
- **示例**:
  - ✅ `^3.0.0` (本项目, 适配 V3.0+)
  - ✅ `^2.3.0` (适配 V2.3+)
  - ✅ `^3.2.148` (精确到 V3.2.148+)
  - ❌ `3.0.0` (不是 range)
- **本项目**: `^3.0.0`
- **踩坑**:
  - 用 `^2.0.0` 但代码用了 V3 才有的 API → 用户装在 V3 上报 undefined

### `license` — 开源协议

- **类型**: string (SPDX 标识)
- **必填**: ✅
- **约束**: OSI 批准的协议标识
- **示例**:
  - ✅ `Apache-2.0` (本项目)
  - ✅ `MIT`
  - ✅ `GPL-3.0` / `GPL-3.0-only`
  - ✅ `BSD-3-Clause`
  - ❌ `My Custom License` (不识别)
- **本项目**: `Apache-2.0`
- **踩坑**:
  - `GPL` (不带版本) → 不识别, 驳回
  - 自造协议 → 不识别

### `categories` — 扩展分类

- **类型**: string 或 string[]
- **必填**: ✅
- **约束** (8 个官方值, **严格匹配大小写**):
  | 值 | 适用 |
  |---|---|
  | `Schematic` | 原理图相关 |
  | `Symbol` | 符号库 |
  | `PCB` | PCB 编辑 |
  | `Footprint` | 封装库 |
  | `Panel` | 拼板 |
  | `Library` | 综合库 |
  | `Project` | 项目级工具 |
  | `Other` | 其它 |
- **示例**:
  - ✅ `"Other"` (本项目, 单值)
  - ✅ `["Schematic", "Project"]` (多值)
  - ❌ `"schematic"` (小写) → 拼写错, 驳回
  - ❌ `"Schematics"` (复数) → 拼写错, 驳回
- **本项目**: `"Other"` (因为是工具型, 不严格归属某一类)
- **踩坑**:
  - 错把 `Other` 写成 `others` / `OtherCategory` → 拼写错
  - 用未支持的值 (如 `AI` / `Tool`) → 拼写错

### `images.logo` — 图标

- **类型**: string (相对路径)
- **必填**: ✅
- **约束**:
  - 比例 **1:1** (正方形)
  - 格式 **PNG 或 JPEG**
  - 推荐 ≥ 500×500
  - **不能用 SDK 默认 logo** (那个蓝白色的小图标)
- **示例**: ✅ `"./images/logo.png"` ✅ `"./images/logo.jpg"`
- **本项目**: `./images/logo.png` (512×512, 9,259 B)
- **踩坑**:
  - 比例不是 1:1 (如 200×100) → 后端拒绝, 报"图片上传异常"
  - 用了 SDK 自带 logo → 驳回"图标必须自定义"

### `entry` — 入口文件

- **类型**: string (相对路径)
- **必填**: ✅
- **约束**:
  - 指向 IIFE 格式的 JS 文件
  - **不建议修改** (SDK 已正确定义)
- **示例**: ✅ `"./dist/index"` (本项目, esbuild 输出 IIFE)
- **本项目**: `./dist/index`
- **踩坑**:
  - 改了 entry 指向 ESM 文件 → 沙箱不支持 ESM, 报"未找到入口"

---

## 强烈建议字段

### `images.banner` — 横幅

- **类型**: string (相对路径)
- **必填**: ⚠️ (强烈建议, 商店页会大幅降级显示)
- **约束**:
  - 比例 **64:27** (= 2.3704:1)
  - 格式 **必须 JPEG**
  - 推荐 1920×810 (整数倍实现, 64×30=1920, 27×30=810)
  - 文件 < 200 KB (建议 quality=85 optimize=True)
- **示例**: ✅ `"./images/banner.jpg"`
- **本项目**: `./images/banner.jpg` (1920×810, 70,911 B, JPEG)
- **踩坑** (这是**最容易踩的字段**, 5 次驳回里 3 次是它):
  1. **PNG 格式** → 必报"图片上传异常"或"未检测到 banner"
  2. **比例不是 64:27** (如 1920×600 是 3.2:1) → 同上
  3. **文件没进 git 树** (working dir 有, 但 git 树没) → CI build 出的 eext 缺文件 → "未检测到 banner"
  4. **比例正确但 file 大小异常** (如 > 5 MB) → 同上

### `repository.type` — 仓库类型

- **类型**: string
- **必填**: ⚠️ (强烈建议填, 否则商店可能视为"无来源代码"打折)
- **约束** (17 个官方值):
  ```
  extension-store, git, mercurial, svn, ftp,
  github, gitlab, gitlab-selfhosted,
  gitee, gitea, bitbucket,
  coding, gnu-savannah, gitbucket, gogs
  ```
- **示例**: ✅ `"github"` (本项目) ✅ `"gitee"` ✅ `"extension-store"`
- **本项目**: `"github"`
- **踩坑**:
  - 拼写错 (如 `git-hub` / `Github` 大小写错) → 驳回
  - 用未支持的值 (如 `bitbucket-selfhosted`) → 驳回
  - 填了 `github` 但 `url` 是空串 → 驳回

### `repository.url` — 仓库 URL

- **类型**: string (URL)
- **必填**: ⚠️ (当 `repository` 存在时必填)
- **约束**: 标准 URL 格式
- **示例**: ✅ `"https://github.com/14790897/local-netlist-analyzer"`
- **本项目**: `https://github.com/14790897/local-netlist-analyzer`
- **踩坑**:
  - 缺协议 (如 `github.com/xxx/yyy`) → 部分后端拒绝
  - 用 git 短 URL (如 `git@github.com:xxx/yyy`) → 商店显示为链接但点击可能错

### `bugs` — 漏洞反馈渠道

- **类型**: string (URL)
- **必填**: ⭕ (但如果填了, **必须是有效 URI**)
- **约束**: 有效 URL
- **示例**: ✅ `"https://github.com/14790897/local-netlist-analyzer/issues"`
- **本项目**: `""` (留空, 商店默认用 issues 页面)
- **踩坑**:
  - 填了但不是有效 URI (如 `mailto:xxx`) → 某些后端拒绝
  - 填了但 `homepage` 也是空 → 商店页会缺链接

---

## 可选字段

### `keywords` — 关键词

- **类型**: string[]
- **必填**: ⭕
- **约束**: 自由, 建议 3-6 个
- **示例**: ✅ `["netlist", "analysis", "ai", "网表"]` (本项目)
- **本项目**: `["netlist", "analysis", "ai", "网表"]`

### `homepage` — 主页

- **类型**: string (URL)
- **必填**: ⭕
- **约束**: URL
- **示例**: ✅ `"https://github.com/14790897/local-netlist-analyzer"`
- **本项目**: `""` (留空, 用 README 顶部的链接)

### `activationEvents` — 激活事件

- **类型**: object
- **必填**: ⭕
- **约束**: V2 时代的字段, V3 通常留 `{}`
- **本项目**: `{}`

### `dependentExtensions` — 依赖扩展

- **类型**: object
- **必填**: ⭕
- **约束**: 依赖其它扩展的 32 位 UUID (自动拉取) 或自定义名称 (手动上传)
- **本项目**: `{}` (无依赖)

---

## headerMenus 子结构

> 扩展初始化时注册的头部菜单。**当前支持按 9 种页面类型分别配置**。

### 9 种页面类型

```json
{
  "headerMenus": {
    "home":      [],  // 首页
    "blank":     [],  // 空白页
    "sch":       [],  // 原理图 (本项目主要用)
    "symbol":    [],  // 符号库
    "pcb":       [],  // PCB 编辑
    "footprint": [],  // 封装库
    "pcbView":   [],  // PCB 预览
    "panel":     [],  // 拼板编辑
    "panelView": []   // 拼板预览
  }
}
```

### 菜单项结构

```json
{
  "headerMenus": {
    "sch": [
      {
        "id": "local-netlist",         // string, 必填, 必须唯一
        "title": "局部网表",            // string, 必填, 显示名
        "menuItems": [                 // object, 可选, 最多嵌套 2 层
          {
            "id": "ai-analyze",
            "title": "AI 分析局部网表",
            "registerFn": "aiAnalyzeSelection"  // string, 指向 export 的方法名
          }
        ]
      }
    ]
  }
}
```

### 关键约束

1. **`id` 必须唯一** (整个 `headerMenus` 树内, 跨页面不能重复)
2. **`menuItems` 与 `registerFn` 冲突** — **同级项内只允许存在其一**
3. **`registerFn` 指向 ES Module export 的方法名** — 代码里 `export function aiAnalyzeSelection() {...}`
4. **最多嵌套 2 层** — 不能 `menuItems.menuItems.menuItems`

### 本项目实例 (v1.5.2)

```json
{
  "headerMenus": {
    "home": [...],  // 6 个菜单项
    "sch":  [...]   // 6 个菜单项 (跟 home 相同)
  }
}
```

6 个菜单项: `AI 分析局部网表` / `分析选中区域网表` / `AI 分析整张原理图` / `分析整张原理图` / `AI 设置` / `AI 对话`

---

## contextMenus 子结构 (实战扩展, 非官方)

> 右键菜单字段, 不在官方 schema 里, 但本项目在实战中发现它能工作。JLCEDA V3 在 sch 页面右键时会调用 `registerFn` 注册的 export 方法。

```json
{
  "contextMenus": {
    "sch": [
      {
        "id": "local-netlist-ctx",
        "title": "局部网表",
        "menuItems": [
          {
            "id": "ctx-ai-analyze",
            "title": "AI 分析选中区域网表",
            "registerFn": "aiAnalyzeSelection"
          }
        ]
      }
    ]
  }
}
```

**踩坑**: 官方文档没写 `contextMenus`, 行为可能因版本而异。本项目 v1.5.2 在 V3.2.148 上工作正常, 但其它 V3 版本不保证。

---

## 完整模板

```json
{
  "name": "your-extension-name",
  "uuid": "32charlowercasestring000000000000",
  "displayName": "你的扩展展示名",
  "description": "简短描述 (96-200 字符, 首句点明核心功能)",
  "version": "1.0.0",
  "publisher": "OSHWHub",
  "engines": {
    "eda": "^3.0.0"
  },
  "license": "Apache-2.0",
  "repository": {
    "type": "github",
    "url": "https://github.com/yourname/your-ext"
  },
  "categories": "Other",
  "keywords": ["tag1", "tag2"],
  "images": {
    "logo": "./images/logo.png",
    "banner": "./images/banner.jpg"
  },
  "homepage": "https://github.com/yourname/your-ext",
  "bugs": "https://github.com/yourname/your-ext/issues",
  "activationEvents": {},
  "entry": "./dist/index",
  "dependentExtensions": {},
  "headerMenus": {
    "sch": [
      {
        "id": "main-menu",
        "title": "主菜单",
        "menuItems": [
          {
            "id": "sub-menu-1",
            "title": "子菜单 1",
            "registerFn": "myExportedFunction"
          }
        ]
      }
    ]
  }
}
```

---

## 参考资料

- [嘉立创 EDA 扩展配置文件规范](https://prodocs.lceda.cn/cn/api/guide/extension-json.html) (官方源)
- [嘉立创 EDA 如何发布](https://prodocs.lceda.cn/cn/api/guide/how-to-publish.html)
- [嘉立创 EDA 扩展广场](https://extensions.oshwhub.com/)
- 本仓库 `docs/PUBLISHING.md` — 完整发布流程 + 驳回码排查表
