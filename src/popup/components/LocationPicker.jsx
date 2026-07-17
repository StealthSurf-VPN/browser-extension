import { Button, CustomSelect, CustomSelectOption } from "@vkontakte/vkui";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { changeLocation } from "../../api/routes/route.configs";
import { updatePaidOptionConfigSettings } from "../../api/routes/route.paid-options";
import CountryFlag from "../../shared/countryFlag.jsx";
import { measureBest } from "../../shared/ping";
import useProxyConnection from "../hooks/useProxyConnection";
import useSnackbarHandler from "../hooks/useSnackbarHandler";
import {
	getLocations,
	getPaidOptionLocationsMap,
	getPings,
} from "../state/selectors";

const EMPTY_LOCATIONS = [];
const CONNECTION_RESTORE_ERROR =
	"Ошибка смены локации, подключение не восстановлено";

const LocationPicker = ({ config, isOpen, onClose, reload }) => {
	const globalLocations = useRecoilValue(getLocations);

	const paidLocationsMap = useRecoilValue(getPaidOptionLocationsMap);

	const locations =
		config.source === "paid_option"
			? (paidLocationsMap?.[config.optionId] ?? EMPTY_LOCATIONS)
			: (globalLocations ?? EMPTY_LOCATIONS);

	const [pings, setPings] = useRecoilState(getPings);

	const [selectedLocationId, setSelectedLocationId] = useState(
		String(config.locationId ?? ""),
	);

	const [saving, setSaving] = useState(false);

	const checkingPingRef = useRef(new Set());

	const isCheckingPingRef = useRef(false);

	const failedPingRef = useRef(new Set());

	const { proxyState, disconnect, connect } = useProxyConnection();

	const showSnackbar = useSnackbarHandler();

	useEffect(() => {
		if (!isOpen) return;

		setSelectedLocationId(String(config.locationId ?? ""));
	}, [config.id, config.locationId, config.source, isOpen]);

	const checkLocationPing = useCallback(
		async (location) => {
			if (!location?.ping_ip || location.is_active === false) return;

			const locationKey = `${location.id}_${location.ping_ip}`;

			if (checkingPingRef.current.has(locationKey)) return;

			if (failedPingRef.current.has(locationKey)) return;

			checkingPingRef.current.add(locationKey);

			try {
				const ms = await measureBest(location.ping_ip, 3);

				if (ms === null) failedPingRef.current.add(locationKey);
				else failedPingRef.current.delete(locationKey);

				setPings((previous) => ({ ...previous, [location.id]: ms }));
			} catch (error) {
				console.error("Ping error for", location.ping_ip, error);
				failedPingRef.current.add(locationKey);
				setPings((previous) => ({ ...previous, [location.id]: null }));
			} finally {
				checkingPingRef.current.delete(locationKey);
			}
		},
		[setPings],
	);

	useEffect(() => {
		if (!isOpen || !locations.length || isCheckingPingRef.current) return;

		let cancelled = false;

		const checkAllLocationsPing = async () => {
			isCheckingPingRef.current = true;

			for (const location of locations) {
				if (cancelled) break;

				if (pings[location.id] !== null && pings[location.id] !== undefined)
					continue;

				await checkLocationPing(location);

				if (!cancelled)
					await new Promise((resolve) => setTimeout(resolve, 100));
			}

			isCheckingPingRef.current = false;
		};

		checkAllLocationsPing();

		return () => {
			cancelled = true;
			isCheckingPingRef.current = false;
		};
	}, [isOpen, locations]);

	const options = useMemo(
		() =>
			locations
				.filter((location) => location.is_active !== false)
				.map(({ id, title, description, code }) => ({
					label: title,
					value: String(id),
					description,
					code,
				})),
		[locations],
	);

	const hasLocationChanged =
		Boolean(selectedLocationId) &&
		String(config.locationId) !== String(selectedLocationId);

	const getPingClassName = (ping) => {
		if (ping == null) return "";

		if (ping <= 100) return "ext-text--positive";

		if (ping <= 200) return "ext-text--warning";

		return "ext-text--negative";
	};

	const restoreConnection = async () => {
		try {
			await connect(config);
			return true;
		} catch (error) {
			console.error("Failed to restore proxy connection:", error);
			return false;
		}
	};

	const handleSave = async () => {
		if (!selectedLocationId || saving) return;

		const wasConnected =
			proxyState.connected &&
			proxyState.connectedConfigId === config.id &&
			proxyState.connectedSource === config.source;

		let didDisconnect = false;

		let locationChanged = false;

		setSaving(true);

		try {
			if (wasConnected) await disconnect();

			didDisconnect = wasConnected;

			const body = {
				location_id: selectedLocationId,
				protocol: config.protocol,
			};

			const response =
				config.source === "config"
					? await changeLocation(config.id, body)
					: await updatePaidOptionConfigSettings(
							config.optionId,
							config.id,
							body,
						);

			if (!response?.data?.status) {
				if (didDisconnect && !(await restoreConnection())) {
					showSnackbar(CONNECTION_RESTORE_ERROR);
					return;
				}

				showSnackbar(
					response?.data?.errorCode === 9
						? "На данной локации нет свободных серверов"
						: "Ошибка смены локации",
				);
				return;
			}

			locationChanged = true;

			const selectedLocation = locations.find(
				(location) => String(location.id) === String(selectedLocationId),
			);

			const updatedConfig = {
				...config,
				locationId: Number(selectedLocationId),
				locationRealId: Number(selectedLocationId),
				locationTitle: selectedLocation?.title ?? config.locationTitle,
				locationCode: selectedLocation?.code ?? config.locationCode,
				hasProxy: false,
				proxyUrl: null,
			};

			if (wasConnected) {
				try {
					await connect(updatedConfig);
				} catch (error) {
					console.error("Location changed, reconnect failed:", error);

					try {
						await reload();
					} catch (reloadError) {
						console.error(
							"Failed to reload after reconnect error:",
							reloadError,
						);
						showSnackbar(
							"Локация изменена, но не удалось переподключиться и обновить данные",
						);
						return;
					}

					showSnackbar("Локация изменена, но переподключиться не удалось");
					onClose();
					return;
				}
			}

			await reload();
			showSnackbar("Локация изменена");
			onClose();
		} catch (error) {
			console.error("Location change failed:", error);

			const connectionRestored =
				!didDisconnect || locationChanged || (await restoreConnection());

			showSnackbar(
				!connectionRestored
					? CONNECTION_RESTORE_ERROR
					: locationChanged
						? "Локация изменена, но данные не обновились"
						: "Ошибка смены локации",
			);
		} finally {
			setSaving(false);
		}
	};

	const renderLocationOption = ({ option, ...restProps }) => {
		const ping = pings[option.value] ?? null;

		return (
			<CustomSelectOption
				{...restProps}
				key={option.value}
				description={option.description}
				after={
					ping != null ? (
						<span className="ext-location-picker__ping">
							<span className={getPingClassName(ping)}>•</span> {ping} мс
						</span>
					) : (
						""
					)
				}
			>
				<CountryFlag code={option.code} size={20} /> {option.label}
			</CustomSelectOption>
		);
	};

	return (
		<div
			id="ext-location-picker"
			className="ext-location-picker"
			aria-hidden={!isOpen}
			inert={isOpen ? undefined : ""}
		>
			<div className="ext-location-picker__content">
				<CustomSelect
					className="ext-location-picker__select"
					value={selectedLocationId}
					onChange={(event) => setSelectedLocationId(event.target.value)}
					placeholder="Не выбрано"
					searchable
					popupDirection="top"
					disabled={saving}
					options={options}
					renderOption={renderLocationOption}
				/>
				<Button
					className="ext-location-picker__submit"
					size="l"
					stretched
					loading={saving}
					disabled={!selectedLocationId || saving}
					onClick={handleSave}
				>
					{hasLocationChanged ? "Изменить" : "Сменить сервер"}
				</Button>
			</div>
		</div>
	);
};

export default LocationPicker;
