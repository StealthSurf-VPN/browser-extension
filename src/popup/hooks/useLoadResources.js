import { useEffect, useRef, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { getConfigs as getConfigsApi } from "../../api/routes/route.configs";
import { getCloudServers as getCloudServersApi } from "../../api/routes/route.cloud-servers";
import { getLocations as getLocationsApi } from "../../api/routes/route.locations";
import {
	getPaidOptionLocations as getPaidOptionLocationsApi,
	getPaidOptions as getPaidOptionsApi,
} from "../../api/routes/route.paid-options";
import { getProfile as getProfileApi } from "../../api/routes/route.profile";
import { getCloudServerProxies } from "../../api/routes/route.proxies";
import { RESOURCE_REVALIDATE_MS, STORAGE_KEYS } from "../../shared/constants";
import {
	getCloudServers,
	getConfigs,
	getLocations,
	getPaidOptionLocationsMap,
	getPaidOptions,
	getProfileData,
} from "../state/selectors";

const localStore = () => (globalThis.browser?.storage || chrome.storage).local;

/**
 * Hook for loading all API resources with a stale-while-revalidate cache.
 * Hydrates atoms instantly from chrome.storage.local, then revalidates in the
 * background (unless the cache is fresher than RESOURCE_REVALIDATE_MS).
 * Falls back to a blocking fetch with skeletons on a cold start.
 * Gated on authentication so unauthenticated 401/empty responses never poison
 * the cache (which would otherwise show "no configs" after login until stale).
 * @param {boolean} isAuthenticated - Whether a session token is present.
 * @returns {{ loading: boolean, error: string|null, reload: () => Promise<void> }}
 */
const useLoadResources = (isAuthenticated) => {
	const setConfigs = useSetRecoilState(getConfigs);

	const setPaidOptions = useSetRecoilState(getPaidOptions);

	const setPaidOptionLocations = useSetRecoilState(getPaidOptionLocationsMap);

	const setCloudServers = useSetRecoilState(getCloudServers);

	const setLocations = useSetRecoilState(getLocations);

	const setProfile = useSetRecoilState(getProfileData);

	const configs = useRecoilValue(getConfigs);

	const locationsData = useRecoilValue(getLocations);

	const hasData = configs !== null && locationsData !== null;

	const [loading, setLoading] = useState(!hasData);

	const [error, setError] = useState(null);

	const applyBundle = (bundle) => {
		setLocations(bundle.locations ?? []);
		setConfigs(bundle.configs ?? []);
		setPaidOptions(bundle.paidOptions ?? []);
		setPaidOptionLocations(bundle.paidOptionLocations ?? {});
		setCloudServers(bundle.cloudServers ?? []);

		if (bundle.profile) setProfile(bundle.profile);
	};

	const fetchBundle = async () => {
		const [configsRes, optionsRes, serversRes, locationsRes, profileRes] =
			await Promise.all([
				getConfigsApi(),
				getPaidOptionsApi(),
				getCloudServersApi(),
				getLocationsApi(),
				getProfileApi().catch(() => ({ data: { status: false } })),
			]);

		const paidOptions = optionsRes.data?.data ?? [];

		const serverOptionIds = [
			...new Set(
				paidOptions
					.filter((option) =>
						(option.configs ?? []).some((cfg) => cfg.id != null),
					)
					.map((option) => option.option_id),
			),
		];

		const paidOptionLocations = {};

		await Promise.all(
			serverOptionIds.map(async (optionId) => {
				try {
					const res = await getPaidOptionLocationsApi(optionId);

					paidOptionLocations[optionId] = res.data?.status
						? (res.data.data ?? [])
						: [];
				} catch {
					paidOptionLocations[optionId] = [];
				}
			}),
		);

		const serversData = serversRes.data?.data ?? [];

		const cloudServers = await Promise.all(
			serversData.map(async (server) => {
				try {
					const proxiesRes = await getCloudServerProxies(server.id);

					return { ...server, proxies: proxiesRes.data?.data ?? [] };
				} catch {
					return { ...server, proxies: [] };
				}
			}),
		);

		return {
			locations: locationsRes.data?.data ?? [],
			configs: configsRes.data?.data ?? [],
			paidOptions,
			paidOptionLocations,
			cloudServers,
			profile: profileRes.data?.status ? profileRes.data.data : null,
		};
	};

	const loadIdRef = useRef(0);

	const revalidate = async () => {
		const currentId = ++loadIdRef.current;

		try {
			setError(null);

			let bundle;

			try {
				bundle = await fetchBundle();
			} catch {
				await new Promise((resolve) => setTimeout(resolve, 1000));

				bundle = await fetchBundle();
			}

			if (loadIdRef.current !== currentId) return;

			applyBundle(bundle);

			await localStore().set({
				[STORAGE_KEYS.PROXY_LIST_CACHE]: bundle,
				[STORAGE_KEYS.PROXY_LIST_CACHE_TIME]: Date.now(),
			});
		} catch (err) {
			if (loadIdRef.current !== currentId) return;

			console.error("Failed to load resources:", err);
			setError(err.message ?? "Ошибка загрузки");
		} finally {
			if (loadIdRef.current === currentId) setLoading(false);
		}
	};

	const reload = () => {
		setLoading(true);

		return revalidate();
	};

	useEffect(() => {
		if (!isAuthenticated || hasData) return;

		let cancelled = false;

		(async () => {
			let cached = null;

			try {
				cached = await localStore().get([
					STORAGE_KEYS.PROXY_LIST_CACHE,
					STORAGE_KEYS.PROXY_LIST_CACHE_TIME,
				]);
			} catch {}

			if (cancelled) return;

			const bundle = cached?.[STORAGE_KEYS.PROXY_LIST_CACHE] ?? null;

			const cachedAt = cached?.[STORAGE_KEYS.PROXY_LIST_CACHE_TIME] ?? 0;

			if (bundle) {
				applyBundle(bundle);
				setLoading(false);

				if (Date.now() - cachedAt >= RESOURCE_REVALIDATE_MS) revalidate();
			} else {
				revalidate();
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [isAuthenticated]);

	return { loading, error, reload };
};

export default useLoadResources;
