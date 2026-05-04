<script>
	import ButtonLike from './ButtonLike.svelte';
	import IconLike from './IconLike.svelte';
	import LinkLike from './LinkLike.svelte';
	import DynamicLike from './DynamicLike.svelte';
	import HeadLike from './HeadLike.svelte';
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
		delayed_show = false
	} = $props();

	const uid = $props.id();
	let delayed = $state(delayed_show);
	let DynamicComponent = $state(enable_dynamic ? DynamicLike : null);

	export function set_delayed_show(value) {
		delayed = value;
	}

	export function set_dynamic_component(value) {
		DynamicComponent = value ? DynamicLike : null;
	}
</script>

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
