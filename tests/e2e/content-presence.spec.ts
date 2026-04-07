import { test, expect } from '@playwright/test';
import { loadAllPosts, getPublishedPosts } from '../utils/content-loader';

test.describe('Content Presence', () => {
  let publishedPostCount: number;
  let publishedSlugs: string[];

  test.beforeAll(async () => {
    const allPosts = await loadAllPosts();
    const published = getPublishedPosts(allPosts);
    publishedPostCount = published.length;
    publishedSlugs = published.map((p) => p.slug);
  });

  test('sidebar should display all published posts', async ({ page }) => {
    await page.goto('/blog');

    // Get all post links from sidebar/main listing
    const postLinks = page.locator('a[href*="/blog/"]');
    const renderedCount = await postLinks.count();

    expect(renderedCount).toBeGreaterThanOrEqual(publishedPostCount);
  });

  test('every published post should be accessible from blog index', async ({ page }) => {
    await page.goto('/blog');

    for (const slug of publishedSlugs) {
      const link = page.locator(`a[href="/blog/${slug}"]`);
      const exists = await link.count();
      expect(exists).toBeGreaterThan(0, `Post link missing: /blog/${slug}`);
    }
  });

  test('published posts should not return 404', async ({ page }) => {
    for (const slug of publishedSlugs) {
      const response = await page.goto(`/blog/${slug}`);
      expect(response?.status()).toBe(200, `Post returned 404: /blog/${slug}`);
    }
  });

  test('draft posts should not appear in listings', async ({ page }) => {
    const allPosts = await loadAllPosts();
    const draftSlugs = allPosts.filter((p) => p.frontmatter.draft).map((p) => p.slug);

    if (draftSlugs.length === 0) {
      test.skip();
    }

    await page.goto('/blog');

    for (const draftSlug of draftSlugs) {
      const link = page.locator(`a[href="/blog/${draftSlug}"]`);
      const exists = await link.count();
      expect(exists).toBe(0, `Draft post should not appear in listing: /blog/${draftSlug}`);
    }
  });

  test('sidebar should be consistent across all blog pages', async ({ page }) => {
    // Get sidebar post count from first page
    await page.goto('/blog');
    const firstPageSidebar = await page.locator('aside a[href*="/blog/"]').count();

    // Check a few post pages
    for (let i = 0; i < Math.min(3, publishedSlugs.length); i++) {
      await page.goto(`/blog/${publishedSlugs[i]}`);
      const currentPageSidebar = await page.locator('aside a[href*="/blog/"]').count();
      expect(currentPageSidebar).toBe(firstPageSidebar,
        `Sidebar post count differs on /blog/${publishedSlugs[i]}`);
    }
  });
});
