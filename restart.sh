#!/bin/bash

# Always go to your project root
cd ~/Projects/servicelink || {
  echo "❌ Could not find ~/Projects/servicelink"
  exit 1
}

echo "🔍 Checking for process on port 3001..."
PID=$(lsof -ti :3001)

if [ -n "$PID" ]; then
  echo "⚠️ Port 3001 in use by PID $PID. Killing..."
  kill -9 $PID
else
  echo "✅ No process running on port 3001."
fi

echo "🚀 Starting API dev server..."
pnpm --filter api dev
