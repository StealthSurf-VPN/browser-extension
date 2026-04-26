import { Icon24DeleteOutline } from "@vkontakte/icons";
import {
	Button,
	Card,
	Footer,
	Group,
	Header,
	Input,
	Panel,
	PanelHeader,
	PanelHeaderBack,
	SegmentedControl,
} from "@vkontakte/vkui";
import React, { useEffect, useState } from "react";
import { MSG, STORAGE_KEYS, sendMessage } from "../../shared/constants";
import useSnackbarHandler from "../hooks/useSnackbarHandler";
import punycode from "punycode/";

const DOMAIN_RE =
	/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:xn--[a-z0-9-]+|[a-z]{2,})$/;

const parseDomain = (input) => {
	const trimmed = input.trim().toLowerCase();

	if (!trimmed) return null;

	const isWildcard = trimmed.startsWith("*.");

	let work = isWildcard ? trimmed.slice(2) : trimmed;

	try {
		const url = new URL(work.includes("://") ? work : `https://${work}`);

		work = url.hostname;
	} catch {}

	work = work.replace(/\/+$/, "");

	const domain = isWildcard ? `*.${work}` : work;

	if (!DOMAIN_RE.test(domain)) return null;

	return domain;
};

const SplitTunnelPage = ({ onBack }) => {
	const showSnackbar = useSnackbarHandler();

	const [splitMode, setSplitMode] = useState("exclude");

	const [splitDomains, setSplitDomains] = useState([]);

	const [domainInput, setDomainInput] = useState("");

	useEffect(() => {
		(globalThis.browser?.storage || chrome.storage).local
			.get([STORAGE_KEYS.SPLIT_TUNNEL_MODE, STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS])
			.then((data) => {
				setSplitMode(data[STORAGE_KEYS.SPLIT_TUNNEL_MODE] || "exclude");
				setSplitDomains(data[STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS] || []);
			});
	}, []);

	const notifyBackground = () =>
		sendMessage({ type: MSG.UPDATE_PROXY_SETTINGS });

	const saveSplitTunnel = async (mode, domains) => {
		try {
			await (globalThis.browser?.storage || chrome.storage).local.set({
				[STORAGE_KEYS.SPLIT_TUNNEL_MODE]: mode,
				[STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS]: domains,
			});
			await notifyBackground();
		} catch (err) {
			console.error("Failed to save split tunnel settings:", err);
		}
	};

	const handleModeChange = async (value) => {
		setSplitMode(value);
		await saveSplitTunnel(value, splitDomains);
	};

	const handleAddDomain = async () => {
		const domain = parseDomain(domainInput);

		if (!domain) {
			if (domainInput.trim()) showSnackbar("Некорректный домен");
			return;
		}

		if (splitDomains.includes(domain)) {
			showSnackbar("Домен уже добавлен");
			return;
		}

		const updated = [...splitDomains, domain];

		setSplitDomains(updated);
		setDomainInput("");
		await saveSplitTunnel(splitMode, updated);
	};

	const handleRemoveDomain = async (domain) => {
		const updated = splitDomains.filter((d) => d !== domain);

		setSplitDomains(updated);
		await saveSplitTunnel(splitMode, updated);
	};

	return (
		<Panel>
			<PanelHeader
				before={<PanelHeaderBack onClick={onBack} />}
				delimiter="none"
			>
				Туннелирование
			</PanelHeader>
			<Group>
				<div className="ext-settings__content ext-split-tunnel">
					<Header mode="secondary" className="ext-settings__section-header">
						Режим
					</Header>

					<Card>
						<div className="ext-split-tunnel__mode">
							<SegmentedControl
								value={splitMode}
								onChange={handleModeChange}
								options={[
									{ label: "Обход", value: "exclude" },
									{ label: "Выборочно", value: "include" },
								]}
							/>
						</div>
						<Footer className="ext-split-tunnel__hint">
							{splitMode === "exclude"
								? "Перечисленные сайты без прокси"
								: "Только перечисленные сайты через прокси"}
						</Footer>
					</Card>

					<Header mode="secondary" className="ext-settings__section-header">
						Домены
					</Header>

					<Card>
						<div className="ext-split-tunnel__input-row">
							<Input
								placeholder="example.com"
								value={domainInput}
								onChange={(e) => setDomainInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleAddDomain();
								}}
							/>
							<Button
								size="l"
								mode="secondary"
								onClick={handleAddDomain}
								disabled={!domainInput.trim()}
							>
								Добавить
							</Button>
						</div>

						{splitDomains.length > 0 ? (
							<div className="ext-split-tunnel__domain-list">
								{splitDomains.map((domain) => (
									<div key={domain} className="ext-split-tunnel__domain-row">
										<span className="ext-split-tunnel__domain-text">
											{punycode.toUnicode(domain)}
										</span>
										<Button
											size="m"
											mode="secondary"
											appearance="negative"
											before={<Icon24DeleteOutline width={20} height={20} />}
											onClick={() => handleRemoveDomain(domain)}
										>
											Удалить
										</Button>
									</div>
								))}
							</div>
						) : (
							<div className="ext-split-tunnel__empty">
								Добавьте домены для раздельного туннелирования
							</div>
						)}
					</Card>

					<Footer>Поддерживаются wildcard-домены: *.example.com</Footer>
				</div>
			</Group>
		</Panel>
	);
};

export default SplitTunnelPage;
