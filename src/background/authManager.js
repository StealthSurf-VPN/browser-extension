import { CLIENT_ID, STORAGE_KEYS } from "../shared/constants";
import getCurrentTimestamp from "../shared/getCurrentTimestamp";
import { generateCodeChallenge, generateCodeVerifier } from "../shared/pkce";

const isFirefox = typeof globalThis.browser?.runtime?.getURL === "function";

const storage = (globalThis.browser?.storage || chrome.storage).local;

const backendUrl = __BACKEND_URL__.replace(/\/+$/, "") + "/";

/**
 * Read access and refresh tokens from storage.
 * @returns {Promise<{ accessToken: object|null, refreshToken: object|null }>}
 */
export const getTokens = async () => {
	const data = await storage.get([
		STORAGE_KEYS.ACCESS_TOKEN,
		STORAGE_KEYS.REFRESH_TOKEN,
	]);

	return {
		accessToken: data[STORAGE_KEYS.ACCESS_TOKEN] ?? null,
		refreshToken: data[STORAGE_KEYS.REFRESH_TOKEN] ?? null,
	};
};

/**
 * Save access and refresh tokens to storage.
 * @param {{ token: string, expires_at: number }} accessToken
 * @param {{ token: string, expires_at: number }} refreshToken
 */
export const setTokens = async (accessToken, refreshToken) => {
	await storage.set({
		[STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
		[STORAGE_KEYS.REFRESH_TOKEN]: refreshToken,
	});
};

/**
 * Remove all auth tokens from storage.
 */
export const clearTokens = async () => {
	await storage.remove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
};

let refreshPromise = null;

/**
 * Refresh the access token using the stored refresh token.
 * Deduplicates concurrent calls — only one refresh runs at a time.
 * Clears tokens on permanent failure (4xx except 429).
 * @returns {Promise<string|null>} New access token string or null on failure
 */
export const refreshAccessToken = async () => {
	if (refreshPromise) return refreshPromise;

	refreshPromise = doRefreshAccessToken().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
};

const doRefreshAccessToken = async () => {
	const { refreshToken } = await getTokens();

	if (!refreshToken?.token || refreshToken.expires_at < getCurrentTimestamp()) {
		await clearTokens();
		return null;
	}

	try {
		const response = await fetch(`${backendUrl}auth/connect/token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "refresh_token",
				refresh_token: refreshToken.token,
				client_id: CLIENT_ID,
			}),
		});

		if (!response.ok) {
			if (
				response.status >= 400 &&
				response.status < 500 &&
				response.status !== 429
			) {
				await clearTokens();
			}
			return null;
		}

		const data = await response.json();

		if (data?.data?.access_token) {
			await setTokens(data.data.access_token, data.data.refresh_token);
			return data.data.access_token.token;
		}
	} catch (err) {
		console.error("Token refresh failed:", err);
	}

	return null;
};

/**
 * Get the appropriate OAuth redirect URI for the current browser.
 * @returns {string} Redirect URI
 */
const getRedirectUri = () => {
	if (isFirefox) return browser.runtime.getURL("callback.html");

	return chrome.identity.getRedirectURL();
};

/**
 * Build the full OAuth authorization URL with PKCE parameters.
 * @param {string} codeChallenge - PKCE code challenge
 * @param {string} redirectUri - OAuth redirect URI
 * @returns {string} Full authorization URL
 */
const buildAuthUrl = (codeChallenge, redirectUri) => {
	const params = new URLSearchParams({
		client_id: CLIENT_ID,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		redirect_uri: redirectUri,
	});

	const base = __CONSOLE_URL__.replace(/\/+$/, "");

	return `${base}/auth/connect?${params}`;
};

/**
 * Exchange an authorization code for tokens via the backend.
 * @param {string} code - Authorization code
 * @param {string} codeVerifier - PKCE code verifier
 * @param {string} redirectUri - OAuth redirect URI
 * @returns {Promise<{ access_token: object, refresh_token: object }>} Token pair
 */
const exchangeCode = async (code, codeVerifier, redirectUri) => {
	const response = await fetch(`${backendUrl}auth/connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "authorization_code",
			code,
			code_verifier: codeVerifier,
			client_id: CLIENT_ID,
			redirect_uri: redirectUri,
		}),
	});

	if (!response.ok)
		throw new Error(`Token exchange HTTP error: ${response.status}`);

	const data = await response.json();

	if (!data?.data?.access_token) throw new Error("Token exchange failed");

	return data.data;
};

/**
 * Start OAuth flow in Chrome by opening a tab and monitoring redirect.
 * Cleans up listeners if the tab is closed by the user.
 * @param {string} authUrl - Authorization URL
 * @param {string} redirectUri - Expected redirect URI
 * @param {string} codeVerifier - PKCE code verifier
 * @returns {Promise<{ success: boolean }>}
 */
