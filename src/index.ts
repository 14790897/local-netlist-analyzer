/**
 * DEBUG 版本 — 最简测试
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	// 扩展加载时的钩子
}

export async function analyzeSelection(): Promise<void> {
	// 1. 验证函数被调用
	eda.sys_Dialog.showInformationMessage('扩展已加载！');
	try {
		// 2. 验证是否能获取选中内容
		const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
		if (!primitives?.length) {
			eda.sys_Dialog.showWarningMessage(
				'getAllSelectedPrimitives 返回了空数组。\n请先在原理图中框选一些元件再试。',
			);
			return;
		}

		// 3. 逐项打印选中内容
		const msgs: string[] = [`共 ${primitives.length} 个图元:`];
		for (const p of primitives) {
			const type = p.getState_PrimitiveType();
			const id = p.getState_PrimitiveId();
			msgs.push(`  - ${type} [${id}]`);
		}
		eda.sys_IFrame.showIFrame({
			htmlContent: `<pre style="padding:20px;font:14px monospace;background:#111;color:#0f0">${msgs.join('\n')}</pre>`,
			title: 'DEBUG',
			width: 400,
			height: 300,
		});
	} catch (err: any) {
		eda.sys_Dialog.showWarningMessage(`异常: ${err?.message || String(err)}`);
	}
}
