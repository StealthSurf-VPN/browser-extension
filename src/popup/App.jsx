import { AppRoot, ConfigProvider } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import { SnackbarProvider } from "notistack";
import React, { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRecoilValue } from "recoil";
import {
	getAccentThemeStyle,
	normalizeAccentTheme,
	normalizeCustomAccentColor,
} from "../shared/accentThemes";
import { STORAGE_KEYS } from "../shared/constants";
import { normalizeInterfaceTheme } from "../shared/interfaceThemes";
import ErrorBoundary from "./components/ErrorBoundary";
import GeminiAccent from "./components/GeminiAccent";
import MainPageSkeleton from "./components/MainPageSkeleton";
import useExtAuth from "./hooks/useExtAuth";
import useLoadResources from "./hooks/useLoadResources";
import AuthPage from "./pages/AuthPage";
import FeedbackPage from "./pages/FeedbackPage";
import MainPage from "./pages/MainPage";
import SettingsPage from "./pages/SettingsPage";
import SplitTunnelPage from "./pages/SplitTunnelPage";
import { getLocations, getPaidOptionLocationsMap } from "./state/selectors";
import "../assets/popup.css";

const storage = (globalThis.browser?.storage || chrome.storage).local;

const getSystemAppearance = () => {
	try {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	} catch {
		return "light";
	}
};

const detectPlatform = () => {
	const ua = navigator.userAgent;

	if (/iPad|iPhone|iPod/.test(ua) || /Macintosh|MacIntel/.test(ua))
		return "ios";

	return "android";
};

