import { STORAGE_KEYS } from "./constants";

const GITHUB_REPO = "stealthsurf-vpn/browser-extension";

const CACHE_KEY = STORAGE_KEYS.UPDATE_CHECK_CACHE;

const CACHE_TTL = 30 * 60 * 1000;

/**
 * Compare two semantic version strings.
 * @param {string} a - First version (e.g. "1.2.3")
 * @param {string} b - Second version (e.g. "1.3.0")
 * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
 */
const compareVersions = (a, b) => {
	const pa = a.split(".").map(Number);

	const pb = b.split(".").map(Number);

	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const va = pa[i] ?? 0;

		const vb = pb[i] ?? 0;

		if (va > vb) return 1;
		if (va < vb) return -1;
	}

	return 0;
};

/**
 * Check GitHub Releases for a newer extension version.
 * Skips check for store installs. Caches result for 30 minutes.
 * @returns {Promise<{ version: string, url: string }|null>} Update info or null if up-to-date
 */
export const checkForUpdate = async () => {
	try {
		if (chrome.management?.getSelf) {
			const self = await chrome.management.getSelf();

			if (self.installType === "normal") return null;
		}

		const cached = await chrome.storage.local.get(CACHE_KEY);

		if (cached[CACHE_KEY]) {
			const { timestamp, result } = cached[CACHE_KEY];

			if (Date.now() - timestamp < CACHE_TTL) return result;
		}

		const res = await fetch(
			`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
			{ cache: "no-store" },
		);

		if (!res.ok) return null;

		const release = await res.json();

		const latest = release.tag_name.replace(/^v/, "");

		const current = chrome.runtime.getManifest().version;

		const result =
			compareVersions(latest, current) > 0
				? { version: latest, url: release.html_url }
				: null;

		await chrome.storage.local.set({
			[CACHE_KEY]: { timestamp: Date.now(), result },
		});

		return result;
	} catch {
		return null;
	}
};
