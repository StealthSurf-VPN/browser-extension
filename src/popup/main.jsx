import React from "react";
import { createRoot } from "react-dom/client";
import { RecoilRoot } from "recoil";
import { loadThemePreferences } from "../shared/themePreferences";
import App from "./App";

if (/Android|Mobile/i.test(navigator.userAgent))
	document.documentElement.classList.add("is-mobile");

const root = createRoot(document.getElementById("root"));

const renderApp = async () => {
	const storage = globalThis.browser?.storage || chrome.storage;
	const themePreferences = await loadThemePreferences(storage);

	root.render(
		<RecoilRoot>
			<App initialThemePreferences={themePreferences} />
		</RecoilRoot>,
	);
};

renderApp();
