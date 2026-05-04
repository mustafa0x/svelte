const MAX_TRACE = 500;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;
const SHOW_COMMENT = 128;

export function hydration_debug_enabled() {
	return /** @type {any} */ (globalThis).__SVELTE_HYDRATION_DEBUG__ === true;
}

/**
 * @param {string} type
 * @param {Record<string, any> | (() => Record<string, any>)} [detail]
 */
export function hydration_debug(type, detail = {}) {
	if (!hydration_debug_enabled()) return;

	var globals = /** @type {any} */ (globalThis);
	var resolved_detail = typeof detail === 'function' ? detail() : detail;
	var entry = {
		t: now(),
		type,
		...scroll_debug(),
		...resolved_detail
	};

	var trace = (globals.__SVELTE_HYDRATION_TRACE__ ??= []);
	trace.push(entry);
	if (trace.length > MAX_TRACE) {
		trace.splice(0, trace.length - MAX_TRACE);
	}

	globals.__SVELTE_LAST_HYDRATION_EVENT__ = entry;
	globals.console?.debug?.('[svelte-hydration]', type, entry);
}

/**
 * @param {unknown} error
 */
export function hydration_debug_error(error) {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack?.split('\n').slice(0, 6).join('\n')
		};
	}

	return String(error);
}

export function hydration_debug_stack() {
	return new Error().stack?.split('\n').slice(2, 8).join('\n');
}

/**
 * @param {Node | null | undefined} node
 */
export function hydration_debug_node(node) {
	if (node === null || node === undefined) return node;

	if (node.nodeType === ELEMENT_NODE) {
		var element = /** @type {Element} */ (node);
		return {
			node: 'element',
			name: element.localName,
			id: element.id || undefined,
			class: typeof element.className === 'string' ? truncate(element.className, 80) : undefined,
			children: element.childElementCount,
			text: truncate(element.textContent)
		};
	}

	if (node.nodeType === COMMENT_NODE) {
		return {
			node: 'comment',
			data: /** @type {Comment} */ (node).data
		};
	}

	if (node.nodeType === TEXT_NODE) {
		return {
			node: 'text',
			text: truncate(node.nodeValue)
		};
	}

	if (node.nodeType === DOCUMENT_NODE) {
		return { node: 'document' };
	}

	if (node.nodeType === DOCUMENT_FRAGMENT_NODE) {
		return { node: 'fragment', children: node.childNodes.length };
	}

	return {
		node: node.nodeName,
		type: node.nodeType
	};
}

/**
 * @param {Node | null | undefined} root
 */
export function hydration_debug_markers(root) {
	var globals = /** @type {any} */ (globalThis);
	var document = globals.document;
	if (!document || !root) return undefined;

	var total = 0;
	/** @type {Record<string, number>} */
	var counts = {};
	/** @type {string[]} */
	var sample = [];
	var walker = document.createTreeWalker(root, SHOW_COMMENT);
	var node;

	while ((node = walker.nextNode())) {
		var data = /** @type {Comment} */ (node).data;
		total += 1;
		counts[data] = (counts[data] ?? 0) + 1;
		if (sample.length < 12) sample.push(data);
		if (total >= 1000) break;
	}

	return { total, counts, sample };
}

function scroll_debug() {
	var globals = /** @type {any} */ (globalThis);
	var document = globals.document;
	if (!document) return {};

	var element = document.documentElement;
	var body = document.body;
	var center = null;

	try {
		center = document.elementFromPoint(globals.innerWidth / 2, globals.innerHeight / 2);
	} catch {
		// ignore
	}

	return {
		url: globals.location?.href,
		scroll: {
			x: globals.scrollX ?? 0,
			y: globals.scrollY ?? 0,
			iw: globals.innerWidth,
			ih: globals.innerHeight,
			dh: element?.scrollHeight,
			bh: body?.scrollHeight,
			rs: document.readyState,
			center: hydration_debug_node(center)
		}
	};
}

function now() {
	var globals = /** @type {any} */ (globalThis);
	return Math.round((globals.performance?.now?.() ?? Date.now()) * 10) / 10;
}

/**
 * @param {string | null | undefined} value
 * @param {number} [length]
 */
function truncate(value, length = 120) {
	if (value == null) return undefined;

	var normalized = String(value).replace(/\s+/g, ' ').trim();
	return normalized.length > length ? `${normalized.slice(0, length)}...` : normalized;
}
