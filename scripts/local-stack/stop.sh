#!/usr/bin/env bash
set -uo pipefail
STACK="${STACK_DIR:-/tmp/scbng-local-stack}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
pkill -f "scripts/local-stack/gateway.mjs" 2>/dev/null
pkill -f "scripts/local-stack/smtp-sink.mjs" 2>/dev/null
pkill -x postgrest 2>/dev/null
pkill -x auth 2>/dev/null
if [[ -d "$STACK/pgdata" ]]; then
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$STACK/pgdata" -m fast stop >/dev/null 2>&1
  else "$PG_BIN/pg_ctl" -D "$STACK/pgdata" -m fast stop >/dev/null 2>&1; fi
fi
echo "Local stack stopped"
