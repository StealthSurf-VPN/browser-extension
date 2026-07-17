const DEFAULT_ACCENT_THEME = "stealthsurf";
export const CUSTOM_ACCENT_THEME = "custom";
const DEFAULT_CUSTOM_ACCENT_COLOR = "#7C3AED";

const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;

const GEMINI_ACCENT_GRADIENT =
	"radial-gradient(circle at 6% 52%, #FBBC04 0%, rgba(251, 188, 4, 0.92) 18%, rgba(251, 188, 4, 0) 44%), radial-gradient(circle at 42% 82%, #34A853 0%, rgba(52, 168, 83, 0.9) 28%, rgba(52, 168, 83, 0) 58%), radial-gradient(circle at 82% 52%, #4285F4 0%, rgba(66, 133, 244, 0.95) 38%, rgba(66, 133, 244, 0) 74%), radial-gradient(circle at 50% 0%, #EA4335 0%, rgba(234, 67, 53, 0.9) 26%, rgba(234, 67, 53, 0) 58%), linear-gradient(135deg, #EA4335 0%, #FBBC04 24%, #34A853 46%, #4285F4 74%, #8AB4F8 100%)";

const ACCENT_THEME_ALIASES = {
	catppuccin: "durev",
	github: "gemini",
	notion: "quattro",
	one: "dyadya-vanya",
};

export const ACCENT_THEMES = [
	{
		id: DEFAULT_ACCENT_THEME,
		title: "StealthSurf",
		color: "#2688EB",
		previewBackground: "#FFFFFF",
		contrast: "#FFFFFF",
	},
	{
		id: "stealthsurf-pink",
		title: "StealthSurf Pink",
		color: "#BB35A0",
		previewBackground: "#FFF0FA",
		contrast: "#FFFFFF",
	},
	{
		id: "durev",
		title: "Durev",
		color: "#1D49A7",
		previewBackground: "#F1F1FF",
		contrast: "#FFFFFF",
	},
	{
		id: "gemini",
		title: "Gemini",
		color: "#FBBC04",
		gradient: GEMINI_ACCENT_GRADIENT,
		previewBackground: "#FFFFFF",
		contrast: "#FFFFFF",
		previewKind: "gemini",
	},
	{
		id: "hit",
		title: "hit",
		color: "#000000",
		previewBackground: "#FFFFFF",
		contrast: "#FFFFFF",
		appearance: {
			light: {
				color: "#000000",
				contrast: "#FFFFFF",
			},
			dark: {
				color: "#FFFFFF",
				contrast: "#000000",
			},
		},
	},
	{
		id: "quattro",
		title: "Quattro",
		color: "#F10200",
		previewBackground: "#FFFFFF",
		contrast: "#FFFFFF",
	},
	{
		id: "dyadya-vanya",
		title: "Dyadya Vanya",
		color: "#F7CF46",
		previewBackground: "#FFF8DD",
		contrast: "#221A00",
	},
	{
		id: "ars",
		title: "ARS",
		color: "#C5D95E",
		previewBackground: "#F7FBE8",
		contrast: "#192105",
		appearance: {
			light: {
				textColor: "#74870F",
			},
		},
	},
	{
		id: CUSTOM_ACCENT_THEME,
		title: "Свой цвет",
		color: DEFAULT_CUSTOM_ACCENT_COLOR,
		previewBackground: "#F5F0FF",
		contrast: "#FFFFFF",
	},
];

const hexToRgb = (hex) => {
	const normalized = hex.replace("#", "");
	const value = Number.parseInt(normalized, 16);

	return {
		r: (value >> 16) & 255,
		g: (value >> 8) & 255,
		b: value & 255,
	};
};

const toHexPart = (value) =>
	Math.max(0, Math.min(255, Math.round(value)))
		.toString(16)
		.padStart(2, "0");

