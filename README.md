<div align="center">

# Tessera

**Verifiable on-chain academic credentials**

Certificates as Soulbound Tokens · Public verification, no account needed · Token-gated courses with Unlock Protocol

[![Avalanche](https://img.shields.io/badge/Avalanche-Fuji-e84142?style=flat-square)](#21-avalanche---making-the-credential-visible)
[![Unlock](https://img.shields.io/badge/Unlock%20Protocol-Sepolia-ff6771?style=flat-square)](#22-unlock-protocol---letting-the-institution-get-paid)
[![HashKey](https://img.shields.io/badge/HashKey%20Chain-Testnet-00d2ff?style=flat-square)](#23-hashkey-chain---so-an-auditor-can-accept-it)
[![Solidity](https://img.shields.io/badge/Solidity%200.8.36-Foundry%20·%2083%20tests-627eea?style=flat-square)](#3-smart-contracts)

Built by the **Tessera Team**

</div>

---

## Table of Contents

1. [What Tessera is](#1-what-tessera-is)
2. [The three buildathon technologies](#2-the-three-buildathon-technologies) ← **start here**
3. [Smart contracts](#3-smart-contracts)
4. [Deployed networks](#4-deployed-networks)
5. [How to verify a certificate without trusting us](#5-how-to-verify-a-certificate-without-trusting-us)
6. [Architecture](#6-architecture)
7. [Running the project locally](#7-running-the-project-locally)
8. [Full configuration](#8-full-configuration)
9. [Verification and testing](#9-verification-and-testing)
10. [Troubleshooting](#10-troubleshooting)
11. [Actual project scope](#11-actual-project-scope)

---
> [!WARNING]
> **DEMO CREDENTIALS — AUTHORIZED USE ONLY**
>
> These credentials are exclusively for buildathon demonstrations, testing, and evaluation. Do not modify, share, misuse, or use them outside the demo environment.

### Demo credentials

**Student**
- Email: `serranoroly23@gmail.com`
- Password: `R1o2l3y4`

**Institution**
- Email: `institution@tessera.io`
- Password: `institution123`

**Teacher**
- Email: `lau.nunez@outlook.es`
- Password: `Pass1234`

## 1. What Tessera is

A platform where an educational institution issues certificates as **Soulbound Tokens** — NFTs that cannot be transferred or sold — and anyone can verify them directly against the blockchain, with no account and no need to trust Tessera.

**The problem.** A PDF diploma can be forged in minutes. Verifying it properly means calling the university, waiting, and trusting whoever answers. It doesn't scale, and in practice almost no one does it.

**The solution.** The certificate carries the institution's authorship recorded in the contract. The recipient can't sell it because the token is permanently locked (ERC-5192). And anyone who wants to check it can read the contract from any block explorer: if Tessera disappeared tomorrow, the credential would still be verifiable.

**Four roles, four dashboards:** platform admin, institution, teacher, and student.

> Everything deployed is **testnet**. There is no mainnet deployment.

---

## 2. The three buildathon technologies

Tessera didn't adopt three chains just to collect logos. Each one solves a problem the other two don't, and all three decisions were made after running into a concrete limitation.

The one-sentence summary: **Polygon issues, Avalanche makes it visible, Unlock makes it payable, and HashKey makes it acceptable to an auditor.**

| | Role in the product | Why this one and not another | Evidence in the code |
|---|---|---|---|
| **Avalanche Fuji** | The diploma can be **shown** | Snowtrace renders the NFT image; PolygonScan Amoy does not | `certificate-mirror.ts` · 6 tests |
| **Unlock Protocol** | The institution **gets paid** for its content | On-chain membership standard, deployed on Sepolia | `unlock.ts`, `lock-health.ts`, `course-access.ts` · 111 tests |
| **HashKey Chain** | An **auditor** can verify it | Compliance-first chain for real-world assets | `institution-accreditation.ts`, `provenance.ts` · 5 tests |

The three integrations add up to **122 automated tests**.

---

### 2.1 Avalanche — making the credential visible

**The real problem.** We minted on Polygon Amoy and it worked: the token existed, the `tokenURI` resolved, the metadata was correct. But opening the certificate on PolygonScan Amoy showed the image as a gray placeholder. That explorer doesn't render NFT images on testnet.

A credential that can't be seen **doesn't work as a credential**. A graduate can't show a gray box to an employer. The problem wasn't technical — it was a product problem.

**What we did.** Every certificate is mirrored on Avalanche Fuji, where Snowtrace does draw the image. The original lives on Amoy; the mirror is the visible copy.

**How it's built** — [`certificate-mirror.ts`](apps/api/src/services/certificate-mirror.ts):

- **The mirror goes through the AutoIssuer, not a direct `mint()`.** The contract only authorizes the institution, an approved teacher, or the AutoIssuer, and the backend's signer is none of the three. The AutoIssuer validates an EIP-712 signature and mints on the institution's behalf, without it paying gas or holding a key.
- **RPC with cascading fallback.** Avalanche's official endpoint returns `403` to requests from datacenter IPs: it worked locally and failed in production. There are three endpoints in order of preference, and `MIRROR_RPC_URLS_FUJI` lets you prepend a private one without redeploying.
- **A mirror failure never invalidates the original.** A mint can't be undone. If the mirror fails, it's logged in `certificate_mirrors` with its reason and attempt count, and can be retried via `POST /v1/me/certificates/:id/mirrors/:chainId/retry`.
- **Independent signing key.** Web3Signer starts with a single `--chain-id` and can't sign for another chain, so mirrors use `MIRROR_SIGNER_PRIVATE_KEY`: a low-value wallet that only pays testnet gas.

**A detail that cost a redeployment.** The first contract on Fuji (`0x60521efB…`) indexed transfers fine, but each token's page came up empty: without `totalSupply()` the explorer can't build the collection's inventory. `ERC721Enumerable` and `contractURI` were added, and it was redeployed on 2026-09-12. Certificates from the previous contract still exist on-chain.

**Check it yourself.** Open a certificate at https://testnet.snowtrace.io and compare it with the same token on Amoy. That difference is exactly why Avalanche is part of the project.

---

### 2.2 Unlock Protocol — letting the institution get paid

**The real problem.** The business model only worked in one direction: the institution **pays** Tessera to issue certificates. Nothing let the institution **get paid** for its own content. A course with valuable material had no way to monetize inside the platform.

**What we did.** Token-gated courses: the institution publishes a course, sets an Unlock Lock, and access to the content depends on holding a valid key. On completion, the student receives a soulbound certificate. The membership is **proven as the cause** of the credential, not just decoration.

**Authorization lives on the server** — [`unlock.ts`](apps/api/src/services/unlock.ts). Full content never leaves the API without a valid key. The lock icon on the cover is just signaling; the actual barrier is on the server. There's nothing to bypass from the browser.

**`getHasValidKey` authorizes; `balanceOf` only informs.** This distinction is deliberate: `balanceOf` also counts expired keys, so authorizing with it would let expired memberships through. `getHasValidKey` already accounts for expiration.

**Just querying the Lock isn't enough.** It proves *that wallet* has a membership, not that the requester owns it. That's why the student signs an EIP-191 message, at no gas cost, and the server recovers the address from the signature:

```
Tessera Portal: proof of wallet ownership
Wallet: 0xAbC...              <- normalized to checksum
Content: course:<courseId>
Issued: 2026-09-13T10:00:00.000Z
Signing costs no gas and authorizes no payment.
```

> Checksum normalization isn't cosmetic: browser wallets return the address in lowercase, and without normalizing, the text differed by several bytes. The signature recovered a different address and **every** verification was rejected.

**Diagnosing the Lock before accepting it** — [`lock-health.ts`](apps/api/src/services/lock-health.ts), 30 tests. The previous screen accepted anything shaped like `0x` plus 40 characters. Now three distinct failure modes are distinguished, each with different consequences:

| Verdict | What it means | Why it matters |
|---|---|---|
| `could not be read` | Might be a downed RPC | Nothing is asserted |
| `not a Lock` | No contract at that address | Rejected: it would never unlock anything |
| `wrong owner` | It's a Lock, but someone else's | **Payments would go to that wallet** |

**The full journey.** Discover (the syllabus is always shown: without it no one knows what they're buying) → preview (the first N modules, capped at the real total so nothing is over-promised) → verify (signature + `getHasValidKey`) → unlock.

**The loop closes on both ends.** `POST /v1/portal/content/:slug/complete` requires the same two checks as reading the content — wallet ownership and on-chain membership — because issuing costs more than reading. And from the already-issued certificate, `PortalOriginPanel` shows the exact Lock that access was checked against.

**An expired membership doesn't revoke access already granted.** The panel says so plainly, without alarm: *"You still have access to this course."*

**Where it lives.** Unlock is deployed on Sepolia and Base Sepolia, not on Amoy or Fuji. That's why memberships live on Sepolia while certificates are minted on each institution's network. Every course stores its own `lockAddress` and `lockChainId`.

---

### 2.3 HashKey Chain — so an auditor can accept it

**The real problem.** A diploma is a real-world asset: it exists off-chain and someone specific is accountable for it. To talk to a regulated institution, it's not enough for the token to exist — a third party needs to be able to verify **who issued it and whether they were authorized**, without asking Tessera's permission or trusting our API.

**What we did.** HashKey Chain is a *compliance-first* chain aimed at tokenizing real-world assets. There we accredit institutions on-chain and publish the full provenance of every certificate.

**Institutional accreditation with traceability** — [`institution-accreditation.ts`](apps/api/src/services/institution-accreditation.ts) and the `institution_accreditations` table. Approving an institution already registered it in `TesseraRegistry`, but that fact only lived as `approved` in our database: there was no record of **which chain**, **which transaction**, or **what happened if it failed**.

Now every accreditation stores `chain_id`, `tx_hash`, `status`, `failure_reason`, and `attempts`. It's traceability, never authorization: **the contract is still what decides**; a row only says an attempt was made and how it ended. HashKey is the only network where accreditation is **written** (`WRITABLE_CHAIN_IDS = [133]`).

**Ownership is checked before writing.** A revert due to missing permissions arrives wrapped in the details of every transport viem tried, and it's easy to mistake for a network failure. Querying `owner()` directly gives an exact message stating which wallet needs to be authorized. If there's a pending `Ownable2Step` transfer to our name, it's accepted on the spot.

**Retry without re-approving.** The HSK testnet RPC goes down and comes back. A failed accreditation isn't a data error, it's a network that didn't respond. `POST /v1/admin/institutions/:id/accredit/:chainId` retries only that network, without touching the institution's approval.

**Public provenance, no authentication required** — [`provenance.ts`](apps/api/src/services/provenance.ts). Three questions, all read straight from the contract:

| Question | Function | Contract |
|---|---|---|
| Who issued it? | `certificateIssuer(tokenId)` | TesseraCertificate |
| Were they authorized? | `isApprovedInstitution(issuer)` | TesseraRegistry |
| Could it have been sold? | `locked(tokenId)` | ERC-5192 |

```bash
curl "http://localhost:3001/v1/certificates/1/provenance?chainId=133"
```

It's public **on purpose**: a provenance claim that can only be checked with an API key doesn't prove anything to a third party. The endpoint has CORS wide open, accepts `?chainId=` to query any of the four networks, and also returns **the exact commands to repeat the read without using Tessera**.

**What can't be done, stated plainly.** HashKey's explorer **doesn't offer source-code verification**, so the bytecode isn't published there; the app flags this in `/status` with `verificationUnavailable: true` instead of hiding it. And the fallback endpoint that was listed in the config (`hashkeychain-testnet.alt.technology`) **doesn't exist**: its DNS doesn't resolve, and it was producing `fetch failed` errors mixed in with what were actually permission errors — sending people off to diagnose network outages that didn't exist.  A single real endpoint was kept.

---

## 3. Smart contracts

Four Solidity `0.8.36` contracts, compiled with Foundry (`evm_version = cancun`, optimizer at 200 runs, `bytecode_hash = ipfs` so explorers can identify the exact compiler).

Source code lives in the sibling repository `tessera-contracts/`.

### 3.1 TesseraRegistry — who can issue

The authority registry. The contract owner approves institutions; each approved institution manages its own list of teachers.

```solidity
function isApprovedInstitution(address institution) external view returns (bool);
function isApprovedTeacher(address institution, address teacher) external view returns (bool);
function institutionName(address institution) external view returns (string memory);

function approveInstitution(address institution, string name) external;  // owner only
function revokeInstitution(address institution) external;                // owner only
```

**`Ownable2Step`:** transferring ownership requires the new owner to explicitly accept it. A typo in the address doesn't leave the contract ownerless.

**Revocation by *epochs*.** Teachers are stored as `mapping(address => mapping(address => uint256))` of epochs. When an institution is revoked, its epoch advances and **all of its teachers are invalidated in a single operation**, with no list traversal and no gas cost proportional to the number of teachers.

### 3.2 TesseraCertificate — the soulbound certificate

`ERC-721` + `ERC721Enumerable` + `ERC721URIStorage` + `ERC-5192`.

```solidity
function locked(uint256 tokenId) external view returns (bool);         // ERC-5192: always true
function certificateIssuer(uint256 tokenId) external view returns (address);
function ownerOf(uint256 tokenId) external view returns (address);
function tokenURI(uint256 tokenId) external view returns (string);
function revoke(uint256 tokenId, string reason) external;
```

**`certificateIssuer(tokenId)` is the central function of the design.** It returns the address of the institution that issued that specific token, read from the contract itself. It doesn't go through any API. This is what makes the credential independently verifiable.

**Non-transferable.** Any `transferFrom` or `safeTransferFrom` reverts with `Soulbound()`. Only the owner can burn a token in exceptional cases.

**Three authorized issuance paths:**
1. The approved institution, directly (`msg.sender == institution`).
2. A teacher approved by that institution.
3. The `TesseraAutoIssuer`, if configured by the owner.

**`ERC721Enumerable` is deliberate.** Without `totalSupply()`, explorers can't build the collection's inventory and each token's page shows up empty. This was discovered in production and led to a redeployment on Avalanche Fuji.

```solidity
event CertificateMinted(uint256 indexed tokenId, address indexed to, address indexed institution, address minter, string uri);
event CertificateRevoked(uint256 indexed tokenId, string reason);
event Locked(uint256 tokenId);   // ERC-5192
```

### 3.3 TesseraBadge — ERC-1155 badges

For minor milestones: participation, rankings, recognitions. Also soulbound, with per-token URI via `ERC1155URIStorage`.

```solidity
function mintBadge(address to, uint256 tokenId, uint256 amount, string tokenURI_, address institution) external;
function uri(uint256 tokenId) external view returns (string);

event BadgeMinted(uint256 indexed tokenId, address indexed to, address indexed institution, uint256 amount, address minter, string uri);
```

### 3.4 TesseraAutoIssuer — delegated issuance via EIP-712 signature

Lets the backend authorize an issuance **without paying gas**: it signs a typed payload and any relayer can submit the transaction.

```solidity
struct IssuancePayload {
    address student;
    address institution;
    string  uri;
    uint256 nonce;
    uint256 deadline;
}

function triggerIssuance(IssuancePayload payload, bytes signature) external returns (uint256 tokenId);
function nonces(address institution) external view returns (uint256);
function DOMAIN_SEPARATOR() external view returns (bytes32);
```

**Protections:**

| Risk | Mitigation |
|---|---|
| Reentrancy | `ReentrancyGuard` |
| Signature replay | Strictly increasing nonce per institution |
| Stolen signature used later | UNIX `deadline`: the signature expires |
| Compromised signer | The owner can rotate it |

EIP-712 domain: name `TesseraAutoIssuer`, version `1`.

---

## 4. Deployed networks

Four networks, each with a distinct, measured purpose. **Only one issues at any given time**: whichever `POLYGON_CHAIN_ID` points to. Presenting all four as if they all minted would be false, and any explorer would disprove it in seconds.

### Polygon Amoy · chainId 80002 · **issuance**

https://amoy.polygonscan.com

| Contract | Address |
|---|---|
| Registry | `0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb` |
| Certificate | `0x9571E4553636314A9A583B8c5c784d207D51F635` |
| Badge | `0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a` |
| AutoIssuer | `0x34df4378BC382A9D1EC6a2656f679C4b46Dce22d` |

**Why.** Cheap gas and fast finality. A university with thousands of graduates a year can certify all of them without cost turning the credential into a luxury. It's what makes real volume viable.

### Avalanche Fuji · chainId 43113 · **display**

https://testnet.snowtrace.io

| Contract | Address |
|---|---|
| Registry | `0xE821fEC944c5BFadB769EC5235D9D09F7e951Dae` |
| Certificate | `0x5F5164642D96cC3128AbF68019D72c426a895945` |
| Badge | `0x5390b92176e316846e6b199d2746DE5b03232E04` |
| AutoIssuer | `0x8f34224573A93086Ed7eA87c972DC70f5E5Bb814` |

**Why.** PolygonScan Amoy doesn't render NFT images: it always serves a placeholder. Snowtrace shows the diploma's actual design. A credential that can't be seen doesn't work as a credential — the graduate needs to be able to show it to an employer.

Certificates here are **mirrors**; the original lives on Amoy.

### Ethereum Sepolia · chainId 11155111 · **memberships**

https://sepolia.etherscan.io

| Contract | Address |
|---|---|
| Registry | `0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b` |
| Certificate | `0x5c5018E212B6F295Af75E5Ff326b0bB3D375530a` |
| Badge | `0xa98D116E8a59ae21C832a3d25407Caf3B603DeD2` |
| AutoIssuer | `0x2017ee0C335A0f799562006B3d5DD00F345a5033` |

**Why.** Unlock Protocol is deployed here, so the Lock that controls access to content lives on the same chain as these contracts.

### HashKey Chain Testnet · chainId 133 · **institutional issuance**

https://testnet-explorer.hsk.xyz

| Contract | Address |
|---|---|
| Registry | `0xdD80FA4FA7781135d5B4fb67054EDCcF17E58DE4` |
| Certificate | `0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b` |
| Badge | `0x52B13E3F00079c00824E68DC9f1dBCc7D0BE808B` |
| AutoIssuer | `0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b` |

**Why.** A *compliance-first* chain for tokenizing real-world assets. A diploma is exactly that: a real asset with an identifiable issuer. Where regulation demands a traceable issuer, `certificateIssuer` answers on-chain.

> HashKey's explorer **doesn't offer source-code verification**, so the bytecode can't be published there. The app flags this explicitly in `/status` instead of hiding it.

---

## 5. How to verify a certificate without trusting us

This is the proof that matters. Open the explorer for any of the networks, paste the **Certificate** contract address, and use the *Read Contract* tab:

| # | Call | Expected result | What it proves |
|---|---|---|---|
| 1 | `locked(tokenId)` | `true` | The certificate is non-transferable (ERC-5192) |
| 2 | `certificateIssuer(tokenId)` | `0x…` | Which institution issued it |
| 3 | `isApprovedInstitution(<result of 2>)` on **Registry** | `true` | That institution was authorized |
| 4 | `ownerOf(tokenId)` | `0x…` | The student's wallet |
| 5 | `tokenURI(tokenId)` | URL | The metadata: image and attributes |

**Five calls, none of them to Tessera's API.** That's the whole point of the design: the credential doesn't depend on us continuing to exist.

Also available from the app:

- **`/verify`** — paste an ID, upload the certificate PDF, or scan its QR code. No account needed.
- **`/verify/<tokenId>`** — a detail page with a provenance panel: issuer, whether it's approved in the Registry, whether it's transferable, and the exact commands to repeat the check yourself.
- **`/status`** — live operational status and all four networks with their contracts.

Public endpoint, no authentication:

```bash
curl -X POST http://localhost:3001/v1/certificates/verify \
  -H 'Content-Type: application/json' \
  -d '{"tokenId":"1"}'
```

---

## 6. Architecture

Monorepo using Turborepo and pnpm workspaces.

```
tessera/
├── apps/
│   ├── api/              Fastify 5 · Drizzle ORM · BullMQ
│   │   ├── src/modules/     20 route modules
│   │   ├── src/services/    Business logic
│   │   └── src/workers/     7 queue workers
│   └── web/              Next.js 15 App Router · React 19
│       └── src/app/
│           ├── (public)/    Landing, catalog, verification
│           └── (app)/       Dashboards: admin · institution · teacher · student
├── packages/
│   ├── contracts/        Typed ABIs · EIP-712 helpers · addresses
│   ├── db/               Drizzle schema · 26 SQL migrations
│   ├── i18n/             EN/ES dictionary · 1613 keys per language
│   └── shared/            Shared types and constants
└── ../tessera-contracts/ (sibling repo) Solidity · Foundry
```

**Database:** PostgreSQL 17, **46 tables**. Main ones: `certificates`, `institutions`, `users`, `courses`, `modules`, `topics`, `assessments`, `enrollments`, `certificate_mirrors`, `portal_unlocks`, `credit_ledger`, `api_keys`, `webhook_endpoints`.

**Queues (BullMQ on Redis):** `certificate`, `badge`, `webhook`, `email`, `indexer`, `gdprExport`, `gdprDeletion`, `paymentSync`.

### 6.1 A certificate's lifecycle

```
Institution queues it →  POST /v1/me/certificates/issue  (up to 500 at once)
        ↓
Credit debit           →  atomic and idempotent per certificateId
        ↓
Generate image          →  SVG → PNG with the student's data
        ↓
Pin to IPFS              →  image + metadata, BEFORE minting
        ↓
Mint on-chain             →  mint on the primary network
        ↓
Mirror (optional)        →  mirror networks; if it fails, the original stays valid
```

**Why it's pinned to IPFS before minting.** An NFT indexer reads the `tokenURI` **only once** and caches a failure. If minting happened before Pinata confirmed, the certificate would permanently end up without an image even though it was perfectly valid.

**Why the mirror step never blocks the main worker.** The certificate exists once the primary network confirms it. A mint can't be undone: if the mirror fails, it's logged and can be retried, but the original stays valid.

### 6.2 Bilingual support

`@tessera/i18n` exposes `useT()` (dictionary) and `useI18n()` (dictionary + locale + setter). English by default, switchable to Spanish **without reloading the page**.

**1613 keys in each language. Zero missing, zero extra** — verified by comparing the full structure of both files.

Two deliberate, documented exceptions in the code:

- **Server Actions** — run on the server with no React context, so they can't read the active locale via `useT()`. Their error messages stay in Spanish.
- **`global-error.tsx`** — replaces the entire provider tree, including the i18n provider. Forcing the hook there could break the error boundary itself and leave a blank screen.

---

## 7. Running the project locally

### 7.1 Prerequisites

| Requirement | Version | Check with |
|---|---|---|
| Node.js | ≥ 22.11.0 | `node -v` |
| pnpm | 11.3.0 | `pnpm -v` |
| Docker Desktop | recent, **running** | `docker info` |
| Git | any | `git --version` |

If you don't have pnpm:

```bash
corepack enable
corepack prepare pnpm@11.3.0 --activate
```

### 7.2 Clone and install

```bash
git clone <repository-url>
cd tessera
pnpm install
```

### 7.3 The TWO environment files

This is where most people get stuck. **Two files are needed**, because the API and the frontend load their config from different places.

**File 1 — `.env` at the root** (used by the API and workers):

```bash
cp .env.example .env
```

**File 2 — `apps/web/.env.local`** (used by Next.js, which does **not** read the root `.env`):

```bash
cat > apps/web/.env.local <<'EOF'
# Auth.js v5 — must be the SAME AUTH_SECRET as the root .env
AUTH_SECRET=dev-secret-change-me-please-32-chars-minimum-ok
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Tessera API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AUTH_URL=http://localhost:3000

# Blockchain — reads from the browser
NEXT_PUBLIC_POLYGON_CHAIN_ID=80002
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
NEXT_PUBLIC_CONTRACT_REGISTRY=0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb
NEXT_PUBLIC_CONTRACT_CERTIFICATE=0x9571E4553636314A9A583B8c5c784d207D51F635
NEXT_PUBLIC_CONTRACT_BADGE=0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a
EOF
```

> **`AUTH_SECRET` must match** across both files, and be **32 characters or more**. If they don't match, login fails with no clear message. Both files are in `.gitignore`.

> The API reads, in this order: root `.env.local` and `.env`, then `apps/api/`'s `.env.local` and `.env`. The first one to define a variable wins.

### 7.4 Bring up the infrastructure

```bash
docker compose up -d
```

Four containers:

| Service | Image | Ports | Access |
|---|---|---|---|
| PostgreSQL | `postgres:17-alpine` | 5432 | `tessera` / `tessera` / db `tessera` |
| Redis | `redis:7-alpine` | 6379 | no password |
| MailHog | `mailhog/mailhog` | 1025 SMTP · **8025 web** | http://localhost:8025 |
| MinIO | `quay.io/minio/minio` | 9000 API · **9001 console** | `minioadmin` / `minioadmin` |

Check that all four are up:

```bash
docker compose ps
```

**Create the MinIO bucket** (the local compose setup doesn't do this automatically). Go to http://localhost:9001, log in with `minioadmin`/`minioadmin`, and create a bucket named **`tessera-assets`**.

### 7.5 Migrations and sample data

```bash
pnpm db:migrate     # applies the 26 migrations
pnpm db:seed        # creates the 4 demo accounts
```

The seed only creates **four users and one institution**. It doesn't create certificates or courses — that's done from the app.

| Role | Email | Password |
|---|---|---|
| Platform admin | `admin@tessera.io` | `admin123` |
| Institution | `institution@tessera.io` | `institution123` |
| Teacher | `teacher@tessera.io` | `teacher123` |
| Student | `student@tessera.io` | `student123` |

### 7.6 Start the app

Three processes. It's most convenient to use one terminal per process:

```bash
# Terminal 1 — API on :3001
pnpm api:dev

# Terminal 2 — Workers (process the queues)
pnpm workers:dev

# Terminal 3 — Frontend on :3000
pnpm --filter @tessera/web dev
```

Or all three at once, in a single terminal:

```bash
pnpm dev
```

> **The workers matter.** Without them the app looks and navigates perfectly fine, but certificates stay stuck in `queued` state forever: nothing processes the queue.

### 7.7 Check that everything is alive

**Open http://localhost:3000** and log in with any of the four accounts.

Dependency status:

```bash
curl http://localhost:3001/v1/health
```

Returns the status of 14 checks: database, Redis, RPC, Arweave, Pinata, signer, signer funds, custody wallets, mirrors, OpenBao, Stripe webhook, object storage, and email.

On a fresh install, several will show as `not_configured` or `mock`. **That's expected** and doesn't prevent using the platform.

### 7.8 Start from scratch

```bash
docker compose down -v      # removes containers AND volumes
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

---

## 8. Full configuration

With default values **the platform starts up and works**. Anything not configured degrades gracefully instead of breaking.

### 8.1 What happens if you don't configure each thing

| Variable | If not configured | What it's for |
|---|---|---|
| `SIGNER_PRIVATE_KEY` | On-chain issuance is **simulated**; everything else works | Minting real certificates |
| `ARWEAVE_JWK_JSON` | Storage runs in deterministic mock mode | Permanent metadata on Arweave |
| `PINATA_JWT` | Storage runs in deterministic mock mode | Pinning image and metadata to IPFS |
| `RESEND_API_KEY` | Emails go to **MailHog** (:8025) | Real email delivery |
| `STRIPE_SECRET_KEY` | Payments disabled | Subscriptions and credit packs |
| `UNLOCK_DEFAULT_LOCK_ADDRESS` | Just a suggestion on the dashboard | Every course stores its own Lock |
| `MIRROR_CHAIN_IDS` | No mirroring to secondary networks | Certificates visible on Snowtrace |
| `WEB3SIGNER_URL` / `OPENBAO_*` | `SIGNER_PRIVATE_KEY` is used instead | Key custody in production |
| `SENTRY_DSN` | No error telemetry | Observability |

### 8.2 Main variables

**API and authentication**

```bash
API_PORT=3001
API_PUBLIC_URL=http://localhost:3001
API_CORS_ORIGINS=http://localhost:3000    # must point to the frontend
AUTH_SECRET=<32 characters or more>        # same value in both .env files
AUTH_URL=http://localhost:3000
JWT_EXPIRES_IN=4h
REFRESH_TOKEN_EXPIRES_IN=30d
```

**Data**

```bash
DATABASE_URL=postgres://tessera:tessera@localhost:5432/tessera
DATABASE_POOL_MAX=20
REDIS_URL=redis://localhost:6379
```

**Blockchain**

```bash
POLYGON_CHAIN=polygonAmoy
POLYGON_CHAIN_ID=80002                     # ← the network that ISSUES
POLYGON_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
POLYGON_RPC_URL_FALLBACK=                  # backup RPC, optional

CONTRACT_REGISTRY_ADDRESS=0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb
CONTRACT_CERTIFICATE_ADDRESS=0x9571E4553636314A9A583B8c5c784d207D51F635
CONTRACT_BADGE_ADDRESS=0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a
CONTRACT_AUTO_ISSUER_ADDRESS=0x34df4378BC382A9D1EC6a2656f679C4b46Dce22d
```

**Real issuance (optional)**

```bash
SIGNER_PRIVATE_KEY=0x...
BACKEND_SIGNER_ADDRESS=0x...
```

> The `SIGNER_PRIVATE_KEY` wallet must be the **owner of TesseraRegistry**. If it isn't, approving an institution fails with *"Tessera's signer (0x…) does not control TesseraRegistry"*.
>
> It needs testnet funds. Faucets: [Polygon Amoy](https://faucet.polygon.technology) · [Avalanche Fuji](https://core.app/tools/testnet-faucet) · [Sepolia](https://sepoliafaucet.com).
>
> The API **detects and warns** at startup and in `/v1/health` if it's using a known Anvil or Hardhat key. These are public: fine for an ephemeral local chain, never for a real network.

**Mirror networks (optional)**

```bash
MIRROR_CHAIN_IDS=43113                     # empty = don't mirror
MIRROR_SIGNER_PRIVATE_KEY=0x...            # separate key from the main one
MIRROR_RPC_URLS_FUJI=                      # private RPCs, if public ones are blocked
```

> Mirroring needs its own key because Web3Signer starts with a single `--chain-id` and can't sign for another chain. It's a low-value wallet: it only pays testnet gas.

**Unlock Protocol (optional)**

```bash
UNLOCK_DEFAULT_LOCK_ADDRESS=               # create at app.unlock-protocol.com
UNLOCK_DEFAULT_CHAIN_ID=11155111           # Ethereum Sepolia
UNLOCK_RPC_URL=                            # empty = public RPCs
```

> Create the Lock at [app.unlock-protocol.com](https://app.unlock-protocol.com) with your wallet connected to **Sepolia**, using the *Deploy a custom membership* option. Recommended: a price greater than zero and a finite duration, so expiration is noticeable when testing.

**Storage**

```bash
OBJECT_STORAGE_PROVIDER=minio
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=tessera-assets
```

### 8.3 All commands

```bash
# Development
pnpm dev                  # all three processes at once
pnpm api:dev              # API only
pnpm workers:dev          # workers only
pnpm --filter @tessera/web dev

# Database
pnpm db:migrate           # apply migrations
pnpm db:seed              # demo accounts
pnpm db:generate          # generate a migration after a schema change
pnpm db:studio            # visual database browser

# Quality
pnpm typecheck            # TypeScript across the monorepo
pnpm lint                 # ESLint
pnpm test                 # Vitest
pnpm build                # production build
pnpm format                # Prettier
```

---

## 9. Verification and testing

### 9.1 The app

```bash
pnpm typecheck    # TypeScript — no errors
pnpm lint         # ESLint
pnpm test         # Vitest — 231 cases across 24 files
pnpm build        # production build — 72 routes
```

The suite focuses on the API's services: certificate issuance, metadata, artwork, multi-chain mirroring, provenance, Unlock verification, course access, storage, payments, and webhooks.

> **A known failure.** `certificate-mirror.test.ts` › *"does not mirror when MIRROR_CHAIN_IDS is empty"* fails on a **5s timeout**: that test hits a real RPC and fails due to network or TLS certificate issues, not the code. The other 230 pass. Isolate it with `pnpm --filter @tessera/api test -- certificate-mirror`.

### 9.2 The contracts

From `tessera-contracts/`. Everything runs inside Docker, **Foundry doesn't need to be installed**:

```bash
make build           # compile
make test            # 83 tests, fuzz at 1024 runs
make test-ci         # fuzz at 10,000 runs
make coverage        # lcov report
make gas             # gas report
make fmt-check       # formatting
```

Includes **invariant tests** (`test/invariant/SoulboundInvariant.t.sol`) that exhaustively check the system's central property: **a certificate can never change owner**, no matter what you do.

Deployment and validation:

```bash
make deploy-amoy
make deploy-network NET=fuji            # or hsk, sepolia
make validate-network NET=fuji          # validates the deployed topology
make verify-network NET=fuji            # publishes the code on the explorer
make approve-institution-network NET=fuji ADDRESS=0x... NAME="University X"
```

---

## 10. Troubleshooting

**The API won't start and complains about a variable**

`envalid` validates the config at startup and stops if something required is missing. The message says exactly which one. It's almost always `AUTH_SECRET` being shorter than 32 characters.

**Login doesn't work, with no clear message**

`AUTH_SECRET` doesn't match between the root `.env` and `apps/web/.env.local`. They must be identical.

**Certificates stay stuck in `queued` forever**

The workers aren't running. Start them with `pnpm workers:dev`.

**`ECONNREFUSED` against the database or Redis**

Docker isn't running, or the containers didn't come up. Check with `docker compose ps` and bring them up with `docker compose up -d`.

**Port 9000 conflict**

`.env.example` ships with `S3_ENDPOINT=http://localhost:9000` (MinIO) and `WEB3SIGNER_URL=http://localhost:9000` (Web3Signer) pointing at the same port. **Locally, MinIO occupies port 9000.** Leave `WEB3SIGNER_URL` empty while you're not using Web3Signer, or the API will try to sign against MinIO.

**"Tessera's signer (0x…) does not control TesseraRegistry"**

The `SIGNER_PRIVATE_KEY` wallet is not the Registry's owner. Only that wallet can approve institutions on-chain.

**Warning about a known development key at startup**

You're using a public Anvil or Hardhat key. That's fine locally and doesn't block anything; the warning exists so nobody takes it to a server thinking it's their own.

**The frontend can't find the API**

`NEXT_PUBLIC_API_URL` must point to `http://localhost:3001`. And heads up: `NEXT_PUBLIC_*` variables **are baked in at build time**. If you change them, you need to rebuild, not just restart.

**No emails arrive**

That's expected without `RESEND_API_KEY`. Emails go to MailHog: http://localhost:8025

---

## 11. Actual project scope

**What's done and working:**

- Four auditable contracts deployed across four networks, with 83 tests including non-transferability invariants.
- Certificate issuance with permanent metadata on IPFS/Arweave, processed via retrying queues.
- Public verification with no account: by ID, by PDF, or by QR code.
- Multi-chain mirroring with retries, which never compromises the original certificate.
- Token-gated courses with Unlock Protocol verified on-chain **on the server**.
- Four role-based dashboards, with differentiated permissions.
- Public API with keys, scopes, rate limits, and HMAC-signed webhooks.
- Bilingual EN/ES interface with 1613 keys per language, switchable without reloading.

**What isn't, stated plainly:**

- **Everything is testnet.** There is no mainnet deployment.
- HashKey's explorer **doesn't support source-code verification**, so the bytecode isn't published there.
- Some formatting utilities — dates, numbers, prices — are still hardcoded to Spanish (`es-PE`). Documented in the code as pending.
- The **institution** and **teacher** areas still have Spanish-only text pending translation; the rest of the app is bilingual.
- One test fails due to network issues, as explained in section 9.1.

---

<div align="center">

**Tessera Team**

Proprietary software — all rights reserved. See [LICENSE](./LICENSE).

</div>
