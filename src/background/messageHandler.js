import { MSG, STORAGE_KEYS, toBadgeCode } from "../shared/constants";
import {
	clearTokens,
	completeFirefoxOAuth,
	getTokens,
	refreshAccessToken,
	setTokens,
	startOAuthFlow,
} from "./authManager";
import {
	connect,
	disconnect,
	getStatus,
	reapplyProxy,
	updateBadge,
} from "./proxyManager";

const storage = (globalThis.browser?.storage || chrome.storage).local;

const handlers = {
	[MSG.PROXY_CONNECT]: async (msg) => {
		if (!msg.credentials?.host || !msg.credentials?.port) {
			return { error: "Invalid credentials: host and port required" };
		}

		if (
			(msg.credentials.user != null &&
				typeof msg.credentials.user !== "string") ||
			(msg.credentials.pass != null && typeof msg.credentials.pass !== "string")
		) {
			return { error: "Invalid credentials: user and pass must be strings" };
		}

		const badgeText = toBadgeCode(msg.configMeta?.locationCode) || "ON";

		await connect(msg.credentials, badgeText);

		if (msg.configMeta) {
			await storage.set({
				[STORAGE_KEYS.CONNECTED_CONFIG]: msg.configMeta,
			});
		}

		return { success: true };
	},

	[MSG.PROXY_DISCONNECT]: async () => {
		await disconnect();

		await storage.remove(STORAGE_KEYS.CONNECTED_CONFIG);

		return { success: true };
	},

	[MSG.PROXY_STATUS]: async () => {
		const proxyState = await getStatus();

		const data = await storage.get(STORAGE_KEYS.CONNECTED_CONFIG);

		return {
			connected: proxyState.connected,
			configMeta: data[STORAGE_KEYS.CONNECTED_CONFIG] ?? null,
		};
	},

	[MSG.AUTH_LOGIN]: async () => {
		return await startOAuthFlow();
	},

	[MSG.AUTH_GET_TOKENS]: async () => {
		return await getTokens();
	},

	[MSG.AUTH_SET_TOKENS]: async (msg) => {
		if (!msg.accessToken?.token || !msg.refreshToken?.token) {
			return { error: "Invalid token format" };
		}

		await setTokens(msg.accessToken, msg.refreshToken);
		return { success: true };
	},

	[MSG.AUTH_CLEAR]: async () => {
		await clearTokens();
		await disconnect();
		await storage.remove(STORAGE_KEYS.CONNECTED_CONFIG);
		return { success: true };
	},

	[MSG.UPDATE_PROXY_SETTINGS]: async () => {
		await reapplyProxy();
		return { success: true };
	},

	[MSG.UPDATE_BADGE]: async (msg) => {
		await updateBadge(msg.text);
		return { success: true };
	},

	[MSG.AUTH_REFRESH]: async () => {
		const token = await refreshAccessToken();
		return { token };
	},

	[MSG.AUTH_FIREFOX_CODE]: async (msg, sender) => {
		const expectedUrl = chrome.runtime.getURL("callback.html");

		if (!sender.url || !sender.url.startsWith(expectedUrl)) {
			return { error: "Unauthorized sender" };
		}

		if (!msg.code || typeof msg.code !== "string" || msg.code.length > 2048) {
			return { error: "Invalid auth code" };
		}

		return await completeFirefoxOAuth(msg.code);
	},
};

/**
 * Route an incoming message to the appropriate handler.
 * @param {{ type: string }} message - Message with a type field matching MSG constants
 * @param {object} sender - Message sender info
 * @param {function} sendResponse - Callback to send the response
 */
export const handleMessage = (message, sender, sendResponse) => {
	if (sender.id !== chrome.runtime.id) {
		sendResponse({ error: "Unauthorized" });
		return;
	}

	const handler = handlers[message.type];

	if (!handler) {
		sendResponse({ error: "Unknown message type" });
		return;
	}

	handler(message, sender)
		.then(sendResponse)
		.catch((err) => {
			console.error(`Handler error [${message.type}]:`, err);
			sendResponse({ error: err.message });
		});
};
