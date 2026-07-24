# JLCEDA 扩展发布指南

> 本指南基于 [嘉立创 EDA 专业版官方用户指南](https://prodocs.lceda.cn/cn/api/guide/how-to-publish.html) 与 [`extension.json` 字段规范](https://prodocs.lceda.cn/cn/api/guide/extension-json.html),并结合本项目 `local-netlist-analyzer` 在 v1.0 → v1.5.2 期间 5 次驳回的实际踩坑经验汇总而成。
>
> **适用对象**: 任何要发布到 [嘉立创 EDA 扩展广场](https://extensions.oshwhub.com/) 的 `.eext` 扩展开发者。
>
> **最后更新**: 2026-07-24 (v1.5.2 通过经验)

---

## 目录

1. [快速清单 (CHECKLIST)](#1-快速清单-checklist)
2. [官方 8 条上架要求逐项展开](#2-官方-8-条上架要求逐项展开)
3. [extension.json 字段规范速查](#3-extensionjson-字段规范速查)
4. [images 资源规格矩阵](#4-images-资源规格矩阵)
5. [驳回码 → 真因排查表](#5-驳回码--真因排查表)
6. [完整上架流程](#6-完整上架流程)
7. [本项目 v1.5.2 通过案例](#7-本项目-v152-通过案例)
8. [自动化校验](#8-自动化校验)

---

## 1. 快速清单 (CHECKLIST)

> 提交前,先按这 16 项**逐条**打勾。任何一项不通过都会被驳回。

### extension.json (8 项)

- [ ] `name` 是 5-30 字符,**只含** `a-z` / `0-9` / `-`,**不含大写、不含下划线**
- [ ] `uuid` 是**严格 32 字符**的小写字母+数字,**不含横线**
- [ ] `version` 是 `major.minor.patch` 三段式 semver
- [ ] `publisher` **不包含邮箱/电话/真名** (建议用中性名: `OSHWHub`、`EasyEDA`、`Pro-API-Team`)
- [ ] `description` 简明扼要,96-200 字符,**不堆砌 emoji / 不写营销话术**
- [ ] `categories` 是官方 8 个值之一: `Schematic` / `Symbol` / `PCB` / `Footprint` / `Panel` / `Library` / `Project` / `Other`
- [ ] `repository.type` 是官方 17 个值之一 (推荐 `github` / `gitee` / `extension-store`)
- [ ] `entry` 指向**实际存在**的入口文件 (默认 `./dist/index`)

### images/ 资源 (4 项)

- [ ] `images/logo.png` (或 `.jpg`) 存在,**1:1** 比例,推荐 ≥500×500
- [ ] `images/banner.jpg` 存在且**经过 `git add` 进了 git 树** (最常踩的坑!)
- [ ] `images/banner.jpg` 是 **JPEG 格式** (不能是 PNG)
- [ ] `images/banner.jpg` 是 **64:27 比例** (1920×810 是最干净的整数实现)

### 文档 (2 项)

- [ ] `README.md` 包含**功能介绍 + 截图 + 使用方法 + 安装步骤**
- [ ] `CHANGELOG.md` 包含**所有已发布版本**的更新日志

### 隐私 (1 项)

- [ ] 整个 `.eext` **不含任何邮箱/电话/真名/个人地址** (用 `unzip -p xxx.eext` 或 `zipfile.namelist()` 检查)

### Git 验证 (1 项, **最常漏**)

- [ ] 提交后跑 `git ls-tree HEAD images/` 确认 banner/logo/demo 都在 git 树里,不只是 working dir

---

## 2. 官方 8 条上架要求逐项展开

来源: [prodocs.lceda.cn/cn/api/guide/how-to-publish.html](https://prodocs.lceda.cn/cn/api/guide/how-to-publish.html)

### 要求 1: 必须属性项

`extension.json` 必须包含:
- `name` (扩展名)
- `uuid` (唯一标识)
- `displayName` (展示名)
- `description` (描述)
- `version` (版本号)
- `license` (开源协议)

**反面教材**:
```json
{ "name": "MyExt", "uuid": "...", ... }  // ❌ 缺 displayName/description/license
```

### 要求 2: 至少一个 categories

可选值 (8 个): `Schematic` / `Symbol` / `PCB` / `Footprint` / `Panel` / `Library` / `Project` / `Other`

**多分类**: 可以是数组 `["Schematic", "Project"]`,但**每个值必须严格匹配**官方拼写和大小写。

### 要求 3: 自定义图标 (logo)

- 不能用 SDK 默认 logo
- **比例 1:1**
- **格式 PNG 或 JPEG**
- **大小 ≤ 5 MB** (官方原文)
- 推荐 ≥ 500×500

**本项目使用**: `images/logo.png` 512×512, 9,259 B, RGB

### 要求 4: 入口文件存在

默认 `./dist/index`,**不建议修改**。打包脚本会确保 `dist/index.js` 是合法 IIFE。

### 要求 5: name 全局唯一

不同 `uuid` 的扩展**不能有相同的 name**。同 `uuid` 不同版本可同名。

### 要求 6: README.md 详细说明

需要包含:
- 扩展**功能**介绍 (解决什么问题)
- 至少 **1 张演示截图** (我们被驳回的就是这个!)
- **使用方法** (菜单在哪里点、流程是什么)
- **安装步骤** (是否需要配置 API key、是否需要启用"顶部菜单"等)

### 要求 7: CHANGELOG.md 更新日志

每版本一段,推荐格式:
```markdown
# 1.5.2

## 修复
- xxx

## 新增
- xxx
```

### 要求 8: 禁止个人隐私

整个 `.eext` 内**严禁**包含:
- 邮箱地址 (开发者的 `support@xxx.com`)
- 电话号码
- 真名 (尤其是 dev plugin 配置里的)
- 个人住址

**自动检查**:
```bash
# 提取 eext 所有文本,grep 邮箱和电话
unzip -p xxx.eext extension.json package.json src/*.ts | grep -E '@|\d{11}'
```

---

## 3. extension.json 字段规范速查

| 字段 | 类型 | 必填 | 约束 | 示例 | 踩坑 |
|---|---|---|---|---|---|
| `name` | string | ✅ | 5-30 字符, 只含 `a-z0-9-` | `local-netlist-analyzer` | 大写/下划线/中文 → 驳回 |
| `uuid` | string | ✅ | 严格 32 字符, 小写字母+数字 | `7bdb0024e09b43129fe600321240eb6d` | 含横线/大写 → 驳回 |
| `displayName` | string | ✅ | 自由 | `局部网表分析器` | — |
| `description` | string | ✅ | 自由 (建议 96-200 字) | `AI 电路分析 + 局部网表导出...` | 太长/营销话术/纯英文 (中文用户平台) → 低质 |
| `version` | string | ✅ | semver `major.minor.patch` | `1.5.2` | `v1.5.2` / `1.5` → 驳回 |
| `publisher` | string | ✅ | 自由但**不能含 PII** | `OSHWHub` | `liuweiqing <xxx@qq.com>` → 隐私误判 |
| `engines.eda` | string | ✅ | semver range | `^3.0.0` | `^2.0.0` 在 V3 商店可能被拒 |
| `license` | string | ✅ | OSI 标识 | `Apache-2.0` | `MIT` / `GPL-3.0` 都可, `Custom` 慎用 |
| `repository.type` | string | ⚠️ | 17 个值之一 (见下) | `github` | 拼写错 `git-hub` → 驳回 |
| `repository.url` | string | ⚠️ | URL | `https://github.com/xxx/yyy` | 必填时, 不能是空串 |
| `categories` | string\|string[] | ✅ | 8 个值之一 | `["Schematic", "Project"]` | 拼写错 / 自造 → 驳回 |
| `keywords` | string[] | ⭕ | 自由 | `["netlist", "ai"]` | — |
| `images.logo` | string | ✅ | 1:1, PNG/JPEG | `./images/logo.png` | 用了 SDK 默认 logo → 驳回 |
| `images.banner` | string | ⚠️ | **64:27, JPEG** | `./images/banner.jpg` | **PNG / 比例错 / 缺文件 → 驳回** |
| `homepage` | string | ⭕ | URL | `https://github.com/xxx/yyy` | — |
| `bugs` | string | ⭕ | URL | `https://github.com/xxx/yyy/issues` | — |
| `entry` | string | ✅ | 路径 | `./dist/index` | 改了 SDK 没同步 → 入口找不到 |
| `headerMenus` | object | ⭕ | 9 种页面类型 | `{ "sch": [...], "home": [...] }` | 用了未支持的页面 → 菜单不显示 |

### `repository.type` 17 个可选值

```
extension-store, git, mercurial, svn, ftp,
github, gitlab, gitlab-selfhosted,
gitee, gitea, bitbucket,
coding, gnu-savannah, gitbucket, gogs
```

**推荐**: `github` (本项目使用) / `gitee` / `extension-store`

### `headerMenus` 9 种页面类型

```json
{
  "headerMenus": {
    "home":      [],  // 首页
    "blank":     [],  // 空白页
    "sch":       [],  // 原理图 (本项目主要用这个)
    "symbol":    [],  // 符号库
    "pcb":       [],  // PCB 编辑
    "footprint": [],  // 封装库
    "pcbView":   [],  // PCB 预览
    "panel":     [],  // 拼板编辑
    "panelView": []   // 拼板预览
  }
}
```

`menuItems` 与 `registerFn` 冲突,**同级项内只允许存在其一**。

---

## 4. images 资源规格矩阵

| 资源 | 比例 | 格式 | 推荐尺寸 | 大小 | 路径 | 是否必填 |
|---|---|---|---|---|---|---|
| `images.logo` | **1:1** | PNG 或 JPEG | 500×500 起 | ≤ 5 MB | 任意 | ✅ 必填 |
| `images.banner` | **64:27** | **必须 JPEG** | 1920×810 (整数) | ≤ 5 MB | 任意 | ⚠️ 强烈建议 |

### logo 设计要点

- 1:1 比例, RGB 模式
- 内容简单清晰,在 64×64 小图下仍能识别
- 避免渐变 (商店页缩略图压缩后会失真)
- 不要包含文字 (除非是项目缩写, 如 LNA)

### banner 设计要点

- **64:27 比例** = 2.370:1
- 1920×810 是最佳整数实现 (1920 / 64 = 30, 810 / 27 = 30)
- 必须是 **JPEG** (不能 PNG, 后端会尝试 sharp 转码, PNG 失败报 generic 错)
- 横向布局 (2.37 倍宽), 通常是产品名 + 3-4 个核心功能图标 + 底部品牌
- 文件大小建议 < 200 KB, JPEG quality=85 optimize=True 即可

**本项目使用**: `images/banner.jpg` 1920×810, 70,911 B, JPEG quality=85

---

## 5. 驳回码 → 真因排查表

| 驳回信息 | 真正原因 | 排查方法 |
|---|---|---|
| **"图片上传异常,请重试"** | (a) banner 用了 PNG; (b) 比例不是 64:27; (c) 文件不在 git 树 | 用 PIL 检查 format/size; `git ls-tree HEAD images/` |
| **"未检测到 banner 图片"** | `extension.json` 有 `images.banner` 但 `.eext` 里没这个文件 | `unzip -l xxx.eext \| grep banner` |
| **"扩展名格式错误"** | `name` 包含大写字母/下划线/中文 | `grep -E '[A-Z_]\|[\u4e00-\u9fff]' extension.json` |
| **"name 已存在"** | 你的 `uuid` 跟既有扩展不同, 但 `name` 跟别人撞了 | 改 `name` |
| **"扩展中包含个人隐私信息"** | `publisher` 字段含 `<xxx@qq.com>` 或真名 | 改 `publisher` 为中性名 |
| **"图标必须自定义"** | 用了 SDK 自带的 `images/logo.png` (默认的蓝白小图标) | 替换成你自己的 logo |
| **"未找到入口文件"** | `entry` 指向 `./dist/index`, 但 `dist/index.js` 缺失或不是合法 JS | `node -e "require('./build/dist/...eext')"` 解压验证 |
| **"缺少 README/CHANGELOG"** | 整个仓库都没这俩文件 | 写, 至少 1 段说明 |
| **"功能描述不清晰"** | `description` 写得太短/太营销化 | 写清: **做什么 + 用在哪 + 输出什么** |
| **"扩展类型 (categories) 错误"** | 拼写错 (如 `schematic` 应为 `Schematic`) | 严格匹配官方 8 个值 |

**通用排查脚本**:
```bash
unzip -p xxx.eext extension.json | python -m json.tool
unzip -l xxx.eext | grep -E '\.(jpg|png|json|md|js)$'
```

---

## 6. 完整上架流程

```
开发完扩展
  ↓
[1] 本地 build
  npm run build  → build/dist/<name>_v<version>.eext
  ↓
[2] 自动化校验 (推荐, 见第 8 节)
  python scripts/validate-extension.py
  ↓
[3] 解压验证 eext 内容
  unzip -l build/dist/<name>_v<version>.eext
  ↓
[4] 本地浏览器测试 (V3.2 沙箱)
  高级 → 扩展管理器 → 导入 → 选 .eext
  ↓
[5] 准备 git release
  git tag v<version>
  git push origin main v<version>
  CI 自动 build + 测 + 挂 release asset
  ↓
[6] 访问 https://extensions.oshwhub.com/ → 扩展管理 → 扩展上传
  选 <name>_v<version>.eext
  ↓
[7] 命名空间封面 → 版本管理 → 切到"发布"状态
  ↓
[8] 等待审核 (通常 1-3 个工作日)
  ↓
[9] 审核通过 → 命名空间封面上出现"可发布"标记
  ↓
[10] 点"上架至扩展广场" → 公开可见
```

### 首次 vs 后续上传

- **首次上传**: 自动创建**命名空间** (按 `uuid` 唯一标识)
- **后续版本**: 同一 `uuid` 全部归入该命名空间, 不会冲突

### 审核状态

- `审核中`: 等待人工/自动审核
- `已通过`: 可上架
- `未通过`: 看消息通知里的具体原因 (驳回码见上表)

---

## 7. 本项目 v1.5.2 通过案例

### 最终配置

```json
{
  "name": "local-netlist-analyzer",
  "uuid": "7bdb0024e09b43129fe600321240eb6d",
  "displayName": "局部网表分析器",
  "description": "AI 电路分析 + 局部网表导出。框选原理图区域, 导出选中元件关联的网表 (CSV/JSON), 并由 AI 分析电路功能、电源轨、信号路径与潜在风险, 自动识别器件型号与 LCSC 编号。",
  "version": "1.5.2",
  "publisher": "OSHWHub",
  "engines": { "eda": "^3.0.0" },
  "license": "Apache-2.0",
  "repository": {
    "type": "github",
    "url": "https://github.com/14790897/local-netlist-analyzer"
  },
  "categories": "Other",
  "keywords": ["netlist", "analysis", "ai", "网表"],
  "images": {
    "logo": "./images/logo.png",
    "banner": "./images/banner.jpg"
  },
  "entry": "./dist/index"
}
```

### 5 次驳回 → 通过 经验

| 版本 | 驳回信息 | 真正原因 | 修复 |
|---|---|---|---|
| v1.3.x | (没说具体原因) | 缺 README/CHANGELOG | 补文档 |
| v1.4.0 | (无驳回, 直接放 demo 期间没传图) | README 引用了不存在的图 | 加 4 张 demo, 改 `.edaignore` |
| v1.5.0 | "插件被驳回, eext 没有演示图" | `.eext` 缺 README 引用的 4 张 PNG | `images/` 目录带进 eext |
| v1.5.0 | "图片上传异常" | banner 是 PNG, 比例 1920×600 (3.2:1), 违反 spec 64:27 | 转 JPEG 1920×810 |
| v1.5.1 | "未检测到 banner 图片" | `images/banner.jpg` 漏 `git add`, 一直在 working dir untracked | commit 真正 `git add` |

**核心教训**:

1. **本地 build OK ≠ CI build OK** — 一定要 `git add` 新文件, 然后 `git ls-tree HEAD images/` 验证
2. **官方 spec 是法** — 字段约束、比例、格式都按 spec 走, 个人经验/类比不可靠
3. **驳回信息可能错位** — "图片上传异常" 实际是格式/比例问题, 不是上传本身
4. **多语言 README 必同步** — 商店 ext.lceda.cn 默认 zh, 其它语言脱节会拉低评分

---

## 8. 自动化校验

CI 集成 `scripts/validate-extension.py`, 任何 PR 自动跑:

```bash
python scripts/validate-extension.py
```

校验项 (16 条):
- extension.json 字段齐全
- name / uuid / version / publisher / categories 格式正确
- images.logo 存在, 是 PNG 或 JPEG, 1:1 比例
- images.banner 存在, **是 JPEG**, 64:27 比例
- `git ls-tree HEAD images/` 包含 logo + banner (即 git 树状态正确)
- README.md + CHANGELOG.md 存在

返回 0 退出码 = 全过, 1 = 有错 (CI 红灯)。

---

## 参考资料

- [嘉立创 EDA 扩展配置文件规范](https://prodocs.lceda.cn/cn/api/guide/extension-json.html)
- [嘉立创 EDA 如何发布](https://prodocs.lceda.cn/cn/api/guide/how-to-publish.html)
- [嘉立创 EDA 扩展广场](https://extensions.oshwhub.com/)
- [How to Get Started (English)](https://prodocs.lceda.cn/en/api/guide/how-to-start.html)
- [Extension Configuration File (English)](https://prodocs.lceda.cn/en/api/guide/extension-json.html)
- [Extensions Marketplace (English)](https://prodocs.lceda.cn/en/api/guide/extensions-marketplace.html)
