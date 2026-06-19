import { Skeleton } from "@vkontakte/vkui";
import React from "react";

const cdnDomain = __CDN_DOMAIN__.replace(/\/+$/, "");

const imgStyle = { objectFit: "contain", verticalAlign: "middle" };

const CountryFlag = ({ code, size = 24, loading = false }) => {
	const [errored, setErrored] = React.useState(false);

	React.useEffect(() => setErrored(false), [code]);

	if (!code)
		return loading ? (
			<Skeleton width={size} height={size} borderRadius={size / 2} />
		) : (
			<span style={{ fontSize: size }}>🌐</span>
		);

	if (errored) return <span style={{ fontSize: size }}>🌐</span>;

	const upper = code.toUpperCase();

	const src = `${cdnDomain}/countries/${upper}.webp`;

	return (
		<img
			src={src}
			alt={upper}
			width={size}
			height={size}
			style={imgStyle}
			onError={() => setErrored(true)}
		/>
	);
};

export default CountryFlag;
