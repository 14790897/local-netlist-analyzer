# Extension Dev MCP Tools — CI 集成方案

## 工作原理

```
GitHub Actions → Playwright → Chrome 打开 EDA 调试模式 → 自动导入 .eext → 抓取 Console 日志
```

## 局限

- 需要真实的 Chrome 浏览器
- 需要 EDA 登录态（扫码）
- 纯 headless CI 无法自动登录

## 方案

保留当前的 mock 测试（`test/mock-test.js`）作为 CI 主流程，额外提供 Playwright 测试脚本供手动触发。

### 安装

```bash
cd extension-dev-mcp-tools
npm install && npm run build
npx playwright install chromium
```

### 手动测试命令

```bash
# 1. 启动浏览器、登录 EDA
node test/e2e-test.js --login

# 2. 构建并测试
npm run build
node test/e2e-test.js --test ./build/dist/*.eext
```

## CI 配置

`.github/workflows/ci.yml` 已包含:
- ✅ `npm run build` — 编译
- ✅ `node test/mock-test.js` — 单元测试（Mock EDA API）
- 🚧 Playwright E2E — 需手动触发（`workflow_dispatch`），因为需要浏览器和登录态
