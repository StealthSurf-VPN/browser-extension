import { STORAGE_KEYS, toBadgeCode } from "../shared/constants";
import { parseRule, matchRule } from "../shared/ipUtils.js";

let proxyConfig = null;
let proxyResult = null;
let bypassHosts = null;

const authRetries = new Map();

const authHandler = (details) => {
	if (!proxyConfig) return { cancel: true };

	if (authRetries.size > 1000) authRetries.clear();

	const count = authRetries.get(details.requestId) || 0;

	if (count >= 2) {
		authRetries.delete(details.requestId);
		return { cancel: true };
	}

	authRetries.set(details.requestId, count + 1);

	return {
		authCredentials: {
			username: proxyConfig.user,
			password: proxyConfig.pass,
		},
	};
};

const buildProxyResult = ({ host, port, user, pass, protocol }) => {
	const isSocks = protocol === "socks5";

	return {
		type: isSocks ? "socks" : "http",
		host,
		port: Number(port),
		username: user,
		password: pass,
		...(isSocks ? { proxyDNS: true } : {}),
		...(!isSocks
			? {
					proxyAuthorizationHeader: `Basic ${btoa(unescape(encodeURIComponent(`${user}:${pass}`)))}`,
				}
			: {}),
	};
};

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

const ruleCache = new Map();

const ruleFor = (entry) => {
	if (ruleCache.has(entry)) return ruleCache.get(entry);

	const r = parseRule(entry);

	ruleCache.set(entry, r);

	return r;
};

const matchesAnyRule = (hostname, entries) => {
	for (const entry of entries) {
		const rule = ruleFor(entry);

		if (rule && matchRule(hostname, rule)) return true;
	}

	return false;
};

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
				if (!matchesAnyRule(hostname, splitTunnelDomains)) {
					return { type: "direct" };
				}
			} else if (matchesAnyRule(hostname, splitTunnelDomains)) {
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
	ruleCache.clear();
};

/**
 * Reapply split tunnel settings without reconnecting.
 */
export const reapplyFirefox = async () => {
	await readSplitTunnelSettings();

	if (!proxyConfig) {
		const state = await getStatusFirefox();

		if (state.connected && state.host) {
			proxyConfig = {
				host: state.host,
				port: state.port,
				user: state.user,
				pass: state.pass,
				protocol: state.protocol || "http",
			};

			proxyResult = buildProxyResult(proxyConfig);
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

	proxyConfig = { host, port, user, pass, protocol };

	proxyResult = buildProxyResult(proxyConfig);

	if (!browser.proxy.onRequest.hasListener(proxyRequestListener)) {
		browser.proxy.onRequest.addListener(proxyRequestListener, {
			urls: ["<all_urls>"],
		});
	}

	if (!browser.webRequest.onAuthRequired.hasListener(authHandler)) {
		browser.webRequest.onAuthRequired.addListener(
			authHandler,
			{ urls: ["<all_urls>"] },
			["blocking"],
		);
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

	if (browser.webRequest.onAuthRequired.hasListener(authHandler)) {
		browser.webRequest.onAuthRequired.removeListener(authHandler);
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
			toBadgeCode(data[STORAGE_KEYS.CONNECTED_CONFIG]?.locationCode) || "ON";

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
