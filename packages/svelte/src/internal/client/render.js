/** @import { ComponentContext, Effect, EffectNodes, TemplateNode } from '#client' */
/** @import { Component, ComponentType, SvelteComponent, MountOptions } from '../../index.js' */
import { DEV } from 'esm-env';
import {
	clear_text_content,
	create_comment,
	create_text,
	get_first_child,
	get_next_sibling,
	init_operations
} from './dom/operations.js';
import { HYDRATION_END, HYDRATION_ERROR, HYDRATION_START } from '../../constants.js';
import { active_effect } from './runtime.js';
import { push, pop, component_context } from './context.js';
import { component_root } from './reactivity/effects.js';
import {
	hydrate_node,
	hydrating,
	mounting_hydratable,
	mark_mounting_hydratable_effect,
	set_hydrate_node,
	set_hydrating,
	set_mounting_hydratable
} from './dom/hydration.js';
import { array_from } from '../shared/utils.js';
import {
	all_registered_events,
	handle_event_propagation,
	root_event_handles
} from './dom/elements/events.js';
import * as w from './warnings.js';
import * as e from './errors.js';
import { assign_nodes } from './dom/template.js';
import { is_passive_event } from '../../utils.js';
import { COMMENT_NODE, STATE_SYMBOL, TEXT_CACHE } from './constants.js';
import { boundary } from './dom/blocks/boundary.js';
import {
	hydration_debug,
	hydration_debug_error,
	hydration_debug_markers,
	hydration_debug_node
} from './debug.js';

/**
 * This is normally true — block effects should run their intro transitions —
 * but is false during hydration (unless `options.intro` is `true`) and
 * when creating the children of a `<svelte:element>` that just changed tag
 */
export let should_intro = true;

/** @param {boolean} value */
export function set_should_intro(value) {
	should_intro = value;
}

/**
 * @param {Element} text
 * @param {string} value
 * @returns {void}
 */
export function set_text(text, value) {
	// For objects, we apply string coercion (which might make things like $state array references in the template reactive) before diffing
	var str = value == null ? '' : typeof value === 'object' ? `${value}` : value;
	// prettier-ignore
	if (str !== (/** @type {any} */ (text)[TEXT_CACHE] ??= text.nodeValue)) {
		/** @type {any} */ (text)[TEXT_CACHE] = str;
		text.nodeValue = `${str}`;
	}
}

/**
 * Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
 * Transitions will play during the initial render unless the `intro` option is set to `false`.
 *
 * @template {Record<string, any>} Props
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
 * @param {MountOptions<Props>} options
 * @returns {Exports}
 */
export function mount(component, options) {
	return _mount(component, options);
}

/**
 * Hydrates a component on the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component
 *
 * @template {Record<string, any>} Props
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
 * @param {{} extends Props ? {
 * 		target: Document | Element | ShadowRoot;
 * 		props?: Props;
 * 		events?: Record<string, (e: any) => any>;
 *  	context?: Map<any, any>;
 * 		intro?: boolean;
 * 		recover?: boolean;
 *		transformError?: (error: unknown) => unknown;
 * 	} : {
 * 		target: Document | Element | ShadowRoot;
 * 		props: Props;
 * 		events?: Record<string, (e: any) => any>;
 *  	context?: Map<any, any>;
 * 		intro?: boolean;
 * 		recover?: boolean;
 *		transformError?: (error: unknown) => unknown;
 * 	}} options
 * @returns {Exports}
 */
