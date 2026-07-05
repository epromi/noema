import { describe, it, expect } from 'vitest';
import { getCalendar } from '$lib/core/calendar';
import { createMockProviders } from './mock-providers';

describe('calendar', () => {
	it('getCalendar parses gog events via tool provider', async () => {
		const data = await getCalendar(createMockProviders());
		expect(data.events.length).toBe(1);
		expect(data.events[0]?.title).toBe('Meeting');
		expect(data.updatedAt).toBeGreaterThan(0);
	});

	it('getCalendar handles provider errors', async () => {
		const mock = createMockProviders({
			tool: {
				h1Command: async () => '',
				gogCommand: async () => {
					throw new Error('gog unavailable');
				},
				execCommand: async () => ''
			}
		});
		const data = await getCalendar(mock);
		expect(data.error).toContain('gog unavailable');
		expect(data.events).toEqual([]);
	});
});
