<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	interface ApiResponse {
		message: string;
		timestamp: string;
		error?: string;
		apiConfig: {
			secretKeyLength: number;
			externalUrl: string;
			timeout: number;
		};
		externalData?: any[];
		localData: Array<{
			id: number;
			name: string;
			value: string;
		}>;
	}

	interface ThaiIdCard {
		id_number: string;
		id_number_status: number;
		name_prefix_th: string;
		th_name: string;
		name_prefix_en: string;
		en_name: string;
		address: string;
		birth_date: string;
		birth_date_th: string;
		issue_date: string;
		issue_date_th: string;
		expiry_date: string;
		expiry_date_th: string;
		laser_code: string;
		detection_score: number;
		raw_text: string;
		error_message?: string;
	}

	let apiData: ApiResponse | null = $state(null);
	let thaiIdData: ThaiIdCard | null = $state(null);
	let loading = $state(false);
	let uploadLoading = $state(false);
	let error = $state('');
	let uploadError = $state('');
	let selectedFile: File | null = $state(null);
	let fileInput: HTMLInputElement;

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Redirect to login if not authenticated
	onMount(() => {
		if (!data.isAuthenticated) {
			goto('/login');
		}
	});	

	async function uploadImage() {
		if (!selectedFile) {
			uploadError = 'Please select a file first';
			return;
		}

		uploadLoading = true;
		uploadError = '';
		try {
			const formData = new FormData();
			formData.append('image', selectedFile);

			const response = await fetch('/api/ocr', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
			}

			thaiIdData = await response.json();
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			uploadLoading = false;
		}
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			selectedFile = target.files[0];
			uploadError = '';
		}
	}
	function clearFile() {
		selectedFile = null;
		if (fileInput) {
			fileInput.value = '';
		}
		thaiIdData = null;
		uploadError = '';
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth', { method: 'DELETE' });
			goto('/login');
		} catch (e) {
			console.error('Logout error:', e);
		}
	}
</script>

