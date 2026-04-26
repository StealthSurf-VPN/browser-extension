import { useCallback, useRef } from "react";
import {
	getSplitTunnelSettings,
	updateSplitTunnelSettings,
} from "../../api/routes/route.profile-extension";
import { STORAGE_KEYS } from "../../shared/constants";

const DEBOUNCE_MS = 500;

const storage = () => (globalThis.browser?.storage || chrome.storage).local;

const isAuthenticated = async () => {
	const data = await storage().get(STORAGE_KEYS.ACCESS_TOKEN);

	return !!data[STORAGE_KEYS.ACCESS_TOKEN]?.token;
};

const isSyncEnabled = async () => {
	const data = await storage().get(STORAGE_KEYS.SYNC_ROUTING);

	const value = data[STORAGE_KEYS.SYNC_ROUTING];

	return value === undefined ? true : !!value;
};

const readSyncMeta = async () => {
	const data = await storage().get([
		STORAGE_KEYS.SYNC_DIRTY,
		STORAGE_KEYS.SYNC_LAST_SYNCED_AT,
	]);

	return {
		dirty: !!data[STORAGE_KEYS.SYNC_DIRTY],
		lastSyncedAt: data[STORAGE_KEYS.SYNC_LAST_SYNCED_AT] ?? null,
	};
};

const pushNow = async (mode, domains) => {
	try {
		const res = await updateSplitTunnelSettings({ mode, domains });

		if (res?.data?.status && res.data.data?.updated_at !== undefined) {
			await storage().set({
				[STORAGE_KEYS.SYNC_LAST_SYNCED_AT]: res.data.data.updated_at,
				[STORAGE_KEYS.SYNC_DIRTY]: false,
			});

			return { ok: true, updatedAt: res.data.data.updated_at };
		}

		const code = res?.data?.statusCode;

		if (code === 400 || code === 422) {
			await storage().set({ [STORAGE_KEYS.SYNC_DIRTY]: false });
			console.warn("Split-tunnel sync rejected by server", res.data);
			return { ok: false };
		}

		return { ok: false };
	} catch (err) {
		console.warn("Split-tunnel sync push failed", err);

		return { ok: false };
	}
};

export const useSplitTunnelSync = () => {
	const debounceRef = useRef(null);

	const syncIfNeeded = useCallback(async ({ mode, domains, applyRemote }) => {
		if (!(await isSyncEnabled())) return "disabled";
		if (!(await isAuthenticated())) return "unauthenticated";

		const meta = await readSyncMeta();

		if (meta.dirty) {
			const r = await pushNow(mode, domains);
			return r.ok ? "pushed-dirty" : "error";
		}

		let res;

		try {
			res = await getSplitTunnelSettings();
		} catch {
			return "error";
		}

		if (!res?.data?.status) return "error";

		const remote = res.data.data;

		const serverFresher =
			remote.updated_at !== null &&
			(meta.lastSyncedAt === null || remote.updated_at > meta.lastSyncedAt);

		if (serverFresher) {
			await applyRemote({ mode: remote.mode, domains: remote.domains });
			await storage().set({
				[STORAGE_KEYS.SYNC_LAST_SYNCED_AT]: remote.updated_at,
				[STORAGE_KEYS.SYNC_DIRTY]: false,
			});
			return "pulled";
		}

		const localHasState = domains.length > 0 || mode !== "exclude";

		if (remote.updated_at === null && localHasState) {
			const r = await pushNow(mode, domains);
			return r.ok ? "pushed-migration" : "error";
		}

		return "noop";
	}, []);

	const schedulePush = useCallback(async (mode, domains) => {
		if (debounceRef.current) clearTimeout(debounceRef.current);

		await storage().set({ [STORAGE_KEYS.SYNC_DIRTY]: true });

		debounceRef.current = setTimeout(async () => {
			debounceRef.current = null;
			if (!(await isSyncEnabled())) return;
			if (!(await isAuthenticated())) return;
			await pushNow(mode, domains);
		}, DEBOUNCE_MS);
	}, []);

	return { syncIfNeeded, schedulePush };
};