const rgbToHex = ({ r, g, b }) =>
	`#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;

const mixHex = (hex, targetHex, amount) => {
	const color = hexToRgb(hex);
	const target = hexToRgb(targetHex);

	return rgbToHex({
		r: color.r + (target.r - color.r) * amount,
		g: color.g + (target.g - color.g) * amount,
		b: color.b + (target.b - color.b) * amount,
	});
};

const alpha = (hex, opacity) => {
	const { r, g, b } = hexToRgb(hex);

	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const isHexAccentColor = (value) => HEX_COLOR_RE.test(value ?? "");

export const normalizeCustomAccentColor = (value) => {
	if (!isHexAccentColor(value)) return DEFAULT_CUSTOM_ACCENT_COLOR;

	const normalized = String(value).replace("#", "").toUpperCase();

	return `#${normalized}`;
};

export const normalizeCustomAccentInput = (value) => {
	const hex = String(value ?? "")
		.trim()
		.replace(/^#/, "")
		.replace(/[^0-9a-fA-F]/g, "")
		.slice(0, 6)
		.toUpperCase();

	return `#${hex}`;
};

const getContrastColor = (hex) => {
	const { r, g, b } = hexToRgb(hex);
	const toLinear = (value) => {
		const channel = value / 255;

		return channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	};
	const luminance =
		0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

	return luminance > 0.42 ? "#111111" : "#FFFFFF";
};

const buildCustomAccentTheme = (customColor) => {
	const color = normalizeCustomAccentColor(customColor);

	return {
		id: CUSTOM_ACCENT_THEME,
		title: "Свой цвет",
		color,
		previewBackground: mixHex(color, "#FFFFFF", 0.86),
		contrast: getContrastColor(color),
	};
};

export const normalizeAccentTheme = (value) =>
	ACCENT_THEMES.some((theme) => theme.id === value)
		? value
		: (ACCENT_THEME_ALIASES[value] ?? DEFAULT_ACCENT_THEME);

export const getAccentTheme = (value, customColor) => {
	const normalized = normalizeAccentTheme(value);

	if (normalized === CUSTOM_ACCENT_THEME)
		return buildCustomAccentTheme(customColor);

	return ACCENT_THEMES.find((theme) => theme.id === normalized);
};

const resolveThemeAppearance = (theme, appearance) => ({
	...theme,
	...(theme.appearance?.[appearance === "dark" ? "dark" : "light"] ?? {}),
});

export const getAccentThemeStyle = (value, appearance, customColor) => {
	const theme = getAccentTheme(value, customColor);

	if (!theme || theme.id === DEFAULT_ACCENT_THEME) return undefined;

	const appearanceTheme = resolveThemeAppearance(theme, appearance);
	const color = appearanceTheme.color;
	const hover = appearanceTheme.hover ?? mixHex(color, "#000000", 0.06);
	const active = appearanceTheme.active ?? mixHex(color, "#000000", 0.12);
	const textColor = appearanceTheme.textColor ?? color;
	const textHover =
		appearanceTheme.textHover ?? mixHex(textColor, "#000000", 0.06);
	const textActive =
		appearanceTheme.textActive ?? mixHex(textColor, "#000000", 0.12);
	const toggleColor =
		appearanceTheme.toggleColor ??
		mixHex(textColor, appearance === "dark" ? "#FFFFFF" : "#000000", 0.22);

	return {
		"--app-accent-color": color,
		"--app-accent-color-hover": hover,
		"--app-accent-color-active": active,
		"--app-accent-text-color": textColor,
		"--app-accent-text-color-hover": textHover,
		"--app-accent-text-color-active": textActive,
		"--app-accent-toggle-color": toggleColor,
		"--app-accent-color-alpha": alpha(color, 0.16),
		"--app-accent-color-alpha-hover": alpha(color, 0.22),
		"--app-accent-color-alpha-active": alpha(color, 0.28),
		"--app-accent-gradient": appearanceTheme.gradient ?? color,
		"--app-accent-contrast": appearanceTheme.contrast,
		"--app-accent-glow-left": alpha(color, appearance === "dark" ? 0.28 : 0.16),
		"--app-accent-glow-right": alpha(
			color,
			appearance === "dark" ? 0.22 : 0.12,
		),
		"--app-accent-shadow": alpha(color, 0.08),
		"--app-accent-bg-top": mixHex(color, "#FFFFFF", 0.97),
		"--app-accent-bg-mid": mixHex(color, "#FFFFFF", 0.925),
		"--app-accent-bg-bottom": mixHex(color, "#FFFFFF", 0.885),
		"--app-accent-bg-grid": alpha(mixHex(color, "#000000", 0.55), 0.1),
		"--app-accent-bg-header": alpha(mixHex(color, "#FFFFFF", 0.97), 0.72),
		"--vkui--color_text_link": "var(--app-accent-text-color)",
		"--vkui--color_text_link--hover": "var(--app-accent-text-color-hover)",
		"--vkui--color_text_link--active": "var(--app-accent-text-color-active)",
		"--vkui--color_text_link_themed": "var(--app-accent-text-color)",
		"--vkui--color_text_link_themed--hover":
			"var(--app-accent-text-color-hover)",
		"--vkui--color_text_link_themed--active":
			"var(--app-accent-text-color-active)",
		"--vkui--color_text_accent": "var(--app-accent-text-color)",
		"--vkui--color_text_accent--hover": "var(--app-accent-text-color-hover)",
		"--vkui--color_text_accent--active": "var(--app-accent-text-color-active)",
		"--vkui--color_text_accent_themed": "var(--app-accent-text-color)",
		"--vkui--color_text_accent_themed--hover":
			"var(--app-accent-text-color-hover)",
		"--vkui--color_text_accent_themed--active":
			"var(--app-accent-text-color-active)",
		"--vkui--color_icon_accent": "var(--app-accent-text-color)",
		"--vkui--color_icon_accent--hover": "var(--app-accent-text-color-hover)",
		"--vkui--color_icon_accent--active": "var(--app-accent-text-color-active)",
		"--vkui--color_icon_accent_themed": "var(--app-accent-text-color)",
		"--vkui--color_icon_accent_themed--hover":
			"var(--app-accent-text-color-hover)",
		"--vkui--color_icon_accent_themed--active":
			"var(--app-accent-text-color-active)",
		"--vkui--color_stroke_accent": "var(--app-accent-text-color)",
		"--vkui--color_stroke_accent--hover": "var(--app-accent-text-color-hover)",
		"--vkui--color_stroke_accent--active":
			"var(--app-accent-text-color-active)",
		"--vkui--color_stroke_accent_themed": "var(--app-accent-text-color)",
		"--vkui--color_stroke_accent_themed--hover":
			"var(--app-accent-text-color-hover)",
		"--vkui--color_stroke_accent_themed--active":
			"var(--app-accent-text-color-active)",
		"--vkui--color_background_accent": "var(--app-accent-color)",
		"--vkui--color_background_accent--hover": "var(--app-accent-color-hover)",
		"--vkui--color_background_accent--active": "var(--app-accent-color-active)",
		"--vkui--color_background_accent_alternative": "var(--app-accent-color)",
		"--vkui--color_background_accent_alternative--hover":
			"var(--app-accent-color-hover)",
		"--vkui--color_background_accent_alternative--active":
			"var(--app-accent-color-active)",
		"--vkui--color_background_accent_themed": "var(--app-accent-color)",
		"--vkui--color_background_accent_themed--hover":
			"var(--app-accent-color-hover)",
		"--vkui--color_background_accent_themed--active":
			"var(--app-accent-color-active)",
		"--vkui--color_background_accent_themed_alpha":
			"var(--app-accent-color-alpha)",
		"--vkui--color_background_accent_themed_alpha--hover":
			"var(--app-accent-color-alpha-hover)",
		"--vkui--color_background_accent_themed_alpha--active":
			"var(--app-accent-color-alpha-active)",
		"--vkui--color_background_accent_tint": "var(--app-accent-color-alpha)",
		"--vkui--color_background_accent_tint--hover":
			"var(--app-accent-color-alpha-hover)",
		"--vkui--color_background_accent_tint--active":
			"var(--app-accent-color-alpha-active)",
		"--vkui--color_text_contrast_themed": "var(--app-accent-contrast)",
	};
};
