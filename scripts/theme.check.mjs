import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	ACCENT_THEMES,
	getAccentThemeStyle,
	normalizeAccentTheme,
	normalizeCustomAccentColor,
} from "../src/shared/accentThemes.js";
import {
	INTERFACE_THEMES,
	normalizeInterfaceTheme,
} from "../src/shared/interfaceThemes.js";
import { loadThemePreferences } from "../src/shared/themePreferences.js";

assert.deepEqual(
	INTERFACE_THEMES.map(({ id }) => id),
	["system", "light", "dark"],
);

assert.deepEqual(
	ACCENT_THEMES.map(({ id }) => id),
	[
		"stealthsurf",
		"stealthsurf-pink",
		"durev",
		"gemini",
		"hit",
		"quattro",
		"dyadya-vanya",
		"ars",
		"custom",
	],
);

assert.equal(normalizeInterfaceTheme("unknown"), "system");
assert.equal(normalizeAccentTheme("unknown"), "stealthsurf");
assert.equal(normalizeCustomAccentColor("7c3aed"), "#7C3AED");
assert.equal(
	getAccentThemeStyle("custom", "light", "#7C3AED")["--app-accent-glow-left"],
	"rgba(124, 58, 237, 0.16)",
);
assert.equal(
	getAccentThemeStyle("custom", "dark", "#7C3AED")["--app-accent-glow-left"],
	"rgba(124, 58, 237, 0.28)",
);
assert.equal(
	getAccentThemeStyle("dyadya-vanya", "light")["--app-accent-toggle-color"],
	"#c1a137",
);
assert.equal(
	getAccentThemeStyle("durev", "dark")["--app-accent-toggle-color"],
	"#4f71ba",
);

const preferences = await loadThemePreferences({
	local: {
		get: async () => ({
			interface_theme: "dark",
			accent_theme: "custom",
			custom_accent_color: "#123456",
		}),
	},
});

assert.deepEqual(preferences, {
	interfaceTheme: "dark",
	accentTheme: "custom",
	customAccentColor: "#123456",
});

const normalizedPreferences = await loadThemePreferences({
	local: {
		get: async () => ({
			interface_theme: "sepia",
			accent_theme: "neon",
			custom_accent_color: "invalid",
		}),
	},
});

assert.deepEqual(normalizedPreferences, {
	interfaceTheme: "system",
	accentTheme: "stealthsurf",
	customAccentColor: "#7C3AED",
});

const fallback = await loadThemePreferences({
	local: {
		get: async () => Promise.reject(new Error("unavailable")),
	},
});

assert.deepEqual(fallback, {
	interfaceTheme: "system",
	accentTheme: "stealthsurf",
	customAccentColor: "#7C3AED",
});

const main = await readFile(
	new URL("../src/popup/main.jsx", import.meta.url),
	"utf8",
);

const app = await readFile(
	new URL("../src/popup/App.jsx", import.meta.url),
	"utf8",
);

const settingsPage = await readFile(
	new URL("../src/popup/pages/SettingsPage.jsx", import.meta.url),
	"utf8",
);

const authPage = await readFile(
	new URL("../src/popup/pages/AuthPage.jsx", import.meta.url),
	"utf8",
);

const feedbackPage = await readFile(
	new URL("../src/popup/pages/FeedbackPage.jsx", import.meta.url),
	"utf8",
);

const mainPage = await readFile(
	new URL("../src/popup/pages/MainPage.jsx", import.meta.url),
	"utf8",
);

const mainPageSkeleton = await readFile(
	new URL("../src/popup/components/MainPageSkeleton.jsx", import.meta.url),
	"utf8",
);

const locationPicker = await readFile(
	new URL("../src/popup/components/LocationPicker.jsx", import.meta.url),
	"utf8",
).catch(() => "");

const loadResources = await readFile(
	new URL("../src/popup/hooks/useLoadResources.js", import.meta.url),
	"utf8",
);

const appearanceSettings = await readFile(
	new URL("../src/popup/components/AppearanceSettings.jsx", import.meta.url),
	"utf8",
);

