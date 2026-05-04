<script>
	import { mount, unmount } from 'svelte';
	import ButtonLike from './ButtonLike.svelte';
	import IconLike from './IconLike.svelte';
	import LinkLike from './LinkLike.svelte';
	import DynamicLike from './DynamicLike.svelte';
	import HeadLike from './HeadLike.svelte';
	import NestedPublic from './NestedPublic.svelte';
	import Throws from './Throws.svelte';

	let {
		show = true,
		items = [1, 2],
		answer = 42,
		keyed = 'alpha',
		raw = '<strong>raw</strong>',
		more_link = true,
		async_answer = 'done',
		enable_dynamic = false,
		delayed_show = false,
		html_visible = true,
		nested_mount_visible = true
	} = $props();

	const uid = $props.id();
	let delayed = $state(delayed_show);
	let show_html = $state(html_visible);
	let show_nested_mount = $state(nested_mount_visible);
	let DynamicComponent = $state(enable_dynamic ? DynamicLike : null);

	export function set_delayed_show(value) {
		delayed = value;
	}

	export function set_show_html(value) {
		show_html = value;
	}

	export function set_nested_mount_visible(value) {
		show_nested_mount = value;
	}

	export function set_dynamic_component(value) {
		DynamicComponent = value ? DynamicLike : null;
	}

	function nestedMount(node) {
		const nested = mount(NestedPublic, {
			target: node,
			intro: false
		});

		return {
			destroy() {
				void unmount(nested);
			}
		};
	}
</script>

{keyed}<p data-after-text>after text</p>

<label for={uid}>Generated id</label>
<input id={uid} />

{#if show}
	<p>shown</p>
{:else}
	<p>hidden</p>
{/if}

{#if delayed}
	<p>delayed shown</p>
{:else}
	<p>delayed hidden</p>
{/if}

{#each items as item (item)}
	<span>{item}</span>
{:else}
	<span>empty</span>
{/each}

{#await answer}
	<p>pending</p>
{:then value}
	<p>await {value}</p>
{/await}

{#await async_answer}
	<p data-async-answer>async pending</p>
{:then value}
	<p data-async-answer>async {value}</p>
{/await}

{#key keyed}
	<p>key {keyed}</p>
{/key}

{@html raw}

<div data-controlled-html>{@html raw}</div>

<div data-html-toggle>
	{#if show_html}
		{@html raw}
	{/if}
</div>

{#if show_nested_mount}
	<div data-nested-public-mount use:nestedMount></div>
{/if}

<svelte:element this={more_link ? 'a' : 'div'} data-kind="more">more</svelte:element>

<div data-sibling-components>
	<ButtonLike>
		<IconLike />
		<span>button {keyed}</span>
		<div>
			<span>{#if show}⌘{:else}Ctrl{/if}</span>
			<span>K</span>
		</div>
	</ButtonLike>
	{#if show}
		<LinkLike>sibling {keyed}</LinkLike>
	{/if}
	<LinkLike>tail {keyed}</LinkLike>
</div>

<LinkLike>snippet {keyed}</LinkLike>

<HeadLike value={keyed} />

{#key keyed}
	{#if DynamicComponent}
		<DynamicComponent value={keyed} />
	{/if}
{/key}

<svelte:boundary>
	<Throws />

	{#snippet failed(error)}
		<p data-boundary-failed>{error.message}</p>
	{/snippet}
</svelte:boundary>
