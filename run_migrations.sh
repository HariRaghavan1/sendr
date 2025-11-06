#!/bin/bash
# Migration Runner Script
# This script will run all migrations in order via Supabase SQL Editor API

echo "🚀 Running Supabase Migrations"
echo "================================"
echo ""
echo "This script will guide you through running migrations."
echo "You can also run them manually via the Supabase dashboard."
echo ""
echo "To run migrations via Supabase Dashboard:"
echo "1. Go to: https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/sql/new"
echo "2. Run each migration file in order (oldest to newest)"
echo ""
echo "Migration files (in order):"
ls -1 supabase/migrations/*.sql | sort
echo ""
echo "📝 Total migrations: $(ls -1 supabase/migrations/*.sql | wc -l)"
