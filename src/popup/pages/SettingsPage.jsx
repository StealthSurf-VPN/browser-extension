import {
	Icon24AdvertisingOutline,
	Icon24BooksOutline,
	Icon24BroadcastOutline,
	Icon24CopyOutline,
	Icon24DocumentTextOutline,
	Icon24MessagesOutline,
	Icon24RobotOutline,
	Icon24StarsOutline,
	Icon24SubscriptionsOutline,
	Icon28PrivacyOutline,
} from "@vkontakte/icons";
import {
	Alert,
	Button,
	Card,
	Footer,
	Group,
	Header,
	IconButton,
	Panel,
	PanelHeader,
	PanelHeaderBack,
	Separator,
	SimpleCell,
	Skeleton,
	Switch,
} from "@vkontakte/vkui";
import React, { useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import { MSG, STORAGE_KEYS } from "../../shared/constants";
import useSnackbarHandler from "../hooks/useSnackbarHandler";
import { getProfileData } from "../state/selectors";

const usefulLinks = [
	{
		title: "Telegram",
		subtitle: "Публикуем важные новости",
		url: "https://to.stealthsurf.app/telegram",
		Icon: Icon24AdvertisingOutline,
	},
	{
		title: "Telegram-бот",
		subtitle: "Консоль в формате Telegram-бота",
		url: "https://t.me/stealthsurf_vpn_bot",
		Icon: Icon24RobotOutline,
	},
	{
		title: "Статус серверов",
		subtitle: "Отслеживание состояния серверов",
		url: "https://status.stealthsurf.app/status/servers",
		Icon: Icon24BroadcastOutline,
	},
	{
		title: "Документация",
		subtitle: "Инструкции по сервису",
		url: "https://docs.stealthsurf.app",
		Icon: Icon24BooksOutline,
	},
	{
		title: "Дорожная карта",
		subtitle: "План развития проекта",
		url: "https://trello.com/b/4J71ea9J",
		Icon: Icon24SubscriptionsOutline,
	},
	{
		title: "Список изменений",
		subtitle: "Последние обновления проекта",
		url: "https://updates.stealthsurf.app",
		Icon: Icon24StarsOutline,
	},
	{
		title: "Поддержка",
		subtitle: "Если есть какие-то вопросы",
		url: "https://t.me/stealthsurf_support",
		Icon: Icon24MessagesOutline,
	},
];

const SettingsPage = ({ onBack, onLogout, setPopout, loading }) => {
	const userData = useRecoilValue(getProfileData);

	const showSnackbar = useSnackbarHandler();

	const version = chrome.runtime.getManifest?.()?.version ?? "1.0.2";

	const [proxyAllTraffic, setProxyAllTraffic] = useState(false);

	useEffect(() => {
		chrome.storage.local
			.get(STORAGE_KEYS.PROXY_ALL_TRAFFIC)
			.then((data) =>
				setProxyAllTraffic(!!data[STORAGE_KEYS.PROXY_ALL_TRAFFIC]),
			);
	}, []);

	const handleProxyAllTraffic = async (checked) => {
		setProxyAllTraffic(checked);
		await chrome.storage.local.set({
			[STORAGE_KEYS.PROXY_ALL_TRAFFIC]: checked,
		});
		await chrome.runtime.sendMessage({ type: MSG.UPDATE_PROXY_SETTINGS });
	};

	const handleCopy = (text) => {
		navigator.clipboard.writeText(text).then(
			() => showSnackbar("Скопировано"),
			() => showSnackbar("Не удалось скопировать"),
		);
	};

	const handleLogout = () => {
		setPopout(
			<Alert
				actions={[
					{
						title: "Выйти",
						mode: "destructive",
						action: onLogout,
					},
					{
						title: "Отмена",
						mode: "cancel",
					},
				]}
				actionsLayout="vertical"
				onClose={() => setPopout(null)}
				header="Подтвердите действие"
				text="Вы уверены, что хотите выйти из аккаунта?"
			/>,
		);
	};

	const displayName = userData
		? userData.sign_in_method === "telegram"
			? `id${userData.uuid}`
			: (userData.uuid ?? userData.email)
		: "";

	return (
		<Panel>
			<PanelHeader
				before={<PanelHeaderBack onClick={onBack} />}
				delimiter="none"
			>
				Настройки
			</PanelHeader>
			<Group>
				<div className="ext-settings__content">
					{loading && !userData ? (
						<Card>
							<SimpleCell
								subtitle={<Skeleton width={140} height={14} />}
								after={<Skeleton width={24} height={24} borderRadius={12} />}
							>
								<Skeleton width={180} height={18} />
							</SimpleCell>
						</Card>
					) : userData ? (
						<Card>
							<SimpleCell
								subtitle={`Внутренний ID: ${userData.id}`}
								multiline
								onClick={() => handleCopy(displayName)}
								after={
									<IconButton
										aria-label="Скопировать"
										onClick={(e) => {
											e.stopPropagation();
											handleCopy(displayName);
										}}
									>
										<Icon24CopyOutline fill="var(--vkui--color_text_secondary)" />
									</IconButton>
								}
							>
								{displayName}
							</SimpleCell>

							{userData.balance !== undefined && (
								<>
									<Separator />
									<SimpleCell disabled>
										Баланс:{" "}
										<b>
											{Number(userData.balance ?? 0).toLocaleString("ru-RU")} ₽
										</b>
									</SimpleCell>
								</>
							)}
						</Card>
					) : (
						<SimpleCell disabled>Не удалось загрузить профиль</SimpleCell>
					)}

					<div className="ext-settings__logout">
						<Button size="l" mode="secondary" onClick={handleLogout} stretched>
							Выйти из аккаунта
						</Button>
					</div>

					<Header mode="secondary" className="ext-settings__section-header">
						Параметры прокси
					</Header>

					<Card>
						<SimpleCell
							Component="label"
							after={
								<Switch
									checked={proxyAllTraffic}
									onChange={(e) => handleProxyAllTraffic(e.target.checked)}
								/>
							}
							subtitle="Используйте, если расширение не работает без VPN"
							multiline
						>
							Проксировать расширение
						</SimpleCell>
					</Card>

					<Header mode="secondary" className="ext-settings__section-header">
						Полезные ссылки
					</Header>

					<Card>
						{usefulLinks.map(({ title, subtitle, url, Icon }) => (
							<SimpleCell
								key={url}
								subtitle={subtitle}
								multiline
								expandable="always"
								before={<Icon />}
								onClick={() => chrome.tabs.create({ url })}
							>
								{title}
							</SimpleCell>
						))}
					</Card>

					<Header mode="secondary" className="ext-settings__section-header">
						Правовая информация
					</Header>

					<Card>
						<SimpleCell
							subtitle="Правила сервиса и политика Fair Usage"
							multiline
							expandable="always"
							before={<Icon24DocumentTextOutline />}
							onClick={() =>
								chrome.tabs.create({
									url: "https://storage.stealthsurf.app/terms-of-use.pdf",
								})
							}
						>
							Условия использования
						</SimpleCell>
						<SimpleCell
							subtitle="Сбор данных и принципы Zero-Logs"
							multiline
							expandable="always"
							before={<Icon28PrivacyOutline width={24} height={24} />}
							onClick={() =>
								chrome.tabs.create({
									url: "https://storage.stealthsurf.app/privacy-policy.pdf",
								})
							}
						>
							Политика конфиденциальности
						</SimpleCell>
					</Card>

					<Footer>Версия приложения: v{version}</Footer>
				</div>
			</Group>
		</Panel>
	);
};

export default SettingsPage;
