<script>
	let { children, href = undefined } = $props();
</script>

{#if href}
	<a data-button-like href={href}>
		{@render children?.()}
	</a>
{:else}
	<button data-button-like type="button">
		{@render children?.()}
	</button>
{/if}
