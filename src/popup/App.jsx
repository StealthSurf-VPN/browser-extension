import { AppRoot, ConfigProvider } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import { SnackbarProvider } from "notistack";
import React, { useEffect, useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import ErrorBoundary from "./components/ErrorBoundary";
import MainPageSkeleton from "./components/MainPageSkeleton";
import useExtAuth from "./hooks/useExtAuth";
import useLoadResources from "./hooks/useLoadResources";
import AuthPage from "./pages/AuthPage";
import ConfigSelectPage from "./pages/ConfigSelectPage";
import FeedbackPage from "./pages/FeedbackPage";
import LocationSelectPage from "./pages/LocationSelectPage";
import MainPage from "./pages/MainPage";
import SettingsPage from "./pages/SettingsPage";
import SplitTunnelPage from "./pages/SplitTunnelPage";
import { getLocations, getPaidOptionLocationsMap } from "./state/selectors";
import "../assets/popup.css";

const detectPlatform = () => {
	const ua = navigator.userAgent;

	if (/iPad|iPhone|iPod/.test(ua) || /Macintosh|MacIntel/.test(ua))
		return "ios";

	return "android";
};

const App = () => {
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

	const [selectedConfig, setSelectedConfig] = useState(null);

	const [locationBackPage, setLocationBackPage] = useState("configSelect");

	const [popout, setPopout] = useState(null);

	const [theme, setTheme] = useState(
		window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light",
	);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");

		const handler = (e) => setTheme(e.matches ? "dark" : "light");

		mq.addEventListener("change", handler);

		return () => mq.removeEventListener("change", handler);
	}, []);

	const platform = useMemo(() => detectPlatform(), []);

	const handleOpenConfigSelect = () => setActivePage("configSelect");

	const handleOpenLocationSelect = (config, backTo = "configSelect") => {
		setSelectedConfig(config);
		setLocationBackPage(backTo);
		setActivePage("locationSelect");
	};

	const handleBack = () => {
		setActivePage("main");
		setSelectedConfig(null);
	};

	const handleLogout = () => {
		setPopout(null);
		logout();
		setActivePage("main");
	};

	const renderPage = () => {
		if (isLoading) return <MainPageSkeleton />;

		if (!isAuthenticated) return <AuthPage onLogin={openLogin} />;

		if (activePage === "configSelect") {
			return (
				<ConfigSelectPage
					locations={combinedLocations}
					loading={resourcesLoading}
					error={resourcesError}
					reload={reloadResources}
					onBack={handleBack}
				/>
			);
		}

		if (activePage === "locationSelect" && selectedConfig) {
			return (
				<LocationSelectPage
					config={selectedConfig}
					onBack={() => setActivePage(locationBackPage)}
				/>
			);
		}

		if (activePage === "splitTunnel") {
			return <SplitTunnelPage onBack={handleBack} />;
		}

		if (activePage === "settings") {
			return (
				<SettingsPage
					loading={resourcesLoading}
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
				onOpenConfigSelect={handleOpenConfigSelect}
				onOpenSettings={() => setActivePage("settings")}
				onOpenSplitTunnel={() => setActivePage("splitTunnel")}
				onOpenLocationSelect={(config) =>
					handleOpenLocationSelect(config, "main")
				}
				locations={combinedLocations}
				loading={resourcesLoading}
			/>
		);
	};

	return (
		<ConfigProvider appearance={theme} platform={platform}>
			<AppRoot>
				<ErrorBoundary>
					<SnackbarProvider
						maxSnack={3}
						anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
					>
						{renderPage()}
					</SnackbarProvider>
					{popout}
				</ErrorBoundary>
			</AppRoot>
		</ConfigProvider>
	);
};

export default App;
