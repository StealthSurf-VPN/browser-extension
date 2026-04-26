import { STORAGE_KEYS, toBadgeCode } from "../shared/constants";
import pacIpHelpersSource from "../shared/pacIpHelpers.js?raw";
import { parseRule, parseIPv6 } from "../shared/ipUtils.js";

let currentCredentials = null;

const authRetries = new Map();

const authHandler = (details) => {
	if (!currentCredentials) return { cancel: true };

	if (authRetries.size > 1000) authRetries.clear();

	const count = authRetries.get(details.requestId) || 0;

	if (count >= 2) {
		authRetries.delete(details.requestId);
		return { cancel: true };
	}

	authRetries.set(details.requestId, count + 1);

	return {
		authCredentials: {
			username: currentCredentials.user,
			password: currentCredentials.pass,
		},
	};
};

/**
 * Get hostnames that should always bypass the proxy (API and console).
 * @returns {string[]} Array of internal hostnames
 */
let cachedInternalHosts = null;

const getInternalBypassHosts = () => {
	if (cachedInternalHosts) return cachedInternalHosts;

	const hosts = [];

	try {
		hosts.push(new URL(__BACKEND_URL__).hostname);
	} catch {}

	try {
		hosts.push(new URL(__CONSOLE_URL__).hostname);
	} catch {}

	cachedInternalHosts = hosts;
	return hosts;
};

/**
 * Read split tunneling settings from chrome.storage.local.
 * @returns {Promise<{ proxyAllTraffic: boolean, mode: string, domains: string[] }>}
 */
const getSplitTunnelSettings = async () => {
	const data = await chrome.storage.local.get([
		STORAGE_KEYS.PROXY_ALL_TRAFFIC,
		STORAGE_KEYS.SPLIT_TUNNEL_MODE,
		STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS,
	]);

	return {
		proxyAllTraffic: !!data[STORAGE_KEYS.PROXY_ALL_TRAFFIC],
		mode: data[STORAGE_KEYS.SPLIT_TUNNEL_MODE] || "exclude",
		domains: data[STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS] || [],
	};
};

/**
 * Sanitize a domain pattern, removing invalid characters.
 * @param {string} d - Raw domain string
 * @returns {string} Sanitized domain
 */
const sanitizeDomain = (d) => {
	const lower = d.toLowerCase().replace(/[^a-z0-9.*_-]/g, "");

	if (
		!/^(\*\.)?[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*$/.test(
			lower,
		)
	)
		return "";

	return lower;
};

const sanitizeIpv4 = (s) =>
	/^(?:(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])\.){3}(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])$/.test(
		s,
	)
		? s
		: "";

const sanitizePrefix = (n, max) => {
	const i = Number(n);

	if (!Number.isInteger(i) || i < 0 || i > max) return null;

	return i;
};

/**
 * Sanitize a proxy hostname, removing characters that could break PAC script.
 * @param {string} h - Raw hostname
 * @returns {string} Sanitized hostname
 */
const sanitizeHost = (h) => String(h).replace(/[^a-z0-9.\-]/gi, "");

/**
 * Sanitize a port number.
 * @param {string|number} p - Raw port value
 * @returns {number} Sanitized port number
 */
const sanitizePort = (p) => {
	const n = Number(p);
	if (!Number.isInteger(n) || n < 1 || n > 65535) return 0;
	return n;
};

/**
 * Build a PAC script condition for a single split-tunnel rule.
 * Dispatches by rule kind: domain, ipv4, ipv4cidr, ipv6, ipv6cidr.
 * @param {string} entry - Raw rule string (domain pattern, IP literal, or CIDR)
 * @param {string} result - PAC return value (e.g. "DIRECT" or "PROXY host:port")
 * @returns {string} PAC script condition line, or empty string if invalid
 */
const buildRuleCheck = (entry, result) => {
	const rule = parseRule(entry);

	if (!rule) return "";

	if (rule.kind === "domain") {
		const safe = sanitizeDomain(rule.value);
		if (!safe) return "";
		if (safe.startsWith("*.")) {
			const base = safe.slice(2);
			if (!base) return "";
			return `if (dnsDomainIs(host, "${base}")) return "${result}";`;
		}
		return `if (host === "${safe}" || dnsDomainIs(host, ".${safe}")) return "${result}";`;
	}

	if (rule.kind === "ipv4") {
		const safe = sanitizeIpv4(rule.value);
		if (!safe) return "";
		return `if (__v4 === "${safe}") return "${result}";`;
	}

	if (rule.kind === "ipv4cidr") {
		const net = sanitizeIpv4(rule.network);
		const p = sanitizePrefix(rule.prefix, 32);
		if (!net || p === null) return "";
		return `if (__v4 && inV4(__v4, "${net}", ${p})) return "${result}";`;
	}

	if (rule.kind === "ipv6") {
		const bytes = parseIPv6(rule.value);
		if (!bytes) return "";
		return `if (__v6 && eqV6(__v6, [${bytes.join(",")}])) return "${result}";`;
	}

	if (rule.kind === "ipv6cidr") {
		const bytes = parseIPv6(rule.network);
		const p = sanitizePrefix(rule.prefix, 128);
		if (!bytes || p === null) return "";
		return `if (__v6 && inV6(__v6, [${bytes.join(",")}], ${p})) return "${result}";`;
	}

	return "";
};

/**
 * Generate a PAC (Proxy Auto-Config) script for Chrome proxy settings.
 * @param {string} host - Proxy server hostname
 * @param {number} port - Proxy server port
 * @param {string[]} internalHosts - Hostnames that always bypass the proxy
 * @param {string} mode - Split tunnel mode: "exclude" or "include"
 * @param {string[]} domains - Domain patterns for split tunneling
 * @returns {string} PAC script source code
 */
