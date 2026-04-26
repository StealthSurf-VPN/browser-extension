import React from "react";
import { createRoot } from "react-dom/client";
import { RecoilRoot } from "recoil";
import App from "./App";

if (/Android|Mobile/i.test(navigator.userAgent))
	document.documentElement.classList.add("is-mobile");

const root = createRoot(document.getElementById("root"));

root.render(
	<RecoilRoot>
		<App />
	</RecoilRoot>,
);
