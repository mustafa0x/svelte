import Renderer from '../Renderer';
import Block from '../Block';
import Wrapper from './shared/Wrapper';
import { b, x } from 'code-red';
import add_event_handlers from './shared/add_event_handlers';
import Window from '../../nodes/Window';
import add_actions from './shared/add_actions';
import { INode } from '../../nodes/interfaces';

const associated_events = {
	innerWidth: 'resize',
	innerHeight: 'resize',
	outerWidth: 'resize',
	outerHeight: 'resize',

	scrollX: 'scroll',
	scrollY: 'scroll',
};

const properties = {
	scrollX: 'pageXOffset',
	scrollY: 'pageYOffset'
};

const readonly = new Set([
	'innerWidth',
	'innerHeight',
	'outerWidth',
	'outerHeight',
	'online',
]);

export default class WindowWrapper extends Wrapper {
	node: Window;

	constructor(renderer: Renderer, block: Block, parent: Wrapper, node: INode) {
		super(renderer, block, parent, node);
	}

	render(block: Block, _parent_node: string, _parent_nodes: string) {
		const { renderer } = this;
		const { component } = renderer;

		const events = {};
		const bindings: Record<string, string> = {};

		add_actions(component, block, '@_window', this.node.actions);
		add_event_handlers(block, '@_window', this.node.handlers);

		this.node.bindings.forEach(binding => {
			// in dev mode, throw if read-only values are written to
			if (readonly.has(binding.name)) {
				renderer.readonly.add(binding.expression.node.name);
			}

			bindings[binding.name] = binding.expression.node.name;

			// bind:online is a special case, we need to listen for two separate events
			if (binding.name === 'online') return;

			const associated_event = associated_events[binding.name];
			const property = properties[binding.name] || binding.name;

			if (!events[associated_event]) events[associated_event] = [];
			events[associated_event].push({
				name: binding.expression.node.name,
				value: property
			});
		});

		const scrolling = block.get_unique_name(`scrolling`);
		const clear_scrolling = block.get_unique_name(`clear_scrolling`);
		const scrolling_timeout = block.get_unique_name(`scrolling_timeout`);

		Object.keys(events).forEach(event => {
			const id = block.get_unique_name(`onwindow${event}`);
			const props = events[event];

			if (event === 'scroll') {
				// TODO other bidirectional bindings...
				block.add_variable(scrolling, x`false`);
				block.add_variable(clear_scrolling, x`() => { ${scrolling} = false }`);
				block.add_variable(scrolling_timeout);

				const condition = [
					bindings.scrollX && `"${bindings.scrollX}" in this._state`,
					bindings.scrollY && `"${bindings.scrollY}" in this._state`
				].filter(Boolean).join(' || ');

				const scrollX = bindings.scrollX && `this._state.${bindings.scrollX}`;
				const scrollY = bindings.scrollY && `this._state.${bindings.scrollY}`;

				renderer.meta_bindings.push(b`
					if (${condition}) {
						@_scrollTo(${scrollX || '@_window.pageXOffset'}, ${scrollY || '@_window.pageYOffset'});
					}
					${scrollX && `${scrollX} = @_window.pageXOffset;`}
					${scrollY && `${scrollY} = @_window.pageYOffset;`}
				`);

				block.event_listeners.push(b`
					@listen(@_window, "${event}", () => {
						${scrolling} = true;
						@_clearTimeout(${scrolling_timeout});
						${scrolling_timeout} = @_setTimeout(${clear_scrolling}, 100);
						ctx.${id}();
					})
				`);
			} else {
				props.forEach(prop => {
					renderer.meta_bindings.push(
						b`this._state.${prop.name} = @_window.${prop.value};`
					);
				});

				block.event_listeners.push(b`
					@listen(@_window, "${event}", ctx.${id})
				`);
			}

			component.add_var({
				name: id.name,
				internal: true,
				referenced: true
			});

			component.partly_hoisted.push(b`
				function ${id}() {
					${props.map(prop => `${prop.name} = @_window.${prop.value}; $$invalidate('${prop.name}', ${prop.name});`)}
				}
			`);

			block.chunks.init.push(b`
				@add_render_callback(ctx.${id});
			`);

			component.has_reactive_assignments = true;
		});

		// special case... might need to abstract this out if we add more special cases
		if (bindings.scrollX || bindings.scrollY) {
			block.chunks.update.push(b`
				if (${
					[bindings.scrollX, bindings.scrollY].filter(Boolean).map(
						b => `changed.${b}`
					).join(' || ')
				} && !${scrolling}) {
					${scrolling} = true;
					@_clearTimeout(${scrolling_timeout});
					@_scrollTo(${
						bindings.scrollX ? `ctx.${bindings.scrollX}` : `@_window.pageXOffset`
					}, ${
						bindings.scrollY ? `ctx.${bindings.scrollY}` : `@_window.pageYOffset`
					});
					${scrolling_timeout} = @_setTimeout(${clear_scrolling}, 100);
				}
			`);
		}

		// another special case. (I'm starting to think these are all special cases.)
		if (bindings.online) {
			const id = block.get_unique_name(`onlinestatuschanged`);
			const name = bindings.online;

			component.add_var({
				name: id.name,
				internal: true,
				referenced: true
			});

			component.partly_hoisted.push(b`
				function ${id}() {
					${name} = @_navigator.onLine; $$invalidate('${name}', ${name});
				}
			`);

			block.chunks.init.push(b`
				@add_render_callback(ctx.${id});
			`);

			block.event_listeners.push(
				`@listen(@_window, "online", ctx.${id})`,
				`@listen(@_window, "offline", ctx.${id})`
			);

			component.has_reactive_assignments = true;
		}
	}
}
