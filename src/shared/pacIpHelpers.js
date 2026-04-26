var IPV4_RE =
	/^(?:(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])\.){3}(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])$/;

function hostIsV4(s) {
	return IPV4_RE.test(s);
}

function parseV4Int(s) {
	if (!IPV4_RE.test(s)) return null;
	var p = s.split(".");
	return ((+p[0] << 24) | (+p[1] << 16) | (+p[2] << 8) | +p[3]) >>> 0;
}

function parseV6(input) {
	if (!input || input.length > 45) return null;
	var str = ("" + input).toLowerCase();
	var lastColon = str.lastIndexOf(":");
	if (lastColon >= 0 && str.indexOf(".", lastColon) >= 0) {
		var v4 = str.slice(lastColon + 1);
		var v4Int = parseV4Int(v4);
		if (v4Int === null) return null;
		str =
			str.slice(0, lastColon + 1) +
			((v4Int >>> 16) & 0xffff).toString(16) +
			":" +
			(v4Int & 0xffff).toString(16);
	}
	var dc = str.match(/::/g);
	if (dc && dc.length > 1) return null;
	var groups;
	if (str.indexOf("::") >= 0) {
		var halves = str.split("::");
		var head = halves[0] ? halves[0].split(":") : [];
		var tail = halves[1] ? halves[1].split(":") : [];
		var fill = 8 - head.length - tail.length;
		if (fill < 0) return null;
		groups = head.slice();
		for (var f = 0; f < fill; f++) groups.push("0");
		for (var t = 0; t < tail.length; t++) groups.push(tail[t]);
	} else {
		groups = str.split(":");
	}
	if (groups.length !== 8) return null;
	var out = new Array(8);
	for (var i = 0; i < 8; i++) {
		var g = groups[i];
		if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
		out[i] = parseInt(g, 16);
	}
	return out;
}

function inV4(host, network, prefix) {
	var h = parseV4Int(host);
	var n = parseV4Int(network);
	if (h === null || n === null) return false;
	if (prefix === 0) return true;
	var mask = (~0 << (32 - prefix)) >>> 0;
	return (h & mask) === (n & mask);
}

function eqV6(a, b) {
	for (var i = 0; i < 8; i++) if (a[i] !== b[i]) return false;
	return true;
}

function inV6(host, network, prefix) {
	for (var i = 0; i < 8; i++) {
		var startBit = i * 16;
		if (startBit >= prefix) return true;
		if (startBit + 16 <= prefix) {
			if (host[i] !== network[i]) return false;
		} else {
			var bits = prefix - startBit;
			var mask = (0xffff << (16 - bits)) & 0xffff;
			if ((host[i] & mask) !== (network[i] & mask)) return false;
		}
	}
	return true;
}
