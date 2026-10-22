#!/usr/bin/env bash
# Starts a local, Supabase-compatible stack for tests:
#   Postgres 16 (54322) + Supabase Auth (54323) + PostgREST (54324)
#   + gateway (54321, same URL shape as Supabase) + SMTP sink (54325, API 54326).
# Requires: Postgres 16 server binaries on this machine, Node 20+, internet access to GitHub releases (first run only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="${STACK_DIR:-/tmp/businessgroup-local-stack}"
BIN="$STACK/bin"
PGDATA="$STACK/pgdata"
LOGS="$STACK/logs"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
POSTGREST_VERSION="v12.2.3"
AUTH_VERSION="v2.164.0"

mkdir -p "$BIN" "$LOGS"

if [[ ! -x "$BIN/postgrest" ]]; then
  echo "Downloading PostgREST $POSTGREST_VERSION"
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar -xJ -C "$BIN"
fi
if [[ ! -x "$BIN/auth/auth" ]]; then
  echo "Downloading Supabase Auth $AUTH_VERSION"
  mkdir -p "$BIN/auth"
  curl -sSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" | tar -xz -C "$BIN/auth"
fi

as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

if [[ "${1:-}" == "--fresh" && -d "$PGDATA" ]]; then
  bash "$ROOT/scripts/local-stack/stop.sh" || true
  rm -rf "$PGDATA"
fi

FIRST_RUN=0
if [[ ! -d "$PGDATA" ]]; then
  FIRST_RUN=1
  mkdir -p "$PGDATA"
  [[ "$(id -u)" == "0" ]] && chown -R postgres "$STACK"
  as_pg "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust >"$LOGS/initdb.log"
fi
[[ "$(id -u)" == "0" ]] && chown -R postgres "$STACK"

if ! as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOGS/postgres.log" -o "-p 54322 -k $STACK -c listen_addresses=127.0.0.1" -w start >/dev/null 2>&1 </dev/null
fi

PSQL=(psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
JWT_SECRET="$(node "$ROOT/scripts/local-stack/keys.mjs" secret)"

if [[ "$FIRST_RUN" == "1" ]]; then
  "${PSQL[@]}" -f "$ROOT/scripts/local-stack/bootstrap.sql"
fi

# Mail sink and auth server
pkill -f "scripts/local-stack/smtp-sink.mjs" 2>/dev/null || true
setsid nohup node "$ROOT/scripts/local-stack/smtp-sink.mjs" >"$LOGS/smtp.log" 2>&1 </dev/null &
pkill -f "scripts/local-stack/brevo-mock.mjs" 2>/dev/null || true
setsid nohup node "$ROOT/scripts/local-stack/brevo-mock.mjs" >"$LOGS/brevo.log" 2>&1 </dev/null &
pkill -f "scripts/local-stack/zoom-mock.mjs" 2>/dev/null || true
setsid nohup node "$ROOT/scripts/local-stack/zoom-mock.mjs" >"$LOGS/zoom.log" 2>&1 </dev/null &

export GOTRUE_API_HOST=127.0.0.1 PORT=54323 API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1"
export GOTRUE_DB_DRIVER=postgres DB_NAMESPACE=auth
export DATABASE_URL="postgres://supabase_auth_admin:local-auth-admin@127.0.0.1:54322/postgres?sslmode=disable"
export GOTRUE_SITE_URL="${SITE_URL:-http://localhost:3000}" GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**,http://127.0.0.1:3000/**"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=54325 GOTRUE_SMTP_ADMIN_EMAIL=no-reply@localhost GOTRUE_SMTP_SENDER_NAME="Bay Area Referral Partners"
export GOTRUE_SMTP_MAX_FREQUENCY=1s GOTRUE_RATE_LIMIT_EMAIL_SENT=10000 GOTRUE_RATE_LIMIT_OTP=10000 GOTRUE_RATE_LIMIT_VERIFY=10000 GOTRUE_RATE_LIMIT_TOKEN_REFRESH=10000
export GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
export GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
export GOTRUE_MAILER_OTP_LENGTH=6 GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=false
export GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=http://127.0.0.1:54326/templates/magic-link
export GOTRUE_LOG_LEVEL=warn

pkill -x auth 2>/dev/null || true
( cd "$BIN/auth" && ./auth migrate >"$LOGS/auth-migrate.log" 2>&1 )
( cd "$BIN/auth" && setsid nohup ./auth serve >"$LOGS/auth.log" 2>&1 </dev/null & )

if [[ "$FIRST_RUN" == "1" ]]; then
  for f in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" -f "$f"
  done
  "${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
fi

cat >"$STACK/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:local-authenticator@127.0.0.1:54322/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 54324
EOF
pkill -x postgrest 2>/dev/null || true
setsid nohup "$BIN/postgrest" "$STACK/postgrest.conf" >"$LOGS/postgrest.log" 2>&1 </dev/null &

pkill -f "scripts/local-stack/gateway.mjs" 2>/dev/null || true
setsid nohup node "$ROOT/scripts/local-stack/gateway.mjs" >"$LOGS/gateway.log" 2>&1 </dev/null &

ready=0
for _ in $(seq 1 40); do
  auth_code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' http://127.0.0.1:54321/auth/v1/health || true)"
  rest_code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' http://127.0.0.1:54321/rest/v1/ || true)"
  if [[ "$auth_code" == "200" && "$rest_code" == "200" ]]; then ready=1; break; fi
  sleep 0.5
done
[[ "$ready" == "1" ]] || { echo "Stack failed to start; see $LOGS"; exit 1; }
echo "Local stack ready: http://127.0.0.1:54321 (logs in $LOGS)"