export function hydrate(component, options) {
	init_operations();
	options.intro = options.intro ?? false;
	const target = options.target;
	const was_hydrating = hydrating;
	const previous_hydrate_node = hydrate_node;

	try {
		hydration_debug('hydrate:start', () => ({
			target: hydration_debug_node(target),
			markers: hydration_debug_markers(target)
		}));

		var anchor = get_first_child(target);
		var skipped = 0;

		while (
			anchor &&
			(anchor.nodeType !== COMMENT_NODE || /** @type {Comment} */ (anchor).data !== HYDRATION_START)
		) {
			anchor = get_next_sibling(anchor);
			skipped += 1;
		}

		if (!anchor) {
			hydration_debug('hydrate:anchor-missing', () => ({
				skipped,
				target: hydration_debug_node(target),
				markers: hydration_debug_markers(target)
			}));
			throw HYDRATION_ERROR;
		}

		set_hydrating(true);
		set_hydrate_node(/** @type {Comment} */ (anchor));
		hydration_debug('hydrate:anchor-found', {
			skipped,
			anchor: hydration_debug_node(anchor)
		});

		const instance = _mount(component, { ...options, anchor });

		set_hydrating(false);
		hydration_debug('hydrate:success', () => ({
			hydrate_node: hydration_debug_node(hydrate_node),
			markers: hydration_debug_markers(target)
		}));

		return /**  @type {Exports} */ (instance);
	} catch (error) {
		// re-throw Svelte errors - they are certainly not related to hydration
		if (
			error instanceof Error &&
			error.message.split('\n').some((line) => line.startsWith('https://svelte.dev/e/'))
		) {
			throw error;
		}
		if (error !== HYDRATION_ERROR) {
			// eslint-disable-next-line no-console
			console.warn('Failed to hydrate: ', error);
		}

		if (options.recover === false) {
			e.hydration_failed();
		}

		hydration_debug('hydrate:recover', () => ({
			error: hydration_debug_error(error),
			target: hydration_debug_node(target),
			markers: hydration_debug_markers(target)
		}));

		// If an error occurred above, the operations might not yet have been initialised.
		init_operations();
		clear_text_content(target);
		hydration_debug('hydrate:target-cleared', () => ({
			target: hydration_debug_node(target),
			markers: hydration_debug_markers(target)
		}));

		set_hydrating(false);
		return mount(component, options);
	} finally {
		set_hydrating(was_hydrating);
		set_hydrate_node(previous_hydrate_node);
	}
}

/** @type {Map<EventTarget, Map<string, number>>} */
const listeners = new Map();

/**
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<any>> | Component<any>} Component
 * @param {MountOptions} options
 * @returns {Exports}
 */
