import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page should load and display welcome', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Mike McMahon/);
    // Main content h1 (sidebar has "Mike McMahon", main has "Welcome")
    const mainHeading = page.locator('.main-content h1').first();
    await expect(mainHeading).toContainText('Welcome');
  });

  test('should have header navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for main navigation links in sidebar
    const homeLink = page.locator('aside a[href="/"]').first();
    const subscribeLink = page.locator('aside a[href="/subscribe"]').first();
    const rssLink = page.locator('aside a[href="/rss.xml"]').first();

    await expect(homeLink).toBeVisible();
    await expect(subscribeLink).toBeVisible();
    await expect(rssLink).toBeVisible();
  });

  test('should navigate to blog post from home', async ({ page }) => {
    await page.goto('/');
    // Click on a blog post link from the Recent Posts section
    const firstBlogLink = page.locator('a[href*="/blog/"]').first();
    await firstBlogLink.click();

    // Should load a blog post
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('should navigate to subscribe from home', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/subscribe"]');

    await expect(page).toHaveURL(/\/subscribe\/?$/);
    // Check main content heading, not sidebar
    const mainHeading = page.locator('.main-content h1, article h1').first();
    await expect(mainHeading).toContainText(/[Ss]ubscri/);
  });

  test('should navigate back to home from blog post', async ({ page }) => {
    // Navigate to a blog post first
    await page.goto('/');
    const firstBlogLink = page.locator('a[href*="/blog/"]').first();
    await firstBlogLink.click();

    // Then navigate back to home via sidebar link
    const homeLink = page.locator('aside a[href="/"]').first();
    await homeLink.click();

    await expect(page).toHaveURL(/\/?$/);
    // Check main content heading
    const mainHeading = page.locator('.main-content h1').first();
    await expect(mainHeading).toContainText('Welcome');
  });

  test('should have working RSS feed link', async ({ page }) => {
    await page.goto('/');
    // Use sidebar-specific selector to get the RSS link
    const rssLink = page.locator('aside a[href="/rss.xml"]');

    await expect(rssLink).toBeVisible();

    const response = await page.request.get(page.url().replace(/\/$/, '') + '/rss.xml');
    expect(response.status()).toBe(200);
  });
});
