/**
 * Parse a proxy connection URL into credentials.
 * Uses the URL API to correctly handle passwords with special characters (: and @).
 * @param {string} connectionUrl - URL in format "protocol://user:pass@host:port"
 * @returns {{ host: string, port: string, user: string, pass: string }} Parsed credentials
 */
const parseConnectionUrl = (connectionUrl) => {
	if (!connectionUrl) {
		return {
			host: "",
			port: "",
			user: "",
			pass: "",
		};
	}

	try {
		const normalized = connectionUrl.includes("://")
			? connectionUrl
			: `http://${connectionUrl}`;

		const url = new URL(normalized);

		return {
			host: url.hostname || "",
			port: url.port || "",
			user: decodeURIComponent(url.username || ""),
			pass: decodeURIComponent(url.password || ""),
		};
	} catch {
		return {
			host: "",
			port: "",
			user: "",
			pass: "",
		};
	}
};

export default parseConnectionUrl;
