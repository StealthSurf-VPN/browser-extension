import { NETWORK } from "../api.instance";

/**
 * Sends user feedback/idea to the admin chat.
 * @param {string} text - Feedback text (1-4000 characters).
 * @param {File[]} files - Optional feedback attachments.
 * @returns {Promise<import("axios").AxiosResponse>}
 */
export const sendFeedback = (text, files = []) => {
	if (!files.length) return NETWORK.post("feedback", { text });

	const formData = new FormData();

	formData.append("text", text);

	for (const file of files) {
		formData.append("files", file);
	}

	return NETWORK.post("feedback", formData);
};
