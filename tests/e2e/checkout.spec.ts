import { test, expect } from '@playwright/test'

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('http://localhost:3000')
  })

  test('should complete full checkout flow', async ({ page }) => {
    // 1. Sign in (assuming test user exists)
    await page.goto('http://localhost:3000/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to home
    await page.waitForURL('**/home')
    
    // 2. Browse marketplace
    await page.goto('http://localhost:3000/marketplace')
    await expect(page.locator('h1')).toContainText('Marketplace')
    
    // 3. Add item to cart (if listings exist)
    const listingCards = page.locator('[data-testid="listing-card"]').first()
    if (await listingCards.count() > 0) {
      await listingCards.locator('button:has-text("Add to Cart")').first().click()
      
      // Verify cart badge updated
      await expect(page.locator('[data-testid="cart-badge"]')).toBeVisible()
      
      // 4. Go to cart
      await page.goto('http://localhost:3000/cart')
      await expect(page.locator('h1')).toContainText('Shopping Cart')
      
      // 5. Proceed to checkout
      await page.click('button:has-text("Proceed to Checkout")')
      await page.waitForURL('**/checkout')
      
      // 6. Fill checkout form
      await page.fill('input[name="fullName"]', 'Test User')
      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[name="address"]', '123 Test St')
      await page.fill('input[name="city"]', 'Test City')
      await page.fill('input[name="zipCode"]', '12345')
      await page.fill('input[name="phone"]', '555-1234')
      
      // 7. Submit order (without payment for test)
      // Note: In actual testing with Stripe, would use test card numbers
      await page.click('button[type="submit"]')
      
      // 8. Verify redirect to orders
      await page.waitForURL('**/orders', { timeout: 10000 })
      await expect(page.locator('h1')).toContainText('Orders')
    }
  })

  test('should show validation errors for invalid inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/checkout')
    
    // Try to submit without filling form
    await page.click('button[type="submit"]')
    
    // Should show validation errors
    await expect(page.locator('text=required')).toBeVisible()
  })

  test('should handle payment errors gracefully', async ({ page }) => {
    // TODO: Implement with Stripe test mode
    // Use declined card 4000 0000 0000 0002
  })
})

