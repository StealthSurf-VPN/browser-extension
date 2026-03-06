import { Icon16Chevron } from "@vkontakte/icons";
import {
	Card,
	Footer,
	Group,
	Panel,
	PanelHeader,
	PanelHeaderBack,
	Placeholder,
	SimpleCell,
	SimpleGrid,
	Skeleton,
} from "@vkontakte/vkui";
import React, { useEffect, useRef } from "react";
import { useRecoilState } from "recoil";
import { STORAGE_KEYS } from "../../shared/constants";
import countryCodeToEmoji from "../../shared/countryFlag";
import getPingLabel from "../../shared/getPingLabel";
import localizeDate from "../../shared/localizeDate";
import { measureBest } from "../../shared/ping";
import useProxyList from "../hooks/useProxyList";
import { getPings, getProxyState } from "../state/selectors";

const ConfigCardSkeleton = () => (
	<Card>
		<SimpleCell
			after={<Skeleton width={16} height={16} />}
			before={<Skeleton width={24} height={24} borderRadius={12} />}
			subtitle={<Skeleton width={180} height={14} style={{ marginTop: 4 }} />}
		>
			<Skeleton width={140} height={18} />
		</SimpleCell>
	</Card>
);

const declOfNum = (n, titles) => {
	const cases = [2, 0, 1, 1, 1, 2];

	return `${n} ${titles[n % 100 > 4 && n % 100 < 20 ? 2 : cases[n % 10 < 5 ? n % 10 : 5]]}`;
};

const ConfigSelectPage = ({ locations, loading, error, reload, onBack }) => {
	const { allItems } = useProxyList();

	const [proxyState, setProxyState] = useRecoilState(getProxyState);

	const [pings, setPings] = useRecoilState(getPings);

	const pingInFlightRef = useRef(new Set());

	const getLocation = (locationId) => {
		if (!locationId || !locations) return null;

		return locations.find((l) => l.id === Number(locationId)) ?? null;
	};

	useEffect(() => {
		if (!locations?.length || !allItems.length) return;

		const uniqueRealIds = [
			...new Set(allItems.map((item) => item.locationRealId).filter(Boolean)),
		];

		for (const realId of uniqueRealIds) {
			if (pings[realId] !== undefined) continue;

			if (pingInFlightRef.current.has(realId)) continue;

			const loc = locations.find((l) => l.id === Number(realId));

			if (!loc?.ping_ip) continue;

			pingInFlightRef.current.add(realId);

			measureBest(loc.ping_ip, 3)
				.then((ms) => {
					if (ms !== null) setPings((prev) => ({ ...prev, [realId]: ms }));
				})
				.finally(() => {
					pingInFlightRef.current.delete(realId);
				});
		}
	}, [locations, allItems.length]);

	const handleSelect = (item) => {
		setProxyState((prev) => ({
			...prev,
			selectedConfigId: item.id,
			selectedSource: item.source,
		}));
		(globalThis.browser?.storage || chrome.storage).local.set({
			[STORAGE_KEYS.SELECTED_CONFIG]: {
				id: item.id,
				source: item.source,
			},
		});
		onBack();
	};

	const selectedId = proxyState.selectedConfigId;

	const selectedSource = proxyState.selectedSource;

	return (
		<Panel>
			<PanelHeader
				before={<PanelHeaderBack onClick={onBack} />}
				delimiter="none"
			>
				Конфиги
			</PanelHeader>
			<Group>
				{loading && !allItems.length ? (
					<div className="ext-configs-grid">
						<SimpleGrid align="start" columns={1} gap={8}>
							{Array.from({ length: 4 }).map((_, i) => (
								<ConfigCardSkeleton key={`skeleton-${i}`} />
							))}
						</SimpleGrid>
					</div>
				) : error && !allItems.length ? (
					<Placeholder
						header="Произошла ошибка"
						action={
							<button type="button" onClick={reload}>
								Попробовать ещё раз
							</button>
						}
					>
						Не удалось загрузить данные
					</Placeholder>
				) : allItems.length === 0 ? (
					<Placeholder header="Нет конфигов">
						Создайте конфиг на сайте StealthSurf
					</Placeholder>
				) : (
					<div className="ext-configs-grid">
						<SimpleGrid align="start" columns={1} gap={8}>
							{allItems.map((item) => {
								const loc = getLocation(item.locationId);

								const isActive =
									(proxyState.connected &&
										proxyState.connectedConfigId === item.id &&
										proxyState.connectedSource === item.source) ||
									(!proxyState.connected &&
										selectedId === item.id &&
										selectedSource === item.source);

								const ping = pings[item.locationRealId];

								const pingLabel = getPingLabel(ping);

								return (
									<Card
										key={`${item.source}-${item.id}`}
										className={isActive ? "ext-config-card--active" : ""}
										onClick={() => handleSelect(item)}
										style={{ cursor: "pointer" }}
									>
										<SimpleCell
											before={
												<span className="ext-configs-grid__flag">
													{countryCodeToEmoji(loc?.code)}
												</span>
											}
											subtitle={
												<>
													До {localizeDate(item.expiresAt)}
													{pingLabel && <>, {pingLabel}</>}
												</>
											}
											after={<Icon16Chevron />}
										>
											{item.title ?? loc?.title ?? "Неизвестный конфиг"}
										</SimpleCell>
									</Card>
								);
							})}
						</SimpleGrid>

						<Footer>
							{declOfNum(allItems.length, ["конфиг", "конфига", "конфигов"])}
						</Footer>
					</div>
				)}
			</Group>
		</Panel>
	);
};

export default ConfigSelectPage;
