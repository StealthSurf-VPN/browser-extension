import { resolve } from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default ({ mode }) => {
	const env = loadEnv(mode, process.cwd());

	const target = process.env.VITE_TARGET || "chrome";

	if (!env.VITE_BACKEND_URL) {
		throw new Error("VITE_BACKEND_URL is not defined in .env");
	}

	if (!env.VITE_CONSOLE_URL) {
		throw new Error("VITE_CONSOLE_URL is not defined in .env");
	}

	return defineConfig({
		plugins: [react()],
		base: "./",
		define: {
			__BACKEND_URL__: JSON.stringify(env.VITE_BACKEND_URL),
			__CONSOLE_URL__: JSON.stringify(env.VITE_CONSOLE_URL),
			__IS_FIREFOX__: target === "firefox",
		},
		build: {
			chunkSizeWarningLimit: Infinity,
			outDir: `dist/${target}`,
			emptyOutDir: true,
			rollupOptions: {
				input: {
					popup: resolve(__dirname, "src/assets/popup.html"),
					background: resolve(__dirname, "src/background/index.js"),
				},
				output: {
					entryFileNames: "[name].js",
					chunkFileNames: "chunks/[name]-[hash].js",
					assetFileNames: "assets/[name]-[hash][extname]",
				},
			},
			target: "esnext",
			minify: mode === "production",
			sourcemap: mode !== "production",
		},
	});
};
