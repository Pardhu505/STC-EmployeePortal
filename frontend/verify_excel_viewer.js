const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('Navigating to the Excel Data Viewer page...');
    // The root route now directly renders ExcelDataViewer
    await page.goto('http://localhost:3000/', { timeout: 60000 });
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
