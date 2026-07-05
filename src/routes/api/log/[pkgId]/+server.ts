import { json } from '@sveltejs/kit';
import { getDevLoopLog } from '$lib/core/dev-loop-log';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const pkgId = params.pkgId ?? '';
	const data = await getDevLoopLog(pkgId);
	return json(data, {
		headers: { 'Cache-Control': 'no-cache' }
	});
};
