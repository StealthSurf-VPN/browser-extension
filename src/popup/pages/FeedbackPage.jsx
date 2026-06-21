import {
	Icon24Attach,
	Icon24DeleteOutline,
	Icon24DocumentOutline,
} from "@vkontakte/icons";
import {
	Button,
	Card,
	Div,
	FormItem,
	Group,
	IconButton,
	Panel,
	PanelHeader,
	PanelHeaderBack,
	SimpleCell,
	Text,
	Textarea,
} from "@vkontakte/vkui";
import React, { useRef, useState } from "react";
import { sendFeedback } from "../../api/routes/route.feedback";
import formatBytes from "../../shared/formatBytes";
import useSnackbarHandler from "../hooks/useSnackbarHandler";

const MAX_LENGTH = 4000;

const MAX_FILES = 5;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_FILE_SIZE_LABEL = formatBytes(MAX_FILE_SIZE, 0);

const COOLDOWN_MS = 3000;

const declOfNum = (n, titles) => {
	const cases = [2, 0, 1, 1, 1, 2];

	return `${n} ${titles[n % 100 > 4 && n % 100 < 20 ? 2 : cases[n % 10 < 5 ? n % 10 : 5]]}`;
};

const getFileKey = (file, index) =>
	`${file.name}-${file.size}-${file.lastModified}-${index}`;

const getValidationError = (text, files) => {
	if (!text.trim()) return "Опишите идею перед отправкой";

	if (files.length > MAX_FILES)
		return `Можно прикрепить не более ${MAX_FILES} файлов`;

	const oversized = files.find((file) => file.size > MAX_FILE_SIZE);

	if (oversized)
		return `Файл «${oversized.name}» больше ${MAX_FILE_SIZE_LABEL}`;

	return null;
};

const FeedbackPage = ({ onBack }) => {
	const [text, setText] = useState("");

	const [files, setFiles] = useState([]);

	const [loading, setLoading] = useState(false);

	const [cooldown, setCooldown] = useState(false);

	const fileInputRef = useRef(null);

	const showSnackbar = useSnackbarHandler();

	const handleFileSelect = (e) => {
		const selected = Array.from(e.target.files ?? []);

		e.target.value = "";

		if (!selected.length) return;

		const availableSlots = MAX_FILES - files.length;

		if (availableSlots <= 0) {
			showSnackbar(`Можно прикрепить не более ${MAX_FILES} файлов`);
			return;
		}

		const valid = selected.filter((file) => file.size <= MAX_FILE_SIZE);

		const skippedBySize = selected.length - valid.length;

		if (skippedBySize > 0)
			showSnackbar(
				`Не добавили ${declOfNum(skippedBySize, ["файл", "файла", "файлов"])}: размер должен быть до ${MAX_FILE_SIZE_LABEL}`,
			);

		const toAdd = valid.slice(0, availableSlots);

		if (valid.length > availableSlots)
			showSnackbar(
				`Добавили ${declOfNum(toAdd.length, ["файл", "файла", "файлов"])} из выбранных`,
			);

		if (!toAdd.length) return;

		setFiles((current) => [...current, ...toAdd]);
	};

	const removeFile = (indexToRemove) =>
		setFiles((current) =>
			current.filter((_, index) => index !== indexToRemove),
		);

	const submit = async () => {
		const trimmed = text.trim();

		if (loading || cooldown) return;

		const validationError = getValidationError(trimmed, files);

		if (validationError) {
			showSnackbar(validationError);
			return;
		}

		try {
			setLoading(true);

			const res = await sendFeedback(trimmed, files);

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
						<Div>
							<Text className="ext-text--muted">
								Поделитесь идеей или предложением — мы читаем каждое обращение и
								учитываем его при развитии сервиса.
								<br />
								<br />
								Можно прикрепить до {MAX_FILES} файлов, не более{" "}
								{MAX_FILE_SIZE_LABEL} каждый.
							</Text>
						</Div>
					</Card>

					<FormItem
						className="ext-feedback-page__form-item"
						top={`Ваше сообщение (${text.length} / ${MAX_LENGTH})`}
					>
						<Textarea
							placeholder="Опишите идею, найденную ошибку или функцию, которую хотите видеть"
							maxLength={MAX_LENGTH}
							rows={6}
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
					</FormItem>

					<input
						ref={fileInputRef}
						type="file"
						multiple
						onChange={handleFileSelect}
						style={{ display: "none" }}
					/>

					{files.length ? (
						<Card className="ext-feedback-page__files">
							{files.map((file, index) => (
								<SimpleCell
									key={getFileKey(file, index)}
									before={<Icon24DocumentOutline />}
									after={
										<IconButton
											aria-label={`Удалить файл ${file.name}`}
											onClick={() => removeFile(index)}
										>
											<Icon24DeleteOutline className="ext-feedback-page__delete" />
										</IconButton>
									}
									subtitle={formatBytes(file.size)}
									multiline
								>
									<span className="ext-feedback-page__file-name">
										{file.name}
									</span>
								</SimpleCell>
							))}
						</Card>
					) : null}

					<div className="ext-feedback-page__actions">
						<Button
							stretched
							size="l"
							mode="secondary"
							before={<Icon24Attach />}
							disabled={loading || files.length >= MAX_FILES}
							onClick={() => fileInputRef.current?.click()}
						>
							{files.length ? "Добавить файлы" : "Прикрепить файлы"}
						</Button>

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
				</div>
			</Group>
		</Panel>
	);
};

export default FeedbackPage;
