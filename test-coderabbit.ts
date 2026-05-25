// Test file for CodeRabbit integration
// This file contains intentional issues for CodeRabbit to detect
// Use this file to test that CodeRabbit is working correctly

// ❌ Issue 1: Missing type annotations
export function addNumbers(a, b) {
  return a + b
}

// ❌ Issue 2: Using 'any' type (violates strict TypeScript)
export function processData(data: any) {
  return data.value
}

// ❌ Issue 3: No error handling in async function
export async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`)
  const user = await response.json()
  return user
}

// ❌ Issue 4: Hardcoded sensitive data (security issue)
export const API_KEY = "sk_live_1234567890"

// ❌ Issue 5: No input validation
export function divideNumbers(a: number, b: number) {
  return a / b  // Could divide by zero
}

// ❌ Issue 6: Missing return type
export function getUsers() {
  return fetch('/api/users')
}

// ✅ Good example (for comparison - CodeRabbit should approve this)
export interface User {
  id: string
  name: string
  email: string
}

export async function getUser(id: string): Promise<User> {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid user ID')
    }
    
    const response = await fetch(`/api/users/${id}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`)
    }
    
    const user: User = await response.json()
    return user
  } catch (error) {
    console.error('Error fetching user:', error)
    throw error
  }
}

// ✅ Good: Properly typed with validation
export function safeDivide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Cannot divide by zero')
  }
  return a / b
}

