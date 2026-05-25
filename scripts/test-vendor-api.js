/**
 * Test script for vendor application API endpoint
 * Tests the /api/vendor/verify endpoint
 */

require('dotenv').config({ path: '.env.local' });

const testPayload = {
  businessName: "Test Business",
  businessType: "Food & Beverage",
  taxId: "12-3456789",
  businessAddress: {
    street: "123 Test St",
    city: "Test City",
    state: "CA",
    zip: "12345",
    country: "US"
  },
  phoneNumber: "+1234567890",
  idDocumentUrl: "https://example.com/test-id.pdf",
  notes: "Test application"
};

async function testAPI() {
  console.log('🧪 Testing Vendor Application API...\n');
  console.log('📤 Test payload:', JSON.stringify(testPayload, null, 2));
  console.log('\n⚠️  Note: This requires authentication.');
  console.log('   Make sure you are logged in and have a valid Clerk session.\n');
  console.log('   To test manually:');
  console.log('   1. Open browser DevTools → Network tab');
  console.log('   2. Submit vendor application in the UI');
  console.log('   3. Check the /api/vendor/verify request');
  console.log('   4. Review the response for errors\n');
  
  console.log('✅ Test script ready. Use browser DevTools to test the actual API call.');
}

testAPI();

