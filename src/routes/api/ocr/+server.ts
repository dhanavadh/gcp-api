import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	GOOGLE_VISION_API_KEY,
	API_TIMEOUT 
} from '$env/static/private';

interface ThaiIdCard {
	id_number: string;
	id_number_status: number; // 1 if checksum valid, 0 if invalid
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
	religion: string;
	laser_code: string; // Code below the photo
	detection_score: number;
	raw_text: string;
	error_message?: string;
}

// Thai ID checksum validation
function validateThaiId(id: string): boolean {
	const digits = id.replace(/\D/g, ''); // Keep digits only
	if (digits.length !== 13) return false;
	
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		sum += parseInt(digits[i]) * (13 - i);
	}
	const check = (11 - (sum % 11)) % 10;
	return check === parseInt(digits[12]);
}

// Thai digit normalization
function normalizeThaiDigits(text: string): string {
	const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
	const arabicDigits = '0123456789';
	let result = text;
	for (let i = 0; i < thaiDigits.length; i++) {
		result = result.replace(new RegExp(thaiDigits[i], 'g'), arabicDigits[i]);
	}
	return result;
}

// Thai month mapping
const thaiMonths: { [key: string]: string } = {
	'ม.ค.': 'Jan', 'มกราคม': 'Jan', 'มค': 'Jan',
	'ก.พ.': 'Feb', 'กุมภาพันธ์': 'Feb', 'กพ': 'Feb',
	'มี.ค.': 'Mar', 'มีนาคม': 'Mar', 'มีค': 'Mar',
	'เม.ย.': 'Apr', 'เมษายน': 'Apr', 'เมย': 'Apr',
	'พ.ค.': 'May', 'พฤษภาคม': 'May', 'พค': 'May',
	'มิ.ย.': 'Jun', 'มิถุนายน': 'Jun', 'มิย': 'Jun',
	'ก.ค.': 'Jul', 'กรกฎาคม': 'Jul', 'กค': 'Jul',
	'ส.ค.': 'Aug', 'สิงหาคม': 'Aug', 'สค': 'Aug',
	'ก.ย.': 'Sep', 'กันยายน': 'Sep', 'กย': 'Sep',
	'ต.ค.': 'Oct', 'ตุลาคม': 'Oct', 'ตค': 'Oct',
	'พ.ย.': 'Nov', 'พฤศจิกายน': 'Nov', 'พย': 'Nov',
	'ธ.ค.': 'Dec', 'ธันวาคม': 'Dec', 'ธค': 'Dec'
};

// Buddhist Era to Gregorian conversion
function convertBuddhistToGregorian(thaiDate: string): string {
	// Match Thai date format: DD MMM YYYY
	const thaiDateMatch = thaiDate.match(/(\d{1,2})\s+([ก-๏\.]+)\s+(\d{4})/);
	if (!thaiDateMatch) return thaiDate;

	const [, day, thaiMonth, year] = thaiDateMatch;
	const monthEn = thaiMonths[thaiMonth.trim()] || thaiMonth;
	
	// Convert Buddhist Era to Gregorian (BE - 543 = CE)
	let gregorianYear = parseInt(year);
	if (gregorianYear >= 2400) {
		gregorianYear -= 543;
	}
	
	return `${day} ${monthEn} ${gregorianYear}`;
}

