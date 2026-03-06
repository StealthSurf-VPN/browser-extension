(async () => {
	const container = document.getElementById("content");

	try {
		const params = new URLSearchParams(window.location.search);

		const code = params.get("code");

		if (!code) throw new Error("Код авторизации не найден в URL");

		const result = await browser.runtime.sendMessage({
			type: "AUTH_FIREFOX_CODE",
			code,
		});

		if (result?.error) throw new Error(result.error);

		container.innerHTML =
			'<div class="success">&#10003;</div>' +
			"<h2>Авторизация успешна</h2>" +
			"<p>Можете закрыть эту вкладку и вернуться в расширение.</p>";

		setTimeout(() => window.close(), 2000);
	} catch (err) {
		container.innerHTML =
			'<div class="error">&#10007;</div>' +
			"<h2>Ошибка авторизации</h2>" +
			"<p></p>";
		container.querySelector("p").textContent = err.message;
	}
})();
