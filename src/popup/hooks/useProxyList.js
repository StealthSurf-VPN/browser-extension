import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import {
	DEFAULT_GAMING_LOCATION_ID,
	PAID_OPTION_FALLBACK_TITLES,
	PAID_OPTION_LOCATION_EXCLUDED_IDS,
} from "../../shared/constants";
import {
	getCloudServers,
	getConfigs,
	getLocations,
	getPaidOptionLocationsMap,
	getPaidOptions,
} from "../state/selectors";

/**
 * @typedef {object} NormalizedProxyItem
 * @property {number} id - Config/proxy ID
 * @property {string|null} title - Config title (null if unnamed)
 * @property {"config"|"paid_option"|"cloud"} source - Data source
 * @property {number} locationId - Virtual/smart location ID
 * @property {number} locationRealId - Physical server location ID (for ping)
 * @property {string} locationTitle - Location display name
 * @property {string|null} locationCode - ISO country code
 * @property {string} protocol - Connection protocol
 * @property {boolean} hasProxy - Whether proxy subconfig exists
 * @property {string|null} proxyUrl - Connection URL or null
 * @property {number} expiresAt - Expiration Unix timestamp (seconds)
 * @property {boolean} isOnline - Server online status
 * @property {boolean} canChangeLocation - Whether location can be changed
 * @property {number} [optionId] - Paid option ID
 * @property {number} [serverId] - Cloud server ID
 */

/**
 * Hook that normalizes configs, paid options, and cloud servers into a flat proxy list.
 * Uses memoization and a location lookup Map for O(1) access.
 * @returns {{ allItems: NormalizedProxyItem[], configItems: NormalizedProxyItem[], paidOptionItems: NormalizedProxyItem[], cloudItems: NormalizedProxyItem[], locations: object[] }}
 */
const useProxyList = () => {
	const configs = useRecoilValue(getConfigs);

	const paidOptions = useRecoilValue(getPaidOptions);

	const paidOptionLocations = useRecoilValue(getPaidOptionLocationsMap);

	const cloudServers = useRecoilValue(getCloudServers);

	const locations = useRecoilValue(getLocations);

	const locationMap = useMemo(() => {
		const map = new Map();

		if (locations) {
			for (const loc of locations) map.set(Number(loc.id), loc);
		}

		return map;
	}, [locations]);

	const getLocationTitle = (locationId) =>
		locationMap.get(Number(locationId))?.title ?? "";

	const getLocationCode = (locationId) =>
		locationMap.get(Number(locationId))?.code ?? null;

	const paidLocationMaps = useMemo(() => {
		const byOption = new Map();

		if (paidOptionLocations) {
			for (const [optionId, locs] of Object.entries(paidOptionLocations)) {
				const map = new Map();

				for (const loc of locs ?? []) map.set(Number(loc.id), loc);

				byOption.set(Number(optionId), map);
			}
		}

		return byOption;
	}, [paidOptionLocations]);

	const normalizedConfigs = useMemo(() => {
		if (!configs) return [];

		return configs.map((config) => ({
			id: config.id,
			title: config.title ?? null,
			source: "config",
			locationId: config.location_id,
			locationRealId: config.location_real_id ?? config.location_id,
			locationTitle: getLocationTitle(config.location_id),
			locationCode: getLocationCode(config.location_id),
			protocol: config.protocol,
			hasProxy: !!config.subconfig,
			proxyUrl: config.subconfig?.connection_url ?? null,
			expiresAt: config.expires_at,
			isOnline: config.is_online,
			canChangeLocation: true,
		}));
	}, [configs, locationMap]);

	const normalizedPaidOptions = useMemo(() => {
		if (!paidOptions) return [];

		const items = [];

		for (const option of paidOptions) {
			if (!option.configs) continue;

			for (const config of option.configs) {
				if (!config.id) continue;

				const locationId =
					config.location_id ??
					option.location_id ??
					DEFAULT_GAMING_LOCATION_ID;

				const fallbackTitle =
					PAID_OPTION_FALLBACK_TITLES[option.option_id] ?? null;

				const paidLoc = paidLocationMaps
					.get(Number(option.option_id))
					?.get(Number(locationId));

				items.push({
					id: config.id,
					title: config.title ?? option.title ?? fallbackTitle,
					source: "paid_option",
					locationId,
					locationRealId: config.location_real_id ?? locationId,
					locationTitle: paidLoc?.title ?? getLocationTitle(locationId),
					locationCode: paidLoc?.code ?? getLocationCode(locationId),
					protocol: config.protocol,
					hasProxy: !!config.subconfig,
					proxyUrl: config.subconfig?.connection_url ?? null,
					optionId: option.option_id,
					expiresAt: option.expires_at,
					isOnline: config.is_online,
					canChangeLocation: !PAID_OPTION_LOCATION_EXCLUDED_IDS.has(
						option.option_id,
					),
				});
			}
		}

		return items;
	}, [paidOptions, locationMap, paidLocationMaps]);

	const normalizedCloudServers = useMemo(() => {
		if (!cloudServers) return [];

		const items = [];

		for (const server of cloudServers) {
			if (!server.proxies) continue;

			for (const proxy of server.proxies) {
				items.push({
					id: proxy.id,
					title: proxy.title ?? null,
					source: "cloud",
					locationId: server.location_id,
					locationRealId: server.location_id,
					locationTitle: getLocationTitle(server.location_id),
					locationCode: getLocationCode(server.location_id),
					protocol: proxy.protocol || "http",
					hasProxy: true,
					proxyUrl: proxy.connection_url,
					serverId: server.id,
					expiresAt: server.expires_at,
					isOnline: server.is_online,
					canChangeLocation: false,
				});
			}
		}

		return items;
	}, [cloudServers, locationMap]);

	const allItems = useMemo(
		() => [
			...normalizedConfigs,
			...normalizedPaidOptions,
			...normalizedCloudServers,
		],
		[normalizedConfigs, normalizedPaidOptions, normalizedCloudServers],
	);

	return {
		allItems,
		configItems: normalizedConfigs,
		paidOptionItems: normalizedPaidOptions,
		cloudItems: normalizedCloudServers,
		locations,
	};
};

export default useProxyList;
