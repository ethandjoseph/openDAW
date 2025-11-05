#!/usr/bin/env bash
set -euo pipefail
echo "mkcert localhost"
mkdir -p certs && cd certs && mkcert localhost || exit 1