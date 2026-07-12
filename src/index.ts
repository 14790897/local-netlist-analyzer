/**
 * 局部网表分析器 — Local Netlist Analyzer v1.0.2
 *
 * 框选原理图元件 → 自动提取这些元件关联的网络连接 → 生成结构化局部网表
 */

interface NetNode {
	netName: string;
	designator: string;
	pinNumber: string;
	pinName: string;
}

interface GroupedNet {
	netName: string;
	nodes: NetNode[];
}

export async function analyzeSelection(): Promise<void> {
	try {
		eda.sys_ToastMessage.showToastMessage('正在分析选中元件...');

		// Step 1: 获取选中图元 (BETA API)
		const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
		if (!primitives?.length) {
			eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件');
			return;
		}

		// Step 2: 筛选器件 — 用 ISCH_Primitive.getState_PrimitiveType() === "Component"
		const selectedDesignators = new Set<string>();
		const componentInfo: Map<string, {
			name: string;
			manufacturer: string;
			manufacturerId: string;
			pins: Map<string, string>; // pinNumber -> pinName
		}> = new Map();

		for (const p of primitives) {
			try {
				if (p.getState_PrimitiveType() !== 'Component') continue;
				// 类型收窄为 ISCH_PrimitiveComponent
				const comp = p as any;

				const designator = comp.getState_Designator();
				if (!designator) continue;

				selectedDesignators.add(designator);

				const pinMap = new Map<string, string>();
				try {
					const pins = await comp.getAllPins();
					if (Array.isArray(pins)) {
						for (const pin of pins) {
							if (pin.pinNumber) {
								pinMap.set(pin.pinNumber, pin.pinName || '');
							}
						}
					}
				} catch {
					// pins not available for this component
				}

				componentInfo.set(designator, {
					name: comp.getState_Name?.() || comp.name || '',
					manufacturer: comp.getState_Manufacturer?.() || '',
					manufacturerId: comp.getState_ManufacturerId?.() || '',
					pins: pinMap,
				});
			} catch {
				continue;
			}
		}

		if (componentInfo.size === 0) {
			eda.sys_Dialog.showWarningMessage(
				`选中了 ${primitives.length} 个图元，但其中没有可识别的器件。\n请在原理图中框选包含器件（如电阻、芯片）的区域`,
			);
			return;
		}

		// Step 3: 获取网表
		let netlistText = '';
		try {
			// 首选 getNetlist（deprecated 但仍可用）
			netlistText = await eda.sch_Netlist.getNetlist('JLCEDA' as any);
		} catch {
			// fallback
		}

		if (!netlistText) {
			try {
				netlistText = await eda.sch_Netlist.getNetlist('EasyEDA' as any);
			} catch {
				// fallback
			}
		}

		// 如果上面都失败，尝试新的 API
		if (!netlistText) {
			try {
				const file = await (eda as any).sch_ManufactureData.getNetlistFile(
					undefined,
					'JLCEDA' as any,
				);
				if (file) {
					netlistText = await (file as any).text?.() || '';
				}
			} catch {
				// fallback
			}
		}

		if (!netlistText || netlistText.length < 10) {
			// 即使没有网表，也显示元件列表
			const nets: GroupedNet[] = [];
			showPanel(nets, componentInfo.size, componentInfo);
			return;
		}

		// Step 4: 解析网表
		const lines = netlistText.split('\n');
		const netNodesMap = new Map<string, NetNode[]>();

		for (const line of lines) {
			const t = line.trim();
			if (!t || t === '(' || t === ')') continue;

			const match = t.match(/\(\s*(\S+)\s+(\S+)/);
			if (!match) continue;

			const netName = match[1];
			const nodeRef = match[2];

			// 匹配选中元件
			let found: string | undefined;
			for (const d of selectedDesignators) {
				if (nodeRef.startsWith(d + '-') || nodeRef === d) {
					found = d;
					break;
				}
			}
			if (!found) continue;

			const dash = nodeRef.indexOf('-');
			const ref = dash > 0 ? nodeRef.substring(0, dash) : nodeRef;
			const pin = dash > 0 ? nodeRef.substring(dash + 1) : '?';
			const info = componentInfo.get(ref);

			if (!netNodesMap.has(netName)) {
				netNodesMap.set(netName, []);
			}
			netNodesMap.get(netName)!.push({
				netName,
				designator: ref,
				pinNumber: pin,
				pinName: info?.pins.get(pin) || '',
			});
		}

		const nets: GroupedNet[] = [];
		for (const [name, nodes] of netNodesMap) {
			nets.push({ netName: name, nodes });
		}

		showPanel(nets, componentInfo.size, componentInfo);

	} catch (err: any) {
		eda.sys_Dialog.showWarningMessage(`分析出错: ${err?.message || String(err)}`);
	}
}

function showPanel(
	nets: GroupedNet[],
	count: number,
	info: Map<string, { name: string; manufacturer: string; manufacturerId: string }>,
): void {
	let text = '# 局部网表分析\n';
	text += `> ${count} 个元件, ${nets.length} 个网络\n\n`;

	text += '## 元件列表\n';
	for (const [d, v] of info) {
		let s = `${d}: ${v.name || '-'}`;
		if (v.manufacturer) s += ` (${v.manufacturer} ${v.manufacturerId || ''})`;
		text += `- ${s}\n`;
	}

	if (nets.length) {
		text += '\n## 网络连接\n';
		for (const n of nets) {
			text += `\n### ${n.netName}\n`;
			for (const node of n.nodes) {
				let pin = `${node.designator}-${node.pinNumber}`;
				if (node.pinName) pin += ` (${node.pinName})`;
				text += `- ${pin}\n`;
			}
		}
	}

	const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const jsText = JSON.stringify(text);

	eda.sys_IFrame.showIFrame({
		htmlContent: /* html */`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#1e1e1e;color:#d4d4d4;padding:16px;font-size:13px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #333}
.top h2{font-size:16px;color:#e0e0e0}
pre{background:#252526;border:1px solid #333;border-radius:6px;padding:12px;overflow:auto;max-height:360px;font:12px/1.5 Consolas,monospace;white-space:pre-wrap}
.btn{padding:6px 14px;border:1px solid #555;background:#333;color:#ccc;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:12px}
.btn:hover{background:#444}
</style></head><body>
<div class="top"><h2>局部网表分析</h2></div>
<button class="btn" onclick="navigator.clipboard.writeText(t)">复制网表文本</button>
<pre>${esc}</pre>
<script>var t=${jsText}</script>
</body></html>`,
		title: '局部网表分析',
		closeOnClickOutside: false,
		topInPx: 60,
		leftInPx: 100,
		width: 550,
		height: 500,
	});
}
