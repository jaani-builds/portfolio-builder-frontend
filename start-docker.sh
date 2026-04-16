#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building portfolio-builder-frontend image..."
docker build -t portfolio-builder-frontend:local .

echo "Stopping existing frontend container..."
docker rm -f portfolio-builder-frontend >/dev/null 2>&1 || true

echo "Starting frontend on http://localhost:5174 ..."
docker run -d --name portfolio-builder-frontend \
  -p 5174:8080 \
  portfolio-builder-frontend:local

echo ""
echo "Frontend running at http://localhost:5174"
