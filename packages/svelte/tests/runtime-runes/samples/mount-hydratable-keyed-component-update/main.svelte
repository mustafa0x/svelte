<script>
	import Alpha from './Alpha.svelte';
	import Beta from './Beta.svelte';

	let kind = $state('alpha');
	let Component = $derived(kind === 'alpha' ? Alpha : Beta);

	export function swap() {
		kind = 'beta';
	}
</script>

{#if Component}
	{#key kind}
		<Component />
	{/key}
{/if}
