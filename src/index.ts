/**
 * 局部网表分析器 — Local Netlist Analyzer
 */

interface NetNode {
	netName: string;
	designator: string;
	pinNumber: string;
	pinName: string;
	componentName: string;
}

interface GroupedNet {
	netName: string;
	nodes: NetNode[];
}

export async function analyzeSelection(): Promise<void> {
	try {
		// Step 0: 确认函数被调用
		eda.sys_ToastMessage.showToastMessage('正在分析选中元件...');

		// Step 1: 获取选中的图元 ID
		const primitiveIds = eda.sch_SelectControl.getSelectedPrimitives_PrimitiveId();
		eda.sys_Log.log(`选中图元 ID 数量: ${primitiveIds?.length || 0}`);

		if (!primitiveIds || primitiveIds.length === 0) {
			eda.sys_Dialog.showWarningMessage(
				'请先在原理图中框选需要分析的元件',
			);
			return;
		}

		// Step 2: 通过 ID 获取完整图元对象
		const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
		eda.sys_Log.log(`获取到图元数量: ${primitives?.length || 0}`);

		if (!primitives || primitives.length === 0) {
			eda.sys_Dialog.showWarningMessage(
				'无法获取选中图元信息，请重试',
			);
			return;
		}

		// Step 3: 筛选器件 —— 检查是否有 getState_Designator 方法
		const components: any[] = [];
		for (const p of primitives) {
			try {
				const d = p.getState_Designator?.();
				if (d) {
					components.push(p);
				}
			} catch {
				// 不是器件，跳过
			}
		}
		eda.sys_Log.log(`器件数量: ${components.length}`);

		if (components.length === 0) {
			eda.sys_Dialog.showWarningMessage(
				`选中了 ${primitives.length} 个图元，但其中没有器件。请在原理图中框选包含器件的区域`,
			);
			return;
		}

		// Step 4: 收集器件信息
		const selectedDesignators = new Set<string>();
		const componentInfo: Map<string, {
			designator: string;
			name: string;
			manufacturer: string;
			manufacturerId: string;
			pinMap: Map<string, string>;
		}> = new Map();

		for (const comp of components) {
			try {
				const designator = comp.getState_Designator();
				if (!designator) continue;

				selectedDesignators.add(designator);

				const pinMap = new Map<string, string>();
				try {
					const pins = await comp.getAllPins?.();
					if (pins) {
						for (const pin of pins) {
							if (pin.pinNumber) {
								pinMap.set(pin.pinNumber, pin.pinName || '');
							}
						}
					}
				} catch {
					// pins not available
				}

				componentInfo.set(designator, {
					designator,
					name: comp.getState_Name?.() || comp.name || '',
					manufacturer: comp.getState_Manufacturer?.() || '',
					manufacturerId: comp.getState_ManufacturerId?.() || '',
					pinMap,
				});
			} catch {
				continue;
			}
		}

		eda.sys_Log.log(`有效器件: ${componentInfo.size}`);

		if (componentInfo.size === 0) {
			eda.sys_Dialog.showWarningMessage('无法读取器件位号信息');
			return;
		}

		// Step 5: 获取网表 —— 尝试多种格式
		let netlistText = '';
		const formats = ['JLCEDA', 'EasyEDA'];

		for (const fmt of formats) {
			try {
				netlistText = await eda.sch_Netlist.getNetlist(fmt as any);
				if (netlistText && netlistText.length > 50) {
					eda.sys_Log.log(`网表格式 ${fmt} 获取成功, 长度: ${netlistText.length}`);
					break;
				}
			} catch {
				eda.sys_Log.log(`网表格式 ${fmt} 获取失败，尝试下一个`);
			}
		}

		if (!netlistText || netlistText.length < 10) {
			eda.sys_Dialog.showWarningMessage(
				'获取网表失败。请确保:\n1. 原理图已保存\n2. 画布上有网络连接（导线）\n3. 关闭后重试',
			);
			return;
		}

		// Step 6: 解析网表
		const lines = netlistText.split('\n');
		const netNodesMap = new Map<string, NetNode[]>();

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed === '(' || trimmed === ')') continue;

			const match = trimmed.match(/\(\s*(\S+)\s+(\S+)/);
			if (!match) continue;

			const netName = match[1];
			const nodeRef = match[2];

			// 匹配选中元件
			let foundDesignator = '';
			for (const designator of selectedDesignators) {
				if (nodeRef.startsWith(designator + '-') || nodeRef === designator) {
					foundDesignator = designator;
					break;
				}
			}
			if (!foundDesignator) continue;

			const parts = nodeRef.split('-');
			const refDesignator = parts[0];
			const pinNumber = parts.slice(1).join('-') || '?';
			const info = componentInfo.get(refDesignator);

			const node: NetNode = {
				netName,
				designator: refDesignator,
				pinNumber,
				pinName: info?.pinMap.get(pinNumber) || '',
				componentName: info?.name || '',
			};

			if (!netNodesMap.has(netName)) {
				netNodesMap.set(netName, []);
			}
			netNodesMap.get(netName)!.push(node);
		}

		const partialNets: GroupedNet[] = [];
		for (const [netName, nodes] of netNodesMap) {
			partialNets.push({ netName, nodes });
		}

		// Step 7: 显示结果
		if (partialNets.length === 0 && componentInfo.size > 0) {
			// 没有找到网络连接，但显示了元件列表
			showResultPanel([], componentInfo.size, 0, componentInfo);
		} else {
			showResultPanel(partialNets, components.length, netNodesMap.size, componentInfo);
		}
	} catch (err: any) {
		eda.sys_Log.log(`分析异常: ${err?.message || err}`);
		eda.sys_Dialog.showWarningMessage(
			`分析出错: ${err?.message || err}\n请检查控制台日志`,
		);
	}
}

