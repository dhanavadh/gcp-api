<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		if (!password.trim()) {
			error = 'Please enter a password';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch('/api/auth', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ password })
			});

			const result = await response.json();

			if (result.success) {
				// Redirect to home page or requested page
				const redirectTo = $page.url.searchParams.get('redirect') || '/';
				goto(redirectTo);
			} else {
				error = result.message || 'Invalid password';
			}
		} catch (e) {
			error = 'Login failed. Please try again.';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleLogin();
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="max-w-md w-full space-y-8 p-8">
		<div>
			<img class="mx-auto h-12 w-auto" src="./favicon.svg" alt="Logo" />
			<h2 class="mt-6 text-center text-3xl font-semibold text-gray-900">
				ทดสอบระบบ OCR
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				รับโทเคนจากเทรุนะครับ
			</p>
		</div>
		
		<div class="bg-white shadow-md rounded-lg p-6">
			<div class="space-y-4">
				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">
						AccessToken
					</label>
					<input
						id="password"
						bind:value={password}
						onkeydown={handleKeydown}
						type="password"
						autocomplete="current-password"
						required
						class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
						placeholder="Enter password"
					/>
				</div>

				{#if error}
					<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
						{error}
					</div>
				{/if}

				<button
					onclick={handleLogin}
					disabled={loading}
					class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-full text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400"
				>
					{loading ? 'Logging in...' : 'Sign In'}
				</button>
			</div>
		</div>
	</div>
</div>