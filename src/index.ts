/**
 * 局部网表分析器 — Local Netlist Analyzer
 *
 * 框选原理图元件 → 自动提取这些元件关联的网络连接 → 生成结构化局部网表
 * 用于 AI 分析局部电路，解决现有插件无法导出局部网表的痛点。
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
		// Step 1: 获取选中的元件
		const primitives = await eda.sch_SelectControl.getSelectedPrimitives();
		if (!primitives || primitives.length === 0) {
			eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件');
			return;
		}

		// 筛选出器件类型的图元
		const components = primitives.filter(
			p => p.primitiveType === eda.ESCH_PrimitiveType.COMPONENT,
		);

		if (components.length === 0) {
			eda.sys_Dialog.showWarningMessage('选中的图元中没有器件，请框选包含器件的区域');
			return;
		}

		// Step 2: 收集所有选中元件的信息：{ designator -> { name, pins } }
		const selectedDesignators = new Set<string>();
		const componentInfo: Map<string, {
			designator: string;
			name: string;
			manufacturer?: string;
			manufacturerId?: string;
			pinNumbers: Set<string>;
			pinMap: Map<string, string>; // pinNumber -> pinName
		}> = new Map();

		for (const comp of components) {
			const designator = comp.getState_Designator();
			if (!designator)
				continue;

			selectedDesignators.add(designator);

			// 获取引脚
			const pinMap = new Map<string, string>();
			const pinNumbers = new Set<string>();
			try {
				const pins = await comp.getAllPins();
				if (pins) {
					for (const pin of pins) {
						const pinNum = pin.pinNumber;
						const pinName = pin.pinName;
						if (pinNum) {
							pinNumbers.add(pinNum);
							pinMap.set(pinNum, pinName || '');
						}
					}
				}
			}
			catch {
				// 某些元件可能无法获取引脚，忽略
			}

			componentInfo.set(designator, {
				designator,
				name: comp.getState_Name() || comp.name || '',
				manufacturer: comp.getState_Manufacturer?.(),
				manufacturerId: comp.getState_ManufacturerId?.(),
				pinNumbers,
				pinMap,
			});
		}

		// Step 3: 获取全量网表
		let netlistText: string;
		try {
			netlistText = await eda.sch_Netlist.getNetlist(eda.ESYS_NetlistType.JLCEDA_PRO);
		}
		catch {
			eda.sys_Dialog.showWarningMessage('获取网表失败，请确保原理图已保存且有网络连接');
			return;
		}

		if (!netlistText) {
			eda.sys_Dialog.showWarningMessage('网表为空，原理图中可能没有网络连接');
			return;
		}

		// Step 4: 解析网表，只保留选中元件涉及的网
		// JLCEDA 网表格式: 每行由括号包裹，包含 Designator-PinNumber = NetName
		const lines = netlistText.split('\n');
		const partialNets: GroupedNet[] = [];
		const netSet = new Set<string>();
		const netNodesMap = new Map<string, NetNode[]>();

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed === '(' || trimmed === ')')
				continue;

			// 尝试匹配格式: ( NetName Designator-PinNumber )
			const match = trimmed.match(/\(\s*(\S+)\s+(\S+)/);
			if (!match)
				continue;

			const netName = match[1];
			const nodeRef = match[2];

			// 检查是否是选中元件
			// nodeRef 格式: 可能是 "R1-1" 或更复杂的格式
			let found = false;
			for (const designator of selectedDesignators) {
				if (nodeRef.startsWith(`${designator}-`) || nodeRef === designator) {
					found = true;
					break;
				}
			}
			if (!found)
				continue;

			// 解析节点信息
			const parts = nodeRef.split('-');
			const refDesignator = parts[0];
			const pinNumber = parts.slice(1).join('-') || '?';

			const info = componentInfo.get(refDesignator);
			const pinName = info?.pinMap.get(pinNumber) || '';

			const node: NetNode = {
				netName,
				designator: refDesignator,
				pinNumber,
				pinName,
				componentName: info?.name || '',
			};

			if (!netNodesMap.has(netName)) {
				netNodesMap.set(netName, []);
				netSet.add(netName);
			}
			netNodesMap.get(netName)!.push(node);
		}

		// Step 5: 补全每个网络中未选中但属于选中元件其他引脚的信息
		// （通过遍历网络，检查同一个网络是否有选中元件的其他引脚）
		// 对已匹配的网络，发现被选中元件关联的所有引脚

		// 整理输出
		for (const [netName, nodes] of netNodesMap) {
			partialNets.push({
				netName,
				nodes,
			});
		}

		// Step 6: 生成展示内容
		const html = generateHtml(partialNets, components.length, netSet.size, componentInfo);

		// Step 7: 使用 IFrame 展示
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
	catch (err: any) {
		eda.sys_Dialog.showWarningMessage(`分析出错: ${err?.message || err}`);
	}
}

function generateHtml(
	nets: GroupedNet[],
	componentCount: number,
	netCount: number,
	componentInfo: Map<string, any>,
): string {
	// 生成结构化的文本输出
	let netlistText = '';
	netlistText += `# 局部网表分析\n`;
	netlistText += `> 选中 ${componentCount} 个元件, 涉及 ${netCount} 个网络\n\n`;

	if (nets.length === 0) {
		netlistText += '⚠️ 选中的元件之间没有直接网络连接，或网表格式未能成功解析。\n';
	}

	// 元件列表
	netlistText += `## 元件列表\n`;
	for (const [designator, info] of componentInfo) {
		const name = info.name || '-';
		const mfr = info.manufacturer || '';
		const mfrId = info.manufacturerId || '';
		let desc = `${designator}: ${name}`;
		if (mfr)
			desc += ` (${mfr})`;
		if (mfrId)
			desc += ` [${mfrId}]`;
		netlistText += `- ${desc}\n`;
	}

	// 网络连接
	netlistText += `\n## 网络连接\n`;
	for (const net of nets) {
		netlistText += `\n### ${net.netName}\n`;
		for (const node of net.nodes) {
			let pinInfo = `${node.designator}-${node.pinNumber}`;
			if (node.pinName)
				pinInfo += ` (${node.pinName})`;
			if (node.componentName)
				pinInfo += ` [${node.componentName}]`;
			netlistText += `- ${pinInfo}\n`;
		}
	}

	// 复制按钮的 JavaScript
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Segoe UI', -apple-system, sans-serif;
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    font-size: 13px;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #333;
}
.header h2 { font-size: 16px; color: #e0e0e0; }
.stats {
    color: #888;
    font-size: 12px;
}
.actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}
.btn {
    padding: 6px 14px;
    border: 1px solid #555;
    background: #333;
    color: #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}
.btn:hover { background: #444; border-color: #777; }
.btn.copy {
    background: #0e639c;
    border-color: #1177bb;
    color: #fff;
}
.btn.copy:hover { background: #1177bb; }
pre {
    background: #252526;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 12px;
    overflow: auto;
    max-height: 360px;
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
}
.toast {
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    background: #4caf50;
    color: #fff;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
}
.toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="header">
    <h2>局部网表分析</h2>
    <span class="stats">${componentCount} 元件 / ${netCount} 网络</span>
</div>
<div class="actions">
    <button class="btn copy" onclick="copyNetlist()">复制网表文本</button>
</div>
<pre id="netlist">${escapeHtml(netlistText)}</pre>
<div class="toast" id="toast">已复制到剪贴板</div>

<script>
const netlistText = ${JSON.stringify(netlistText)};
function copyNetlist() {
    navigator.clipboard.writeText(netlistText).then(() => {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1500);
    });
}
</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
