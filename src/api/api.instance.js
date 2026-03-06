import axios from "axios";
import { MSG, STORAGE_KEYS, sendMessage } from "../shared/constants";
import getCurrentTimestamp from "../shared/getCurrentTimestamp";

const storage = (globalThis.browser?.storage || chrome.storage).local;

export const NETWORK = axios.create({
	baseURL: __BACKEND_URL__,
	timeout: 30000,
	validateStatus: (status) => status < 500,
	headers: {
		"Content-Type": "application/json",
	},
});

const getStoredTokens = async () => {
	const data = await storage.get([
		STORAGE_KEYS.ACCESS_TOKEN,
		STORAGE_KEYS.REFRESH_TOKEN,
	]);

	return {
		accessToken: data[STORAGE_KEYS.ACCESS_TOKEN] ?? null,
		refreshToken: data[STORAGE_KEYS.REFRESH_TOKEN] ?? null,
	};
};

let isRefreshing = false;

let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
	refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
	for (const callback of refreshSubscribers) callback(token);
	refreshSubscribers = [];
};

const doRefresh = async () => {
	isRefreshing = true;

	try {
		const result = await Promise.race([
			sendMessage({
				type: MSG.AUTH_REFRESH,
			}),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Refresh timeout")), 10000),
			),
		]);

		const token = result?.token ?? null;

		onRefreshed(token);
		return token;
	} catch {
		onRefreshed(null);
		return null;
	} finally {
		isRefreshing = false;
	}
};

const isAuthUrl = (url) => url === "auth" || url.startsWith("auth/");

NETWORK.interceptors.request.use(async (config) => {
	if (isAuthUrl(config.url)) {
		config.headers.Authorization = null;
		return config;
	}

	const { accessToken } = await getStoredTokens();

	if (!accessToken?.token) return config;

	let token = accessToken.token;

	if (accessToken.expires_at < getCurrentTimestamp()) {
		if (isRefreshing) {
			return new Promise((resolve) => {
				subscribeTokenRefresh((newToken) => {
					config.headers.Authorization = newToken ? `Bearer ${newToken}` : null;
					resolve(config);
				});
			});
		}

		const newToken = await doRefresh();

		if (newToken) {
			token = newToken;
		} else {
			return config;
		}
	}

	config.headers.Authorization = `Bearer ${token}`;

	return config;
});

NETWORK.interceptors.response.use(
	async (response) => {
		if (
			response.data?.statusCode === 401 &&
			response.data?.errorCode === 0 &&
			!isAuthUrl(response.config.url) &&
			!response.config.__isRetryAfterRefresh
		) {
			let token;

			if (isRefreshing) {
				token = await new Promise((resolve) => {
					subscribeTokenRefresh(resolve);
				});
			} else {
				token = await doRefresh();
			}

			if (token) {
				response.config.headers.Authorization = `Bearer ${token}`;

				response.config.__isRetryAfterRefresh = true;

				return NETWORK(response.config);
			}
		}

		return response;
	},
	(error) => Promise.reject(error),
);
