#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT}/backend"
FRONTEND_DIR="${ROOT}/frontend"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ ! -d "${BACKEND_DIR}/.venv" ]]; then
  python3 -m venv "${BACKEND_DIR}/.venv"
fi
# shellcheck disable=SC1091
source "${BACKEND_DIR}/.venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install -r "${BACKEND_DIR}/requirements.txt"

if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
  (cd "${FRONTEND_DIR}" && npm install)
fi

export SAR_DATABASE_PATH="${SAR_DATABASE_PATH:-${BACKEND_DIR}/data/sar.db}"
export SAR_ARTIFACTS_DIR="${SAR_ARTIFACTS_DIR:-${BACKEND_DIR}/data/artifacts}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

(
  cd "${BACKEND_DIR}"
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

(
  cd "${FRONTEND_DIR}"
  npm run dev
) &
FRONTEND_PID=$!

echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Docs:     http://localhost:8000/docs"

wait
