/** @import { TemplateNode } from '#client' */

import { COMMENT_NODE } from '#client/constants';
import {
	HYDRATION_END,
	HYDRATION_ERROR,
	HYDRATION_START,
	HYDRATION_START_ELSE
} from '../../../constants.js';
import { active_effect } from '../runtime.js';
import * as w from '../warnings.js';
import { hydration_debug, hydration_debug_node, hydration_debug_stack } from '../debug.js';
import { get_next_sibling } from './operations.js';

/**
 * Use this variable to guard everything related to hydration code so it can be treeshaken out
 * if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
 */
export let hydrating = false;

/** @param {boolean} value */
export function set_hydrating(value) {
	if (hydrating !== value) {
		hydration_debug('hydrating:set', {
			from: hydrating,
			to: value,
			hydrate_node: hydration_debug_node(hydrate_node)
		});
	}
	hydrating = value;
}

export let mounting_hydratable = false;

/** @param {boolean} value */
export function set_mounting_hydratable(value) {
	if (mounting_hydratable !== value) {
		hydration_debug('mounting-hydratable:set', {
			from: mounting_hydratable,
			to: value,
			hydrating,
			hydrate_node: hydration_debug_node(hydrate_node)
		});
	}
	mounting_hydratable = value;
}

const mounting_hydratable_effects = new WeakSet();

/** @param {import('#client').Effect} effect */
export function mark_mounting_hydratable_effect(effect) {
	mounting_hydratable_effects.add(effect);
}

/** @param {import('#client').Effect | null} effect */
export function effect_is_mounting_hydratable(effect) {
	while (effect !== null) {
		if (mounting_hydratable_effects.has(effect)) return true;
		effect = effect.parent;
	}

	return false;
}

let mounting_hydratable_next = false;
/** @type {import('#client').Effect | null} */
let mounting_hydratable_next_effect = null;
const mounting_hydratable_next_nodes = new WeakSet();

/** @param {Node} node */
export function mark_mounting_hydratable_next(node) {
	if (mounting_hydratable_next && mounting_hydratable_next_effect === active_effect) {
		mounting_hydratable_next = false;
		mounting_hydratable_next_effect = null;
		mounting_hydratable_next_nodes.add(node);
	}
}

/** @param {Node} node */
export function consume_mounting_hydratable_next(node) {
	return mounting_hydratable && mounting_hydratable_next_nodes.delete(node);
}

/**
 * @param {TemplateNode} node
 * @param {string} [open]
 * @param {string} [close]
 * @returns {TemplateNode}
 */
export function create_hydration_marker(node, open = HYDRATION_START, close = HYDRATION_END) {
	if (hydrating || !mounting_hydratable || node.nodeType !== COMMENT_NODE) return node;

	var marker = document.createComment(open);
	node.before(marker);
	if (active_effect?.nodes?.start === node) {
		active_effect.nodes.start = marker;
	}

	var anchor = /** @type {Comment} */ (node);
	anchor.data = close;
	// @ts-expect-error used by blocks that update the opening marker
	anchor.__svelte_hydration_open = marker;
	hydration_debug('marker:create', {
		open,
		close,
		marker: hydration_debug_node(marker),
		anchor: hydration_debug_node(anchor)
	});

	return node;
}

/**
 * @param {TemplateNode} node
 * @returns {Comment}
 */
export function get_hydration_open(node) {
	// @ts-expect-error set by create_hydration_marker
	return node.__svelte_hydration_open ?? node;
}

/**
 * The node that is currently being hydrated. This starts out as the first node inside the opening
 * <!--[--> comment, and updates each time a component calls `$.child(...)` or `$.sibling(...)`.
 * When entering a block (e.g. `{#if ...}`), `hydrate_node` is the block opening comment; by the
 * time we leave the block it is the closing comment, which serves as the block's anchor.
 * @type {TemplateNode}
 */
export let hydrate_node;

/** @param {TemplateNode | null} node */
export function set_hydrate_node(node) {
	if (node === null) {
		hydration_debug('hydrate-node:null', {
			current: hydration_debug_node(hydrate_node)
		});
		w.hydration_mismatch();
		throw HYDRATION_ERROR;
	}

	return (hydrate_node = node);
}

export function hydrate_next() {
	return set_hydrate_node(get_next_sibling(hydrate_node));
}

/** @param {TemplateNode} node */
export function reset(node) {
	if (!hydrating) {
		if (mounting_hydratable && mounting_hydratable_next_effect === active_effect) {
			mounting_hydratable_next = false;
			mounting_hydratable_next_effect = null;
		}
		return;
	}

	// If the node has remaining siblings, something has gone wrong
	if (get_next_sibling(hydrate_node) !== null) {
		hydration_debug('hydrate:reset-mismatch', {
			node: hydration_debug_node(node),
			hydrate_node: hydration_debug_node(hydrate_node),
			next: hydration_debug_node(get_next_sibling(hydrate_node))
		});
		w.hydration_mismatch();
		throw HYDRATION_ERROR;
	}

	hydrate_node = node;
}

/**
 * @param {HTMLTemplateElement} template
 */
export function hydrate_template(template) {
	if (hydrating) {
		// @ts-expect-error TemplateNode doesn't include DocumentFragment, but it's actually fine
		hydrate_node = template.content;
	}
}

export function next(count = 1) {
	if (hydrating) {
		var i = count;
		var node = hydrate_node;

		while (i--) {
			node = /** @type {TemplateNode} */ (get_next_sibling(node));
		}

		hydrate_node = node;
	} else if (mounting_hydratable && count === 1) {
		mounting_hydratable_next = true;
		mounting_hydratable_next_effect = active_effect;
	}
}

/**
 * Skips or removes (depending on {@link remove}) all nodes starting at `hydrate_node` up until the next hydration end comment
 * @param {boolean} remove
 */
export function skip_nodes(remove = true) {
	var depth = 0;
	var node = hydrate_node;
	var start = node;
	var removed = 0;
	/** @type {unknown[]} */
	var sample = [];

	while (true) {
		if (node.nodeType === COMMENT_NODE) {
			var data = /** @type {Comment} */ (node).data;

			if (data === HYDRATION_END) {
				if (depth === 0) {
					hydration_debug('skip-nodes:end', () => ({
						remove,
						removed,
						start: hydration_debug_node(start),
						end: hydration_debug_node(node),
						sample,
						stack: hydration_debug_stack()
					}));
					return node;
				}
				depth -= 1;
			} else if (
				data === HYDRATION_START ||
				data === HYDRATION_START_ELSE ||
				// "[1", "[2", etc. for if blocks
				(data[0] === '[' && !isNaN(Number(data.slice(1))))
			) {
				depth += 1;
			}
		}

		var next = /** @type {TemplateNode} */ (get_next_sibling(node));
		if (remove) {
			removed += 1;
			if (sample.length < 8) sample.push(hydration_debug_node(node));
			node.remove();
		}
		node = next;
	}
}

/**
 *
 * @param {TemplateNode} node
 */
export function read_hydration_instruction(node) {
	if (!node || node.nodeType !== COMMENT_NODE) {
		hydration_debug('hydration-instruction:missing', {
			node: hydration_debug_node(node)
		});
		w.hydration_mismatch();
		throw HYDRATION_ERROR;
	}

	return /** @type {Comment} */ (node).data;
}
