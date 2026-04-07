// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';
import clippyQuipsIntegration from './src/integrations/clippy-quips';

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE_URL || 'https://mikemcmahon.dev',
	output: 'server',
	adapter: vercel({
		webAnalytics: {
			enabled: false,
		},
	}),
	integrations: [mdx(), sitemap(), clippyQuipsIntegration()],
	markdown: {
		shikiConfig: {
			theme: 'github-light',
		},
	},
});
