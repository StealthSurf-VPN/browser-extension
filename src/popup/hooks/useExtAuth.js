import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { MSG, STORAGE_KEYS, sendMessage } from "../../shared/constants";
import { getIsAuthenticated, getIsLoading } from "../state/selectors";

/**
 * Hook for managing extension authentication state.
 * Checks tokens on mount, listens for OAuth callback, provides login/logout.
 * @returns {{ isAuthenticated: boolean, isLoading: boolean, logout: () => Promise<void>, openLogin: () => Promise<void> }}
 */
const useExtAuth = () => {
	const [isAuthenticated, setIsAuthenticated] =
		useRecoilState(getIsAuthenticated);

	const [isLoading, setIsLoading] = useRecoilState(getIsLoading);

	const checkAuth = async () => {
		try {
			const result = await sendMessage({
				type: MSG.AUTH_GET_TOKENS,
			});

			if (result?.accessToken?.token) {
				setIsAuthenticated(true);
			} else {
				setIsAuthenticated(false);
			}
		} catch {
			setIsAuthenticated(false);
		} finally {
			setIsLoading(false);
		}
	};

	const logout = async () => {
		await sendMessage({ type: MSG.AUTH_CLEAR });
		setIsAuthenticated(false);
	};

	const openLogin = async () => {
		await sendMessage({ type: MSG.AUTH_LOGIN });
		window.close();
	};

	useEffect(() => {
		checkAuth();

		const listener = (changes, areaName) => {
			if (areaName !== "local") return;

			if (changes[STORAGE_KEYS.ACCESS_TOKEN]) {
				if (changes[STORAGE_KEYS.ACCESS_TOKEN].newValue?.token) {
					setIsAuthenticated(true);
				} else {
					setIsAuthenticated(false);
				}
			}
		};

		(globalThis.browser || chrome).storage.onChanged.addListener(listener);

		return () =>
			(globalThis.browser || chrome).storage.onChanged.removeListener(listener);
	}, []);

	return { isAuthenticated, isLoading, logout, openLogin };
};

export default useExtAuth;