function _mount(
	Component,
	{ target, anchor, props = {}, events, context, intro = true, transformError, hydratable = false }
) {
	init_operations();
	hydration_debug('mount:start', {
		target: hydration_debug_node(target),
		anchor: hydration_debug_node(anchor),
		hydrating,
		hydratable,
		intro
	});

	/** @type {Exports} */
	// @ts-expect-error will be defined because the render effect runs synchronously
	var component = undefined;

	var unmount = component_root(() => {
		var hydratable_mount = hydratable && !hydrating;
		/** @type {Node} */
		var anchor_node;
		/** @type {Comment | undefined} */
		var start_marker;
		var was_mounting_hydratable = mounting_hydratable;

		if (hydratable_mount) {
			mark_mounting_hydratable_effect(/** @type {Effect} */ (active_effect));
		}

		if (hydratable_mount) {
			anchor_node =
				anchor === undefined
					? target.appendChild(create_comment(HYDRATION_END))
					: target.insertBefore(create_comment(HYDRATION_END), anchor);

			start_marker = create_comment(HYDRATION_START);
			target.insertBefore(start_marker, anchor_node);
			hydration_debug('mount:hydratable-markers-created', {
				start_marker: hydration_debug_node(start_marker),
				anchor_node: hydration_debug_node(anchor_node)
			});
		} else {
			anchor_node = anchor ?? target.appendChild(create_text());
		}

		boundary(
			/** @type {TemplateNode} */ (anchor_node),
			{
				pending: () => {}
			},
			(anchor_node) => {
				push({});
				var ctx = /** @type {ComponentContext} */ (component_context);
				if (context) ctx.c = context;

				if (events) {
					// We can't spread the object or else we'd lose the state proxy stuff, if it is one
					/** @type {any} */ (props).$$events = events;
				}

				if (hydrating) {
					assign_nodes(/** @type {TemplateNode} */ (anchor_node), null);
				}

				should_intro = intro;
				set_mounting_hydratable(hydratable_mount);

				try {
					hydration_debug('mount:component-start', {
						hydrating,
						hydratable_mount,
						anchor_node: hydration_debug_node(anchor_node),
						hydrate_node: hydration_debug_node(hydrate_node)
					});
					// @ts-expect-error the public typings are not what the actual function looks like
					component = Component(anchor_node, props) || {};
					hydration_debug('mount:component-done', {
						hydrating,
						hydratable_mount,
						hydrate_node: hydration_debug_node(hydrate_node)
					});
				} finally {
					set_mounting_hydratable(was_mounting_hydratable);
					should_intro = true;
				}

				if (hydrating) {
					/** @type {Effect & { nodes: EffectNodes }} */ (active_effect).nodes.end = hydrate_node;

					if (
						hydrate_node === null ||
						hydrate_node.nodeType !== COMMENT_NODE ||
						/** @type {Comment} */ (hydrate_node).data !== HYDRATION_END
					) {
						hydration_debug('mount:hydrate-end-mismatch', {
							hydrate_node: hydration_debug_node(hydrate_node)
						});
						w.hydration_mismatch();
						throw HYDRATION_ERROR;
					}
					hydration_debug('mount:hydrate-end-ok', {
						hydrate_node: hydration_debug_node(hydrate_node)
					});
				}

				pop();
			},
			transformError
		);

		// Setup event delegation _after_ component is mounted - if an error would happen during mount, it would otherwise not be cleaned up
		/** @type {Set<string>} */
		var registered_events = new Set();

		/** @param {Array<string>} events */
		var event_handle = (events) => {
			for (var i = 0; i < events.length; i++) {
				var event_name = events[i];

				if (registered_events.has(event_name)) continue;
				registered_events.add(event_name);

				var passive = is_passive_event(event_name);

				// Add the event listener to both the container and the document.
				// The container listener ensures we catch events from within in case
				// the outer content stops propagation of the event.
				//
				// The document listener ensures we catch events that originate from elements that were
				// manually moved outside of the container (e.g. via manual portals).
				for (const node of [target, document]) {
					var counts = listeners.get(node);

					if (counts === undefined) {
						counts = new Map();
						listeners.set(node, counts);
					}

					var count = counts.get(event_name);

					if (count === undefined) {
						node.addEventListener(event_name, handle_event_propagation, { passive });
						counts.set(event_name, 1);
					} else {
						counts.set(event_name, count + 1);
					}
				}
			}
		};

		event_handle(array_from(all_registered_events));
		root_event_handles.add(event_handle);

		return () => {
			for (var event_name of registered_events) {
				for (const node of [target, document]) {
					var counts = /** @type {Map<string, number>} */ (listeners.get(node));
					var count = /** @type {number} */ (counts.get(event_name));

					if (--count == 0) {
						node.removeEventListener(event_name, handle_event_propagation);
						counts.delete(event_name);

						if (counts.size === 0) {
							listeners.delete(node);
						}
					} else {
						counts.set(event_name, count);
					}
				}
			}

			root_event_handles.delete(event_handle);

			if (anchor_node !== anchor) {
				anchor_node.parentNode?.removeChild(anchor_node);
			}

			start_marker?.parentNode?.removeChild(start_marker);

			set_mounting_hydratable(was_mounting_hydratable);
		};
	});

	mounted_components.set(component, unmount);
	return component;
}

/**
 * References of the components that were mounted or hydrated.
 * Uses a `WeakMap` to avoid memory leaks.
 */
let mounted_components = new WeakMap();

/**
 * Unmounts a component that was previously mounted using `mount` or `hydrate`.
 *
 * Since 5.13.0, if `options.outro` is `true`, [transitions](https://svelte.dev/docs/svelte/transition) will play before the component is removed from the DOM.
 *
 * Returns a `Promise` that resolves after transitions have completed if `options.outro` is true, or immediately otherwise (prior to 5.13.0, returns `void`).
 *
 * ```js
 * import { mount, unmount } from 'svelte';
 * import App from './App.svelte';
 *
 * const app = mount(App, { target: document.body });
 *
 * // later...
 * unmount(app, { outro: true });
 * ```
 * @param {Record<string, any>} component
 * @param {{ outro?: boolean }} [options]
 * @returns {Promise<void>}
 */
export function unmount(component, options) {
	const fn = mounted_components.get(component);

	if (fn) {
		mounted_components.delete(component);
		return fn(options);
	}

	if (DEV) {
		if (STATE_SYMBOL in component) {
			w.state_proxy_unmount();
		} else {
			w.lifecycle_double_unmount();
		}
	}

	return Promise.resolve();
}
