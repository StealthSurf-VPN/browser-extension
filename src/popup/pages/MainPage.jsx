import {
	Icon24DownloadOutline,
	Icon24GearOutline,
	Icon24ShuffleOutline,
	Icon28GlobeOutline,
} from "@vkontakte/icons";
import { IconButton, Separator, SimpleCell, Spinner } from "@vkontakte/vkui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRecoilState } from "recoil";
import { MSG, sendMessage, toBadgeCode } from "../../shared/constants";
import CountryFlag from "../../shared/countryFlag.jsx";
import getPingLabel from "../../shared/getPingLabel";
import localizeDate from "../../shared/localizeDate";
import { measureBest } from "../../shared/ping";
import { checkForUpdate } from "../../shared/updateChecker";
import useProxyConnection from "../hooks/useProxyConnection";
import useSnackbarHandler from "../hooks/useSnackbarHandler";
import useProxyList from "../hooks/useProxyList";
import { getPings } from "../state/selectors";

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
	onOpenConfigSelect,
	onOpenSettings,
	onOpenSplitTunnel,
	onOpenLocationSelect,
	locations,
	loading,
}) => {
	const { allItems } = useProxyList();

	const { proxyState, connect, disconnect, restoreStatus } =
		useProxyConnection();

	const showSnackbar = useSnackbarHandler();

	const [pings, setPings] = useRecoilState(getPings);

	const [isToggling, setIsToggling] = useState(false);

	const [externalIp, setExternalIp] = useState(null);

	const [loadingIp, setLoadingIp] = useState(false);

	const [ipFailed, setIpFailed] = useState(false);

	const [updateInfo, setUpdateInfo] = useState(null);

	const ipAbortRef = useRef(null);

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

		const locId = displayRealLocation.id;

		if (pings[locId] !== undefined) return;

		measureBest(displayRealLocation.ping_ip, 3).then((ms) => {
			if (ms !== null) setPings((prev) => ({ ...prev, [locId]: ms }));
		});
	}, [displayRealLocation?.id]);

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

	const pingLabel = getPingLabel(ping);

	const showConfigureButton = displayConfig?.canChangeLocation;

	return (
		<div className="ext-main">
			<div className="ext-header">
				<div className="ext-header__logo">
					<Icon28GlobeOutline
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

			<div className="ext-bottom-card">
				<div className="ext-config-selector" onClick={onOpenConfigSelect}>
					{loading && !displayConfig ? (
						<div className="ext-config-selector__content">
							<Spinner size="small" />
						</div>
					) : displayConfig ? (
						<div className="ext-config-selector__content">
							<span className="ext-config-selector__flag">
								<CountryFlag code={displayLocation?.code} size={28} />
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
							<span className="ext-config-selector__chevron">›</span>
						</div>
					) : (
						<div className="ext-config-selector__content">
							<span className="ext-config-selector__flag">🌐</span>
							<span className="ext-config-selector__text">Выберите конфиг</span>
							<span className="ext-config-selector__chevron">›</span>
						</div>
					)}
				</div>

				{showConfigureButton && (
					<>
						<Separator className="ext-bottom-card__separator" />
						<SimpleCell
							className="ext-bottom-card__action"
							onClick={() => onOpenLocationSelect(displayConfig)}
							after={
								<span className="ext-config-selector__chevron ext-change-location-banner__arrow">
									›
								</span>
							}
						>
							Изменить локацию
						</SimpleCell>
					</>
				)}
			</div>
		</div>
	);
};

export default MainPage;