<div class="max-w-4xl mx-auto p-6">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Thai ID OCR System</h1>
		<button
			onclick={handleLogout}
			class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
		>
			Logout
		</button>
	</div>
	
	<!-- File Upload Section -->
	<div class="bg-white shadow-lg rounded-lg p-6 mb-6">
		<h2 class="text-xl font-semibold mb-4">Image OCR Upload</h2>
		
		<div class="mb-4">
			<label for="imageUpload" class="block text-sm font-medium text-gray-700 mb-2">
				Select an image to extract text:
			</label>
			<input
				bind:this={fileInput}
				id="imageUpload"
				type="file"
				accept="image/*"
				onchange={handleFileSelect}
				class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
			/>
		</div>

		{#if selectedFile}
			<div class="mb-4 p-3 bg-gray-50 rounded">
				<p class="text-sm text-gray-600">
					<strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
				</p>
			</div>
		{/if}

		<div class="flex gap-2">
			<button
				onclick={uploadImage}
				disabled={uploadLoading || !selectedFile}
				class="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
			>
				{uploadLoading ? 'Processing...' : 'Extract Text'}
			</button>
			
			{#if selectedFile}
				<button
					onclick={clearFile}
					class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
				>
					Clear
				</button>
			{/if}
		</div>

		{#if uploadError}
			<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
				<strong>Upload Error:</strong> {uploadError}
			</div>
		{/if}
	</div>	

	<!-- Thai ID Card Results -->
	{#if thaiIdData}
		<div class="bg-white shadow-lg rounded-lg p-6 mb-6">
			<h2 class="text-xl font-semibold mb-4">Thai ID Card Results</h2>
			
			<div class="mb-4 p-3 bg-blue-50 rounded-lg">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-blue-900">Detection Score:</span>
					<span class="text-lg font-bold text-blue-900">{thaiIdData.detection_score}%</span>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
				<!-- Personal Information -->
				<div class="space-y-4">
					<h3 class="text-lg font-medium text-gray-900 border-b pb-2">Personal Information</h3>
					
					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-700">ID Number</label>
							<div class="mt-1 p-2 bg-gray-50 rounded border">
								<div class="flex items-center justify-between">
									<span class="font-mono">{thaiIdData.id_number || 'Not detected'}</span>
									{#if thaiIdData.id_number}
										<span class="text-xs px-2 py-1 rounded {thaiIdData.id_number_status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
											{thaiIdData.id_number_status === 1 ? '✓ Valid' : '✗ Invalid Checksum'}
										</span>
									{/if}
								</div>
							</div>
						</div>
						
						<div>
							<label class="block text-sm font-medium text-gray-700">Thai Name</label>
							<div class="mt-1 p-2 bg-gray-50 rounded border thai-text">
								{#if thaiIdData.name_prefix_th}
									<span class="text-blue-600 font-medium">{thaiIdData.name_prefix_th}</span>
									{thaiIdData.th_name}
								{:else}
									{thaiIdData.th_name || 'Not detected'}
								{/if}
							</div>
						</div>
						
						<div>
							<label class="block text-sm font-medium text-gray-700">English Name</label>
							<div class="mt-1 p-2 bg-gray-50 rounded border">
								{#if thaiIdData.name_prefix_en}
									<span class="text-blue-600 font-medium">{thaiIdData.name_prefix_en}.</span>
									{thaiIdData.en_name}
								{:else}
									{thaiIdData.en_name || 'Not detected'}
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Dates and Address -->
				<div class="space-y-4">
					<h3 class="text-lg font-medium text-gray-900 border-b pb-2">Dates & Address</h3>
					
					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-700">Birth Date</label>
							<div class="mt-1 space-y-1">
								{#if thaiIdData.birth_date_th}
									<div class="p-2 bg-blue-50 rounded border text-sm thai-text">
										<span class="text-xs text-gray-600">Thai:</span> {thaiIdData.birth_date_th}
									</div>
								{/if}
								<div class="p-2 bg-gray-50 rounded border">
									<span class="text-xs text-gray-600">Gregorian:</span> {thaiIdData.birth_date || 'Not detected'}
								</div>
							</div>
						</div>
						
						<div>
							<label class="block text-sm font-medium text-gray-700">Issue Date</label>
							<div class="mt-1 space-y-1">
								{#if thaiIdData.issue_date_th}
									<div class="p-2 bg-blue-50 rounded border text-sm thai-text">
										<span class="text-xs text-gray-600">Thai:</span> {thaiIdData.issue_date_th}
									</div>
								{/if}
								<div class="p-2 bg-gray-50 rounded border">
									<span class="text-xs text-gray-600">Gregorian:</span> {thaiIdData.issue_date || 'Not detected'}
								</div>
							</div>
						</div>
						
						<div>
							<label class="block text-sm font-medium text-gray-700">Expiry Date</label>
							<div class="mt-1 space-y-1">
								{#if thaiIdData.expiry_date_th}
									<div class="p-2 bg-blue-50 rounded border text-sm thai-text">
										<span class="text-xs text-gray-600">Thai:</span> {thaiIdData.expiry_date_th}
									</div>
								{/if}
								<div class="p-2 bg-gray-50 rounded border">
									<span class="text-xs text-gray-600">Gregorian:</span> {thaiIdData.expiry_date || 'Not detected'}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Address -->
			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-700 mb-2">Address</label>
				<div class="p-3 bg-gray-50 rounded border thai-text">
					{thaiIdData.address || 'Not detected'}
				</div>
			</div>

			<!-- Laser Code -->
			{#if thaiIdData.laser_code}
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">Laser Code</label>
					<div class="p-3 bg-gray-50 rounded border font-mono text-sm">
						{thaiIdData.laser_code}
					</div>
				</div>
			{/if}

			<!-- Raw Text (Collapsible) -->
			{#if thaiIdData.raw_text}
				<details class="mb-4">
					<summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
						Show Raw OCR Text
					</summary>
					<div class="mt-3 p-4 bg-gray-50 rounded border">
						<pre class="whitespace-pre-wrap text-sm text-gray-600">{thaiIdData.raw_text}</pre>
					</div>
				</details>
			{/if}
		</div>
	{/if}

	{#if loading || uploadLoading}
		<div class="flex justify-center items-center py-8">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
		</div>
	{/if}
</div>
