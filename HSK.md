# Tessera on HashKey Chain — RWA Track

**Academic diplomas as verifiable Real World Assets.**

> This document is written for the HSK Chain reviewers and the EAG
> international jury. Everything below is reproducible: every claim ends with
> a command you can run yourself.

---

## 1. Why a diploma is an RWA

A diploma is an asset that exists **outside** the chain and has a **legally
identifiable issuer** who answers for it. That is precisely the definition
HashKey Chain targets with its compliance-first design.

What makes it hard is not minting a token — anyone can mint. It is answering,
years later and without trusting the issuing platform:

| Question | Answered by |
|---|---|
| **Who issued it?** | `certificateIssuer(tokenId)` |
| **Were they authorised to?** | `isApprovedInstitution(issuer)` |
| **Could it have been sold?** | `locked(tokenId)` — ERC-5192 |

All three are **contract reads**. None touches Tessera's database. If our
servers disappeared tomorrow, a regulator with an RPC endpoint still gets the
same answer.

That is the whole argument of this track submission.

---

## 2. Deployed contracts

**HashKey Chain Testnet — chainId 133**

| Contract | Address |
|---|---|
| TesseraRegistry | `0xdD80FA4FA7781135d5B4fb67054EDCcF17E58DE4` |
| TesseraCertificate | `0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b` |
| TesseraBadge | `0x52B13E3F00079c00824E68DC9f1dBCc7D0BE808B` |
| TesseraAutoIssuer | `0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b` |

- RPC: `https://testnet.hsk.xyz`
- Explorer: `https://testnet-explorer.hsk.xyz`
- Solidity 0.8.36, no chain-specific dependencies — the same bytecode runs on
  all four networks Tessera supports.

### Deployment status and Mainnet

These contracts are deployed and validated on **HSK Testnet**. They are *not*
on Mainnet (chainId 177) yet, and we state that plainly rather than implying
otherwise.

The reason is a deliberate project constraint: Tessera runs entirely on
testnets for the Buildathon, so that judges and users can exercise the full
flow — issuing certificates, buying Unlock memberships, enrolling in courses —
without spending real money. Putting only the HSK half on Mainnet would split
the demo across value regimes and make the end-to-end flow impossible to
reproduce for free.

The code is **chain-agnostic and Mainnet-ready**. Switching is configuration,
not a rewrite:

```bash
# HSK Mainnet, measured 2026-09-12
chainId   177        (eth_chainId -> 0xb1)
RPC       https://mainnet.hsk.xyz
gas       ~500 gwei
cost      ~3.75 HSK to deploy all four contracts
          ~0.125 HSK per certificate minted
```

Add the network to `apps/api/src/config/networks.ts`, fund the deployer, run
the same Foundry script. No contract change is required.

---

## 3. Verify it yourself

