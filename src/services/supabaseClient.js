// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL?.trim();
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY?.trim();
const DEMO_EMAIL_STORAGE_KEY = 'itakt_demo_email';

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Faltan REACT_APP_SUPABASE_URL o REACT_APP_SUPABASE_ANON_KEY en .env');
}

function resolveDemoEmail() {
	if (typeof window === 'undefined') {
		return '';
	}

	return window.localStorage.getItem(DEMO_EMAIL_STORAGE_KEY) || '';
}

export function setDemoSessionEmail(email) {
	if (typeof window === 'undefined') {
		return;
	}

	const normalizedEmail = String(email || '').trim().toLowerCase();
	if (!normalizedEmail) {
		window.localStorage.removeItem(DEMO_EMAIL_STORAGE_KEY);
		return;
	}

	window.localStorage.setItem(DEMO_EMAIL_STORAGE_KEY, normalizedEmail);
}

export function clearDemoSessionEmail() {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.removeItem(DEMO_EMAIL_STORAGE_KEY);
}

const fetchWithDemoHeaders = (input, init = {}) => {
	const demoEmail = resolveDemoEmail();
	const headers = new Headers(init?.headers || {});

	if (demoEmail) {
		headers.set('x-itakt-user-email', demoEmail);
	}

	return fetch(input, {
		...init,
		headers
	});
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
	global: {
		fetch: fetchWithDemoHeaders
	}
});
