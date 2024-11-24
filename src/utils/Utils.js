export function formatColor(string) {
	const size = string.length;

	if (size === 6 || size === 3) {
		return `#${string}`;
	}

	return '';
}

export function nearEqualsRGB(c1, c2, n = 3) {
	return c1.r.toFixed(n) === c2.r.toFixed(n) && c1.g.toFixed(n) === c2.g.toFixed(n) && c1.b.toFixed(n) === c2.b.toFixed(n);
}

export function nearEqualsXYZ(v1, v2, n = 3) {
	return v1.x.toFixed(n) === v2.x.toFixed(n) && v1.y.toFixed(n) === v2.y.toFixed(n) && v1.z.toFixed(n) === v2.z.toFixed(n);
}
