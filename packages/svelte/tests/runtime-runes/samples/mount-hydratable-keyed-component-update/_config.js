import { flushSync, mount, unmount } from 'svelte';
import { test } from '../../test';

export default test({
	mode: ['client'],

	async test({ assert, mod }) {
		const target = document.createElement('section');
		document.body.appendChild(target);

		const mounted = mount(mod.default, {
			target,
			hydratable: true,
			intro: false
		});

		flushSync();
		assert.htmlEqual(target.innerHTML, '<p>alpha</p>');

		mounted.swap();
		flushSync();
		assert.htmlEqual(target.innerHTML, '<section>beta</section>');

		await unmount(mounted);
		target.remove();
	}
});
