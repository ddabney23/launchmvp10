import { test, expect } from '@playwright/test'

test.describe('Social Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/home')
  })

  test('should create a post', async ({ page }) => {
    // Navigate to create post
    await page.goto('http://localhost:3000/create')
    
    // Fill post content
    await page.fill('textarea[name="content"]', 'This is a test post from E2E tests!')
    
    // Select visibility
    await page.selectOption('select[name="visibility"]', 'public')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Should redirect to home and show the post
    await page.waitForURL('**/home')
    await expect(page.locator('text=This is a test post')).toBeVisible()
  })

  test('should like and unlike a post', async ({ page }) => {
    await page.goto('http://localhost:3000/feed')
    
    // Find first post's like button
    const firstPost = page.locator('[data-testid="post-card"]').first()
    const likeButton = firstPost.locator('[data-testid="like-button"]')
    
    // Get initial like count
    const initialCount = await firstPost.locator('[data-testid="like-count"]').textContent()
    
    // Click like
    await likeButton.click()
    
    // Wait for update
    await page.waitForTimeout(500)
    
    // Click unlike
    await likeButton.click()
    
    // Count should be back to original
    await expect(firstPost.locator('[data-testid="like-count"]')).toHaveText(initialCount || '0')
  })

  test('should comment on a post', async ({ page }) => {
    await page.goto('http://localhost:3000/feed')
    
    // Find first post
    const firstPost = page.locator('[data-testid="post-card"]').first()
    
    // Click to open post details
    await firstPost.click()
    
    // Fill comment
    await page.fill('textarea[placeholder*="comment"]', 'Great post!')
    
    // Submit comment
    await page.click('button:has-text("Post Comment")')
    
    // Verify comment appears
    await expect(page.locator('text=Great post!')).toBeVisible()
  })

  test('should follow and unfollow a user', async ({ page }) => {
    await page.goto('http://localhost:3000/explore')
    
    // Find first user card
    const firstUser = page.locator('[data-testid="user-card"]').first()
    const followButton = firstUser.locator('button:has-text("Follow")')
    
    if (await followButton.isVisible()) {
      // Click follow
      await followButton.click()
      
      // Should change to "Following"
      await expect(firstUser.locator('button:has-text("Following")')).toBeVisible()
      
      // Click unfollow
      await firstUser.locator('button:has-text("Following")').click()
      
      // Should change back to "Follow"
      await expect(followButton).toBeVisible()
    }
  })
})

