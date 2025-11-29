const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login', { timeout: 60000 });

    // Fill in the login form
    await page.fill('input[placeholder="Enter your email or employee ID"]', 'admin@showtimeconsulting.in');
    await page.fill('input[placeholder="Enter your password"]', 'password');

    // Click the sign-in button and wait for navigation to the dashboard
    await Promise.all([
      page.waitForNavigation({ url: 'http://localhost:3000/dashboard' }),
      page.click('button:has-text("Sign In")'),
    ]);

    // Navigate to the "Andhra Pradesh zone to booth mapping" page
    await page.click('a[href="/dashboard/excel-data-viewer"]');

    // Wait for the page to load
    await page.waitForSelector('h1:has-text("Excel Data Viewer")');

    // Capture a screenshot of the page
    await page.screenshot({ path: '/home/jules/verification/verification.png' });

    console.log('Verification successful!');
  } catch (error) {
    console.error('Verification failed:', error);
    await page.screenshot({ path: '/home/jules/verification/verification_error.png' });
  } finally {
    await browser.close();
  }
})();
