import {
	Card,
	CustomSelect,
	CustomSelectOption,
	Div,
	FormItem,
	Input,
} from "@vkontakte/vkui";
import React, { useEffect, useId, useMemo, useState } from "react";
import {
	ACCENT_THEMES,
	CUSTOM_ACCENT_THEME,
	getAccentTheme,
	isHexAccentColor,
	normalizeCustomAccentColor,
	normalizeCustomAccentInput,
} from "../../shared/accentThemes";
import { INTERFACE_THEMES } from "../../shared/interfaceThemes";

const ThemePreview = ({ theme }) => {
	const gradientId = useId().replace(/:/g, "");
	const geminiBaseGradientId = `${gradientId}-gemini-base`;
	const geminiRedGradientId = `${gradientId}-gemini-red`;

	if (theme.previewKind === "gemini") {
		return (
			<span
				className="appearance-theme-preview appearance-theme-preview--gemini"
				style={{
					"--appearance-theme-preview-bg": theme.previewBackground,
					"--appearance-theme-preview-color": theme.color,
				}}
				aria-hidden="true"
			>
				<svg
					className="appearance-theme-preview__gemini-icon"
					viewBox="0 0 32 32"
					focusable="false"
					aria-hidden="true"
				>
					<defs>
						<radialGradient id={geminiBaseGradientId} cx="16%" cy="60%" r="88%">
							<stop offset="0%" stopColor="#FBBC04" />
							<stop offset="30%" stopColor="#9BD35C" />
							<stop offset="48%" stopColor="#34A853" />
							<stop offset="68%" stopColor="#2AB7C9" />
							<stop offset="100%" stopColor="#4285F4" />
						</radialGradient>
						<linearGradient
							id={geminiRedGradientId}
							x1="13"
							y1="0"
							x2="20"
							y2="24"
							gradientUnits="userSpaceOnUse"
						>
							<stop offset="0%" stopColor="#EA4335" />
							<stop offset="42%" stopColor="#EA4335" stopOpacity="0.68" />
							<stop offset="78%" stopColor="#EA4335" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path
						d="M16 1C18.42 9.55 22.45 13.58 31 16C22.45 18.42 18.42 22.45 16 31C13.58 22.45 9.55 18.42 1 16C9.55 13.58 13.58 9.55 16 1Z"
						fill={`url(#${geminiBaseGradientId})`}
					/>
					<path
						d="M16 1C18.42 9.55 22.45 13.58 31 16C22.45 18.42 18.42 22.45 16 31C13.58 22.45 9.55 18.42 1 16C9.55 13.58 13.58 9.55 16 1Z"
						fill={`url(#${geminiRedGradientId})`}
					/>
				</svg>
			</span>
		);
	}

	return (
		<span
			className="appearance-theme-preview"
			style={{
				"--appearance-theme-preview-bg": theme.previewBackground,
				"--appearance-theme-preview-color": theme.color,
			}}
			aria-hidden="true"
		>
			Aa
		</span>
	);
};

const GeminiSelectedIcon = () => {
	const gradientId = useId().replace(/:/g, "");
	const geminiBaseGradientId = `${gradientId}-gemini-check-base`;
	const geminiRedGradientId = `${gradientId}-gemini-check-red`;
	const checkPath =
		"M6.25 11.45 2.55 7.75C2.2 7.4 2.2 6.83 2.55 6.48C2.9 6.13 3.47 6.13 3.82 6.48L6.25 8.91L12.18 2.98C12.53 2.63 13.1 2.63 13.45 2.98C13.8 3.33 13.8 3.9 13.45 4.25L6.89 11.45C6.72 11.62 6.49 11.7 6.25 11.7C6.02 11.7 5.78 11.62 5.61 11.45Z";

	return (
		<span className="appearance-theme-selected-icon" aria-hidden="true">
			<svg
				className="appearance-theme-selected-icon__gemini-check"
				viewBox="0 0 16 16"
				focusable="false"
				aria-hidden="true"
			>
				<defs>
					<radialGradient id={geminiBaseGradientId} cx="16%" cy="60%" r="88%">
						<stop offset="0%" stopColor="#FBBC04" />
						<stop offset="30%" stopColor="#9BD35C" />
						<stop offset="48%" stopColor="#34A853" />
						<stop offset="68%" stopColor="#2AB7C9" />
						<stop offset="100%" stopColor="#4285F4" />
					</radialGradient>
					<linearGradient
						id={geminiRedGradientId}
						x1="8"
						y1="0"
						x2="10"
						y2="13"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#EA4335" />
						<stop offset="48%" stopColor="#EA4335" stopOpacity="0.72" />
						<stop offset="88%" stopColor="#EA4335" stopOpacity="0" />
					</linearGradient>
				</defs>
				<path d={checkPath} fill={`url(#${geminiBaseGradientId})`} />
				<path d={checkPath} fill={`url(#${geminiRedGradientId})`} />
			</svg>
		</span>
	);
};

