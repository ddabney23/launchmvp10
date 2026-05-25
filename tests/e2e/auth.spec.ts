import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should sign up new user', async ({ page }) => {
    await page.goto('http://localhost:3000/auth')
    
    // Switch to sign up mode
    await page.click('text=Sign up')
    
    // Fill signup form
    const timestamp = Date.now()
    await page.fill('input[type="email"]', `test${timestamp}@example.com`)
    await page.fill('input[type="password"]', 'SecurePassword123!')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Should redirect to onboarding or home
    await page.waitForURL(/\/(onboarding|home)/, { timeout: 10000 })
  })

  test('should sign in existing user', async ({ page }) => {
    await page.goto('http://localhost:3000/auth')
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Should redirect to home
    await page.waitForURL('**/home', { timeout: 10000 })
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:3000/auth')
    
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('[role="alert"]')).toBeVisible()
  })

  test('should sign out user', async ({ page }) => {
    // First sign in
    await page.goto('http://localhost:3000/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/home')
    
    // Click logout
    await page.click('[data-testid="logout-button"]')
    
    // Should redirect to auth page
    await page.waitForURL('**/auth')
  })
})

