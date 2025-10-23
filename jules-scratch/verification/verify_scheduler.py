
from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the login page
    page.goto("http://localhost:3000/login")

    # Fill in the login credentials
    page.fill('input[id="identifier"]', "admin@showtimeconsulting.in")
    page.fill('input[id="password"]', "password")

    # Click the login button
    page.click('button:has-text("Sign In")')

    # Wait for the dashboard to load
    page.wait_for_selector('h2:has-text("Dashboard")')

    # Navigate to the announcements page by clicking the link
    page.click('a[href="/dashboard#announcements"]')


    # Wait for the main announcements heading to be visible
    page.wait_for_selector('h2:has-text("Announcements")')

    # Click the "Create Announcement" button
    page.click('button:has-text("Create Announcement")')

    time.sleep(1) # a small delay to ensure the form is rendered

    # Click the date picker button
    page.click('button:has-text("Pick a date")')

    # Click the day "15" in the calendar
    page.click('text=15')

    # Take a screenshot of the form with the scheduler
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
