import { NETWORK } from "../api.instance";

export const getSplitTunnelSettings = () =>
	NETWORK.get("profile/extension/split-tunnel");

export const updateSplitTunnelSettings = (body) =>
	NETWORK.put("profile/extension/split-tunnel", body);
