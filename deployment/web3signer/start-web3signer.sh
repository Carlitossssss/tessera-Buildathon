#!/bin/sh
set -eu

mkdir -p /opt/tessera/keys
cat > /opt/tessera/keys/backend-signer.yaml <<EOF
type: "hashicorp"
keyType: "SECP256K1"
tlsEnabled: "false"
keyPath: "/v1/${OPENBAO_SIGNING_KEY_PATH}"
keyName: "${OPENBAO_SIGNING_KEY_FIELD}"
serverHost: "${OPENBAO_HOST}"
serverPort: "${OPENBAO_PORT}"
timeout: "10000"
token: "${OPENBAO_WEB3SIGNER_TOKEN}"
httpProtocolVersion: "HTTP_1_1"
EOF

# --chain-id fija la cadena para la que Web3Signer firma transacciones. Es un
# unico valor por proceso, asi que una instancia solo sirve a la red principal.
# Las replicas en otras cadenas no pueden firmarse aqui: ver
# services/certificate-mirror.ts, que usa una clave local para ese caso.
exec /opt/web3signer/bin/web3signer \
  --http-listen-host=0.0.0.0 \
  --http-host-allowlist=web3signer,api,workers,localhost,127.0.0.1 \
  --key-store-path=/opt/tessera/keys \
  --logging=INFO \
  eth1 \
  --chain-id="${WEB3SIGNER_CHAIN_ID}"
