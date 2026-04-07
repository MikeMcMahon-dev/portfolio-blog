import { test, expect } from '@playwright/test';

/**
 * SMOKE TESTS - Fast critical-path validation
 *
 * These tests verify the site works at all. They run FIRST.
 * If these fail, the site is broken and we should not deploy.
 *
 * ✅ Fast: ~2 min on chromium only
 * ✅ Serial: Bails early on critical failures
 * ✅ Pre-commit: Run before committing
 */

test.describe.serial('🔥 SMOKE: Critical Site Health', () => {
  test('01. Home page loads and renders', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    // Main content h1 (sidebar has h1 "Mike McMahon", main has h1 "Welcome")
    const mainHeading = page.locator('main h1, .main-content h1').first();
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toContainText('Welcome');
  });

  test('02. Sidebar navigation exists', async ({ page }) => {
    await page.goto('/');

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Should have home, subscribe, and RSS links
    await expect(page.locator('aside a[href="/"]').first()).toBeVisible();
    await expect(page.locator('aside a[href="/subscribe"]').first()).toBeVisible();
    await expect(page.locator('aside a[href="/rss.xml"]').first()).toBeVisible();
  });

  test('03. Blog posts are listed on home', async ({ page }) => {
    await page.goto('/');

    // Should have recent posts
    const recentPosts = page.locator('a[href*="/blog/"]');
    const count = await recentPosts.count();

    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('04. Can navigate to blog post', async ({ page }) => {
    await page.goto('/');

    const firstBlogLink = page.locator('a[href*="/blog/"]').first();
    await firstBlogLink.click();

    // Should load without 404
    expect(page.url()).toContain('/blog/');
    const response = await page.request.head(page.url());
    expect(response.status()).toBe(200);

    // Should have article content
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('05. Subscribe page loads', async ({ page }) => {
    const response = await page.goto('/subscribe', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    // Main content heading (article > h1)
    const mainHeading = page.locator('article h1, .main-content h1').first();
    await expect(mainHeading).toContainText(/Subscribe/i);
  });

  test('06. RSS feed is valid', async ({ page }) => {
    await page.goto('/');

    const response = await page.request.get('/rss.xml');
    expect(response.status()).toBe(200);

    // Should be valid XML
    const text = await response.text();
    expect(text).toContain('<rss');
    expect(text).toContain('</rss>');
  });

  test('07. No console errors on home', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Some errors are OK (3rd party), but should not have app-level errors
    const appErrors = errors.filter(e =>
      !e.includes('Failed to load') &&
      !e.includes('net::ERR') &&
      !e.includes('Cross-Origin')
    );

    expect(appErrors).toHaveLength(0);
  });
});
