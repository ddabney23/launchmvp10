#!/bin/bash
# Bash script to automatically run Supabase migrations
# This script runs all pending migrations in order

set -e

echo "🚀 Supabase Migration Runner"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed!"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Get project ref from environment
SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF:-""}
SUPABASE_DB_PASSWORD=${SUPABASE_DB_PASSWORD:-""}

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "⚠️  SUPABASE_PROJECT_REF not set"
    echo "You can:"
    echo "  1. Set environment variable: export SUPABASE_PROJECT_REF='your-project-ref'"
    echo "  2. Or run migrations manually in Supabase Dashboard"
    echo ""
    echo "Alternatively, run migrations manually:"
    echo "  1. Go to https://app.supabase.com"
    echo "  2. Select your project"
    echo "  3. Go to Database → Migrations"
    echo "  4. Or use SQL Editor to run migration files"
    exit 0
fi

# Get migrations directory
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Get all migration files
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)

if [ -z "$MIGRATION_FILES" ]; then
    echo "⚠️  No migration files found in $MIGRATIONS_DIR"
    exit 0
fi

MIGRATION_COUNT=$(echo "$MIGRATION_FILES" | wc -l)
echo "📋 Found $MIGRATION_COUNT migration files"
echo ""

# Confirmation
read -p "This will run all migrations on your Supabase project. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🔄 Running migrations..."
echo ""

SUCCESS_COUNT=0
ERROR_COUNT=0

while IFS= read -r file; do
    echo -n "  Running: $(basename "$file")... "
    
    if supabase db push --db-url "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_REF.supabase.co:5432/postgres" 2>&1; then
        echo "✅"
        ((SUCCESS_COUNT++))
    else
        echo "❌ Error"
        ((ERROR_COUNT++))
    fi
done <<< "$MIGRATION_FILES"

echo ""
echo "📊 Summary:"
echo "  ✅ Successful: $SUCCESS_COUNT"
echo "  ❌ Errors: $ERROR_COUNT"

if [ $ERROR_COUNT -eq 0 ]; then
    echo ""
    echo "✅ All migrations completed successfully!"
else
    echo ""
    echo "⚠️  Some migrations failed. Check the errors above."
    echo "You can also run migrations manually in Supabase Dashboard → SQL Editor"
fi

