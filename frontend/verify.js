const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('Navigating to the login page...');
    await page.goto('http://localhost:3000/login', { timeout: 60000 });
    console.log('Current URL:', page.url());

    console.log('Filling in login credentials...');
    await page.fill('input[type="email"]', 'admin@showtimeconsulting.in');
    await page.fill('input[type="password"]', 'password');

    console.log('Clicking the sign-in button...');
    await page.click('button[type="submit"]');

    console.log('Waiting for navigation to the dashboard...');
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 20000 });
    console.log('Successfully navigated to the dashboard. Current URL:', page.url());

    // Navigate to the AP Zone to Booth Mapping page
    console.log('Navigating to AP Zone to Booth Mapping page...');
    await page.click('text="Andhra Pradesh zone to booth mapping"');
    await page.waitForURL('http://localhost:3000/dashboard/excel-data-viewer', { timeout: 10000 });
    console.log('Successfully navigated to the Excel Data Viewer page.');

    // Upload the Excel file
    console.log('Uploading the Excel file...');
    const filePath = path.join(__dirname, '..', 'AP-ZN-BN-MP.xlsx'); // Adjusted path
    await page.setInputFiles('input[type="file"]', filePath);
    console.log('File uploaded. Waiting for data to be displayed...');

    // Wait for a specific element that indicates data has been loaded and displayed
    await page.waitForSelector('table', { timeout: 15000 }); // Wait for the table to appear
    console.log('Data table is visible.');

    // Take a screenshot
    const screenshotPath = '/home/jules/verification/verification_success.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Verification successful. Screenshot saved to ${screenshotPath}`);

  } catch (error) {
    console.error('Verification script failed:', error);
    const errorScreenshotPath = '/home/jules/verification/verification_error.png';
    await page.screenshot({ path: errorScreenshotPath });
    console.log(`Error screenshot saved to ${errorScreenshotPath}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
