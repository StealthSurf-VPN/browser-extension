import {
	Button,
	Card,
	Checkbox,
	CustomSelect,
	CustomSelectOption,
	FormItem,
	Group,
	Panel,
	PanelHeader,
	PanelHeaderBack,
	SimpleCell,
} from "@vkontakte/vkui";
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

const LocationSelectPage = ({ config, onBack }) => {
	const globalLocations = useRecoilValue(getLocations);

	const paidLocationsMap = useRecoilValue(getPaidOptionLocationsMap);

	const locations =
		config.source === "paid_option"
			? (paidLocationsMap?.[config.optionId] ?? [])
			: globalLocations;

	const [pings, setPings] = useRecoilState(getPings);

	const [selectedLocationId, setSelectedLocationId] = useState(
		config.locationId ? String(config.locationId) : null,
	);

	const [isDisconnected, setIsDisconnected] = useState(false);

	const [checkboxError, setCheckboxError] = useState(false);

	const [saving, setSaving] = useState(false);

	const checkingPingRef = useRef(new Set());

	const isCheckingPingRef = useRef(false);

	const failedPingRef = useRef(new Set());

	const { proxyState, disconnect, connect } = useProxyConnection();

	const showSnackbar = useSnackbarHandler();

	const checkLocationPing = useCallback(
		async (location) => {
			if (!location || !location.ping_ip || location.is_active === false)
				return;

			const locationKey = `${location.id}_${location.ping_ip}`;

			if (checkingPingRef.current.has(locationKey)) return;

			if (failedPingRef.current.has(locationKey)) return;

			checkingPingRef.current.add(locationKey);

			try {
				const ms = await measureBest(location.ping_ip, 3);

				if (ms === null) {
					failedPingRef.current.add(locationKey);
				} else {
					failedPingRef.current.delete(locationKey);
				}

				setPings((prev) => ({ ...prev, [location.id]: ms }));
			} catch (error) {
				console.error("Ping error for", location.ping_ip, error);
				failedPingRef.current.add(locationKey);

				setPings((prev) => ({ ...prev, [location.id]: null }));
			} finally {
				checkingPingRef.current.delete(locationKey);
			}
		},
		[setPings],
	);

	const locationsCount = locations?.length ?? 0;

	useEffect(() => {
		if (!locations || !locationsCount) return;

		if (isCheckingPingRef.current) return;

		let cancelled = false;

		const checkAllLocationsPing = async () => {
			isCheckingPingRef.current = true;

			for (const location of locations) {
				if (cancelled) break;

				if (pings[location.id] === null || pings[location.id] === undefined) {
					const locationKey = `${location.id}_${location.ping_ip}`;

					if (
						!checkingPingRef.current.has(locationKey) &&
						!failedPingRef.current.has(locationKey)
					) {
						await checkLocationPing(location);

						await new Promise((resolve) => setTimeout(resolve, 100));
					}
				}
			}

			isCheckingPingRef.current = false;
		};

		checkAllLocationsPing();

		return () => {
			cancelled = true;
			isCheckingPingRef.current = false;
		};
	}, [locations]);

	const locationsKey = locations
		?.filter((el) => el.is_active !== false)
		.map((l) => `${l.id}:${l.title}:${l.code}`)
		.join("|");

	const options = useMemo(() => {
		if (!locations || locations.length === 0) return [];

		return locations
			.filter((el) => el.is_active !== false)
			.map(({ id, title, description, code }) => ({
				label: title,
				value: String(id),
				description,
				code,
			}));
	}, [locationsKey]);

	const getPingForLocation = (locationId) => pings[locationId] ?? null;

	const getPingClassName = (ping) => {
		if (ping == null) return "";

		if (ping <= 100) return "ext-text--positive";

		if (ping <= 200) return "ext-text--warning";

		return "ext-text--negative";
	};

	const handleSave = async () => {
		if (!isDisconnected) {
			setCheckboxError(true);
			return;
		}

		if (!selectedLocationId) {
			onBack();
			return;
		}

		try {
			setSaving(true);

			const isCurrentlyConnected =
				proxyState.connected &&
				proxyState.connectedConfigId === config.id &&
				proxyState.connectedSource === config.source;

			if (isCurrentlyConnected) await disconnect();

			const body = {
				location_id: selectedLocationId,
				protocol: config.protocol,
			};

			let res;

			if (config.source === "config") {
				res = await changeLocation(config.id, body);
			} else if (config.source === "paid_option") {
				res = await updatePaidOptionConfigSettings(
					config.optionId,
					config.id,
					body,
				);
			}

			if (res?.data?.status) {
				const selectedLoc = locations?.find(
					(l) => String(l.id) === String(selectedLocationId),
				);

				const updatedConfig = {
					...config,
					locationId: Number(selectedLocationId),
					locationTitle: selectedLoc?.title ?? config.locationTitle,
					hasProxy: false,
					proxyUrl: null,
				};

				await connect(updatedConfig);
				showSnackbar("Локация изменена");
				onBack();
			} else if (res?.data?.errorCode === 9) {
				showSnackbar("На данной локации нет свободных серверов");
			}
		} catch (err) {
			showSnackbar("Ошибка смены локации");
			console.error("Location change failed:", err);
		} finally {
			setSaving(false);
		}
	};

	const selectedLoc = locations?.find(
		(l) => String(l.id) === String(selectedLocationId),
	);

	const caption = selectedLoc?.caption ?? null;

	return (
		<Panel>
			<PanelHeader
				before={<PanelHeaderBack onClick={onBack} />}
				delimiter="none"
			>
				Смена локации
			</PanelHeader>
			<Group>
				<div className="ext-location-page">
					<div className="ext-location-page__item">
						<Card>
							<SimpleCell
								multiline
								subtitle={
									<>
										Мы привязываем прокси к существующему конфигу, поэтому после
										смены локации потребуется его переподключить.
										<br />
										<br />
										Протокол не изменится, но если был включен доступ к
										Xray-конфигу, то он отключится.
									</>
								}
							/>
						</Card>
					</div>

					<FormItem
						top="Выберите локацию"
						className="ext-location-page__form-item"
					>
						<CustomSelect
							value={selectedLocationId}
							onChange={(e) => setSelectedLocationId(e.target.value)}
							placeholder="Не выбрано"
							searchable
							options={options}
							renderOption={({ option, ...restProps }) => {
								const ping = getPingForLocation(option.value);

								return (
									<CustomSelectOption
										{...restProps}
										key={option.value}
										description={option.description}
										after={
											ping != null ? (
												<span className="ext-location-page__ping">
													<span className={getPingClassName(ping)}>•</span>{" "}
													{ping} мс
												</span>
											) : (
												""
											)
										}
									>
										<CountryFlag code={option.code} size={20} /> {option.label}
									</CustomSelectOption>
								);
							}}
						/>
					</FormItem>

					{caption && (
						<div className="ext-location-page__item">
							<Card>
								<SimpleCell multiline subtitle={caption}>
									Об этой локации
								</SimpleCell>
							</Card>
						</div>
					)}

					<FormItem
						top="Подтвердите действие"
						className="ext-location-page__form-item"
					>
						<Card
							className="ext-location-page__checkbox-card"
							style={{
								transition:
									"background-color 0.3s ease, border-color 0.3s ease",
								borderWidth: "1px",
								borderStyle: "solid",
								borderColor: checkboxError
									? "var(--vkui--color_icon_negative)"
									: "transparent",
								backgroundColor: checkboxError ? "rgba(255, 0, 0, 0.08)" : "",
							}}
						>
							<Checkbox
								checked={isDisconnected}
								onChange={(e) => {
									setIsDisconnected(e.target.checked);
									if (e.target.checked) setCheckboxError(false);
								}}
								description="Перед сменой локации проверьте, что вы не подключены к VPN-конфигу."
							>
								Сейчас я не использую конфиг
							</Checkbox>
						</Card>
					</FormItem>

					<div className="ext-location-page__item">
						<Button
							size="l"
							stretched
							loading={saving}
							disabled={!selectedLocationId || !isDisconnected || saving}
							onClick={handleSave}
						>
							{saving ? "Изменяем локацию..." : "Изменить локацию"}
						</Button>
					</div>
				</div>
			</Group>
		</Panel>
	);
};

export default LocationSelectPage;
