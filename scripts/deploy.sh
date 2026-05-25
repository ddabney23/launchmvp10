#!/bin/bash

# Optimix Deployment Script
# Automates pre-deployment checks and deployment process

set -e  # Exit on error

echo "🚀 Starting Optimix deployment process..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Parse command line arguments
ENVIRONMENT=${1:-production}
SKIP_TESTS=${2:-false}

print_info "Deployment environment: $ENVIRONMENT"
print_info "Skip tests: $SKIP_TESTS"
echo ""

# Step 1: Pre-deployment checks
echo "Step 1: Running pre-deployment checks..."
echo "----------------------------------------"

# Check Node version
NODE_VERSION=$(node -v)
print_info "Node version: $NODE_VERSION"

# Check if .env.local exists
if [ ! -f ".env.local" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_warning ".env.local not found (OK for production deployment)"
fi

# Step 2: Install dependencies
echo ""
echo "Step 2: Installing dependencies..."
echo "----------------------------------"
npm ci || {
    print_error "Failed to install dependencies"
    exit 1
}
print_success "Dependencies installed"

# Step 3: Lint code
echo ""
echo "Step 3: Running linter..."
echo "-------------------------"
npm run lint || {
    print_error "Linting failed. Please fix errors before deploying."
    exit 1
}
print_success "Linting passed"

# Step 4: Type check
echo ""
echo "Step 4: Type checking..."
echo "------------------------"
npx tsc --noEmit --skipLibCheck || {
    print_error "Type checking failed. Please fix TypeScript errors."
    exit 1
}
print_success "Type checking passed"

# Step 5: Run tests (optional)
if [ "$SKIP_TESTS" != "true" ]; then
    echo ""
    echo "Step 5: Running tests..."
    echo "------------------------"
    npm run test || {
        print_error "Tests failed. Please fix failing tests."
        exit 1
    }
    print_success "Tests passed"
else
    print_warning "Skipping tests (not recommended for production)"
fi

# Step 6: Build application
echo ""
echo "Step 6: Building application..."
echo "--------------------------------"
npm run build || {
    print_error "Build failed. Please check build errors."
    exit 1
}
print_success "Build completed"

# Step 7: Check build size
echo ""
echo "Step 7: Analyzing build..."
echo "--------------------------"
BUILD_SIZE=$(du -sh .next | cut -f1)
print_info "Build size: $BUILD_SIZE"

# Step 8: Database migrations (production only)
if [ "$ENVIRONMENT" == "production" ]; then
    echo ""
    echo "Step 8: Running database migrations..."
    echo "---------------------------------------"
    print_warning "About to run migrations on PRODUCTION database"
    read -p "Continue? (yes/no) " -n 3 -r
    echo
    if [[ $REPLY =~ ^yes$ ]]; then
        npx prisma migrate deploy || {
            print_error "Migration failed"
            exit 1
        }
        print_success "Migrations completed"
    else
        print_error "Deployment aborted by user"
        exit 1
    fi
fi

# Step 9: Deploy to Vercel
echo ""
echo "Step 9: Deploying to Vercel..."
echo "-------------------------------"

if [ "$ENVIRONMENT" == "production" ]; then
    print_warning "About to deploy to PRODUCTION"
    read -p "Continue? (yes/no) " -n 3 -r
    echo
    if [[ $REPLY =~ ^yes$ ]]; then
        vercel --prod || {
            print_error "Deployment failed"
            exit 1
        }
    else
        print_error "Deployment aborted by user"
        exit 1
    fi
else
    vercel || {
        print_error "Deployment failed"
        exit 1
    }
fi

print_success "Deployment completed"

# Step 10: Post-deployment verification
echo ""
echo "Step 10: Post-deployment checks..."
echo "-----------------------------------"
print_info "Please verify:"
print_info "  1. Application loads at deployed URL"
print_info "  2. Health check passes: /api/health"
print_info "  3. Authentication works"
print_info "  4. Payment processing works"
print_info "  5. Database queries work"

echo ""
echo "========================================"
print_success "Deployment process complete! 🎉"
echo "========================================"

