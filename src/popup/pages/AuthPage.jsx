import { Icon56GlobeOutline } from "@vkontakte/icons";
import { Button, Card, Footnote, Link, Placeholder } from "@vkontakte/vkui";
import React from "react";

const AuthPage = ({ onLogin }) => {
	return (
		<div className="ext-auth-page">
			<Card mode="outline" className="ext-auth-card">
				<Placeholder
					header="StealthSurf VPN"
					icon={<Icon56GlobeOutline />}
					noPadding
				>
					Для продолжения работы с сервисом необходимо авторизоваться в системе
				</Placeholder>

				<Button
					className="ext-auth-card__login"
					size="l"
					stretched
					onClick={onLogin}
				>
					Войти в аккаунт
				</Button>

				<Footnote className="ext-auth-card__legal">
					Продолжая, вы принимаете{" "}
					<Link
						href="https://cdn.stealthsurf.net/legal/terms-of-use.pdf"
						target="_blank"
						rel="noreferrer"
					>
						условия использования
					</Link>{" "}
					и{" "}
					<Link
						href="https://cdn.stealthsurf.net/legal/privacy-policy.pdf"
						target="_blank"
						rel="noreferrer"
					>
						политику конфиденциальности
					</Link>
				</Footnote>
			</Card>
		</div>
	);
};

export default AuthPage;
