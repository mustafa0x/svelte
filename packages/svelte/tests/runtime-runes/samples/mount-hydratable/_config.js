import { flushSync, hydrate, mount, unmount } from 'svelte';
import { test } from '../../test';

const props = {
	show: true,
	items: [1, 2],
	answer: 42,
	keyed: 'alpha',
	raw: '<strong>raw</strong>'
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
			intro: false
		});

		flushSync();

		const html = target.innerHTML;
		assert.include(html, '<!--[-->');
		assert.include(html, '<!--[0-->');
		assert.include(html, '<!--]-->');

		await unmount(mounted);

		target.innerHTML = html;
		const hydrated = hydrate(mod.default, {
			target,
			props,
			intro: false,
			recover: false
		});

		flushSync();

		assert.deepEqual(warnings, []);
		assert.htmlEqual(target.innerHTML, html);

		await unmount(hydrated);
		target.remove();
	}
});
