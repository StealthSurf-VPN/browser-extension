/**
 * Formats bytes into human-readable format.
 * @param {number} bytes - Number of bytes.
 * @param {number} decimals - Number of decimal places.
 * @returns {string} Formatted string (e.g., "1.5 ГБ").
 */
const formatBytes = (bytes, decimals = 2) => {
	if (!bytes || bytes === 0) return "0 Б";

	const k = 1024;

	const dm = decimals < 0 ? 0 : decimals;

	const sizes = ["Б", "КБ", "МБ", "ГБ", "ТБ"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	const value = Number.parseFloat((bytes / k ** i).toFixed(dm));

	return `${value} ${sizes[i]}`;
};

export default formatBytes;
