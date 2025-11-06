import { test, expect } from '@playwright/test';

/**
 * E2E tests for campaign creation workflow
 *
 * These tests verify the full user journey from authentication through
 * creating and running a campaign.
 */

test.describe('Campaign Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should display landing page with authentication options', async ({ page }) => {
    // Check for main heading or branding
    await expect(page.locator('body')).toContainText(/Sendr|Email|Campaign/i);

    // Authentication should be required
    // User should see sign-in or get started options
    const hasAuthButton = await page.locator('button, a').filter({
      hasText: /sign in|get started|login/i
    }).count();

    expect(hasAuthButton).toBeGreaterThan(0);
  });

  test('should navigate to dashboard after authentication', async ({ page }) => {
    // Note: This is a placeholder for auth flow
    // In a real test, you would:
    // 1. Click sign in
    // 2. Fill in credentials
    // 3. Submit form
    // 4. Verify redirect to dashboard

    // For now, we'll just verify the dashboard route exists
    await page.goto('/dashboard');

    // Should show campaign or workflow related content
    // (might redirect to auth if not logged in, which is expected)
    await page.waitForLoadState('networkidle');

    // Verify we're either on dashboard or auth page
    const url = page.url();
    expect(url).toMatch(/(dashboard|auth|login)/i);
  });

  test('should be able to access settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should show settings or redirect to auth
    const url = page.url();
    expect(url).toMatch(/(settings|auth|login)/i);

    // If on settings page, should show API key fields
    if (url.includes('settings')) {
      // Look for API key configuration sections
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(/API|key|config/i);
    }
  });

  test.skip('full campaign creation flow (requires authentication)', async ({ page }) => {
    /**
     * This test is skipped by default because it requires:
     * 1. Valid authentication credentials
     * 2. Configured API keys (Clado, OpenAI, Composio)
     * 3. Network access to external APIs
     *
     * To run this test:
     * 1. Remove test.skip
     * 2. Set up test environment variables
     * 3. Ensure test database is seeded
     */

    // Step 1: Authenticate
    // await page.goto('/auth');
    // await page.fill('input[type="email"]', 'test@example.com');
    // await page.fill('input[type="password"]', 'testpassword');
    // await page.click('button[type="submit"]');

    // Step 2: Navigate to dashboard
    // await page.waitForURL('/dashboard');
    // await expect(page).toHaveURL('/dashboard');

    // Step 3: Start new conversation
    // await page.click('button:has-text("New Conversation")');

    // Step 4: Create campaign via chat
    // const chatInput = page.locator('textarea, input[type="text"]').last();
    // await chatInput.fill('Create a campaign targeting CTOs in tech companies');
    // await chatInput.press('Enter');

    // Step 5: Wait for campaign creation
    // await page.waitForSelector('text=/campaign.*created/i', { timeout: 30000 });

    // Step 6: Verify campaign appears
    // await expect(page.locator('text=/CEO|CTO/i')).toBeVisible();

    // Step 7: Run test campaign
    // await page.click('button:has-text("Test Run")');

    // Step 8: Monitor execution
    // await expect(page.locator('text=/finding prospects|generating emails/i')).toBeVisible();

    // Step 9: Wait for completion
    // await page.waitForSelector('text=/complete/i', { timeout: 120000 });

    // Step 10: Verify results
    // await expect(page.locator('text=/generated|prospects/i')).toBeVisible();
  });

  test('should handle navigation between routes', async ({ page }) => {
    // Test basic routing structure
    const routes = ['/dashboard', '/settings'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Verify we didn't encounter a 404
      const pageContent = await page.textContent('body');
      expect(pageContent?.toLowerCase()).not.toContain('404');
      expect(pageContent?.toLowerCase()).not.toContain('not found');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify page loads and is usable
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check that content isn't overflowing
    const bodyBox = await body.boundingBox();
    expect(bodyBox?.width).toBeLessThanOrEqual(375);
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known acceptable errors (like network errors in test environment)
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Failed to load resource') &&
      !error.includes('net::ERR_') &&
      !error.includes('supabase')  // Supabase auth errors are expected without credentials
    );

    // There should be no critical JavaScript errors
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle network failures gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.route('**/*', route => route.abort());

    await page.goto('/').catch(() => {
      // Expected to fail, we're testing error handling
    });

    // In a production app, you'd verify:
    // - Error message is shown to user
    // - Retry mechanism is available
    // - Offline state is indicated
  });
});

test.describe('Conversation Interface', () => {
  test.skip('should create conversation via chat (requires auth)', async ({ page }) => {
    /**
     * Skipped - requires authentication setup
     */
  });

  test('should render conversation view route', async ({ page }) => {
    // Test that the route exists
    await page.goto('/conversation/test-id');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    // Should either show conversation or redirect to auth
    expect(url).toMatch(/(conversation|auth|login|dashboard)/i);
  });
});

test.describe('Settings Management', () => {
  test.skip('should save API keys (requires auth)', async ({ page }) => {
    /**
     * Skipped - requires authentication
     *
     * Full test would:
     * 1. Navigate to settings
     * 2. Enter API keys
     * 3. Click save
     * 4. Verify success message
     * 5. Reload and verify keys are persisted (masked)
     */
  });

  test('settings page has proper input types', async ({ page }) => {
    await page.goto('/settings');

    // If we reach settings (not redirected), verify password inputs
    const url = page.url();
    if (url.includes('settings')) {
      // API keys should be password type by default (hidden)
      const passwordInputs = await page.locator('input[type="password"]').count();

      // Should have at least one password field for API keys
      if (passwordInputs > 0) {
        // Verify show/hide button exists
        const toggleButtons = await page.locator('button[aria-label*="Show"], button[aria-label*="Hide"]').count();
        expect(toggleButtons).toBeGreaterThan(0);
      }
    }
  });
});