const InterfaceThemePreview = ({ themeId }) => (
	<span
		className={`interface-theme-preview interface-theme-preview--${themeId}`}
		aria-hidden="true"
	>
		<span className="interface-theme-preview__line interface-theme-preview__line--top" />
		<span className="interface-theme-preview__line interface-theme-preview__line--wide" />
		<span className="interface-theme-preview__panel">
			<span className="interface-theme-preview__panel-line interface-theme-preview__panel-line--short" />
			<span className="interface-theme-preview__panel-line" />
			<span className="interface-theme-preview__panel-line interface-theme-preview__panel-line--medium" />
		</span>
	</span>
);

const AppearanceSettings = ({
	accentTheme,
	customAccentColor,
	interfaceTheme,
	onAccentChange,
	onCustomAccentColorChange,
	onInterfaceThemeChange,
}) => {
	const [customAccentDraft, setCustomAccentDraft] = useState(customAccentColor);
	const isCustomAccentTheme = accentTheme === CUSTOM_ACCENT_THEME;
	const customAccentDraftValid = isHexAccentColor(customAccentDraft);
	const selectedTheme = getAccentTheme(accentTheme, customAccentColor);
	const options = useMemo(
		() =>
			ACCENT_THEMES.map((theme) => {
				const resolvedTheme =
					theme.id === CUSTOM_ACCENT_THEME
						? getAccentTheme(theme.id, customAccentColor)
						: theme;

				return {
					...resolvedTheme,
					value: theme.id,
					label: theme.title,
				};
			}),
		[customAccentColor],
	);

	useEffect(() => {
		setCustomAccentDraft(customAccentColor);
	}, [customAccentColor]);

	const handleCustomAccentChange = (event) => {
		const nextDraft = normalizeCustomAccentInput(event.target.value);

		setCustomAccentDraft(nextDraft);

		if (isHexAccentColor(nextDraft))
			onCustomAccentColorChange(normalizeCustomAccentColor(nextDraft));
	};

	return (
		<Card className="ext-appearance-settings">
			<Div>
				<FormItem className="appearance-theme-field" top="Тема интерфейса">
					<div
						className="interface-theme-grid"
						role="radiogroup"
						aria-label="Тема интерфейса"
					>
						{INTERFACE_THEMES.map((option) => {
							const selected = interfaceTheme === option.id;

							return (
								<label
									key={option.id}
									className={`interface-theme-option${selected ? " interface-theme-option--selected" : ""}`}
								>
									<input
										className="interface-theme-option__input"
										type="radio"
										name="interface-theme"
										value={option.id}
										checked={selected}
										onChange={() => onInterfaceThemeChange(option.id)}
									/>
									<InterfaceThemePreview themeId={option.id} />
									<span className="interface-theme-option__label">
										{option.title}
									</span>
								</label>
							);
						})}
					</div>
				</FormItem>

				<FormItem
					className="appearance-theme-field"
					top="Акцентная тема"
					bottom="Цвет кнопок, ссылок, иконок и активных элементов"
				>
					<CustomSelect
						key={accentTheme}
						className="appearance-theme-select"
						defaultValue={accentTheme}
						options={options}
						before={<ThemePreview theme={selectedTheme} />}
						forceDropdownPortal
						popupDirection="top"
						dropdownOffsetDistance={6}
						renderDropdown={({ defaultDropdownContent }) => (
							<div className="appearance-theme-dropdown-content">
								{defaultDropdownContent}
							</div>
						)}
						onChange={(event) => onAccentChange(event.target.value)}
						renderOption={({ option, selected, after, ...restProps }) => {
							const useGeminiSelectedIcon =
								selected && accentTheme === "gemini";

							return (
								<CustomSelectOption
									{...restProps}
									selected={selected}
									className={`appearance-theme-select-option${useGeminiSelectedIcon ? " appearance-theme-select-option--gemini-selected" : ""}`}
									before={<ThemePreview theme={option} />}
									after={
										useGeminiSelectedIcon ? (
											<>
												{after}
												<GeminiSelectedIcon />
											</>
										) : (
											after
										)
									}
								/>
							);
						}}
					/>
				</FormItem>

				{isCustomAccentTheme && (
					<FormItem
						className="appearance-custom-accent"
						top="HEX-код"
						status={customAccentDraftValid ? "default" : "error"}
						bottom={
							customAccentDraftValid
								? "Цвет применяется сразу"
								: "Введите цвет в формате #RRGGBB"
						}
					>
						<div className="appearance-custom-accent__row">
							<span
								className="appearance-custom-accent__swatch"
								style={{
									"--appearance-custom-accent-color": customAccentDraftValid
										? normalizeCustomAccentColor(customAccentDraft)
										: customAccentColor,
								}}
								aria-hidden="true"
							/>
							<Input
								value={customAccentDraft}
								onChange={handleCustomAccentChange}
								placeholder="#2688EB"
								maxLength={7}
								spellCheck={false}
							/>
						</div>
					</FormItem>
				)}
			</Div>
		</Card>
	);
};

export default AppearanceSettings;