function showResultPanel(
	nets: GroupedNet[],
	componentCount: number,
	netCount: number,
	componentInfo: Map<string, any>,
): void {
	let netlistText = '# 局部网表分析\n';
	netlistText += `> 选中 ${componentCount} 个元件, 涉及 ${netCount} 个网络\n\n`;

	netlistText += '## 元件列表\n';
	for (const [designator, info] of componentInfo) {
		let desc = `${designator}: ${info.name || '-'}`;
		if (info.manufacturer) desc += ` (${info.manufacturer})`;
		if (info.manufacturerId) desc += ` [${info.manufacturerId}]`;
		netlistText += `- ${desc}\n`;
	}

	if (nets.length === 0) {
		netlistText += '\n> 选中元件之间没有直接网络连接，或已通过端口/跨页连接\n';
	} else {
		netlistText += '\n## 网络连接\n';
		for (const net of nets) {
			netlistText += `\n### ${net.netName}\n`;
			for (const node of net.nodes) {
				let pinInfo = `${node.designator}-${node.pinNumber}`;
				if (node.pinName) pinInfo += ` (${node.pinName})`;
				netlistText += `- ${pinInfo}\n`;
			}
		}
	}

	const html = buildHtml(netlistText, componentCount, netCount);
	eda.sys_IFrame.showIFrame({
		htmlContent: html,
		title: '局部网表分析',
		closeOnClickOutside: false,
		topInPx: 60,
		leftInPx: 100,
		width: 550,
		height: 500,
	});
}

function buildHtml(
	netlistText: string,
	componentCount: number,
	netCount: number,
): string {
	const escaped = netlistText
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

	return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Segoe UI,-apple-system,sans-serif;background:#1e1e1e;color:#d4d4d4;padding:16px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #333}
.header h2{font-size:16px;color:#e0e0e0}
.stats{color:#888;font-size:12px}
.actions{display:flex;gap:8px;margin-bottom:12px}
.btn{padding:6px 14px;border:1px solid #555;background:#333;color:#ccc;border-radius:4px;cursor:pointer;font-size:12px}
.btn:hover{background:#444}
.btn.copy{background:#0e639c;border-color:#1177bb;color:#fff}
.btn.copy:hover{background:#1177bb}
pre{background:#252526;border:1px solid #333;border-radius:6px;padding:12px;overflow:auto;max-height:360px;font-family:Cascadia Code,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap}
.toast{position:fixed;top:10px;right:10px;padding:8px 16px;background:#4caf50;color:#fff;border-radius:4px;font-size:12px;opacity:0;transition:opacity .3s;pointer-events:none}
.toast.show{opacity:1}
</style></head><body>
<div class="header"><h2>局部网表分析</h2><span class="stats">${componentCount} 元件 / ${netCount} 网络</span></div>
<div class="actions"><button class="btn copy" onclick="copyNetlist()">复制网表文本</button></div>
<pre>${escaped}</pre>
<div class="toast" id="toast">已复制!</div>
<script>
var t=${JSON.stringify(netlistText)};
function copyNetlist(){navigator.clipboard.writeText(t).then(function(){var e=document.getElementById("toast");e.classList.add("show");setTimeout(function(){e.classList.remove("show")},1500)})}
</script></body></html>`;
}
