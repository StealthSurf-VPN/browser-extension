import { AppRoot, ConfigProvider, Spinner } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import { SnackbarProvider } from "notistack";
import React, { useEffect, useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import ErrorBoundary from "./components/ErrorBoundary";
import useExtAuth from "./hooks/useExtAuth";
import useLoadResources from "./hooks/useLoadResources";
import AuthPage from "./pages/AuthPage";
import ConfigSelectPage from "./pages/ConfigSelectPage";
import LocationSelectPage from "./pages/LocationSelectPage";
import MainPage from "./pages/MainPage";
import SettingsPage from "./pages/SettingsPage";
import SplitTunnelPage from "./pages/SplitTunnelPage";
import { getLocations } from "./state/selectors";
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
	} = useLoadResources();

	const locations = useRecoilValue(getLocations);

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
		if (isLoading) {
			return (
				<div className="ext-loading">
					<Spinner size="large" />
				</div>
			);
		}

		if (!isAuthenticated) return <AuthPage onLogin={openLogin} />;

		if (activePage === "configSelect") {
			return (
				<ConfigSelectPage
					locations={locations}
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
				/>
			);
		}

		return (
			<MainPage
				onOpenConfigSelect={handleOpenConfigSelect}
				onOpenSettings={() => setActivePage("settings")}
				onOpenSplitTunnel={() => setActivePage("splitTunnel")}
				onOpenLocationSelect={(config) =>
					handleOpenLocationSelect(config, "main")
				}
				locations={locations}
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
