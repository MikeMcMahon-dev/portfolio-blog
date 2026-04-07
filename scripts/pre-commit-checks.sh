#!/bin/bash

# Pre-commit validation script
# Run this before committing: bash scripts/pre-commit-checks.sh

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# 1. Unit + content tests (fast)
echo "✓ Running unit & content tests..."
npm run test:content
npm run test:build

# 2. Smoke tests (fast E2E on chromium only)
echo ""
echo "✓ Running smoke tests (site health check)..."
npm run test:smoke

echo ""
echo "✅ All pre-commit checks passed!"
echo ""

# 3. Labtime logging (Claude logs work sessions)
echo "✓ Logging session to labtime..."
LABTIME_SCRIPT=/Users/mmcmahon/src/home-lab/scripts/labtime.sh
LABTIME_CSV=/Users/mmcmahon/src/home-lab/lab-time.csv
export LABTIME_CSV LABTIME_PROJECT=portfolio-blog

# Log a note about the commit
git_msg=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "pre-commit validation")
$LABTIME_SCRIPT note "Pre-commit validation passed: $git_msg" 2>/dev/null || echo "⚠ labtime logging skipped"

echo ""
echo "Safe to commit. For full E2E suite, run: npm run test:e2e:full"