const geminiAccent = await readFile(
	new URL("../src/popup/components/GeminiAccent.jsx", import.meta.url),
	"utf8",
);

const css = await readFile(
	new URL("../src/assets/popup.css", import.meta.url),
	"utf8",
);

const accentThemesSource = await readFile(
	new URL("../src/shared/accentThemes.js", import.meta.url),
	"utf8",
);

const componentPatterns = await readFile(
	new URL("../.ai/rules/component-patterns.md", import.meta.url),
	"utf8",
);

const extensionArchitecture = await readFile(
	new URL("../.ai/rules/extension-architecture.md", import.meta.url),
	"utf8",
);

const proxyConnection = await readFile(
	new URL("../.ai/rules/proxy-connection.md", import.meta.url),
	"utf8",
);

assert.match(main, /loadThemePreferences/);
assert.match(app, /startViewTransition/);
assert.match(app, /getAccentThemeStyle/);
assert.match(app, /ext-app-shell__glow--left/);
assert.match(app, /ext-app-shell__glow--right/);
assert.match(app, /scrollTop > 8/);
assert.match(app, /ext-app-shell--scrolled/);
assert.match(app, /const root = document\.documentElement/);
assert.match(app, /rootStyle\.setProperty\(property, value\)/);
assert.match(app, /classList\.toggle\("ext-app-accent--gemini"/);
assert.match(app, /const isDefaultAccent = accentTheme === "stealthsurf";/);
assert.match(app, /isDefaultAccent \? " ext-app-accent--stealthsurf" : ""/);
assert.doesNotMatch(
	accentThemesSource,
	/getChatWidgetAccentStyle|--app-chat-widget-/,
);
assert.match(settingsPage, /<AppearanceSettings/);
assert.doesNotMatch(appearanceSettings, /\bnoMaxHeight\b/);
assert.match(settingsPage, /className="settings-logout-button"/);
assert.ok(
	settingsPage.indexOf("Синхронизация") <
		settingsPage.indexOf("<AppearanceSettings"),
);
assert.ok(
	settingsPage.indexOf("<AppearanceSettings") <
		settingsPage.indexOf("Полезные ссылки"),
);
assert.match(authPage, /className="ext-auth-card"/);
assert.match(authPage, /\n\s+noPadding\n/);
assert.match(authPage, /className="ext-auth-card__login"/);
assert.equal(authPage.match(/onClick=\{onLogin\}/g)?.length, 1);
assert.match(authPage, /terms-of-use\.pdf/);
assert.match(authPage, /privacy-policy\.pdf/);
assert.match(feedbackPage, /const addFiles =/);
assert.match(feedbackPage, /const handlePaste =/);
assert.match(feedbackPage, /clipboardData\.files/);
assert.match(feedbackPage, /e\.preventDefault\(\)/);
assert.match(feedbackPage, /onPaste=\{handlePaste\}/);
assert.match(feedbackPage, /выбрать или вставить из буфера/);
assert.match(mainPage, /aria-expanded=\{isConfigListOpen\}/);
assert.match(mainPage, /STORAGE_KEYS\.SELECTED_CONFIG/);
assert.match(mainPage, /className="ext-config-list"/);
assert.match(mainPage, /setIsConfigListOpen\(false\)/);
assert.doesNotMatch(mainPage, /isConfigListOpen && \(/);
assert.match(mainPage, /aria-hidden=\{!isConfigListOpen\}/);
assert.match(mainPage, /inert=\{isConfigListOpen \? undefined : ""\}/);
assert.match(
	mainPage,
	/onClick=\{\(\) => void reload\(\)\.catch\(\(\) => \{\}\)\}/,
);
assert.doesNotMatch(app, /ConfigSelectPage/);
assert.doesNotMatch(app, /configSelect/);
assert.doesNotMatch(app, /LocationSelectPage|locationSelect|selectedConfig/);
assert.doesNotMatch(
	`${componentPatterns}\n${extensionArchitecture}\n${proxyConnection}`,
	/ConfigSelectPage|LocationSelectPage|configSelect|locationSelect/,
);
assert.match(mainPage, /<LocationPicker/);
assert.match(mainPage, /aria-expanded=\{isLocationPickerOpen\}/);
assert.match(mainPage, /setIsLocationPickerOpen\(false\)/);
assert.match(locationPicker, /className="ext-location-picker__select"/);
assert.match(locationPicker, /className="ext-location-picker__submit"/);
assert.match(locationPicker, /if \(!selectedLocationId \|\| saving\) return;/);
assert.match(locationPicker, /disabled=\{!selectedLocationId \|\| saving\}/);
assert.match(
	locationPicker,
	/\{hasLocationChanged \? "Изменить" : "Сменить сервер"\}/,
);
assert.match(locationPicker, /const wasConnected =/);
assert.match(locationPicker, /if \(wasConnected\) await disconnect\(\)/);
assert.match(locationPicker, /if \(wasConnected\) \{/);
assert.match(locationPicker, /await connect\(updatedConfig\)/);
assert.match(locationPicker, /return true;[\s\S]*return false;/);
assert.match(
	locationPicker,
	/didDisconnect && !\(await restoreConnection\(\)\)/,
);
assert.match(locationPicker, /CONNECTION_RESTORE_ERROR/);
assert.match(
	loadResources,
	/setError\(err\.message \?\? "Ошибка загрузки"\);\s*throw err;/,
);
assert.equal(
	loadResources.match(/void revalidate\(\)\.catch\(\(\) => \{\}\);/g)?.length,
	2,
);
assert.doesNotMatch(
	locationPicker,
	/Checkbox|isDisconnected|Сейчас я не использую/,
);
assert.match(appearanceSettings, /role="radiogroup"/);
assert.match(appearanceSettings, /appearance-theme-select/);
assert.match(appearanceSettings, /popupDirection="top"/);
assert.match(geminiAccent, /MutationObserver/);
assert.match(geminiAccent, /app-gemini-icon-gradient/);
assert.match(
	geminiAccent,
	/\.ext-app-shell \.vkuiButton--mode-secondary\.vkuiButton--appearance-accent \.vkuiIcon use/,
);
assert.doesNotMatch(
	geminiAccent,
	/\.ext-app-shell \.vkuiButton--appearance-accent \.vkuiIcon use/,
);
assert.match(geminiAccent, /\.ext-app-shell \.ext-app-accent-icon use/);
assert.equal(mainPage.match(/ext-app-accent-icon/g)?.length, 5);
assert.equal(mainPageSkeleton.match(/ext-app-accent-icon/g)?.length, 1);
assert.match(css, /\.ext-app-shell::after/);
assert.match(css, /\.ext-app-shell \{[^}]*overflow-x: clip;/);
assert.match(css, /\.ext-app-shell \{[^}]*overflow-y: auto;/);
assert.match(css, /min-height: 600px;/);
assert.doesNotMatch(css, /min-height: 520px;/);
assert.match(componentPatterns, /\*\*Desktop:\*\* fixed `380×600`/);
assert.doesNotMatch(componentPatterns, /380×520|520–600/);
assert.doesNotMatch(css, /-(?:webkit|moz)-font-smoothing/);
assert.match(css, /\.ext-app-shell--scrolled \.vkuiPanelHeader__fixed/);
assert.match(css, /backdrop-filter: blur\(16px\)/);
assert.match(
	css,
	/\.ext-app-shell:not\(\.theme-dark\) \.settings-logout-button \{[^}]*background: var\(--app-console-surface\) !important;[^}]*box-shadow:/,
);
assert.match(css, /\.ext-app-shell__glow--left/);
assert.match(css, /\.ext-app-accent--gemini/);
assert.match(
	css,
	/\.ext-app-accent--gemini\s+\.vkuiButton--mode-secondary\.vkuiButton--appearance-accent\s+\.vkuiIcon/,
);
assert.doesNotMatch(
	css,
	/\.ext-app-accent--gemini\s+\.vkuiButton--appearance-accent\s+\.vkuiIcon/,
);
assert.match(css, /\.ext-app-accent--gemini \.ext-app-accent-icon/);
assert.match(css, /\.interface-theme-grid/);
assert.match(
	css,
	/\.ext-config-list \{[^}]*max-height: 0;[^}]*max-height 0\.32s/s,
);
assert.match(
	css,
	/\.ext-bottom-card--open \.ext-config-list \{[^}]*max-height: 165px;/s,
);
assert.match(
	css,
	/\.ext-location-picker \{[^}]*max-height: 0;[^}]*max-height 0\.32s/s,
);
assert.match(css, /\.ext-location-trigger \{[^}]*font-weight: 500;/);
assert.match(css, /\.ext-location-trigger > span \{[^}]*font-size: 14px;/);
assert.match(
	css,
	/\.ext-bottom-card--location-open \.ext-location-picker \{[^}]*max-height: 140px;/s,
);
assert.match(css, /\.ext-auth-card/);
assert.match(
	css,
	/\.ext-app-shell:not\(\.theme-dark\)\s+\.ext-feedback-page__form-item\s+\.vkuiFormField\s*\{[^}]*background: var\(--app-console-surface\) !important;/,
);
assert.match(css, /\.appearance-custom-accent__swatch/);
assert.match(
	css,
	/\.interface-theme-option:focus-within\s*\{[^}]*outline: 2px solid/s,
);
assert.doesNotMatch(css, /\.interface-theme-option:has\(/);
assert.match(
	css,
	/\.vkuiCustomSelectDropdown:has\(\.appearance-theme-dropdown-content\)\s+\.vkuiCustomScrollView\s*\{[^}]*max-height: min\(270px, calc\(100vh - 250px\)\)/s,
);
assert.doesNotMatch(
	css,
	/\.appearance-theme-dropdown-content\s*\{[^}]*overflow-y:/s,
);
assert.match(
	css,
	/\.ext-toggle--active \{[^}]*background: var\(--app-accent-color-alpha[^}]*border-color: currentColor[^}]*color: var\(--app-accent-toggle-color/is,
);
assert.doesNotMatch(css, /color-mix\(/i);
assert.match(
	css,
	/\.ext-toggle--active:hover \{[^}]*--app-accent-color-alpha-hover[^}]*border-color: currentColor/is,
);
assert.doesNotMatch(
	css,
	/\.ext-toggle--active \{[^}]*background: var\(--app-accent-gradient/is,
);
assert.match(
	css,
	/\.ext-toggle-status__label--active \{[^}]*--app-accent-text-color/is,
);
assert.match(
	css,
	/\.ext-app-accent--stealthsurf \.ext-toggle--active \{[^}]*rgba\(76, 175, 80, 0\.12\)[^}]*#4caf50/is,
);
assert.match(
	css,
	/\.ext-app-accent--stealthsurf \.ext-toggle-status__label--active \{[^}]*#4caf50/is,
);
assert.match(
	css,
	/\.ext-app-accent--gemini \.ext-toggle--active \{[^}]*padding-box[^}]*--app-accent-gradient[^}]*border-box/is,
);
assert.match(
	css,
	/\.ext-app-accent--gemini \.ext-toggle--active svg path,[\s\S]*stroke: url\("#app-gemini-icon-gradient"\) #4285f4;/i,
);
assert.match(css, /@keyframes ext-pulse-glow[\s\S]*rgba\(76, 175, 80, 0\.2\)/i);
assert.match(
	css,
	/\.ext-ip-badge \{[^}]*background: var\(--app-console-surface\);[^}]*box-shadow:[^}]*var\(--app-console-border\)/s,
);
assert.match(
	css,
	/\.ext-ip-badge--clickable:hover \{[^}]*var\(--app-console-surface-muted\)/s,
);
assert.doesNotMatch(css, /ext-location-page__checkbox/);
assert.match(css, /\.ext-location-picker__submit:disabled/);
assert.match(css, /\.vkuiCustomSelectDropdown/);
assert.match(
	css,
	/\.vkuiCustomSelectDropdown \.vkuiCustomSelectOption__selectedIcon \{[^}]*--app-accent-text-color/is,
);
assert.match(css, /\.vkuiCheckbox__input:checked/);
assert.match(css, /prefers-reduced-motion: reduce/);
