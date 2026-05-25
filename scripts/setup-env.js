#!/usr/bin/env node

/**
 * Environment Setup Wizard
 * Interactive script to help set up .env.local file
 * 
 * Usage: node scripts/setup-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(__dirname, '..', '.env.local');
const examplePath = path.join(__dirname, '..', 'env.example.txt');

console.log('\n🚀 Optimix Environment Setup Wizard\n');
console.log('This wizard will help you create your .env.local file.\n');

const questions = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    prompt: '📍 Supabase Project URL (e.g., https://abc.supabase.co): ',
    required: true,
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    prompt: '🔑 Supabase Anon Key: ',
    required: true,
  },
  {
    key: 'DATABASE_URL',
    prompt: '🗄️  Database URL (postgres://...): ',
    required: true,
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLIC_KEY',
    prompt: '💳 Stripe Publishable Key (pk_test_...): ',
    required: false,
  },
  {
    key: 'STRIPE_SECRET_KEY',
    prompt: '🔐 Stripe Secret Key (sk_test_...): ',
    required: false,
  },
];

const answers = {};

function ask(index) {
  if (index >= questions.length) {
    createEnvFile();
    return;
  }

  const q = questions[index];
  const requiredText = q.required ? ' (required)' : ' (optional, press Enter to skip)';
  
  rl.question(q.prompt + requiredText + '\n> ', (answer) => {
    if (q.required && !answer.trim()) {
      console.log('❌ This field is required. Please try again.\n');
      ask(index);
    } else {
      if (answer.trim()) {
        answers[q.key] = answer.trim();
      }
      ask(index + 1);
    }
  });
}

function createEnvFile() {
  console.log('\n✅ Creating .env.local file...\n');

  // Read template
  let template = '';
  if (fs.existsSync(examplePath)) {
    template = fs.readFileSync(examplePath, 'utf8');
  }

  // Build env content
  let envContent = `# ============================================
# OPTIMIX - Environment Variables
# ============================================
# Generated: ${new Date().toISOString()}
# This file was created by the setup wizard

# ============================================
# REQUIRED - SUPABASE CONFIGURATION
# ============================================
NEXT_PUBLIC_SUPABASE_URL=${answers.NEXT_PUBLIC_SUPABASE_URL || ''}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${answers.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}
DATABASE_URL=${answers.DATABASE_URL || ''}

# ============================================
# REQUIRED - APPLICATION CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_NAME=Optimix
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# PAYMENT INTEGRATION
# ============================================
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=${answers.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || 'pk_test_YOUR_KEY_HERE'}
STRIPE_SECRET_KEY=${answers.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE'}
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# ============================================
# OPTIONAL - MONITORING & ANALYTICS
# ============================================
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_GA_TRACKING_ID=

# ============================================
# OPTIONAL - PUSH NOTIFICATIONS
# ============================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ============================================
# OPTIONAL - EMAIL SERVICE
# ============================================
RESEND_API_KEY=
FROM_EMAIL=noreply@optimix.com

# ============================================
# OPTIONAL - TWO-FACTOR AUTHENTICATION
# ============================================
NEXT_PUBLIC_2FA_SERVICE_NAME=Optimix

# ============================================
# DEVELOPMENT SETTINGS
# ============================================
NEXT_PUBLIC_USE_MOCK_DATA=false
NODE_ENV=development
`;

  // Write file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local file created successfully!\n');
    console.log('📝 File location:', envPath, '\n');
    console.log('📋 Next steps:');
    console.log('   1. Review your .env.local file');
    console.log('   2. Add any optional variables if needed');
    console.log('   3. Run: npm run verify:env');
    console.log('   4. Run: npm run verify:db');
    console.log('   5. Run: npm run dev\n');
  } catch (error) {
    console.error('❌ Error creating .env.local:', error.message);
    console.log('\n💡 Manual setup:');
    console.log('   1. Create a file named .env.local in the project root');
    console.log('   2. Copy the content from env.example.txt');
    console.log('   3. Fill in your values\n');
  }

  rl.close();
}

// Start the wizard
console.log('📖 You can find your Supabase credentials at:');
console.log('   https://app.supabase.com → Your Project → Settings → API\n');
console.log('📖 You can find your Stripe credentials at:');
console.log('   https://dashboard.stripe.com → Developers → API keys\n');
console.log('Let\'s begin!\n');

ask(0);

