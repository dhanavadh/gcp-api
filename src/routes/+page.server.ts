import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const isAuthenticated = cookies.get('auth_session') === 'authenticated';
	
	if (!isAuthenticated) {
		throw redirect(302, '/login');
	}
	
	return {
		isAuthenticated: true
	};
};