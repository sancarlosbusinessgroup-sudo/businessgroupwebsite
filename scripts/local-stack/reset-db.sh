#!/usr/bin/env bash
# Throws away the local database and rebuilds it from migrations + seed.
set -euo pipefail
exec bash "$(dirname "$0")/start.sh" --fresh
