#!/bin/bash
set -euo pipefail

docker rm -f portfolio-builder-frontend >/dev/null 2>&1 || true
echo "portfolio-builder-frontend stopped."
