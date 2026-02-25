#!/usr/bin/env bash
# dev-check.sh — runs typecheck across all packages, then does a startup smoke test on the API
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
ERRORS=""

log()  { echo "  $1"; }
ok()   { echo "  ✓ $1"; ((PASS++)) || true; }
fail() { echo "  ✗ $1"; ((FAIL++)) || true; ERRORS="$ERRORS\n  - $1"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CounterPromo Dev Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. TypeScript: shared ──────────────────────────────────────────────────
echo ""
echo "▶ TypeScript — packages/shared"
if (cd packages/shared && npx tsc --noEmit 2>&1); then
  ok "packages/shared typechecks clean"
else
  fail "packages/shared has TypeScript errors"
fi

# ── 2. TypeScript: db ─────────────────────────────────────────────────────
echo ""
echo "▶ TypeScript — packages/db"
if (cd packages/db && npx tsc --noEmit 2>&1); then
  ok "packages/db typechecks clean"
else
  fail "packages/db has TypeScript errors"
fi

# ── 3. TypeScript: api ────────────────────────────────────────────────────
echo ""
echo "▶ TypeScript — apps/api"
if (cd apps/api && npx tsc --noEmit 2>&1); then
  ok "apps/api typechecks clean"
else
  fail "apps/api has TypeScript errors"
fi

# ── 4. TypeScript: worker ─────────────────────────────────────────────────
echo ""
echo "▶ TypeScript — apps/worker"
if (cd apps/worker && npx tsc --noEmit 2>&1); then
  ok "apps/worker typechecks clean"
else
  fail "apps/worker has TypeScript errors"
fi

# ── 5. TypeScript: web ────────────────────────────────────────────────────
echo ""
echo "▶ TypeScript — apps/web"
if (cd apps/web && npx tsc --noEmit 2>&1); then
  ok "apps/web typechecks clean"
else
  fail "apps/web has TypeScript errors"
fi

# ── 6. API startup smoke test ─────────────────────────────────────────────
echo ""
echo "▶ API startup smoke test"

API_PID=""
LOG_FILE=$(mktemp)

# If something is already on port 3001, test that directly
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null | grep -q "200"; then
  ok "API /health returned 200 (existing server)"
else
  # Nothing running — start one
  (cd apps/api && node --import tsx/esm src/server.ts > "$LOG_FILE" 2>&1) &
  API_PID=$!

  sleep 6

  if ! kill -0 "$API_PID" 2>/dev/null; then
    fail "API process crashed on startup"
    echo "  --- startup log ---"
    cat "$LOG_FILE"
    echo "  -------------------"
  else
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
      ok "API /health returned 200"
    else
      fail "API /health returned HTTP $HTTP_STATUS (expected 200)"
      echo "  --- startup log ---"
      cat "$LOG_FILE"
      echo "  -------------------"
    fi
    kill "$API_PID" 2>/dev/null || true
  fi
fi
rm -f "$LOG_FILE"

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL" -eq 0 ]; then
  echo "  All checks passed ($PASS/$((PASS+FAIL)))"
else
  echo "  $FAIL check(s) failed, $PASS passed"
  echo -e "$ERRORS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
