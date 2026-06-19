import { selector } from "recoil";
import { extensionAtom, pingsAtom, proxyAtom, resourcesAtom } from "./atoms";

export const getIsAuthenticated = selector({
	key: "getIsAuthenticated",
	get: ({ get }) => get(extensionAtom).isAuthenticated,
	set: ({ set }, isAuthenticated) =>
		set(extensionAtom, (old) => ({ ...old, isAuthenticated })),
});

export const getIsLoading = selector({
	key: "getIsLoading",
	get: ({ get }) => get(extensionAtom).isLoading,
	set: ({ set }, isLoading) =>
		set(extensionAtom, (old) => ({ ...old, isLoading })),
});

export const getProxyState = selector({
	key: "getProxyState",
	get: ({ get }) => get(proxyAtom),
	set: ({ set }, value) => set(proxyAtom, value),
});

export const getConfigs = selector({
	key: "getConfigs",
	get: ({ get }) => get(resourcesAtom).configs,
	set: ({ set }, configs) => set(resourcesAtom, (old) => ({ ...old, configs })),
});

export const getPaidOptions = selector({
	key: "getPaidOptions",
	get: ({ get }) => get(resourcesAtom).paidOptions,
	set: ({ set }, paidOptions) =>
		set(resourcesAtom, (old) => ({ ...old, paidOptions })),
});

export const getPaidOptionLocationsMap = selector({
	key: "getPaidOptionLocationsMap",
	get: ({ get }) => get(resourcesAtom).paidOptionLocations,
	set: ({ set }, paidOptionLocations) =>
		set(resourcesAtom, (old) => ({ ...old, paidOptionLocations })),
});

export const getCloudServers = selector({
	key: "getCloudServers",
	get: ({ get }) => get(resourcesAtom).cloudServers,
	set: ({ set }, cloudServers) =>
		set(resourcesAtom, (old) => ({ ...old, cloudServers })),
});

export const getLocations = selector({
	key: "getLocations",
	get: ({ get }) => get(resourcesAtom).locations,
	set: ({ set }, locations) =>
		set(resourcesAtom, (old) => ({ ...old, locations })),
});

export const getProfileData = selector({
	key: "getProfileData",
	get: ({ get }) => get(resourcesAtom).profile,
	set: ({ set }, profile) => set(resourcesAtom, (old) => ({ ...old, profile })),
});

export const getPings = selector({
	key: "getPings",
	get: ({ get }) => get(pingsAtom),
	set: ({ set }, value) => set(pingsAtom, value),
});
