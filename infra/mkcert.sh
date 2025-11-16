#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")" && pwd)/certs"
mkdir -p "$CERT_DIR"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Install it from https://github.com/FiloSottile/mkcert#installation"
  echo "On macOS: brew install mkcert nss"
  echo "On Linux: use your package manager or download prebuilt binaries"
  exit 1
fi

echo "Ensuring local CA is installed..."
mkcert -install

echo "Generating localhost certs into $CERT_DIR ..."
mkcert -key-file "$CERT_DIR/privkey.pem" -cert-file "$CERT_DIR/fullchain.pem" localhost 127.0.0.1 ::1

echo "Done. To run HTTPS nginx container:"
echo "  docker compose -f infra/docker-compose.yml -f infra/docker-compose.ssl.yml up -d nginx"

