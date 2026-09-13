# OpenBao stays on the Docker internal network; Dokploy must not publish port 8200.
ui = true
disable_mlock = true
api_addr = "http://openbao:8200"
cluster_addr = "http://openbao:8201"
# Development workload tokens are rotated every 90 days. Web3Signer uses a
# static token and cannot renew a periodic token by itself.
default_lease_ttl = "720h"
max_lease_ttl = "2160h"

listener "tcp" {
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable = 1
}

storage "raft" {
  path = "/openbao/data"
  node_id = "tessera-1"
}
