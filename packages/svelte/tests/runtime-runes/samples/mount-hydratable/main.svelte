<script>
	import Throws from './Throws.svelte';

	let {
		show = true,
		items = [1, 2],
		answer = 42,
		keyed = 'alpha',
		raw = '<strong>raw</strong>',
		more_link = true
	} = $props();

	const uid = $props.id();
</script>

<label for={uid}>Generated id</label>
<input id={uid} />

{#if show}
	<p>shown</p>
{:else}
	<p>hidden</p>
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

<svelte:boundary>
	<Throws />

	{#snippet failed(error)}
		<p data-boundary-failed>{error.message}</p>
	{/snippet}
</svelte:boundary>
