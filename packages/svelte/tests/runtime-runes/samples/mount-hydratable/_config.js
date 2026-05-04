import { flushSync, hydrate, mount, tick, unmount } from 'svelte';
import { test } from '../../test';

const props = {
	show: true,
	items: [1, 2],
	answer: 42,
	keyed: 'alpha',
	raw: '<strong>raw</strong>',
	more_link: true,
	async_answer: 'done'
};

function get_orphan_head_markers() {
	return Array.from(document.head.childNodes)
		.filter(
			(node) =>
				node.nodeType === Node.COMMENT_NODE &&
				/** @type {Comment} */ (node).data !== '' &&
				!(/** @type {Comment} */ (node).data.startsWith('[')) &&
				!(/** @type {Comment} */ (node).data.startsWith(']')) &&
				node.nextSibling?.nodeType === Node.COMMENT_NODE &&
				/** @type {Comment} */ (node.nextSibling).data === ''
		)
		.map((node) => /** @type {Comment} */ (node).data);
}

export default test({
	mode: ['client'],

	async test({ assert, mod, warnings }) {
		const target = document.createElement('section');
		document.body.appendChild(target);
		const async_deferred = Promise.withResolvers();

		const mounted = mount(mod.default, {
			target,
			props: {
				...props,
				async_answer: async_deferred.promise
			},
			hydratable: true,
			intro: false,
			transformError: (error) => ({
				message: error instanceof Error ? error.message : String(error)
			})
		});

		flushSync();
		await tick();
		async_deferred.resolve('done');
		flushSync();
		await tick();
		mounted.set_delayed_show(true);
		flushSync();
		await tick();
		mounted.set_dynamic_component(true);
		flushSync();
		await tick();
		mounted.set_dynamic_component(false);
		flushSync();
		await tick();
		mounted.set_dynamic_component(true);
		flushSync();
		await tick();
		flushSync();

		const html = target.innerHTML;
		assert.include(html, '<!--[-->');
		assert.include(html, '<!--[0-->');
		assert.match(html, /<!--\[0-->\s*<p>delayed shown<\/p>/);
		assert.include(html, '<!--$');
		assert.include(html, '<!--[?');
		assert.include(html, '<!--]-->');
		assert.include(html, '<a data-snippet-link=""><!---->snippet alpha<!----></a>');
		assert.include(html, '<div data-sibling-components="">');

		const async_answer = /** @type {HTMLParagraphElement} */ (
			target.querySelector('[data-async-answer]')
		);
		assert.equal(async_answer.textContent, 'async done');
		assert.equal(async_answer.previousSibling?.nodeType, Node.COMMENT_NODE);
		assert.equal(/** @type {Comment} */ (async_answer.previousSibling).data, '[!');
		assert.equal(async_answer.nextSibling?.nodeType, Node.COMMENT_NODE);
		assert.equal(/** @type {Comment} */ (async_answer.nextSibling).data, ']');

		const head_html = document.head.innerHTML;
		assert.include(head_html, '<!--');
		assert.include(head_html, '<link rel="alternate" hreflang="ar" href="/ar/about">');
		assert.include(head_html, '<link rel="alternate" hreflang="x-default" href="/about">');
		assert.include(head_html, '<link rel="dynamic-alternate" hreflang="ar" href="/ar/dynamic">');
		assert.include(head_html, '<meta property="dynamic:locale:alternate" content="ar">');
		assert.deepEqual(get_orphan_head_markers(), []);

		const controlled = /** @type {HTMLDivElement} */ (
			target.querySelector('[data-controlled-html]')
		);
		assert.equal(controlled.firstChild?.nodeType, Node.COMMENT_NODE);
		assert.equal(controlled.lastChild?.nodeType, Node.COMMENT_NODE);

		const normal_target = document.createElement('section');
		document.body.appendChild(normal_target);
		const normal = mount(mod.default, {
			target: normal_target,
			props,
			intro: false,
			transformError: (error) => ({
				message: error instanceof Error ? error.message : String(error)
			})
		});

		flushSync();
		await tick();
		flushSync();

		assert.notInclude(normal_target.innerHTML, '<!--[');
		assert.notInclude(normal_target.innerHTML, '<!--$');

		await unmount(normal);
		normal_target.remove();
		await unmount(mounted);

		target.innerHTML = html;
		document.head.innerHTML = head_html;
		const hydrated = hydrate(mod.default, {
			target,
			props: { ...props, delayed_show: true, enable_dynamic: true },
			intro: false,
			recover: false,
			transformError: (error) => ({
				message: error instanceof Error ? error.message : String(error)
			})
		});

		flushSync();
		await tick();
		flushSync();

		assert.deepEqual(warnings, []);
		assert.equal(target.innerHTML, html);
		assert.htmlEqual(target.innerHTML, html);
		assert.htmlEqual(document.head.innerHTML, head_html);
		assert.deepEqual(get_orphan_head_markers(), []);
		assert.equal(
			target.querySelector('body > section > a[data-snippet-link]')?.textContent,
			'snippet alpha'
		);
		assert.equal(
			target.querySelector('[data-sibling-components]')?.textContent?.replace(/\s+/g, ' ').trim(),
			'button alpha ⌘ K sibling alpha tail alpha'
		);

		await unmount(hydrated);
		target.remove();
	}
});
