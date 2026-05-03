<script>
	import ButtonLike from './ButtonLike.svelte';
	import IconLike from './IconLike.svelte';
	import LinkLike from './LinkLike.svelte';
	import Throws from './Throws.svelte';

	let {
		show = true,
		items = [1, 2],
		answer = 42,
		keyed = 'alpha',
		raw = '<strong>raw</strong>',
		more_link = true,
		delayed_show = false
	} = $props();

	const uid = $props.id();
	let delayed = $state(delayed_show);

	export function set_delayed_show(value) {
		delayed = value;
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

<svelte:boundary>
	<Throws />

	{#snippet failed(error)}
		<p data-boundary-failed>{error.message}</p>
	{/snippet}
</svelte:boundary>