const startChromeOAuth = (authUrl, redirectUri, codeVerifier) =>
	new Promise((resolve, reject) => {
		chrome.tabs.create({ url: authUrl }, (tab) => {
			if (!tab) {
				reject(new Error("Failed to create auth tab"));
				return;
			}

			const tabId = tab.id;

			let timeoutId;

			const cleanup = () => {
				clearTimeout(timeoutId);
				chrome.tabs.onUpdated.removeListener(updateListener);
				chrome.tabs.onRemoved.removeListener(removeListener);
			};

			const removeListener = (closedTabId) => {
				if (closedTabId !== tabId) return;

				cleanup();
				reject(new Error("Auth tab closed by user"));
			};

			const updateListener = async (updatedTabId, changeInfo) => {
				if (updatedTabId !== tabId || !changeInfo.url) return;

				if (!changeInfo.url.startsWith(redirectUri)) return;

				cleanup();
				chrome.tabs.remove(tabId).catch(() => {});

				try {
					const url = new URL(changeInfo.url);

					const code = url.searchParams.get("code");

					if (!code || typeof code !== "string" || code.length > 2048)
						throw new Error("Invalid auth code");

					const tokens = await exchangeCode(code, codeVerifier, redirectUri);

					await setTokens(tokens.access_token, tokens.refresh_token);

					resolve({ success: true });
				} catch (err) {
					reject(err);
				}
			};

			chrome.tabs.onUpdated.addListener(updateListener);
			chrome.tabs.onRemoved.addListener(removeListener);

			timeoutId = setTimeout(
				() => {
					if (chrome.tabs.onUpdated.hasListener(updateListener)) {
						cleanup();
						reject(new Error("OAuth timeout — no response within 5 minutes"));
					}
				},
				5 * 60 * 1000,
			);
		});
	});

/**
 * Start OAuth flow in Firefox by storing verifier and opening auth tab.
 * Token exchange happens in callback.html.
 * @param {string} authUrl - Authorization URL
 * @param {string} codeVerifier - PKCE code verifier
 * @param {string} redirectUri - Expected redirect URI
 * @returns {Promise<{ success: boolean, pending: boolean }>}
 */
const startFirefoxOAuth = async (authUrl, codeVerifier, redirectUri) => {
	await storage.set({
		[STORAGE_KEYS.OAUTH_CODE_VERIFIER]: codeVerifier,
		[STORAGE_KEYS.OAUTH_REDIRECT_URI]: redirectUri,
	});

	await browser.tabs.create({ url: authUrl });

	return { success: true, pending: true };
};

/**
 * Initiate the full PKCE OAuth flow.
 * Generates verifier/challenge and opens authorization page.
 * @returns {Promise<{ success: boolean }>}
 */
let authInProgress = false;

export const startOAuthFlow = async () => {
	if (authInProgress) return { error: "Auth already in progress" };

	authInProgress = true;

	try {
		const codeVerifier = generateCodeVerifier();

		const codeChallenge = await generateCodeChallenge(codeVerifier);

		const redirectUri = getRedirectUri();

		const authUrl = buildAuthUrl(codeChallenge, redirectUri);

		if (isFirefox) {
			const result = await startFirefoxOAuth(
				authUrl,
				codeVerifier,
				redirectUri,
			);
			return result;
		}

		const result = await startChromeOAuth(authUrl, redirectUri, codeVerifier);
		return result;
	} finally {
		authInProgress = false;
	}
};

/**
 * Complete the Firefox OAuth flow by exchanging the code for tokens.
 * Called from callback.html after redirect.
 * @param {string} code - Authorization code from OAuth redirect
 * @returns {Promise<{ success: boolean }>}
 */
export const completeFirefoxOAuth = async (code) => {
	const data = await storage.get([
		STORAGE_KEYS.OAUTH_CODE_VERIFIER,
		STORAGE_KEYS.OAUTH_REDIRECT_URI,
	]);

	const codeVerifier = data[STORAGE_KEYS.OAUTH_CODE_VERIFIER];

	const redirectUri = data[STORAGE_KEYS.OAUTH_REDIRECT_URI];

	if (!codeVerifier || !redirectUri) throw new Error("No pending OAuth flow");

	try {
		const tokens = await exchangeCode(code, codeVerifier, redirectUri);

		await setTokens(tokens.access_token, tokens.refresh_token);

		return { success: true };
	} finally {
		await storage.remove([
			STORAGE_KEYS.OAUTH_CODE_VERIFIER,
			STORAGE_KEYS.OAUTH_REDIRECT_URI,
		]);
	}
};

let alarmListenerRegistered = false;

/**
 * Initialize the auth manager: clean stale OAuth state, set up periodic token refresh.
 * @returns {Promise<void>}
 */
export const initAuthManager = async () => {
	await chrome.alarms.create("tokenRefreshCheck", { periodInMinutes: 5 });

	if (!alarmListenerRegistered) {
		alarmListenerRegistered = true;

		chrome.alarms.onAlarm.addListener(async (alarm) => {
			if (alarm.name !== "tokenRefreshCheck") return;

			const { accessToken } = await getTokens();

			if (
				accessToken?.token &&
				accessToken.expires_at < getCurrentTimestamp() + 300
			) {
				await refreshAccessToken();
			}
		});
	}
};
