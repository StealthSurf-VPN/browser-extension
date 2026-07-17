import React, { useEffect, useRef } from "react";

const GEMINI_ICON_GRADIENT_FILL = "url(#app-gemini-icon-gradient)";

const GEMINI_ICON_USE_SELECTOR = [
	".ext-app-shell .vkuiButton--mode-secondary.vkuiButton--appearance-accent .vkuiIcon use",
	".ext-app-shell .ext-app-accent-icon use",
	".ext-app-shell .vkuiSimpleCell__before .vkuiIcon use",
	".ext-app-shell .vkuiSimpleCell__after .vkuiIcon use",
	".ext-app-shell .appearance-theme-select-option .vkuiIcon use",
	".vkuiPopoutRoot .appearance-theme-select-option .vkuiIcon use",
].join(",");

const GEMINI_ICON_SHAPE_SELECTOR = [
	"path",
	"circle",
	"ellipse",
	"line",
	"polygon",
	"polyline",
	"rect",
].join(",");

const shouldPatchGeminiIconNode = (node) => {
	const ownFill = node.getAttribute("fill");

	if (ownFill === "none") return false;
	if (ownFill) return ownFill === "currentColor";

	const inheritedFill = node.parentElement
		?.closest("[fill]")
		?.getAttribute("fill");

	return inheritedFill === "currentColor";
};

const GeminiAccent = ({ enabled }) => {
	const originalFillsRef = useRef(new Map());

	useEffect(() => {
		const restoreIconSymbols = () => {
			for (const [node, fill] of originalFillsRef.current) {
				if (fill === null) node.removeAttribute("fill");
				else node.setAttribute("fill", fill);
			}

			originalFillsRef.current.clear();
		};

		if (!enabled) {
			restoreIconSymbols();
			return undefined;
		}

		const patchIconSymbols = () => {
			const symbolIds = new Set();

			for (const use of document.querySelectorAll(GEMINI_ICON_USE_SELECTOR)) {
				const href = use.getAttribute("href") || use.getAttribute("xlink:href");

				if (href?.startsWith("#")) symbolIds.add(href.slice(1));
			}

			for (const symbolId of symbolIds) {
				const symbol = document.getElementById(symbolId);

				if (!symbol) continue;

				for (const node of symbol.querySelectorAll(
					GEMINI_ICON_SHAPE_SELECTOR,
				)) {
					if (!shouldPatchGeminiIconNode(node)) continue;

					if (!originalFillsRef.current.has(node))
						originalFillsRef.current.set(node, node.getAttribute("fill"));

					node.setAttribute("fill", GEMINI_ICON_GRADIENT_FILL);
				}
			}
		};

		let frame = window.requestAnimationFrame(patchIconSymbols);

		const observer = new MutationObserver(() => {
			window.cancelAnimationFrame(frame);
			frame = window.requestAnimationFrame(patchIconSymbols);
		});

		observer.observe(document.body, { childList: true, subtree: true });

		return () => {
			window.cancelAnimationFrame(frame);
			observer.disconnect();
			restoreIconSymbols();
		};
	}, [enabled]);

	return (
		<svg
			className="ext-accent-gradient-defs"
			width="0"
			height="0"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<linearGradient
					id="app-gemini-accent-gradient"
					x1="0%"
					y1="100%"
					x2="100%"
					y2="0%"
				>
					<stop offset="0%" stopColor="#FBBC04" />
					<stop offset="22%" stopColor="#FBBC04" />
					<stop offset="42%" stopColor="#34A853" />
					<stop offset="66%" stopColor="#4285F4" />
					<stop offset="82%" stopColor="#8AB4F8" />
					<stop offset="100%" stopColor="#EA4335" />
				</linearGradient>
				<linearGradient
					id="app-gemini-icon-gradient"
					gradientUnits="userSpaceOnUse"
					x1="0"
					y1="24"
					x2="24"
					y2="0"
				>
					<stop offset="0%" stopColor="#FBBC04" />
					<stop offset="30%" stopColor="#34A853" />
					<stop offset="62%" stopColor="#4285F4" />
					<stop offset="82%" stopColor="#8AB4F8" />
					<stop offset="100%" stopColor="#EA4335" />
				</linearGradient>
			</defs>
		</svg>
	);
};

export default GeminiAccent;
