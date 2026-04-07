import { test, expect } from '@playwright/test';
import { loadAllPosts, getPublishedPosts } from '../utils/content-loader';

test.describe('Component Consistency', () => {
  let publishedSlugs: string[];

  test.beforeAll(async () => {
    const allPosts = await loadAllPosts();
    const published = getPublishedPosts(allPosts);
    publishedSlugs = published.map((p) => p.slug);
  });

  test('Subscribe link should appear in sidebar on every page', async ({ page }) => {
    const testPages = ['/blog', ...publishedSlugs.slice(0, 3).map((slug) => `/blog/${slug}`)];

    for (const testPage of testPages) {
      await page.goto(testPage);

      // Check for Subscribe in sidebar (various possible selectors)
      const subscribeInSidebar = page.locator('aside').locator('text=Subscribe, /i');
      const count = await subscribeInSidebar.count();

      expect(count).toBeGreaterThan(0,
        `Subscribe link missing from sidebar on ${testPage}`);
    }
  });

  test('Subscribe component should be functional on all pages', async ({ page }) => {
    const testPages = ['/blog', ...publishedSlugs.slice(0, 2).map((slug) => `/blog/${slug}`)];

    for (const testPage of testPages) {
      await page.goto(testPage);

      // Find Subscribe button/link
      const subscribeBtn = page.locator('aside button, aside a').filter({
        hasText: /Subscribe/i
      }).first();

      const isVisible = await subscribeBtn.isVisible();
      expect(isVisible).toBe(true,
        `Subscribe button not visible on ${testPage}`);

      // Verify it's clickable (not disabled)
      const isDisabled = await subscribeBtn.isDisabled();
      expect(isDisabled).toBe(false,
        `Subscribe button is disabled on ${testPage}`);
    }
  });

  test('main layout components should be present on all pages', async ({ page }) => {
    const testPages = ['/blog', ...publishedSlugs.slice(0, 2).map((slug) => `/blog/${slug}`)];

    for (const testPage of testPages) {
      await page.goto(testPage);

      // Verify key layout sections exist
      const sidebar = page.locator('aside');
      const main = page.locator('main, article');
      const nav = page.locator('nav');

      expect(await sidebar.count()).toBeGreaterThan(0,
        `Sidebar missing on ${testPage}`);
      expect(await main.count()).toBeGreaterThan(0,
        `Main content area missing on ${testPage}`);
      // Nav may not always exist but track consistency
    }
  });

  test('no broken internal links in sidebar', async ({ page }) => {
    await page.goto('/blog');

    // Get all links from sidebar
    const sidebarLinks = page.locator('aside a[href]');
    const linkCount = await sidebarLinks.count();

    expect(linkCount).toBeGreaterThan(0);

    // Check each link is valid
    for (let i = 0; i < linkCount; i++) {
      const href = await sidebarLinks.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/undefined|null|#$/);
    }
  });
});
