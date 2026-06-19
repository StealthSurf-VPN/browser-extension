import {
	Button,
	Card,
	FormItem,
	Group,
	Panel,
	PanelHeader,
	PanelHeaderBack,
	SimpleCell,
	Textarea,
} from "@vkontakte/vkui";
import React, { useState } from "react";
import { sendFeedback } from "../../api/routes/route.feedback";
import useSnackbarHandler from "../hooks/useSnackbarHandler";

const MAX_LENGTH = 4000;

const COOLDOWN_MS = 3000;

const FeedbackPage = ({ onBack }) => {
	const [text, setText] = useState("");

	const [loading, setLoading] = useState(false);

	const [cooldown, setCooldown] = useState(false);

	const showSnackbar = useSnackbarHandler();

	const submit = async () => {
		const trimmed = text.trim();

		if (!trimmed || loading || cooldown) return;

		try {
			setLoading(true);

			const res = await sendFeedback(trimmed);

			if (res.data?.status) {
				showSnackbar("Спасибо! Мы обязательно рассмотрим вашу идею");
				onBack();
				return;
			}

			if (res.status !== 429)
				showSnackbar("Не удалось отправить. Попробуйте ещё раз");

			setCooldown(true);
			setTimeout(() => setCooldown(false), COOLDOWN_MS);
		} catch (error) {
			showSnackbar("Произошла ошибка при отправке");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Panel>
			<PanelHeader
				before={<PanelHeaderBack onClick={onBack} />}
				delimiter="none"
			>
				Предложить идею
			</PanelHeader>
			<Group>
				<div className="ext-settings__content">
					<Card>
						<SimpleCell
							multiline
							subtitle="Поделитесь идеей или предложением — мы читаем каждое обращение и учитываем его при развитии сервиса."
						/>
					</Card>

					<FormItem
						className="ext-feedback-page__form-item"
						top="Ваше предложение"
						bottom={`${text.length} / ${MAX_LENGTH}`}
					>
						<Textarea
							placeholder="Опишите вашу идею"
							maxLength={MAX_LENGTH}
							rows={6}
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
					</FormItem>

					<Button
						size="l"
						stretched
						loading={loading}
						className={
							!text.trim() || cooldown
								? "ext-feedback-page__submit--off"
								: undefined
						}
						onClick={submit}
					>
						{loading ? "Отправляем" : "Отправить"}
					</Button>
				</div>
			</Group>
		</Panel>
	);
};

export default FeedbackPage;
