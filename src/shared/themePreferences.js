import {
	normalizeAccentTheme,
	normalizeCustomAccentColor,
} from "./accentThemes.js";
import { STORAGE_KEYS } from "./constants.js";
import { normalizeInterfaceTheme } from "./interfaceThemes.js";

export const loadThemePreferences = async (storage) => {
	let values = {};

	try {
		values = await storage.local.get([
			STORAGE_KEYS.INTERFACE_THEME,
			STORAGE_KEYS.ACCENT_THEME,
			STORAGE_KEYS.CUSTOM_ACCENT_COLOR,
		]);
	} catch {}

	return {
		interfaceTheme: normalizeInterfaceTheme(
			values[STORAGE_KEYS.INTERFACE_THEME],
		),
		accentTheme: normalizeAccentTheme(values[STORAGE_KEYS.ACCENT_THEME]),
		customAccentColor: normalizeCustomAccentColor(
			values[STORAGE_KEYS.CUSTOM_ACCENT_COLOR],
		),
	};
};
