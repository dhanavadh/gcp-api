import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WEBSITE_PASSWORD } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { password } = await request.json();

		if (password === WEBSITE_PASSWORD) {
			// Set session cookie that expires in 24 hours
			cookies.set('auth_session', 'authenticated', {
				path: '/',
				httpOnly: true,
				secure: false, // Set to true in production with HTTPS
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 // 24 hours
			});

			return json({ success: true, message: 'Authentication successful' });
		} else {
			return json({ success: false, message: 'Invalid password' }, { status: 401 });
		}
	} catch (error) {
		return json({ success: false, message: 'Authentication failed' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('auth_session', { path: '/' });
	return json({ success: true, message: 'Logged out successfully' });
};