const App = ({ initialThemePreferences }) => {
	const { isAuthenticated, isLoading, logout, openLogin } = useExtAuth();

	const {
		loading: resourcesLoading,
		error: resourcesError,
		reload: reloadResources,
	} = useLoadResources(isAuthenticated);

	const locations = useRecoilValue(getLocations);

	const paidOptionLocations = useRecoilValue(getPaidOptionLocationsMap);

	const combinedLocations = useMemo(() => {
		const base = locations ?? [];

		if (!paidOptionLocations) return base;

		const seen = new Set(base.map((loc) => loc.id));

		const extra = [];

		for (const locs of Object.values(paidOptionLocations)) {
			for (const loc of locs ?? []) {
				if (seen.has(loc.id)) continue;

				seen.add(loc.id);
				extra.push(loc);
			}
		}

		return extra.length ? [...base, ...extra] : base;
	}, [locations, paidOptionLocations]);

	const [activePage, setActivePage] = useState("main");

	const [popout, setPopout] = useState(null);

	const [isScrolled, setIsScrolled] = useState(false);

	const [systemTheme, setSystemTheme] = useState(getSystemAppearance);

	const [interfaceTheme, setInterfaceTheme] = useState(
		initialThemePreferences.interfaceTheme,
	);

	const [accentTheme, setAccentTheme] = useState(
		initialThemePreferences.accentTheme,
	);

	const [customAccentColor, setCustomAccentColor] = useState(
		initialThemePreferences.customAccentColor,
	);

	const theme = interfaceTheme === "system" ? systemTheme : interfaceTheme;

	const accentStyle = useMemo(
		() => getAccentThemeStyle(accentTheme, theme, customAccentColor),
		[accentTheme, customAccentColor, theme],
	);

	const isGeminiAccent = accentTheme === "gemini";

	const isDefaultAccent = accentTheme === "stealthsurf";

	useEffect(() => {
		const root = document.documentElement;
		const rootStyle = root.style;
		const accentProperties = Object.keys(accentStyle ?? {});

		for (const property of accentProperties) {
			const value = accentStyle[property];

			rootStyle.setProperty(property, value);
		}

		root.classList.toggle("ext-app-accent--gemini", isGeminiAccent);

		return () => {
			for (const property of accentProperties)
				rootStyle.removeProperty(property);

			root.classList.remove("ext-app-accent--gemini");
		};
	}, [accentStyle, isGeminiAccent]);

	useEffect(() => {
		let mediaQuery;

		const handleChange = (event) =>
			setSystemTheme(event.matches ? "dark" : "light");

		try {
			mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			mediaQuery.addEventListener("change", handleChange);
		} catch {}

		return () => mediaQuery?.removeEventListener("change", handleChange);
	}, []);

	const platform = useMemo(() => detectPlatform(), []);

	const handleBack = () => {
		setActivePage("main");
	};

	const handleLogout = () => {
		setPopout(null);
		logout();
		setActivePage("main");
	};

	const handleInterfaceThemeChange = async (value) => {
		const nextTheme = normalizeInterfaceTheme(value);
		const applyTheme = () => setInterfaceTheme(nextTheme);
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		if (
			typeof document.startViewTransition === "function" &&
			!prefersReducedMotion
		)
			document.startViewTransition(() => flushSync(applyTheme));
		else applyTheme();

		await storage.set({ [STORAGE_KEYS.INTERFACE_THEME]: nextTheme });
	};

	const handleAccentThemeChange = async (value) => {
		const nextTheme = normalizeAccentTheme(value);

		setAccentTheme(nextTheme);
		await storage.set({ [STORAGE_KEYS.ACCENT_THEME]: nextTheme });
	};

	const handleCustomAccentColorChange = async (value) => {
		const nextColor = normalizeCustomAccentColor(value);

		setCustomAccentColor(nextColor);
		await storage.set({ [STORAGE_KEYS.CUSTOM_ACCENT_COLOR]: nextColor });
	};

	const renderPage = () => {
		if (isLoading) return <MainPageSkeleton />;

		if (!isAuthenticated) return <AuthPage onLogin={openLogin} />;

		if (activePage === "splitTunnel") {
			return <SplitTunnelPage onBack={handleBack} />;
		}

		if (activePage === "settings") {
			return (
				<SettingsPage
					loading={resourcesLoading}
					interfaceTheme={interfaceTheme}
					accentTheme={accentTheme}
					customAccentColor={customAccentColor}
					onInterfaceThemeChange={handleInterfaceThemeChange}
					onAccentThemeChange={handleAccentThemeChange}
					onCustomAccentColorChange={handleCustomAccentColorChange}
					onBack={handleBack}
					onLogout={handleLogout}
					setPopout={setPopout}
					onOpenFeedback={() => setActivePage("feedback")}
				/>
			);
		}

		if (activePage === "feedback") {
			return <FeedbackPage onBack={() => setActivePage("settings")} />;
		}

		return (
			<MainPage
				onOpenSettings={() => setActivePage("settings")}
				onOpenSplitTunnel={() => setActivePage("splitTunnel")}
				locations={combinedLocations}
				loading={resourcesLoading}
				error={resourcesError}
				reload={reloadResources}
			/>
		);
	};

	return (
		<ConfigProvider appearance={theme} platform={platform}>
			<AppRoot
				style={accentStyle}
				className={`ext-app-shell ${platform} theme-${theme}${isGeminiAccent ? " ext-app-accent--gemini" : ""}${isDefaultAccent ? " ext-app-accent--stealthsurf" : ""}${isScrolled ? " ext-app-shell--scrolled" : ""}`}
				onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 8)}
			>
				<GeminiAccent enabled={isGeminiAccent} />
				<div
					className="ext-app-shell__glow ext-app-shell__glow--left"
					aria-hidden="true"
				/>
				<div
					className="ext-app-shell__glow ext-app-shell__glow--right"
					aria-hidden="true"
				/>
				<div className="ext-app-shell__content">
					<ErrorBoundary>
						<SnackbarProvider
							maxSnack={3}
							anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
						>
							{renderPage()}
						</SnackbarProvider>
						{popout}
					</ErrorBoundary>
				</div>
			</AppRoot>
		</ConfigProvider>
	);
};

export default App;
