/**
 * MINIMAL 测试 — 验证扩展加载和菜单注册
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	console.log('[LOCAL-NETLIST] activate called, status:', status);
}

export function about(): void {
	console.log('[LOCAL-NETLIST] about called');
	eda.sys_Dialog.showInformationMessage('局部网表分析器 v1.0.4 已加载!');
}
