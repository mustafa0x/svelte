<script>
	let { value } = $props();

	const alternates = [
		{ locale: 'ar', href: '/ar/dynamic' },
		{ locale: 'en', href: '/en/dynamic' }
	];

	const og_locales = ['ar', 'en'];
</script>

<svelte:head>
	{#each alternates as alternate (alternate.locale)}
		<link rel="dynamic-alternate" hreflang={alternate.locale} href={alternate.href} />
	{/each}
	<link rel="dynamic-alternate" hreflang="x-default" href="/dynamic" />
	{#each og_locales as locale (locale)}
		<meta property="dynamic:locale:alternate" content={locale} />
	{/each}
</svelte:head>

<section data-dynamic-like>dynamic {value}</section>
