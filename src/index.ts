/**
 * 局部网表分析器 — Local Netlist Analyzer
 * 框选原理图元件 → 提取关联网络 → 结构化网表输出
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

// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {}

export async function analyzeSelection(): Promise<void> {
	try {
		// Step 1: 获取选中图元 (BETA API, 返回 ISCH_Primitive[])
		const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
		if (!primitives?.length) {
			eda.sys_Dialog.showWarningMessage('请先在原理图中框选需要分析的元件');
			return;
		}

		// Step 2: 筛选器件 + 收集信息
		const selectedDesignators = new Set<string>();
		const componentInfo = new Map<string, {
			name: string;
			manufacturer: string;
			manufacturerId: string;
			pins: Map<string, string>;
		}>();

		for (const p of primitives) {
			try {
				if (p.getState_PrimitiveType() !== 'Component') continue;
				// ISCH_PrimitiveComponent 才有以下方法, cast 为 any
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
				} catch { /* pins unavailable */ }

				componentInfo.set(designator, {
					name: comp.getState_Name?.() || comp.name || '',
					manufacturer: comp.getState_Manufacturer?.() || '',
					manufacturerId: comp.getState_ManufacturerId?.() || '',
					pins: pinMap,
				});
			} catch { continue; }
		}

		if (componentInfo.size === 0) {
			eda.sys_Dialog.showWarningMessage(
				`选中了 ${primitives.length} 个图元，但没有可识别的器件。\n请在原理图中框选包含器件的区域`,
			);
			return;
		}

		// Step 3: 获取网表 (deprecated 但直接返回文本)
		let netlistText = '';
		try {
			netlistText = await eda.sch_Netlist.getNetlist('JLCEDA' as any);
		} catch {
			try { netlistText = await eda.sch_Netlist.getNetlist('EasyEDA' as any); } catch { /* */ }
		}
		// fallback: 新 API 返回 File 对象
		if (!netlistText) {
			try {
				const file = await (eda as any).sch_ManufactureData?.getNetlistFile?.(undefined, 'JLCEDA' as any);
				if (file) netlistText = await (file as any).text?.() || '';
			} catch { /* */ }
		}

		// Step 4: 解析网表
		// JLCEDA 格式: (NetName Designator1-Pin1 Designator2-Pin2 ...)
		// 示例: (VCC U1-3)
		//       (GND R1-1 R2-1)
		//       (NET1 U1-1 R1-2 C3-1)
		const netNodesMap = new Map<string, NetNode[]>();
		if (netlistText) {
			for (const line of netlistText.split('\n')) {
				const t = line.trim();
				if (!t.startsWith('(') || !t.endsWith(')')) continue;

				// 去掉首尾括号，按空白分割
				const parts = t.slice(1, -1).split(/\s+/).filter(Boolean);
				if (parts.length < 2) continue;

				const netName = parts[0];
				const nodeRefs = parts.slice(1);

				for (const nodeRef of nodeRefs) {
					// 匹配 Designator-PinNumber 格式
					const dash = nodeRef.indexOf('-');
					const ref = dash > 0 ? nodeRef.substring(0, dash) : nodeRef;
					const pin = dash > 0 ? nodeRef.substring(dash + 1) : '?';

					if (!selectedDesignators.has(ref)) continue;

					const info = componentInfo.get(ref);
					if (!netNodesMap.has(netName)) netNodesMap.set(netName, []);
					netNodesMap.get(netName)!.push({
						netName, designator: ref, pinNumber: pin,
						pinName: info?.pins.get(pin) || '',
					});
				}
			}
		}

		const nets: GroupedNet[] = [];
		for (const [name, nodes] of netNodesMap) nets.push({ netName: name, nodes });

		// Step 5: 生成 HTML 展示
		let text = '# 局部网表分析\n';
		text += `> ${componentInfo.size} 个元件, ${nets.length} 个网络\n\n`;
		text += '## 元件列表\n';
		for (const [d, v] of componentInfo) {
			let s = `${d}: ${v.name || '-'}`;
			if (v.manufacturer) s += ` (${v.manufacturer} ${v.manufacturerId})`;
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
		const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
		const jsText = JSON.stringify(text);

		eda.sys_IFrame.showIFrame({
			htmlContent: '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
				+ '*{margin:0;padding:0;box-sizing:border-box}'
				+ 'body{font:13px system-ui,-apple-system,sans-serif;background:#1e1e1e;color:#d4d4d4;padding:16px}'
				+ '.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #333}'
				+ '.top h2{font-size:16px;color:#e0e0e0}'
				+ 'pre{background:#252526;border:1px solid #333;border-radius:6px;padding:12px;overflow:auto;max-height:360px;font:12px/1.5 Consolas,monospace;white-space:pre-wrap}'
				+ '.btn{padding:6px 14px;border:1px solid #555;background:#0e639c;border-color:#1177bb;color:#fff;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:12px}'
				+ '.btn:hover{background:#1177bb}'
				+ '</style></head><body><div class="top"><h2>局部网表分析</h2></div>'
				+ '<button class="btn" onclick="navigator.clipboard.writeText(t)">复制网表文本</button>'
				+ `<pre>${esc}</pre>`
				+ `<script>var t=${jsText}</script>`
				+ '</body></html>',
			title: '局部网表分析',
			closeOnClickOutside: false,
			topInPx: 60,
			leftInPx: 100,
			width: 550,
			height: 500,
		});
	} catch (err: any) {
		eda.sys_Dialog.showWarningMessage(`分析出错: ${err?.message || String(err)}`);
	}
}
