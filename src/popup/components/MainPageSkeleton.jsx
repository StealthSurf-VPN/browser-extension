import { Icon28GlobeOutline } from "@vkontakte/icons";
import { Separator, Skeleton } from "@vkontakte/vkui";
import React from "react";

const MainPageSkeleton = () => (
	<div className="ext-main">
		<div className="ext-header">
			<div className="ext-header__logo">
				<Icon28GlobeOutline
					className="ext-app-accent-icon"
					width={24}
					height={24}
					fill="var(--vkui--color_text_accent)"
				/>
				<span className="ext-header__title">StealthSurf VPN</span>
			</div>
			<div className="ext-header__actions">
				<Skeleton width={24} height={24} borderRadius={12} />
				<Skeleton width={24} height={24} borderRadius={12} />
			</div>
		</div>

		<div className="ext-toggle-area">
			<Skeleton width={120} height={120} borderRadius={60} />
			<div className="ext-toggle-status">
				<Skeleton width={132} height={22} />
			</div>
		</div>

		<div className="ext-bottom-card">
			<div
				className="ext-config-selector__content"
				style={{ padding: "14px 16px" }}
			>
				<span className="ext-config-selector__flag">
					<Skeleton width={28} height={28} borderRadius={14} />
				</span>
				<div className="ext-config-selector__info">
					<Skeleton width={110} height={15} />
					<Skeleton width={150} height={12} style={{ marginTop: 4 }} />
				</div>
				<Skeleton width={7} height={14} />
			</div>

			<Separator className="ext-bottom-card__separator" />

			<div className="ext-location-trigger" aria-hidden="true">
				<Skeleton width={128} height={15} />
			</div>
		</div>
	</div>
);

export default MainPageSkeleton;
