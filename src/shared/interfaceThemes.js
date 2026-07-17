const DEFAULT_INTERFACE_THEME = "system";

export const INTERFACE_THEMES = [
	{
		id: "system",
		title: "Системная",
	},
	{
		id: "light",
		title: "Светлая",
	},
	{
		id: "dark",
		title: "Темная",
	},
];

export const normalizeInterfaceTheme = (value) =>
	INTERFACE_THEMES.some((theme) => theme.id === value)
		? value
		: DEFAULT_INTERFACE_THEME;
