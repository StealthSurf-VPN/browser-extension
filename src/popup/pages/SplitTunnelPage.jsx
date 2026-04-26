import {
	Icon24DeleteOutline,
	Icon24DownloadOutline,
	Icon24UploadOutline,
} from "@vkontakte/icons";
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
import React, { useEffect, useRef, useState } from "react";
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

	try {
		work = punycode.toASCII(work);
	} catch {}

	const domain = isWildcard ? `*.${work}` : work;

	if (!DOMAIN_RE.test(domain)) return null;

	return domain;
};

const EXPORT_HEADER = "# StealthSurf split tunneling rules";

const MAX_IMPORT_BYTES = 1024 * 1024;

const MODE_LINE_RE = /^#\s*mode:\s*(exclude|include)\s*$/i;

const buildExportText = (mode, domains) => {
	const lines = [EXPORT_HEADER, `# mode: ${mode}`, ...domains];

	return `${lines.join("\n")}\n`;
};

const parseImportText = (text) => {
	const stripped = text.replace(/^﻿/, "");

	const lines = stripped.split(/\r?\n/);

	let mode = null;

	const domains = [];

	let skipped = 0;

	for (const raw of lines) {
		const line = raw.trim();

		if (!line) continue;

		if (line.startsWith("#")) {
			if (!mode) {
				const match = line.match(MODE_LINE_RE);
				if (match) mode = match[1].toLowerCase();
			}
			continue;
		}

		const domain = parseDomain(line);

		if (domain) domains.push(domain);
		else skipped++;
	}

	return { mode, domains, skipped };
};

const SplitTunnelPage = ({ onBack }) => {
	const showSnackbar = useSnackbarHandler();

	const [splitMode, setSplitMode] = useState("exclude");

	const [splitDomains, setSplitDomains] = useState([]);

	const [domainInput, setDomainInput] = useState("");

	const fileInputRef = useRef(null);

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

	const handleExport = () => {
		if (splitDomains.length === 0) return;

		const text = buildExportText(splitMode, splitDomains);

		const blob = new Blob([text], { type: "text/plain;charset=utf-8" });

		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");

		a.href = url;
		a.download = "stealthsurf-split-tunnel.txt";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	const handleImportFile = (event) => {
		const file = event.target.files?.[0];

		event.target.value = "";

		if (!file) return;

		if (file.size === 0) {
			showSnackbar("Файл пустой");
			return;
		}

		if (file.size > MAX_IMPORT_BYTES) {
			showSnackbar("Файл слишком большой");
			return;
		}

		const reader = new FileReader();

		reader.onload = async () => {
			const text = String(reader.result || "");

			const parsed = parseImportText(text);

			const existing = new Set(splitDomains);

			const fresh = parsed.domains.filter((d) => !existing.has(d));

			const merged = [...splitDomains, ...fresh];

			const nextMode =
				parsed.mode && parsed.mode !== splitMode ? parsed.mode : splitMode;

			const modeChanged = nextMode !== splitMode;

			if (fresh.length > 0 || modeChanged) {
				setSplitDomains(merged);
				if (modeChanged) setSplitMode(nextMode);
				await saveSplitTunnel(nextMode, merged);
			}

			let message;

			if (fresh.length > 0 || parsed.skipped > 0 || modeChanged) {
				const parts = [];

				if (fresh.length > 0) parts.push(`Импортировано: ${fresh.length}`);
				if (parsed.skipped > 0) parts.push(`пропущено: ${parsed.skipped}`);
				if (modeChanged) parts.push("режим обновлён");

				message = parts.join(", ");
			} else if (parsed.domains.length > 0) {
				message = "Все домены уже в списке";
			} else {
				message = "Файл пустой";
			}

			showSnackbar(message);
		};

		reader.onerror = () => showSnackbar("Не удалось прочитать файл");

		reader.readAsText(file, "utf-8");
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

						<div className="ext-split-tunnel__actions-row">
							<Button
								size="m"
								mode="secondary"
								stretched
								before={<Icon24DownloadOutline width={20} height={20} />}
								onClick={handleExport}
								disabled={splitDomains.length === 0}
							>
								Экспорт
							</Button>
							<Button
								size="m"
								mode="secondary"
								stretched
								before={<Icon24UploadOutline width={20} height={20} />}
								onClick={() => fileInputRef.current?.click()}
							>
								Импорт
							</Button>
						</div>

						<input
							ref={fileInputRef}
							type="file"
							accept=".txt,text/plain"
							style={{ display: "none" }}
							onChange={handleImportFile}
						/>
					</Card>

					<Footer>Поддерживаются wildcard-домены: *.example.com</Footer>
				</div>
			</Group>
		</Panel>
	);
};

export default SplitTunnelPage;
