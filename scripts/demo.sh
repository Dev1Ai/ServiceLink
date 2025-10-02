#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-http://localhost:3001}

echo "== Login as customer and provider =="
cust_json=$(curl -s -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","password":"password123"}')
prov_json=$(curl -s -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"provider@example.com","password":"password123"}')
cust_token=$(echo "$cust_json" | sed -n 's/.*"access_token"\s*:\s*"\([^"]*\)".*/\1/p')
prov_token=$(echo "$prov_json" | sed -n 's/.*"access_token"\s*:\s*"\([^"]*\)".*/\1/p')
echo "Customer token: ${cust_token:0:16}..."
echo "Provider token: ${prov_token:0:16}..."

echo "== Create job (customer) =="
job_json=$(curl -s -X POST "$API_BASE/jobs" -H 'Content-Type: application/json' -H "Authorization: Bearer $cust_token" \
  -d '{"title":"demo job","description":"demo via script"}')
job_id=$(echo "$job_json" | sed -n 's/.*"id"\s*:\s*"\([^"]*\)".*/\1/p')
echo "Job id: $job_id"

echo "== Provider submits quote =="
quote_json=$(curl -s -X POST "$API_BASE/jobs/$job_id/quotes" -H 'Content-Type: application/json' -H "Authorization: Bearer $prov_token" \
  -d '{"total":12345}')
quote_id=$(echo "$quote_json" | sed -n 's/.*"id"\s*:\s*"\([^"]*\)".*/\1/p')
echo "Quote id: $quote_id"

echo "== Customer accepts quote =="
curl -s -X POST "$API_BASE/jobs/$job_id/quotes/$quote_id/accept" -H "Authorization: Bearer $cust_token" > /dev/null
echo "Accepted"

echo "== Customer verifies completion =="
curl -s -X POST "$API_BASE/jobs/$job_id/complete" -H "Authorization: Bearer $cust_token" > /dev/null
echo "Verified completion"

echo "== Done =="

