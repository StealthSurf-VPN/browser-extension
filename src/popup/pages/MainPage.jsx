import {
	Icon20ChevronUp,
	Icon24DownloadOutline,
	Icon24GearOutline,
	Icon24ShuffleOutline,
	Icon28GlobeOutline,
} from "@vkontakte/icons";
import { IconButton, Separator, Skeleton, Spinner } from "@vkontakte/vkui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRecoilState, useSetRecoilState } from "recoil";
import {
	MSG,
	STORAGE_KEYS,
	sendMessage,
	toBadgeCode,
} from "../../shared/constants";
import CountryFlag from "../../shared/countryFlag.jsx";
import getPingLabel from "../../shared/getPingLabel";
import localizeDate from "../../shared/localizeDate";
import { measureBest } from "../../shared/ping";
import { checkForUpdate } from "../../shared/updateChecker";
import LocationPicker from "../components/LocationPicker";
import useProxyConnection from "../hooks/useProxyConnection";
import useSnackbarHandler from "../hooks/useSnackbarHandler";
import useProxyList from "../hooks/useProxyList";
import { getPings, getProxyState } from "../state/selectors";

const storage = (globalThis.browser?.storage || chrome.storage).local;

const PowerIcon = ({ size = 48 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		role="img"
		aria-label="Power"
	>
		<title>Power</title>
		<path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
		<line x1="12" y1="2" x2="12" y2="12" />
	</svg>
);

const ipServices = [
	{
		url: "https://ipapi.co/json/",
		parse: (d) => ({ ip: d.ip, countryCode: d.country_code }),
	},
	{
		url: "https://ipinfo.io/json",
		parse: (d) => ({ ip: d.ip, countryCode: d.country }),
	},
	{
		url: "https://api.ip.sb/geoip",
		parse: (d) => ({ ip: d.ip, countryCode: d.country_code }),
	},
];

const fetchExternalIp = async (signal) => {
	for (const svc of ipServices) {
		try {
			const timeoutSignal = AbortSignal.timeout(5000);
			const combinedSignal = signal
				? AbortSignal.any([signal, timeoutSignal])
				: timeoutSignal;

			const res = await fetch(svc.url, {
				cache: "no-store",
				signal: combinedSignal,
			});

			if (!res.ok) continue;

			const data = await res.json();

			const result = svc.parse(data);

			if (result.ip && /^[\d.:a-f]+$/i.test(result.ip)) return result;
		} catch (err) {
			if (err.name === "AbortError") return null;
		}
	}

	return null;
};

const MainPage = ({
	onOpenSettings,
	onOpenSplitTunnel,
	locations,
	loading,
	error,
	reload,
}) => {
	const { allItems } = useProxyList();

	const { proxyState, connect, disconnect, restoreStatus } =
		useProxyConnection();

	const showSnackbar = useSnackbarHandler();

	const [pings, setPings] = useRecoilState(getPings);

	const setProxyState = useSetRecoilState(getProxyState);

	const [isToggling, setIsToggling] = useState(false);

	const [isConfigListOpen, setIsConfigListOpen] = useState(false);

	const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

	const [externalIp, setExternalIp] = useState(null);

	const [loadingIp, setLoadingIp] = useState(false);

	const [ipFailed, setIpFailed] = useState(false);

	const [updateInfo, setUpdateInfo] = useState(null);

	const ipAbortRef = useRef(null);

	const pingInFlightRef = useRef(new Set());

	useEffect(() => {
		checkForUpdate().then((info) => {
			if (info) setUpdateInfo(info);
		});
	}, []);

	useEffect(() => {
		restoreStatus();
	}, []);

	useEffect(() => {
		if (ipAbortRef.current) {
			ipAbortRef.current.abort();
			ipAbortRef.current = null;
		}

		if (proxyState.connected) {
			const controller = new AbortController();

			ipAbortRef.current = controller;

			setLoadingIp(true);
			setIpFailed(false);
			fetchExternalIp(controller.signal)
				.then((result) => {
					if (controller.signal.aborted) return;

					if (result) {
						setExternalIp(result);
						if (result.countryCode) {
							sendMessage({
								type: MSG.UPDATE_BADGE,
								text: toBadgeCode(result.countryCode),
							});
						}
					} else {
						setIpFailed(true);
					}
				})
				.finally(() => {
					if (!controller.signal.aborted) setLoadingIp(false);
				});
		} else {
			setExternalIp(null);
			setLoadingIp(false);
			setIpFailed(false);
		}

		return () => {
			if (ipAbortRef.current) {
				ipAbortRef.current.abort();
				ipAbortRef.current = null;
			}
		};
	}, [proxyState.connected]);

	const getLocation = (locationId) => {
		if (!locationId || !locations) return null;

		return locations.find((l) => l.id === Number(locationId)) ?? null;
	};

	const connectedItem = useMemo(
		() =>
			proxyState.connected
				? (allItems.find(
						(item) =>
							item.id === proxyState.connectedConfigId &&
							item.source === proxyState.connectedSource,
					) ?? null)
				: null,
		[
			allItems,
			proxyState.connected,
			proxyState.connectedConfigId,
			proxyState.connectedSource,
		],
	);

	const connectedLocation = useMemo(
		() =>
			proxyState.connected ? getLocation(proxyState.connectedLocationId) : null,
		[proxyState.connected, proxyState.connectedLocationId, locations],
	);

	const selectedItem = useMemo(
		() =>
			proxyState.selectedConfigId
				? (allItems.find(
						(item) =>
							item.id === proxyState.selectedConfigId &&
							item.source === proxyState.selectedSource,
					) ?? null)
				: null,
		[allItems, proxyState.selectedConfigId, proxyState.selectedSource],
	);

	const hasNewSelection =
		selectedItem &&
		proxyState.connected &&
		(selectedItem.id !== proxyState.connectedConfigId ||
			selectedItem.source !== proxyState.connectedSource);

	const displayConfig = hasNewSelection
		? selectedItem
		: (connectedItem ??
			selectedItem ??
			(allItems.length > 0 ? allItems[0] : null));

	const displayLocation = displayConfig
		? getLocation(displayConfig.locationId)
		: null;

	const displayRealLocation = displayConfig
		? getLocation(displayConfig.locationRealId)
		: null;

	useEffect(() => {
		if (!displayRealLocation?.ping_ip) return;

		const locId = Number(displayRealLocation.id);

		if (pings[locId] !== undefined) return;

		if (pingInFlightRef.current.has(locId)) return;

		pingInFlightRef.current.add(locId);

		measureBest(displayRealLocation.ping_ip, 3)
			.then((ms) => {
				if (ms !== null) setPings((prev) => ({ ...prev, [locId]: ms }));
			})
			.finally(() => {
				pingInFlightRef.current.delete(locId);
			});
	}, [displayRealLocation?.id, displayRealLocation?.ping_ip, pings, setPings]);

	useEffect(() => {
		if (!isConfigListOpen || !locations?.length || !allItems.length) return;

		const uniqueRealIds = [
			...new Set(
				allItems.map((item) => Number(item.locationRealId)).filter(Boolean),
			),
		];

		for (const realId of uniqueRealIds) {
			if (pings[realId] !== undefined) continue;

			if (pingInFlightRef.current.has(realId)) continue;

			const location = locations.find((item) => Number(item.id) === realId);

			if (!location?.ping_ip) continue;

			pingInFlightRef.current.add(realId);

			measureBest(location.ping_ip, 3)
				.then((ms) => {
					if (ms !== null) setPings((prev) => ({ ...prev, [realId]: ms }));
				})
				.finally(() => {
					pingInFlightRef.current.delete(realId);
				});
		}
	}, [allItems, isConfigListOpen, locations, pings, setPings]);

	const ping = displayRealLocation
		? (pings[displayRealLocation.id] ?? null)
		: null;

	const handleToggle = async () => {
		if (isToggling) return;

		setIsToggling(true);

		try {
			if (proxyState.connected && hasNewSelection) {
				await disconnect();
				await connect(selectedItem);
			} else if (proxyState.connected) {
				await disconnect();
			} else if (displayConfig) {
				await connect(displayConfig);
			}
		} catch (err) {
			console.error("Toggle failed:", err);
			showSnackbar("Ошибка подключения");
		} finally {
			setIsToggling(false);
		}
	};

	const handleConfigSelect = (item) => {
		setProxyState((prev) => ({
			...prev,
			selectedConfigId: item.id,
			selectedSource: item.source,
		}));
		storage.set({
			[STORAGE_KEYS.SELECTED_CONFIG]: {
				id: item.id,
				source: item.source,
			},
		});
		setIsConfigListOpen(false);
	};

	const handleConfigListToggle = () => {
		setIsLocationPickerOpen(false);
		setIsConfigListOpen((value) => !value);
	};

	const handleLocationPickerToggle = () => {
		setIsConfigListOpen(false);
		setIsLocationPickerOpen((value) => !value);
	};

	const pingLabel = getPingLabel(ping);

	const showConfigureButton = displayConfig?.canChangeLocation;

	return (
		<div className="ext-main">
			<div className="ext-header">
				<div className="ext-header__logo">
					<Icon28GlobeOutline
						className="ext-app-accent-icon"
						width={24}
						height={24}
						fill="var(--vkui--color_text_accent)"
					/>
					<span className="ext-header__title">StealthSurf VPN</span>
				</div>
				<div className="ext-header__actions">
					<IconButton onClick={onOpenSplitTunnel} aria-label="Туннелирование">
						<Icon24ShuffleOutline />
					</IconButton>
					<IconButton onClick={onOpenSettings} aria-label="Настройки">
						<Icon24GearOutline />
					</IconButton>
				</div>
			</div>

			<div className="ext-toggle-area">
				<button
					type="button"
					className={`ext-toggle ${proxyState.connected ? "ext-toggle--active" : ""} ${isToggling ? "ext-toggle--loading" : ""}`}
					onClick={handleToggle}
					disabled={isToggling || loading}
				>
					{isToggling ? <Spinner size="large" /> : <PowerIcon size={48} />}
				</button>

				<div className="ext-toggle-status">
					<span
						className={`ext-toggle-status__label ${proxyState.connected ? "ext-toggle-status__label--active" : ""}`}
					>
						{proxyState.connected ? "Подключено" : "Не подключено"}
					</span>
					{proxyState.connected && connectedLocation && (
						<span className="ext-toggle-status__location">
							{connectedLocation.title}
						</span>
					)}
					{proxyState.connected && loadingIp && !externalIp && (
						<div className="ext-ip-badge ext-ip-badge--loading">
							<Spinner size="small" />
							<span className="ext-ip-badge__ip">Определяем IP</span>
						</div>
					)}
					{proxyState.connected && !loadingIp && !externalIp && ipFailed && (
						<div className="ext-ip-badge ext-ip-badge--failed">
							<span className="ext-ip-badge__ip">IP не определён</span>
						</div>
					)}
					{proxyState.connected && externalIp && (
						<div
							className="ext-ip-badge ext-ip-badge--clickable"
							onClick={() =>
								chrome.tabs.create({
									url: `https://2ip.ru/whois/?ip=${encodeURIComponent(externalIp.ip)}`,
								})
							}
						>
							<span className="ext-ip-badge__flag">
								<CountryFlag code={externalIp.countryCode} size={14} />
							</span>
							<span className="ext-ip-badge__ip">{externalIp.ip}</span>
						</div>
					)}
				</div>
			</div>

			{updateInfo && (
				<div
					className="ext-update-banner"
					onClick={() => chrome.tabs.create({ url: updateInfo.url })}
				>
					<Icon24DownloadOutline width={16} height={16} />
					<span className="ext-update-banner__text">
						Доступно обновление v{updateInfo.version}
					</span>
					<span className="ext-update-banner__arrow">›</span>
				</div>
			)}

			<div
				className={`ext-bottom-card${isConfigListOpen ? " ext-bottom-card--open" : ""}${isLocationPickerOpen ? " ext-bottom-card--location-open" : ""}`}
			>
				<button
					type="button"
					className="ext-config-selector"
					onClick={handleConfigListToggle}
					aria-expanded={isConfigListOpen}
					aria-controls="ext-config-list"
				>
					{loading && !displayConfig ? (
						<div className="ext-config-selector__content">
							<span className="ext-config-selector__flag">
								<Skeleton width={28} height={28} borderRadius={14} />
							</span>
							<div className="ext-config-selector__info">
								<Skeleton width={140} height={16} />
								<Skeleton width={100} height={12} style={{ marginTop: 4 }} />
							</div>
							<Icon20ChevronUp className="ext-config-selector__chevron ext-app-accent-icon" />
						</div>
					) : displayConfig ? (
						<div className="ext-config-selector__content">
							<span className="ext-config-selector__flag">
								<CountryFlag
									code={displayLocation?.code}
									size={28}
									loading={loading}
								/>
							</span>
							<div className="ext-config-selector__info">
								<span className="ext-config-selector__name">
									{displayConfig.title ??
										displayLocation?.title ??
										"Неизвестный конфиг"}
								</span>
								<span className="ext-config-selector__location">
									До {localizeDate(displayConfig.expiresAt)}
									{pingLabel && <>, {pingLabel}</>}
								</span>
							</div>
							<Icon20ChevronUp className="ext-config-selector__chevron ext-app-accent-icon" />
						</div>
					) : (
						<div className="ext-config-selector__content">
							<span className="ext-config-selector__flag">🌐</span>
							<span className="ext-config-selector__text">Выберите конфиг</span>
							<Icon20ChevronUp className="ext-config-selector__chevron ext-app-accent-icon" />
						</div>
					)}
				</button>

				<div
					id="ext-config-list"
					className="ext-config-list"
					aria-hidden={!isConfigListOpen}
					inert={isConfigListOpen ? undefined : ""}
				>
					{loading && !allItems.length ? (
						<div className="ext-config-list__loading">
							<Spinner size="small" />
							<span>Загрузка конфигов…</span>
						</div>
					) : error && !allItems.length ? (
						<button
							type="button"
							className="ext-config-list__error"
							onClick={() => void reload().catch(() => {})}
						>
							<span>Не удалось загрузить конфиги</span>
							<span className="ext-config-list__retry">
								Нажмите, чтобы повторить
							</span>
						</button>
					) : allItems.length === 0 ? (
						<div className="ext-config-list__empty">Нет доступных конфигов</div>
					) : (
						allItems.map((item) => {
							const location = getLocation(item.locationId);
							const itemPingLabel = getPingLabel(pings[item.locationRealId]);
							const isActive =
								displayConfig?.id === item.id &&
								displayConfig?.source === item.source;

							return (
								<button
									key={`${item.source}-${item.id}`}
									type="button"
									className={`ext-config-item${isActive ? " ext-config-item--active" : ""}`}
									onClick={() => handleConfigSelect(item)}
									aria-pressed={isActive}
								>
									<span className="ext-config-item__flag">
										<CountryFlag
											code={location?.code}
											size={28}
											loading={loading}
										/>
									</span>
									<span className="ext-config-item__info">
										<span className="ext-config-item__name">
											{item.title ?? location?.title ?? "Неизвестный конфиг"}
										</span>
										<span className="ext-config-item__location">
											До {localizeDate(item.expiresAt)}
											{itemPingLabel && <>, {itemPingLabel}</>}
										</span>
									</span>
								</button>
							);
						})
					)}
				</div>

				{showConfigureButton && (
					<>
						<Separator className="ext-bottom-card__separator" />
						<button
							type="button"
							className="ext-location-trigger"
							onClick={handleLocationPickerToggle}
							aria-expanded={isLocationPickerOpen}
							aria-controls="ext-location-picker"
						>
							<span>Изменить локацию</span>
							<Icon20ChevronUp className="ext-location-trigger__chevron ext-app-accent-icon" />
						</button>
						<LocationPicker
							config={displayConfig}
							isOpen={isLocationPickerOpen}
							onClose={() => setIsLocationPickerOpen(false)}
							reload={reload}
						/>
					</>
				)}
			</div>
		</div>
	);
};

export default MainPage;
