import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const primaryUrl = "https://primary.example/";
const alternativeUrl = "https://alternative.example/";
const stored = {};

globalThis.__BACKEND_URL__ = primaryUrl;
globalThis.__ALTERNATIVE_BACKEND_URL__ = alternativeUrl;
globalThis.chrome = {
	storage: {
		local: {
			get: async (key) => ({ [key]: stored[key] }),
			set: async (values) => Object.assign(stored, values),
		},
	},
};

const initialProbes = [];

globalThis.fetch = async (url, options) => {
	initialProbes.push({ url, options });
	return { status: 204 };
};

const {
	BACKEND_TIMEOUT_MS,
	PRIMARY_BACKEND_URL,
	getActiveBackendUrl,
	isBackendUnavailable,
	recheckPrimaryBackend,
	retryWithFallbackBackend,
} = await import("../src/shared/backendFallback.js");
const { STORAGE_KEYS } = await import("../src/shared/constants.js");

assert.equal(BACKEND_TIMEOUT_MS, 5000);
assert.equal(PRIMARY_BACKEND_URL, primaryUrl);
assert.equal(await getActiveBackendUrl(), primaryUrl);
assert.equal(initialProbes.length, 1);
assert.equal(initialProbes[0].url, primaryUrl);
assert.equal(initialProbes[0].options.method, "HEAD");
assert.equal(isBackendUnavailable(new TypeError("Failed to fetch")), true);
assert.equal(isBackendUnavailable({ response: { status: 502 } }), true);
assert.equal(isBackendUnavailable({ response: { status: 504 } }), true);
assert.equal(isBackendUnavailable({ response: { status: 500 } }), false);
assert.equal(isBackendUnavailable({ response: { status: 401 } }), false);

delete stored[STORAGE_KEYS.ACTIVE_BACKEND_URL];

const unavailablePrimaryProbes = [];

globalThis.fetch = async (url) => {
	unavailablePrimaryProbes.push(url);

	if (url === primaryUrl) throw new TypeError("Failed to fetch");

	return { status: 204 };
};

const unavailablePrimaryModule = await import(
	"../src/shared/backendFallback.js?unavailable-primary"
);

assert.equal(
	await unavailablePrimaryModule.getActiveBackendUrl(),
	alternativeUrl,
);
assert.deepEqual(unavailablePrimaryProbes, [primaryUrl, alternativeUrl]);
assert.equal(stored[STORAGE_KEYS.ACTIVE_BACKEND_URL], alternativeUrl);

const attempts = [];
const fallbackResult = await retryWithFallbackBackend(
	primaryUrl,
	new TypeError("Failed to fetch"),
	"GET",
	async (url) => {
		attempts.push(url);
		return "alternative response";
	},
);

assert.equal(fallbackResult, "alternative response");
assert.deepEqual(attempts, [alternativeUrl]);
assert.equal(stored[STORAGE_KEYS.ACTIVE_BACKEND_URL], alternativeUrl);
assert.equal(await getActiveBackendUrl(), alternativeUrl);

const unsafeError = new TypeError("Failed to fetch");
let unsafeRequestCalled = false;

await assert.rejects(
	retryWithFallbackBackend(primaryUrl, unsafeError, "POST", async () => {
		unsafeRequestCalled = true;
	}),
	(error) => error === unsafeError,
);

assert.equal(unsafeRequestCalled, false);

stored[STORAGE_KEYS.ACTIVE_BACKEND_URL] = primaryUrl;
assert.equal(await getActiveBackendUrl(), primaryUrl);

stored[STORAGE_KEYS.ACTIVE_BACKEND_URL] = alternativeUrl;
assert.equal(await getActiveBackendUrl(), alternativeUrl);

let probeUrl;
let probeOptions;

globalThis.fetch = async (url, options) => {
	probeUrl = url;
	probeOptions = options;
	return { status: 204 };
};

await recheckPrimaryBackend(alternativeUrl);

assert.equal(probeUrl, primaryUrl);
assert.equal(probeOptions.method, "HEAD");
assert.equal(stored[STORAGE_KEYS.ACTIVE_BACKEND_URL], primaryUrl);

const sourceFiles = await Promise.all(
	[
		"../src/api/api.instance.js",
		"../src/background/authManager.js",
		"../src/background/proxyChrome.js",
		"../src/background/proxyFirefox.js",
		"../vite.config.mjs",
	].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);
const [apiInstance, authManager, proxyChrome, proxyFirefox, viteConfig] =
	sourceFiles;

assert.match(apiInstance, /retryWithFallbackBackend/);
assert.match(
	apiInstance,
	/retryWithFallbackBackend\([\s\S]*?config\.method,[\s\S]*?async \(fallbackUrl\)/,
);
assert.match(apiInstance, /recheckPrimaryBackend/);
assert.match(apiInstance, /timeout: 30000/);
assert.doesNotMatch(authManager, /retryWithFallbackBackend/);
assert.match(authManager, /recheckPrimaryBackend/);
assert.match(proxyChrome, /BACKEND_URLS/);
assert.match(proxyFirefox, /BACKEND_URLS/);
assert.match(viteConfig, /VITE_ALTERNATIVE_BACKEND_URL/);