function parseThaiIdCard(visionResponse: any): ThaiIdCard {
	const defaultResponse: ThaiIdCard = {
		id_number: '',
		id_number_status: 0,
		name_prefix_th: '',
		th_name: '',
		name_prefix_en: '',
		en_name: '',
		address: '',
		birth_date: '',
		birth_date_th: '',
		issue_date: '',
		issue_date_th: '',
		expiry_date: '',
		expiry_date_th: '',
		religion: '',
		laser_code: '',
		detection_score: 0,
		raw_text: ''
	};

	if (!visionResponse?.responses?.[0]?.fullTextAnnotation?.text) {
		return defaultResponse;
	}

	const fullText = visionResponse.responses[0].fullTextAnnotation.text;
	const normalizedText = normalizeThaiDigits(fullText);
	defaultResponse.raw_text = fullText;

	// Thai ID number pattern (13 digits) - improved with normalization
	const idMatch = normalizedText.match(/\b\d{1}[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d{1}\b|\b\d{13}\b/);
	if (idMatch) {
		const cleanId = idMatch[0].replace(/[\s-]/g, '');
		defaultResponse.id_number = cleanId;
		defaultResponse.id_number_status = validateThaiId(cleanId) ? 1 : 0;
	}

	// Thai name with prefix pattern
	const thaiPrefixes = ['นาย', 'นาง', 'นางสาว', 'เด็กหญิง', 'เด็กชาย'];
	const thaiPrefixPattern = thaiPrefixes.join('|');
	const thaiNameMatch = fullText.match(new RegExp(`(${thaiPrefixPattern})\\s+([ก-๏\\s]+)`, 'i'));
	if (thaiNameMatch) {
		defaultResponse.name_prefix_th = thaiNameMatch[1].trim();
		defaultResponse.th_name = thaiNameMatch[2].trim();
	} else {
		// Fallback: try to find Thai name without prefix
		const thaiNameFallback = fullText.match(/(?:ชื่อตัว.*?ชื่อสกุล|Name)[\s\n]*([ก-๏\s]+)/i);
		if (thaiNameFallback) {
			defaultResponse.th_name = thaiNameFallback[1].trim();
		}
	}

	// English name with prefix pattern - handle multiline format
	const englishPrefixes = ['Mr\\.', 'Mrs\\.', 'Miss', 'Ms\\.'];
	const englishPrefixPattern = englishPrefixes.join('|');
	
	// Try to match "Name Mrs. Bunyang\nLast name Lopez" pattern
	const multilineEnglishMatch = fullText.match(new RegExp(`Name\\s+(${englishPrefixPattern})\\s+([A-Z][a-z]+)\\s*\\n?.*?Last name\\s+([A-Z][a-z]+)`, 'i'));
	if (multilineEnglishMatch) {
		defaultResponse.name_prefix_en = multilineEnglishMatch[1].replace('.', '').trim();
		defaultResponse.en_name = `${multilineEnglishMatch[2]} ${multilineEnglishMatch[3]}`.trim();
	} else {
		// Single line pattern
		const englishNameMatch = fullText.match(new RegExp(`(${englishPrefixPattern})\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)`));
		if (englishNameMatch) {
			defaultResponse.name_prefix_en = englishNameMatch[1].replace('.', '').trim();
			defaultResponse.en_name = englishNameMatch[2].trim();
		} else {
			// Fallback: try to find English name without prefix
			const englishNameFallback = fullText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
			if (englishNameFallback) {
				defaultResponse.en_name = englishNameFallback[1].trim();
			}
		}
	}

	// Enhanced date patterns - Thai and English formats
	const thaiDatePatterns = normalizedText.match(/\d{1,2}\s+[ก-๏\.]+\s+\d{4}/g);
	const englishDatePatterns = normalizedText.match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/g);
	
	// Process Thai dates
	if (thaiDatePatterns && thaiDatePatterns.length > 0) {
		const sortedThaiDates = thaiDatePatterns.slice(0, 3); // Take first 3 dates found
		
		if (sortedThaiDates[0]) {
			defaultResponse.birth_date_th = sortedThaiDates[0];
			defaultResponse.birth_date = convertBuddhistToGregorian(sortedThaiDates[0]);
		}
		if (sortedThaiDates[1]) {
			defaultResponse.issue_date_th = sortedThaiDates[1];
			defaultResponse.issue_date = convertBuddhistToGregorian(sortedThaiDates[1]);
		}
		if (sortedThaiDates[2]) {
			defaultResponse.expiry_date_th = sortedThaiDates[2];
			defaultResponse.expiry_date = convertBuddhistToGregorian(sortedThaiDates[2]);
		}
	}
	
	// Fallback to English dates if Thai dates not found
	if (!defaultResponse.birth_date && englishDatePatterns && englishDatePatterns.length > 0) {
		const sortedEnglishDates = englishDatePatterns.slice(0, 3);
		defaultResponse.birth_date = sortedEnglishDates[0] || '';
		defaultResponse.issue_date = sortedEnglishDates[1] || '';
		defaultResponse.expiry_date = sortedEnglishDates[2] || '';
	}

	// Enhanced address pattern - Thai address structure starting with house number and ending with จ.(province)
	const addressMatch = normalizedText.match(/(\d+\/?\d*\s+หมู่ที่?\s+\d+\s+ต\.[ก-๏\s]+อ\.[ก-๏\s]+จ\.[ก-๏\s]+)/i);
	if (addressMatch) {
		defaultResponse.address = addressMatch[1].trim().replace(/\s+/g, ' ');
	} else {
		// Fallback: look for complete address pattern starting from house number
		const addressFallback = normalizedText.match(/(\d+\/?\d*[ก-๏\s\/,.-]*?จ\.?\s*[ก-๏]+)/i);
		if (addressFallback) {
			defaultResponse.address = addressFallback[1].trim().replace(/\s+/g, ' ');
		}
	}

	// Religion pattern - extract text after "ศาสนา" until newline or "ที่อยู่"
	const religionMatch = fullText.match(/ศาสนา\s+([ก-๏]+)(?=\s|$|\n|ที่อยู่)/i);
	if (religionMatch) {
		defaultResponse.religion = religionMatch[1].trim();
	}

	// Laser code pattern (code below the photo) - typically format like "2004-03-07261317"
	const laserCodeMatch = normalizedText.match(/(\d{4}-\d{2}-\d{8}|\d{14})/);
	if (laserCodeMatch) {
		defaultResponse.laser_code = laserCodeMatch[1];
	}

	// Calculate detection score based on found fields and validation
	let score = 0;
	if (defaultResponse.id_number) {
		score += 25;
		// Bonus for valid checksum
		if (defaultResponse.id_number_status === 1) score += 10;
	}
	if (defaultResponse.name_prefix_th) score += 5;
	if (defaultResponse.th_name) score += 15;
	if (defaultResponse.name_prefix_en) score += 5;
	if (defaultResponse.en_name) score += 10;
	if (defaultResponse.address) score += 10;
	if (defaultResponse.birth_date) score += 5;
	if (defaultResponse.birth_date_th) score += 5;
	if (defaultResponse.issue_date) score += 5;
	if (defaultResponse.expiry_date) score += 5;
	if (defaultResponse.religion) score += 5;
	if (defaultResponse.laser_code) score += 5;
	
	defaultResponse.detection_score = score;

	return defaultResponse;
}

