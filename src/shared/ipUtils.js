import punycode from "punycode/";

const IPV4_RE =
	/^(?:(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])\.){3}(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])$/;

const DOMAIN_RE =
	/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:xn--[a-z0-9-]+|[a-z]{2,})$/;

export const isIPv4 = (s) => IPV4_RE.test(s);

export const ipv4ToInt = (s) => {
	if (!IPV4_RE.test(s)) return null;

	const parts = s.split(".").map(Number);

	return (
		((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
	);
};

export const intToIpv4 = (n) =>
	`${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;

export const parseIPv6 = (input) => {
	if (!input || input.length > 45) return null;

	let str = String(input).toLowerCase();

	const lastColon = str.lastIndexOf(":");

	if (lastColon >= 0 && str.indexOf(".", lastColon) >= 0) {
		const v4 = str.slice(lastColon + 1);
		const v4Int = ipv4ToInt(v4);
		if (v4Int === null) return null;
		str =
			str.slice(0, lastColon + 1) +
			((v4Int >>> 16) & 0xffff).toString(16) +
			":" +
			(v4Int & 0xffff).toString(16);
	}

	const dcMatches = str.match(/::/g);

	if (dcMatches && dcMatches.length > 1) return null;

	let groups;

	if (str.indexOf("::") >= 0) {
		const [head, tail] = str.split("::");

		const headGroups = head ? head.split(":") : [];

		const tailGroups = tail ? tail.split(":") : [];

		const fillCount = 8 - headGroups.length - tailGroups.length;

		if (fillCount < 0) return null;

		groups = [...headGroups, ...new Array(fillCount).fill("0"), ...tailGroups];
	} else {
		groups = str.split(":");
	}

	if (groups.length !== 8) return null;

	const result = new Array(8);

	for (let i = 0; i < 8; i++) {
		const g = groups[i];
		if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
		result[i] = parseInt(g, 16);
	}

	return result;
};

export const formatIPv6 = (groups) => {
	if (!groups || groups.length !== 8) return null;

	let bestStart = -1;

	let bestLen = 1;

	let curStart = -1;

	let curLen = 0;

	for (let i = 0; i <= 8; i++) {
		if (i < 8 && groups[i] === 0) {
			if (curStart === -1) curStart = i;
			curLen++;
		} else {
			if (curLen > bestLen) {
				bestStart = curStart;
				bestLen = curLen;
			}
			curStart = -1;
			curLen = 0;
		}
	}

	const parts = groups.map((g) => g.toString(16));

	if (bestStart === -1) return parts.join(":");

	const head = parts.slice(0, bestStart).join(":");

	const tail = parts.slice(bestStart + bestLen).join(":");

	return `${head}::${tail}`;
};

const applyV6Mask = (groups, prefix) => {
	const result = groups.slice();

	for (let i = 0; i < 8; i++) {
		const startBit = i * 16;

		if (startBit >= prefix) {
			result[i] = 0;
		} else if (startBit + 16 > prefix) {
			const bits = prefix - startBit;
			const mask = (0xffff << (16 - bits)) & 0xffff;
			result[i] = result[i] & mask;
		}
	}

	return result;
};

const parseDomainInternal = (input) => {
	const trimmed = input.trim().toLowerCase();

	if (!trimmed) return null;

	const isWildcard = trimmed.startsWith("*.");

	let work = isWildcard ? trimmed.slice(2) : trimmed;

	try {
		const url = new URL(work.includes("://") ? work : `https://${work}`);

		work = url.hostname;
	} catch {}

	work = work.replace(/\/+$/, "");

	try {
		work = punycode.toASCII(work);
	} catch {}

	const domain = isWildcard ? `*.${work}` : work;

	if (!DOMAIN_RE.test(domain)) return null;

	return domain;
};

