/** @import { TemplateNode } from '#client' */
import { EFFECT_TRANSPARENT } from '#client/constants';
import {
	hydrate_next,
	hydrating,
	mounting_hydratable,
	read_hydration_instruction,
	skip_nodes,
	set_hydrate_node,
	set_hydrating,
	hydrate_node,
	create_hydration_marker,
	get_hydration_open
} from '../hydration.js';
import { HYDRATION_START } from '../../../../constants.js';
import { block } from '../../reactivity/effects.js';
import { BranchManager } from './branches.js';

/**
 * @param {TemplateNode} node
 * @param {(branch: (fn: (anchor: Node) => void, key?: number | false) => void) => void} fn
 * @param {boolean} [elseif] True if this is an `{:else if ...}` block rather than an `{#if ...}`, as that affects which transitions are considered 'local'
 * @returns {void}
 */
export function if_block(node, fn, elseif = false) {
	/** @type {TemplateNode | undefined} */
	var marker;
	if (hydrating) {
		marker = hydrate_node;
		hydrate_next();
	} else if (mounting_hydratable) {
		marker = node;
		node = create_hydration_marker(node, `${HYDRATION_START}-1`);
		marker = get_hydration_open(node);
	}

	var branches = new BranchManager(node);
	var flags = elseif ? EFFECT_TRANSPARENT : 0;

	/**
	 * @param {number | false} key
	 * @param {null | ((anchor: Node) => void)} fn
	 */
	function update_branch(key, fn) {
		if (hydrating) {
			var data = read_hydration_instruction(/** @type {TemplateNode} */ (marker));

			// "[n" = branch n, "[-1" = else
			if (key !== parseInt(data.substring(1))) {
				// Hydration mismatch: remove everything inside the anchor and start fresh.
				// This could happen with `{#if browser}...{/if}`, for example
				var anchor = skip_nodes();

				set_hydrate_node(anchor);
				branches.anchor = anchor;

				set_hydrating(false);
				branches.ensure(key, fn);
				set_hydrating(true);

				return;
			}
		} else if (mounting_hydratable) {
			/** @type {Comment} */ (marker).data = `${HYDRATION_START}${key}`;
		}

		branches.ensure(key, fn);
	}

	block(() => {
		var has_branch = false;

		fn((fn, key = 0) => {
			has_branch = true;
			update_branch(key, fn);
		});

		if (!has_branch) {
			update_branch(-1, null);
		}
	}, flags);
}
