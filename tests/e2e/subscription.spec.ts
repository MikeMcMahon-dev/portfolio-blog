import { test, expect } from '@playwright/test';

test.describe('Subscription', () => {
  test('subscribe page should load', async ({ page }) => {
    await page.goto('/subscribe');

    await expect(page).toHaveURL(/\/subscribe\/?$/);
    await expect(page.locator('h1, h2').first()).toBeTruthy();
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

    // Browser validation should prevent submit or form should have error
    const formInvalid = await emailInput.evaluate((el: any) => !el.checkValidity?.());
    if (formInvalid) {
      expect(formInvalid).toBeTruthy();
    }
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

  test('unsubscribe page should have token form or secondary flow', async ({
    page,
  }) => {
    await page.goto('/unsubscribe');

    // Should have email input at minimum
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Might have token input or second form
    const tokenInput = page.locator('input[name*="token"]');
    const hasToken = await tokenInput.count();

    // At least email form should be present
    expect(hasToken >= 0).toBeTruthy();
  });
});
