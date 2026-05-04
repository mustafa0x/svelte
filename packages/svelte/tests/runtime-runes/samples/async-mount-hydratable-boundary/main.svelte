<script>
	let { boundary_answer = 'boundary done' } = $props();
</script>

<svelte:boundary>
	<p data-boundary-main>{await boundary_answer}</p>

	{#snippet pending()}
		<p data-boundary-pending>boundary pending</p>
	{/snippet}
</svelte:boundary>
