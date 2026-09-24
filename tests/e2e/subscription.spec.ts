import { test, expect } from '@playwright/test';

test.describe('Subscription', () => {
  test('subscribe page should load', async ({ page }) => {
    await page.goto('/subscribe');

    await expect(page).toHaveURL(/\/subscribe\/?$/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('subscribe form should have email input', async ({ page }) => {
    await page.goto('/subscribe');

    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('subscribe form should have submit button', async ({ page }) => {
    await page.goto('/subscribe');

    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.goto('/subscribe');

    const emailInput = page.locator('input[type="email"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    // Try invalid email
    await emailInput.fill('not-an-email');

    // Browser validation must reject it before submit
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('subscribe form should accept valid email', async ({ page }) => {
    await page.goto('/subscribe');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');

    const isValid = await emailInput.evaluate((el: any) => el.checkValidity?.());
    expect(isValid).toBeTruthy();
  });

  test('should show RSS feed link on subscribe page', async ({ page }) => {
    await page.goto('/subscribe');

    // Use more specific selector: the RSS link in the "Or use RSS" section of main content
    const rssLink = page.locator('main a[href="/rss.xml"], article a[href="/rss.xml"]').first();
    await expect(rssLink).toBeVisible();
  });

  test('unsubscribe page should load', async ({ page }) => {
    await page.goto('/unsubscribe');

    await expect(page).toHaveURL(/\/unsubscribe\/?$/);
  });

  test('unsubscribe page should have email form', async ({ page }) => {
    await page.goto('/unsubscribe');

    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('unsubscribe page should have token paste form', async ({ page }) => {
    await page.goto('/unsubscribe');

    // Brevo's link tracking strips query params, so pasting the token is the
    // only unsubscribe path that survives. It has to be there.
    await expect(page.locator('input[name="token"]')).toBeVisible();
  });
});
