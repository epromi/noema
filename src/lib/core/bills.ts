import type { AllProviders } from '$lib/providers/types';
import { getProvider } from '$lib/providers';
import type { BillEntry, BillsData, OpenLoop } from '$lib/types';
import { parseMarkdownTable } from './utils.js';

export async function getBills(providers?: AllProviders): Promise<BillsData> {
	const p = providers ?? getProvider();

	try {
		const tasks = await p.filesystem.readMemory('logistics/tasks.md');
		const bills = parseBills(tasks);
		const openLoops = parseOpenLoops(tasks);

		return {
			bills,
			openLoops,
			updatedAt: Date.now()
		};
	} catch (err) {
		return {
			bills: [],
			openLoops: [],
			updatedAt: Date.now(),
			error: String(err)
		};
	}
}

function parseBills(tasks: string): BillEntry[] {
	const bills: BillEntry[] = [];
	let idx = 0;
	for (const line of tasks.split('\n')) {
		if (line.includes('💰') && (line.includes('Ft') || line.includes('maradék') || line.includes('utal'))) {
			idx++;
			bills.push({
				id: `bill-${idx}`,
				desc: line.replace(/^\s*[-*]\s*\[?\s*[x ]\s*\]?\s*/, '').substring(0, 120),
				status: '💰'
			});
		}
	}
	return bills;
}

function parseOpenLoops(tasks: string): OpenLoop[] {
	const rows = parseMarkdownTable(tasks, 'Open Loops');
	const openLoops: OpenLoop[] = [];

	for (const cells of rows) {
		if (cells.length < 3 || !cells[0]?.match(/^OL-\d+/)) continue;
		const status = cells[4] ?? '';
		if (status.includes('✅') || status.includes('Lezárva')) continue;

		const severity: OpenLoop['severity'] = status.includes('🔴')
			? 'red'
			: status.includes('🚩')
				? 'yellow'
				: 'green';

		openLoops.push({
			id: cells[0],
			desc: (cells[1] ?? '').substring(0, 100),
			age: cells[3] ?? '',
			severity
		});
	}

	return openLoops;
}
