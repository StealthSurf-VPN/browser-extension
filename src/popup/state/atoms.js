import { atom } from "recoil";

export const extensionAtom = atom({
	key: "extensionState",
	default: {
		isAuthenticated: false,
		isLoading: true,
	},
});

export const proxyAtom = atom({
	key: "proxyState",
	default: {
		connected: false,
		credentials: null,
		connectedConfigId: null,
		connectedConfigTitle: null,
		connectedSource: null,
		connectedLocationId: null,
		selectedConfigId: null,
		selectedSource: null,
	},
});

export const resourcesAtom = atom({
	key: "resourcesState",
	default: {
		configs: null,
		paidOptions: null,
		paidOptionLocations: null,
		cloudServers: null,
		locations: null,
		profile: null,
	},
});

export const pingsAtom = atom({
	key: "pingsState",
	default: {},
});
