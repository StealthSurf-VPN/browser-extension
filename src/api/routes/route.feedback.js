import { NETWORK } from "../api.instance";

/**
 * Sends user feedback/idea to the admin chat.
 * @param {string} text - Feedback text (1-4000 characters).
 * @returns {Promise<import("axios").AxiosResponse>}
 */
export const sendFeedback = (text) => NETWORK.post("feedback", { text });
