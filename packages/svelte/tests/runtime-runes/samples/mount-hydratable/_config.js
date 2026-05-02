import { flushSync, hydrate, mount, tick, unmount } from 'svelte';
import { test } from '../../test';

const props = {
	show: true,
	items: [1, 2],
	answer: 42,
	keyed: 'alpha',
	raw: '<strong>raw</strong>',
	more_link: true
};

export default test({
	mode: ['client'],

	async test({ assert, mod, warnings }) {
		const target = document.createElement('section');
		document.body.appendChild(target);

		const mounted = mount(mod.default, {
			target,
			props,
			hydratable: true,
			intro: false,
			transformError: (error) => ({
				message: error instanceof Error ? error.message : String(error)
			})
		});

		flushSync();
		await tick();
		flushSync();

		const html = target.innerHTML;
		assert.include(html, '<!--[-->');
		assert.include(html, '<!--[0-->');
		assert.include(html, '<!--$');
		assert.include(html, '<!--[?');
		assert.include(html, '<!--]-->');

		const controlled = /** @type {HTMLDivElement} */ (
			target.querySelector('[data-controlled-html]')
		);
		assert.equal(controlled.firstChild?.nodeType, Node.COMMENT_NODE);
		assert.equal(controlled.lastChild?.nodeType, Node.COMMENT_NODE);

		await unmount(mounted);

		target.innerHTML = html;
		const hydrated = hydrate(mod.default, {
			target,
			props,
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
		assert.htmlEqual(target.innerHTML, html);

		await unmount(hydrated);
		target.remove();
	}
});
