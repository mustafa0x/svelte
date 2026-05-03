<script>
	let { value } = $props();

	const alternates = [
		{ locale: 'ar', href: '/ar/about' },
		{ locale: 'en', href: '/en/about' }
	];

	const og_locales = ['ar', 'en'];
</script>

<svelte:head>
	<title>hydratable {value}</title>
	{#each alternates as alternate (alternate.locale)}
		<link rel="alternate" hreflang={alternate.locale} href={alternate.href} />
	{/each}
	<link rel="alternate" hreflang="x-default" href="/about" />
	{#each og_locales as locale (locale)}
		<meta property="og:locale:alternate" content={locale} />
	{/each}
</svelte:head>
