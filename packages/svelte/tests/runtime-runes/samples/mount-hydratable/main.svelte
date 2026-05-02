<script>
	let {
		show = true,
		items = [1, 2],
		answer = 42,
		keyed = 'alpha',
		raw = '<strong>raw</strong>',
		more_link = true
	} = $props();
</script>

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

<svelte:element this={more_link ? 'a' : 'div'} data-kind="more">more</svelte:element>
