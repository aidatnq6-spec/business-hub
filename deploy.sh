#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
echo "========================================"
echo "  DEPLOY len Firebase Hosting"
echo "  https://gen-lang-client-0931039939.web.app"
echo "========================================"

# Kiem tra Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "[!] Chua co Firebase CLI. Dang cai dat..."
    npm install -g firebase-tools
fi

echo "[1/3] Dang nhap Firebase..."
firebase login

echo "[2/3] Chon project..."
firebase use gen-lang-client-0931039939

echo "[3/3] Dang deploy..."
firebase deploy --project gen-lang-client-0931039939 --only hosting,firestore:rules

echo ""
echo "✅ XONG! Mo trinh duyet kiem tra:"
echo "   https://gen-lang-client-0931039939.web.app"
