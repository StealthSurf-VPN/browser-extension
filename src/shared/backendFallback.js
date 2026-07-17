import { STORAGE_KEYS } from "./constants.js";

export const BACKEND_TIMEOUT_MS = 5000;

const PRIMARY_RECHECK_INTERVAL_MS = 60 * 1000;

const SAFE_RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const storage = (globalThis.browser?.storage || chrome.storage).local;

const normalizeBackendUrl = (url) => `${url.replace(/\/+$/, "")}/`;

export const PRIMARY_BACKEND_URL = normalizeBackendUrl(__BACKEND_URL__);

export const ALTERNATIVE_BACKEND_URL = normalizeBackendUrl(
	__ALTERNATIVE_BACKEND_URL__,
);

export const BACKEND_URLS = [
	PRIMARY_BACKEND_URL,
	ALTERNATIVE_BACKEND_URL,
].filter((url, index, urls) => urls.indexOf(url) === index);

let primaryRecheckPromise = null;

let lastPrimaryRecheckAt = 0;

let activeBackendUrl = null;

let activeBackendPromise = null;

const getStoredBackendUrl = async () => {
	try {
		const data = await storage.get(STORAGE_KEYS.ACTIVE_BACKEND_URL);

		const activeUrl = data[STORAGE_KEYS.ACTIVE_BACKEND_URL];

		if (
			typeof activeUrl === "string" &&
			BACKEND_URLS.includes(normalizeBackendUrl(activeUrl))
		) {
			return normalizeBackendUrl(activeUrl);
		}
	} catch {}

	return null;
};

export const setActiveBackendUrl = async (url) => {
	const normalizedUrl = normalizeBackendUrl(url);

	if (!BACKEND_URLS.includes(normalizedUrl)) return;

	activeBackendUrl = normalizedUrl;

	try {
		await storage.set({
			[STORAGE_KEYS.ACTIVE_BACKEND_URL]: normalizedUrl,
		});
	} catch {}
};

export const isBackendUnavailable = (error) => {
	const status = error?.response?.status ?? error?.status;

	return status == null || status === 0 || (status >= 502 && status <= 504);
};

export const fetchWithBackendTimeout = async (
	url,
	options = {},
	timeoutMs = BACKEND_TIMEOUT_MS,
) => {
	const controller = new AbortController();

	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, {
			...options,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeoutId);
	}
};

const probeBackend = async (url) => {
	try {
		const response = await fetchWithBackendTimeout(url, {
			method: "HEAD",
			cache: "no-store",
		});

		return !isBackendUnavailable({ status: response.status });
	} catch {
		return false;
	}
};

const resolveActiveBackendUrl = async () => {
	const storedBackendUrl = await getStoredBackendUrl();

	if (activeBackendUrl) {
		activeBackendUrl = storedBackendUrl || activeBackendUrl;
		return activeBackendUrl;
	}

	if (storedBackendUrl === ALTERNATIVE_BACKEND_URL) {
		activeBackendUrl = storedBackendUrl;
		return storedBackendUrl;
	}

	if (await probeBackend(PRIMARY_BACKEND_URL)) {
		await setActiveBackendUrl(PRIMARY_BACKEND_URL);
		return PRIMARY_BACKEND_URL;
	}

	lastPrimaryRecheckAt = Date.now();

	if (
		BACKEND_URLS.length > 1 &&
		(await probeBackend(ALTERNATIVE_BACKEND_URL))
	) {
		await setActiveBackendUrl(ALTERNATIVE_BACKEND_URL);
		return ALTERNATIVE_BACKEND_URL;
	}

	activeBackendUrl = storedBackendUrl || PRIMARY_BACKEND_URL;
	return activeBackendUrl;
};

export const getActiveBackendUrl = () => {
	if (activeBackendPromise) return activeBackendPromise;

	activeBackendPromise = resolveActiveBackendUrl().finally(() => {
		activeBackendPromise = null;
	});

	return activeBackendPromise;
};

export const retryWithFallbackBackend = async (
	failedUrl,
	error,
	method,
	request,
) => {
	if (
		!SAFE_RETRY_METHODS.has(String(method).toUpperCase()) ||
		!isBackendUnavailable(error)
	) {
		throw error;
	}

	const normalizedFailedUrl = normalizeBackendUrl(failedUrl);

	const fallbackUrl = BACKEND_URLS.find((url) => url !== normalizedFailedUrl);

	if (!fallbackUrl) throw error;

	const result = await request(fallbackUrl);

	await setActiveBackendUrl(fallbackUrl);

	return result;
};

export const recheckPrimaryBackend = (activeUrl) => {
	if (
		BACKEND_URLS.length < 2 ||
		normalizeBackendUrl(activeUrl) === PRIMARY_BACKEND_URL
	) {
		return null;
	}

	if (primaryRecheckPromise) return primaryRecheckPromise;

	const now = Date.now();

	if (now - lastPrimaryRecheckAt < PRIMARY_RECHECK_INTERVAL_MS) return null;

	lastPrimaryRecheckAt = now;

	primaryRecheckPromise = probeBackend(PRIMARY_BACKEND_URL)
		.then(async (isAvailable) => {
			if (isAvailable) await setActiveBackendUrl(PRIMARY_BACKEND_URL);
		})
		.finally(() => {
			primaryRecheckPromise = null;
		});

	return primaryRecheckPromise;
};
