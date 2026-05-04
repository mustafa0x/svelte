import { flushSync, hydrate, mount, tick, unmount } from 'svelte';
import { test } from '../../test';

export default test({
	mode: ['client'],
	skip_no_async: true,

	async test({ assert, mod, warnings }) {
		const target = document.createElement('section');
		document.body.appendChild(target);
		const deferred = Promise.withResolvers();

		const mounted = mount(mod.default, {
			target,
			props: {
				boundary_answer: deferred.promise
			},
			hydratable: true,
			intro: false
		});

		flushSync();
		await tick();

		const pending = /** @type {HTMLParagraphElement} */ (
			target.querySelector('[data-boundary-pending]')
		);
		assert.equal(pending.textContent, 'boundary pending');
		assert.equal(pending.previousSibling?.nodeType, Node.COMMENT_NODE);
		assert.equal(/** @type {Comment} */ (pending.previousSibling).data, '[!');

		deferred.resolve('boundary done');
		flushSync();
		await tick();
		flushSync();

		const boundary_main = /** @type {HTMLParagraphElement} */ (
			target.querySelector('[data-boundary-main]')
		);
		assert.equal(boundary_main.textContent, 'boundary done');
		assert.equal(boundary_main.previousSibling?.nodeType, Node.COMMENT_NODE);
		assert.equal(/** @type {Comment} */ (boundary_main.previousSibling).data, '[');
		assert.equal(boundary_main.nextSibling?.nodeType, Node.COMMENT_NODE);
		assert.equal(/** @type {Comment} */ (boundary_main.nextSibling).data, ']');

		const html = target.innerHTML;
		await unmount(mounted);

		target.innerHTML = html;
		const hydrated = hydrate(mod.default, {
			target,
			props: {
				boundary_answer: 'boundary done'
			},
			intro: false,
			recover: false
		});

		flushSync();
		await tick();
		flushSync();

		assert.deepEqual(warnings, []);
		assert.equal(target.innerHTML, html);

		await unmount(hydrated);
		target.remove();
	}
});