Install [Foundry](https://book.getfoundry.sh/) and run these against HSK
Testnet. No Tessera account, no API key.

```bash
export RPC=https://testnet.hsk.xyz
export CERT=0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b
export REGISTRY=0xdD80FA4FA7781135d5B4fb67054EDCcF17E58DE4

# 1. Who issued certificate #1?
cast call $CERT "certificateIssuer(uint256)(address)" 1 --rpc-url $RPC
#   -> 0xEe1001B535826EDc4247E7f3a024dDc145A20bdb

# 2. Is that issuer an approved institution, on-chain?
cast call $REGISTRY "isApprovedInstitution(address)(bool)" \
  0xEe1001B535826EDc4247E7f3a024dDc145A20bdb --rpc-url $RPC
#   -> true

# 3. Is the token soulbound? (ERC-5192)
cast call $CERT "locked(uint256)(bool)" 1 --rpc-url $RPC
#   -> true

# 4. Basic identity
cast call $CERT "name()(string)"   --rpc-url $RPC   # -> "Tessera Certificate"
cast call $CERT "symbol()(string)" --rpc-url $RPC   # -> "TCERT"
```

**The three answers together are the provenance claim:** an approved
institution issued it, and it cannot be resold.

---

## 3b. Institutional accreditation — the other half

A verifiable diploma needs two facts, not one. The token proves *what* was
issued; accreditation proves *who* was allowed to issue it.

When a platform admin approves an institution, Tessera registers it in the
`TesseraRegistry` deployed on HSK. From then on the chain answers, on its own:

```bash
cast call 0xdD80FA4FA7781135d5B4fb67054EDCcF17E58DE4   "isApprovedInstitution(address)(bool)" <institution wallet>   --rpc-url https://testnet.hsk.xyz
#   -> true
```

Verified on-chain, tx `0x296367139acf5026b3adb294bc14af2293a594e4a0ce144c3d087aa70c60cfec`.

Or over HTTP, public and unauthenticated:

```bash
curl "https://api.tessera.blokis.dev/v1/public/institutions/<slug>/accreditation"
```

The response lists every chain, whether it recognises the issuer, and the
`cast` command to check each one independently.

### Three decisions worth stating

1. **Accreditation never blocks approval.** HSK testnet's RPC is intermittent —
   measured going down and back up within twenty minutes. The issuing network
   (Amoy) decides; HSK is attempted in parallel and, if it fails, the reason is
   stored with a retry button. An institution is never left unapproved because
   a secondary chain did not answer.

2. **It is signed with a separate key.** Web3Signer starts with a single
   `--chain-id` and cannot sign for another chain, so accreditation reuses
   `MIRROR_SIGNER_PRIVATE_KEY` — the same mechanism already proven for
   certificate mirrors, rather than a new one.

3. **Reads go to the contract, never to our database.** The whole point is that
   the answer does not depend on what Tessera asserts.

This is what makes the credential a Real World Asset rather than a token: an
auditor can establish the issuer's standing without trusting the platform that
issued it.

## 4. The same thing over HTTP

For reviewers who prefer not to install Foundry, the API exposes the identical
reads — **public, no authentication**:

```bash
curl "https://api.tessera.blokis.dev/v1/certificates/1/provenance?chainId=133"
```

```json
{
  "data": {
    "chainId": 133,
    "network": "HashKey Chain Testnet",
    "tokenId": "1",
    "issuer": "0xEe1001B535826EDc4247E7f3a024dDc145A20bdb",
    "issuerApproved": true,
    "soulbound": true,
    "owner": "0x000000000000000000000000000000000000dEaD",
    "explorerUrl": "https://testnet-explorer.hsk.xyz/token/0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b",
    "verifyCommands": [
      "cast call 0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b \"certificateIssuer(uint256)(address)\" 1 --rpc-url https://testnet.hsk.xyz",
      "..."
    ]
  }
}
```

Note the `verifyCommands` field. The endpoint **hands you the commands to
check it without us**. An assertion of provenance that can only be verified
through the asserting party's own API proves very little, so we ship the
escape hatch in the response itself.

In the UI the same data appears on every public verification page
(`/verify/:tokenId`), with a *"Check it yourself"* disclosure that reveals
those commands.

---

## 5. Where this lives in the code

| Concern | File |
|---|---|
| Network definitions, all four chains | `apps/api/src/config/networks.ts` |
| On-chain provenance reads | `apps/api/src/services/provenance.ts` |
| Public endpoint | `apps/api/src/modules/certificates/routes.ts` |
| Contract ABIs | `packages/contracts/src/abis/` |
| UI panel | `apps/web/src/app/(public)/verify/[tokenId]/provenance-panel.tsx` |
| Tests | `apps/api/src/services/provenance.test.ts` |

Design decisions worth calling out:

1. **Each read is independent** (`Promise.allSettled`). An older contract that
   lacks `certificateIssuer` still returns owner and lock status instead of
   failing the whole response.
2. **The registry is only queried when an issuer was actually read.** Asking
   about the zero address would return `false` and wrongly suggest the issuer
   was unapproved, when the truth is we never learned who they were.
3. **Provenance never blocks the page.** If the RPC is down the certificate is
   still valid; the panel simply does not render.
4. **Responses are cached for 5 minutes.** A minted token is immutable, and
   caching keeps a burst of reviewers from hammering a public RPC.

---

## 6. Why HashKey Chain specifically

Tessera issues on Polygon Amoy and mirrors to Avalanche Fuji and Ethereum
Sepolia. HSK is not a fourth mirror — it plays a different role.

Selling verifiable credentials to a regulated institution (a university, a
ministry of education, a professional licensing body) runs into one question
early: *who is legally accountable for this record, and can that be proven
without trusting your company?*

HSK is built for exactly that conversation. Its compliance-first positioning
means an institution's counsel is not being asked to accept a general-purpose
chain for a regulated record. And `certificateIssuer` + `isApprovedInstitution`
give their auditors a direct answer that does not route through us.

That is why the institutional role sits on HSK in
`apps/api/src/config/networks.ts`, and why the provenance endpoint defaults to
reading whichever chain the certificate actually lives on.

---

## 7. Reproducing the full stack

```bash
git clone <repo> && cd tessera
pnpm install
docker compose up -d postgres redis minio
pnpm --filter @tessera/db migrate
pnpm --filter @tessera/api dev

curl "http://localhost:3001/v1/certificates/1/provenance?chainId=133"
```

Validation on the current commit:

```
typecheck   5/5 packages
tests       117 passing
lint        clean
build       production build succeeds
```

---

## 8. Honest limitations

- **Not on Mainnet.** Explained in §2. It is a funding and demo-coherence
  decision, not a technical blocker.
- **The HSK testnet explorer cannot verify source code.** Its Blockscout
  v7.0.2 verification endpoint returns errors for every input format we tried
  (7 approaches documented in `BUILDATHON.md`). The bytecode is on-chain and
  the source is in this repository; the explorer's own tooling is the gap.
- **`totalSupply` is not exposed.** The contract implements ERC-721 +
  Metadata, not ERC-721Enumerable. Enumeration is intentionally left off: it
  adds per-mint gas cost for a feature a credential registry does not need.