async function convertImageToBase64(imageFile: File): Promise<string> {
	const arrayBuffer = await imageFile.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);
	let binaryString = '';
	for (let i = 0; i < uint8Array.length; i++) {
		binaryString += String.fromCharCode(uint8Array[i]);
	}
	return btoa(binaryString);
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Check authentication
	const isAuthenticated = cookies.get('auth_session') === 'authenticated';
	if (!isAuthenticated) {
		throw error(401, 'Unauthorized - Please login first');
	}

	try {
		const formData = await request.formData();
		const imageFile = formData.get('image') as File;

		if (!imageFile) {
			throw error(400, 'No image file provided');
		}

		if (!imageFile.type.startsWith('image/')) {
			throw error(400, 'File must be an image');
		}

		// Check if API key is configured
		if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === 'your-google-vision-api-key-here') {
			throw error(500, 'Google Vision API key not configured');
		}

		// Convert image to base64
		const base64Image = await convertImageToBase64(imageFile);

		// Prepare Google Vision API request
		const visionRequest = {
			requests: [
				{
					image: {
						content: base64Image
					},
					features: [
						{
							type: 'DOCUMENT_TEXT_DETECTION',
							maxResults: 1
						}
					]
				}
			]
		};

		// Call Google Vision API
		const timeout = parseInt(API_TIMEOUT) || 30000;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(
			`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(visionRequest),
				signal: controller.signal
			}
		);

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Vision API Error:', response.status, errorText);
			throw error(response.status, `Vision API error: ${errorText}`);
		}

		const visionResponse = await response.json();

		// Parse the Vision API response for Thai ID card data
		const thaiIdData = parseThaiIdCard(visionResponse);
		
		return json(thaiIdData);

	} catch (e) {
		console.error('OCR Error:', e);
		
		if (e instanceof Error && e.name === 'AbortError') {
			throw error(408, 'Request timeout');
		}
		
		if (e instanceof Error) {
			throw error(500, `OCR processing failed: ${e.message}`);
		}
		
		throw error(500, 'OCR processing failed');
	}
};