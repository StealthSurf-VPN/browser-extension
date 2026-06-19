import { NETWORK } from "../api.instance";

/** @returns {Promise<import("axios").AxiosResponse>} List of user paid options with configs */
export const getPaidOptions = () => NETWORK.get("paid-options");

/**
 * @param {number} paidOptionId - Paid option ID (option_id)
 * @returns {Promise<import("axios").AxiosResponse>} Curated locations available for the paid option
 */
export const getPaidOptionLocations = (paidOptionId) =>
	NETWORK.get(`paid-options/${paidOptionId}/locations`);

/**
 * @param {number} paidOptionId - Paid option ID
 * @param {number} configId - Config ID within the paid option
 * @returns {Promise<import("axios").AxiosResponse>} proxy subconfig details
 */
export const getPaidOptionConfigSubconfig = (paidOptionId, configId) =>
	NETWORK.get(`paid-options/${paidOptionId}/configs/${configId}/subconfig`);

/**
 * @param {number} paidOptionId - Paid option ID
 * @param {number} configId - Config ID within the paid option
 * @param {{ protocol: string }} data - Subconfig parameters
 * @returns {Promise<import("axios").AxiosResponse>} Created subconfig with connection_url
 */
export const createPaidOptionConfigSubconfig = (paidOptionId, configId, data) =>
	NETWORK.post(
		`paid-options/${paidOptionId}/configs/${configId}/subconfig`,
		data,
	);

/**
 * @param {number} paidOptionId - Paid option ID
 * @param {number} configId - Config ID within the paid option
 * @returns {Promise<import("axios").AxiosResponse>} Deletion result
 */
export const deletePaidOptionConfigSubconfig = (paidOptionId, configId) =>
	NETWORK.delete(`paid-options/${paidOptionId}/configs/${configId}/subconfig`);

/**
 * @param {number} paidOptionId - Paid option ID
 * @param {number} configId - Config ID within the paid option
 * @param {{ location_id: string, protocol: string }} data - New settings
 * @returns {Promise<import("axios").AxiosResponse>} Updated config
 */
export const updatePaidOptionConfigSettings = (paidOptionId, configId, data) =>
	NETWORK.patch(
		`paid-options/${paidOptionId}/configs/${configId}/settings`,
		data,
	);
