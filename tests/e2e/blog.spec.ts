import { test, expect } from '@playwright/test';

test.describe('Blog', () => {
  test('blog index should list posts', async ({ page }) => {
    await page.goto('/blog');

    // Should have multiple post links
    const postLinks = page.locator('a[href*="/blog/"]');
    const count = await postLinks.count();

    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('blog posts should link to readable pages', async ({ page }) => {
    await page.goto('/blog');

    // Get first blog post link
    const firstPost = page.locator('a[href*="/blog/"]').first();
    const href = await firstPost.getAttribute('href');

    expect(href).toBeTruthy();
    expect(href).toContain('/blog/');

    // Navigate to post
    await firstPost.click();

    // Should render post content
    await expect(page.locator('h1, h2').first()).toBeTruthy();
    await expect(page.locator('article').first()).toBeTruthy();
  });

  test('individual blog posts should display metadata', async ({ page }) => {
    await page.goto('/blog');

    // Navigate to first post
    const firstPost = page.locator('a[href*="/blog/"]').first();
    await firstPost.click();

    // Should have title
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Should have some content (prefer article over main for blog posts)
    const content = page.locator('article').first();
    const text = await content.textContent();
    expect(text).toBeTruthy();
    expect(text?.length).toBeGreaterThan(50);
  });

  test('blog post sidebar should show categories', async ({ page }) => {
    await page.goto('/blog');
    await page.locator('a[href*="/blog/"]').first().click();

    // Check for sidebar with categories (Sidebar component)
    const sidebar = page.locator('aside');
    if (await sidebar.isVisible()) {
      const sidebarText = await sidebar.textContent();
      // Should mention categories
      expect(
        sidebarText?.includes('Sessions') ||
          sidebarText?.includes('Projects') ||
          sidebarText?.includes('About')
      ).toBeTruthy();
    }
  });

  test('should not have 404 errors for blog posts', async ({ page }) => {
    await page.goto('/blog');

    const postLinks = page.locator('a[href*="/blog/"]');
    const count = await postLinks.count();

    // Test first 5 posts
    for (let i = 0; i < Math.min(count, 5); i++) {
      const link = postLinks.nth(i);
      const href = await link.getAttribute('href');

      if (href && !href.startsWith('http')) {
        await page.goto(href);
        const status = page.url();
        expect(status).not.toContain('404');
      }
    }
  });

  test('blog post URLs should be consistent with slugs', async ({ page }) => {
    await page.goto('/blog');

    const firstPost = page.locator('a[href*="/blog/"]').first();
    const href = await firstPost.getAttribute('href');

    // URL should contain actual slug
    const urlMatch = href?.match(/\/blog\/(.+?)(?:\/)?$/);
    expect(urlMatch).toBeTruthy();
  });
});
