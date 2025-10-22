#!/usr/bin/env bash
set -euo pipefail
echo "mkcert localhost"
cd certs && mkcert localhost || exit 1