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
echo "Safe to commit. For full E2E suite, run: npm run test:e2e:full"