export const parseRule = (input) => {
	const trimmed = String(input || "").trim();

	if (!trimmed) return null;

	const slashIdx = trimmed.lastIndexOf("/");

	if (slashIdx > 0 && /^\d+$/.test(trimmed.slice(slashIdx + 1))) {
		const left = trimmed.slice(0, slashIdx);
		const prefix = parseInt(trimmed.slice(slashIdx + 1), 10);

		const v4 = ipv4ToInt(left);

		if (v4 !== null) {
			if (prefix < 0 || prefix > 32) return null;
			const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
			const network = (v4 & mask) >>> 0;
			return { kind: "ipv4cidr", network: intToIpv4(network), prefix };
		}

		const v6 = parseIPv6(left);

		if (v6) {
			if (prefix < 0 || prefix > 128) return null;
			const masked = applyV6Mask(v6, prefix);
			return { kind: "ipv6cidr", network: formatIPv6(masked), prefix };
		}

		return null;
	}

	if (IPV4_RE.test(trimmed)) {
		return { kind: "ipv4", value: trimmed };
	}

	const v6 = parseIPv6(trimmed);

	if (v6) {
		return { kind: "ipv6", value: formatIPv6(v6) };
	}

	const domain = parseDomainInternal(trimmed);

	if (domain) return { kind: "domain", value: domain };

	return null;
};

export const formatRule = (rule) => {
	if (!rule) return null;
	if (rule.kind === "domain" || rule.kind === "ipv4" || rule.kind === "ipv6") {
		return rule.value;
	}
	if (rule.kind === "ipv4cidr" || rule.kind === "ipv6cidr") {
		return `${rule.network}/${rule.prefix}`;
	}
	return null;
};

export const inCidrV4 = (host, networkStr, prefix) => {
	const h = ipv4ToInt(host);

	const n = ipv4ToInt(networkStr);

	if (h === null || n === null) return false;
	if (prefix === 0) return true;

	const mask = (~0 << (32 - prefix)) >>> 0;

	return (h & mask) === (n & mask);
};

export const inCidrV6 = (hostBytes, networkBytes, prefix) => {
	if (!hostBytes || !networkBytes) return false;

	for (let i = 0; i < 8; i++) {
		const startBit = i * 16;
		if (startBit >= prefix) return true;
		if (startBit + 16 <= prefix) {
			if (hostBytes[i] !== networkBytes[i]) return false;
		} else {
			const bits = prefix - startBit;
			const mask = (0xffff << (16 - bits)) & 0xffff;
			if ((hostBytes[i] & mask) !== (networkBytes[i] & mask)) return false;
		}
	}

	return true;
};

const v6IsV4Mapped = (bytes) =>
	bytes[0] === 0 &&
	bytes[1] === 0 &&
	bytes[2] === 0 &&
	bytes[3] === 0 &&
	bytes[4] === 0 &&
	bytes[5] === 0xffff;

const v6ToMappedV4 = (bytes) =>
	`${(bytes[6] >> 8) & 0xff}.${bytes[6] & 0xff}.${(bytes[7] >> 8) & 0xff}.${bytes[7] & 0xff}`;

export const matchRule = (hostname, rule) => {
	if (!rule || !hostname) return false;

	if (rule.kind === "domain") {
		const pattern = rule.value;
		if (pattern.startsWith("*.")) {
			const base = pattern.slice(2);
			if (!base) return false;
			return hostname === base || hostname.endsWith("." + base);
		}
		return hostname === pattern || hostname.endsWith("." + pattern);
	}

	const hostV4 = IPV4_RE.test(hostname) ? hostname : null;

	const hostV6 = !hostV4 ? parseIPv6(hostname) : null;

	if (rule.kind === "ipv4") {
		if (hostV4 === rule.value) return true;
		if (hostV6 && v6IsV4Mapped(hostV6) && v6ToMappedV4(hostV6) === rule.value)
			return true;
		return false;
	}

	if (rule.kind === "ipv4cidr") {
		if (hostV4 && inCidrV4(hostV4, rule.network, rule.prefix)) return true;
		if (hostV6 && v6IsV4Mapped(hostV6))
			return inCidrV4(v6ToMappedV4(hostV6), rule.network, rule.prefix);
		return false;
	}

	if (rule.kind === "ipv6") {
		if (!hostV6) return false;
		const ruleBytes = parseIPv6(rule.value);
		if (!ruleBytes) return false;
		for (let i = 0; i < 8; i++) if (hostV6[i] !== ruleBytes[i]) return false;
		return true;
	}

	if (rule.kind === "ipv6cidr") {
		if (!hostV6) return false;
		const netBytes = parseIPv6(rule.network);
		return inCidrV6(hostV6, netBytes, rule.prefix);
	}

	return false;
};
