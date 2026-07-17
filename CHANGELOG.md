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
