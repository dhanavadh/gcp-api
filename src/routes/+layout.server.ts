import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const isAuthenticated = cookies.get('auth_session') === 'authenticated';
	
	return {
		isAuthenticated
	};
};