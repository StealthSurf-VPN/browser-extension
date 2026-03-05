import { STORAGE_KEYS } from "../shared/constants";

let proxyConfig = null;
let proxyResult = null;
let bypassHosts = null;
let proxyAllTraffic = false;
let splitTunnelMode = "exclude";
let splitTunnelDomains = [];
const emptySet = new Set();

/**
 * Build a set of internal hostnames that should bypass the proxy.
 * @returns {Set<string>} Set of internal hostnames
 */
const buildBypassHosts = () => {
	const hosts = new Set();

	try {
		hosts.add(new URL(__BACKEND_URL__).hostname);
	} catch {}

	try {
		hosts.add(new URL(__CONSOLE_URL__).hostname);
	} catch {}

	return hosts;
};

/**
 * Get the current bypass host set, respecting proxyAllTraffic setting.
 * @returns {Set<string>} Bypass hostnames (empty if proxyAllTraffic is true)
 */
const getBypassHosts = () => {
	if (proxyAllTraffic) return emptySet;

	if (!bypassHosts) bypassHosts = buildBypassHosts();

	return bypassHosts;
};

/**
 * Check if a hostname matches a domain pattern (supports wildcards).
 * @param {string} hostname - Request hostname (e.g. "sub.example.com")
 * @param {string} pattern - Domain pattern (e.g. "*.example.com" or "example.com")
 * @returns {boolean} True if hostname matches the pattern
 */
const matchesDomain = (hostname, pattern) => {
	if (pattern.startsWith("*.")) {
		const base = pattern.slice(2);
		if (!base) return false;
		return hostname === base || hostname.endsWith("." + base);
	}

	if (!pattern) return false;

	return hostname === pattern || hostname.endsWith("." + pattern);
};

/**
 * Check if a hostname matches any domain in the list.
 * @param {string} hostname - Request hostname
 * @param {string[]} domains - Array of domain patterns
 * @returns {boolean} True if any pattern matches
 */
const matchesAnyDomain = (hostname, domains) =>
	domains.some((d) => matchesDomain(hostname, d));

/**
 * Firefox proxy.onRequest listener. Routes requests through proxy or direct
 * based on internal bypass list and split tunnel rules.
 * Malformed URLs are proxied (not DIRECT) to prevent traffic leaks.
 * @param {object} details - Request details from browser.proxy.onRequest
 * @returns {{ type: string, host?: string, port?: number, username?: string, password?: string }}
 */
const proxyRequestListener = (details) => {
	if (!proxyConfig || !proxyResult) return { type: "direct" };

	try {
		const hostname = new URL(details.url).hostname;

		if (getBypassHosts().has(hostname)) return { type: "direct" };

		if (splitTunnelDomains.length > 0) {
			if (splitTunnelMode === "include") {
				if (!matchesAnyDomain(hostname, splitTunnelDomains)) {
					return { type: "direct" };
				}
			} else if (matchesAnyDomain(hostname, splitTunnelDomains)) {
				return { type: "direct" };
			}
		}
	} catch {
		return proxyResult;
	}

	return proxyResult;
};

/**
 * Read split tunnel settings from storage into module-level variables.
 */
const readSplitTunnelSettings = async () => {
	const data = await browser.storage.local.get([
		STORAGE_KEYS.PROXY_ALL_TRAFFIC,
		STORAGE_KEYS.SPLIT_TUNNEL_MODE,
		STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS,
	]);

	proxyAllTraffic = !!data[STORAGE_KEYS.PROXY_ALL_TRAFFIC];
	splitTunnelMode = data[STORAGE_KEYS.SPLIT_TUNNEL_MODE] || "exclude";
	splitTunnelDomains = data[STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS] || [];
	bypassHosts = null;
};

/**
 * Reapply split tunnel settings without reconnecting.
 */
export const reapplyFirefox = async () => {
	await readSplitTunnelSettings();

	if (!proxyConfig) {
		const state = await getStatusFirefox();

		if (state.connected && state.host) {
			const protocol = state.protocol || "http";

			proxyConfig = {
				host: state.host,
				port: state.port,
				user: state.user,
				pass: state.pass,
			};

			proxyResult = {
				type: "http",
				host: state.host,
				port: Number(state.port),
				username: state.user,
				password: state.pass,
			};
		} else {
			return;
		}
	}

	if (!browser.proxy.onRequest.hasListener(proxyRequestListener)) {
		browser.proxy.onRequest.addListener(proxyRequestListener, {
			urls: ["<all_urls>"],
		});
	}
};

/**
 * Apply proxy in Firefox via proxy.onRequest listener.
 * @param {{ host: string, port: string, user: string, pass: string }} credentials
 * @param {string} [badgeText="ON"] - Text for the extension badge
 */
export const connectFirefox = async (
	{ host, port, user, pass, protocol = "http" },
	badgeText = "ON",
) => {
	await readSplitTunnelSettings();

	proxyConfig = { host, port, user, pass };

	proxyResult = {
		type: "http",
		host: proxyConfig.host,
		port: Number(proxyConfig.port),
		username: proxyConfig.user,
		password: proxyConfig.pass,
	};

	if (!browser.proxy.onRequest.hasListener(proxyRequestListener)) {
		browser.proxy.onRequest.addListener(proxyRequestListener, {
			urls: ["<all_urls>"],
		});
	}

	await browser.storage.local.set({
		[STORAGE_KEYS.PROXY_STATE]: {
			connected: true,
			host,
			port,
			user,
			pass,
			protocol,
		},
	});

	browser.browserAction.setBadgeText({ text: badgeText });
	browser.browserAction.setBadgeBackgroundColor({ color: "#2688EB" });
};

/**
 * Clear Firefox proxy and remove onRequest listener.
 */
export const disconnectFirefox = async () => {
	proxyConfig = null;
	proxyResult = null;

	if (browser.proxy.onRequest.hasListener(proxyRequestListener)) {
		browser.proxy.onRequest.removeListener(proxyRequestListener);
	}

	await browser.storage.local.set({
		[STORAGE_KEYS.PROXY_STATE]: { connected: false },
	});

	browser.browserAction.setBadgeText({ text: "" });
};

/**
 * Get the current proxy connection state from storage.
 * @returns {Promise<{ connected: boolean, host?: string, port?: string, user?: string, pass?: string }>}
 */
export const getStatusFirefox = async () => {
	const data = await browser.storage.local.get(STORAGE_KEYS.PROXY_STATE);
	return data[STORAGE_KEYS.PROXY_STATE] ?? { connected: false };
};

/**
 * Restore proxy connection after browser restart.
 */
export const restoreFirefox = async () => {
	const state = await getStatusFirefox();

	if (state.connected && state.host) {
		const data = await browser.storage.local.get(STORAGE_KEYS.CONNECTED_CONFIG);

		const badgeText =
			data[STORAGE_KEYS.CONNECTED_CONFIG]?.locationCode?.toUpperCase() || "ON";

		await connectFirefox(
			{
				host: state.host,
				port: state.port,
				user: state.user,
				pass: state.pass,
				protocol: state.protocol || "http",
			},
			badgeText,
		);
	}
};
