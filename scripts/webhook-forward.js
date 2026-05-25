#!/usr/bin/env node

/**
 * Clerk Webhook Forwarding Helper
 * Cross-platform script to help set up webhook forwarding
 */

const { execSync, spawn } = require('child_process');
const os = require('os');
const platform = os.platform();

console.log('🚀 Setting up Clerk Webhook Forwarding for Localhost\n');

// Check if ngrok is installed
function checkNgrok() {
  try {
    execSync('ngrok version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if dev server is running
function checkDevServer() {
  try {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3000', { timeout: 2000 }, (res) => {
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
}

async function main() {
  // Check ngrok
  if (!checkNgrok()) {
    console.log('❌ ngrok is not installed.\n');
    console.log('Please install ngrok:');
    console.log('  1. Download from: https://ngrok.com/download');
    console.log('  2. Or install via: npm install -g ngrok');
    if (platform === 'darwin') {
      console.log('  3. Or install via: brew install ngrok');
    }
    console.log('\nAfter installing, run this script again.');
    process.exit(1);
  }

  console.log('✅ ngrok is installed\n');

  // Check dev server
  const devServerRunning = await checkDevServer();
  if (!devServerRunning) {
    console.log('⚠️  Warning: Dev server doesn\'t appear to be running on port 3000');
    console.log('   Please start your dev server first: npm run dev\n');
    
    // On Windows, we can't easily do interactive input, so just warn
    if (platform === 'win32') {
      console.log('Continuing anyway...\n');
    } else {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('Continue anyway? (y/n) ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        process.exit(1);
      }
    }
  } else {
    console.log('✅ Dev server is running on port 3000\n');
  }

  console.log('Starting ngrok tunnel...\n');
  console.log('📋 Next steps:');
  console.log('  1. Copy the HTTPS URL from ngrok (e.g., https://abc123.ngrok-free.app)');
  console.log('  2. Go to Clerk Dashboard: https://dashboard.clerk.com');
  console.log('  3. Navigate to: Webhooks → Add Endpoint');
  console.log('  4. Enter URL: https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/clerk');
  console.log('  5. Select events: user.created, user.updated, user.deleted');
  console.log('  6. Copy the Signing Secret to your .env.local as CLERK_WEBHOOK_SECRET');
  console.log('\nPress Ctrl+C to stop the tunnel\n');

  // Start ngrok
  const ngrok = spawn('ngrok', ['http', '3000'], {
    stdio: 'inherit',
    shell: platform === 'win32',
  });

  ngrok.on('error', (error) => {
    console.error('❌ Error starting ngrok:', error.message);
    process.exit(1);
  });

  ngrok.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ ngrok exited with code ${code}`);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nStopping ngrok tunnel...');
    ngrok.kill();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