const buildPacScript = (host, port, internalHosts, mode, domains) => {
	const safeHost = sanitizeHost(host);

	if (!safeHost) throw new Error("Invalid proxy host");

	const safePort = sanitizePort(port);

	if (!safePort) throw new Error("Invalid proxy port");

	const proxyStr = `PROXY ${safeHost}:${safePort}`;

	const internalChecks = internalHosts
		.map((h) => {
			const s = sanitizeHost(h);
			return `if (host === "${s}" || dnsDomainIs(host, ".${s}")) return "DIRECT";`;
		})
		.join("\n    ");

	if (mode === "include" && domains.length > 0) {
		const ruleChecks = domains
			.map((d) => buildRuleCheck(d, proxyStr))
			.filter(Boolean)
			.join("\n    ");

		return `${pacIpHelpersSource}
function FindProxyForURL(url, host) {
    ${internalChecks}
    var __isV4 = hostIsV4(host);
    var __v6 = __isV4 ? null : parseV6(host);
    var __v4 = hostV4Form(host, __isV4, __v6);
    ${ruleChecks}
    return "DIRECT";
}`;
	}

	if (mode === "exclude" && domains.length > 0) {
		const ruleChecks = domains
			.map((d) => buildRuleCheck(d, "DIRECT"))
			.filter(Boolean)
			.join("\n    ");

		return `${pacIpHelpersSource}
function FindProxyForURL(url, host) {
    ${internalChecks}
    var __isV4 = hostIsV4(host);
    var __v6 = __isV4 ? null : parseV6(host);
    var __v4 = hostV4Form(host, __isV4, __v6);
    ${ruleChecks}
    return "${proxyStr}";
}`;
	}

	return `${pacIpHelpersSource}
function FindProxyForURL(url, host) {
    ${internalChecks}
    return "${proxyStr}";
}`;
};

/**
 * Apply proxy settings in Chrome via PAC script.
 * Registers onAuthRequired listener for proxy authentication.
 * @param {{ host: string, port: string, user: string, pass: string }} credentials
 * @param {string} [badgeText="ON"] - Text for the extension badge
 */
export const connectChrome = async (
	{ host, port, user, pass, protocol = "http" },
	badgeText = "ON",
) => {
	currentCredentials = { host, port, user, pass, protocol };

	const { proxyAllTraffic, mode, domains } = await getSplitTunnelSettings();

	const internalHosts = proxyAllTraffic ? [] : getInternalBypassHosts();

	const pacScript = buildPacScript(
		host,
		Number(port),
		internalHosts,
		mode,
		domains,
	);

	const proxyConfig = {
		mode: "pac_script",
		pacScript: { data: pacScript },
	};

	await chrome.proxy.settings.set({
		value: proxyConfig,
		scope: "regular",
	});

	if (!chrome.webRequest.onAuthRequired.hasListener(authHandler)) {
		chrome.webRequest.onAuthRequired.addListener(
			authHandler,
			{ urls: ["<all_urls>"] },
			["blocking"],
		);
	}

	await chrome.storage.local.set({
		[STORAGE_KEYS.PROXY_STATE]: {
			connected: true,
			host,
			port,
			user,
			pass,
			protocol,
		},
	});

	chrome.action.setBadgeText({ text: badgeText });
	chrome.action.setBadgeBackgroundColor({ color: "#2688EB" });
};

/**
 * Clear Chrome proxy settings and remove auth listener.
 */
export const disconnectChrome = async () => {
	currentCredentials = null;

	await chrome.proxy.settings.clear({ scope: "regular" });

	if (chrome.webRequest.onAuthRequired.hasListener(authHandler)) {
		chrome.webRequest.onAuthRequired.removeListener(authHandler);
	}

	await chrome.storage.local.set({
		[STORAGE_KEYS.PROXY_STATE]: { connected: false },
	});

	chrome.action.setBadgeText({ text: "" });
};

/**
 * Get the current proxy connection state from storage.
 * @returns {Promise<{ connected: boolean, host?: string, port?: string, user?: string, pass?: string }>}
 */
export const getStatusChrome = async () => {
	const data = await chrome.storage.local.get(STORAGE_KEYS.PROXY_STATE);
	return data[STORAGE_KEYS.PROXY_STATE] ?? { connected: false };
};

/**
 * Reapply proxy settings with current credentials (e.g. after split tunnel change).
 * Falls back to storage if in-memory credentials are lost (service worker restart).
 */
export const reapplyChrome = async () => {
	if (!currentCredentials) {
		const state = await getStatusChrome();

		if (state.connected && state.host) {
			currentCredentials = {
				host: state.host,
				port: state.port,
				user: state.user,
				pass: state.pass,
				protocol: state.protocol || "http",
			};
		} else {
			return;
		}
	}

	const data = await chrome.storage.local.get(STORAGE_KEYS.CONNECTED_CONFIG);

	const badgeText =
		toBadgeCode(data[STORAGE_KEYS.CONNECTED_CONFIG]?.locationCode) || "ON";

	await connectChrome(currentCredentials, badgeText);
};

/**
 * Restore proxy connection after service worker restart.
 * Reads persisted state from chrome.storage.local and re-applies if was connected.
 */
export const restoreChrome = async () => {
	const state = await getStatusChrome();

	if (state.connected && state.host) {
		const data = await chrome.storage.local.get(STORAGE_KEYS.CONNECTED_CONFIG);

		const badgeText =
			toBadgeCode(data[STORAGE_KEYS.CONNECTED_CONFIG]?.locationCode) || "ON";

		await connectChrome(
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
