<div align="center">

# Tessera

**Credenciales académicas verificables on-chain**

Certificados como Soulbound Tokens · Verificación pública sin cuenta · Cursos token-gated con Unlock Protocol

[![Avalanche](https://img.shields.io/badge/Avalanche-Fuji-e84142?style=flat-square)](#21-avalanche---que-la-credencial-se-vea)
[![Unlock](https://img.shields.io/badge/Unlock%20Protocol-Sepolia-ff6771?style=flat-square)](#22-unlock-protocol---que-la-institución-cobre)
[![HashKey](https://img.shields.io/badge/HashKey%20Chain-Testnet-00d2ff?style=flat-square)](#23-hashkey-chain---que-un-auditor-lo-acepte)
[![Solidity](https://img.shields.io/badge/Solidity%200.8.36-Foundry%20·%2083%20tests-627eea?style=flat-square)](#3-contratos-inteligentes)

Desarrollado por el **Equipo Tessera** — [Blokis](https://blokislabs.com)

</div>

---

## Índice

1. [Qué es Tessera](#1-qué-es-tessera)
2. [Las tres tecnologías del buildathon](#2-las-tres-tecnologías-del-buildathon) ← **empiece aquí**
3. [Contratos inteligentes](#3-contratos-inteligentes)
4. [Redes desplegadas](#4-redes-desplegadas)
5. [Cómo verificar un certificado sin confiar en nosotros](#5-cómo-verificar-un-certificado-sin-confiar-en-nosotros)
6. [Arquitectura](#6-arquitectura)
7. [Levantar el proyecto en local](#7-levantar-el-proyecto-en-local)
8. [Configuración completa](#8-configuración-completa)
9. [Verificación y pruebas](#9-verificación-y-pruebas)
10. [Solución de problemas](#10-solución-de-problemas)
11. [Alcance real del proyecto](#11-alcance-real-del-proyecto)

---

## 1. Qué es Tessera

Una plataforma donde una institución educativa emite certificados como **Soulbound Tokens** —NFT que no se pueden transferir ni vender— y cualquiera puede verificarlos directamente contra la blockchain, sin crear una cuenta y sin confiar en Tessera.

**El problema.** Un diploma en PDF se falsifica en minutos. Verificarlo de verdad exige llamar por teléfono a la universidad, esperar, y confiar en quien contesta. No escala, y en la práctica casi nadie lo hace.

**La solución.** El certificado lleva la autoría de la institución grabada en el contrato. Quien lo recibe no puede venderlo porque el token está permanentemente bloqueado (ERC-5192). Y quien quiera comprobarlo lee el contrato desde cualquier explorador de bloques: si Tessera desapareciera mañana, la credencial seguiría siendo verificable.

**Cuatro roles, cuatro paneles:** administrador de plataforma, institución, docente y estudiante.

> Todo lo desplegado es **testnet**. No hay ningún despliegue en mainnet.

---

## 2. Las tres tecnologías del buildathon

Tessera no adoptó tres cadenas para sumar logos. Cada una resuelve un problema que las otras dos no resuelven, y las tres decisiones se tomaron después de chocar con una limitación concreta.

El resumen en una frase: **Polygon emite, Avalanche hace que se vea, Unlock hace que se pague, y HashKey hace que un auditor lo acepte.**

| | Rol en el producto | Por qué esta y no otra | Evidencia en el código |
|---|---|---|---|
| **Avalanche Fuji** | El diploma se puede **enseñar** | Snowtrace renderiza la imagen del NFT; PolygonScan Amoy no | `certificate-mirror.ts` · 6 tests |
| **Unlock Protocol** | La institución **cobra** por su contenido | Estándar de membresías on-chain, desplegado en Sepolia | `unlock.ts`, `lock-health.ts`, `course-access.ts` · 111 tests |
| **HashKey Chain** | Un **auditor** puede comprobarlo | Cadena compliance-first para activos del mundo real | `institution-accreditation.ts`, `provenance.ts` · 5 tests |

Las tres integraciones suman **122 tests automatizados**.

---

### 2.1 Avalanche — que la credencial se vea

**El problema real.** Emitimos en Polygon Amoy y funcionaba: el token existía, el `tokenURI` resolvía, la metadata era correcta. Pero al abrir el certificado en PolygonScan Amoy la imagen salía como un marcador de posición gris. Ese explorador no renderiza imágenes de NFT en testnet.

Una credencial que no se ve **no funciona como credencial**. Un egresado no puede enseñarle un cuadro gris a un empleador. El problema no era técnico, era de producto.

**Qué hicimos.** Cada certificado se replica en Avalanche Fuji, donde Snowtrace sí dibuja la imagen. El original vive en Amoy; la réplica es la copia visible.

**Cómo está construido** — [`certificate-mirror.ts`](apps/api/src/services/certificate-mirror.ts):

- **La réplica pasa por el AutoIssuer, no por `mint()` directo.** El contrato solo autoriza a la institución, a un docente aprobado o al AutoIssuer, y el signer del backend no es ninguno de los tres. El AutoIssuer valida una firma EIP-712 y acuña en nombre de la institución, sin que ella pague gas ni custodie una clave.
- **RPC con fallback en cascada.** El endpoint oficial de Avalanche devuelve `403` a peticiones desde IPs de datacenter: funcionaba en local y fallaba en producción. Hay tres endpoints en orden de preferencia, y `MIRROR_RPC_URLS_FUJI` permite anteponer uno privado sin desplegar.
- **Un fallo de réplica nunca invalida el original.** Un mint no se puede deshacer. Si la réplica falla se registra en `certificate_mirrors` con su razón y su contador de intentos, y se reintenta con `POST /v1/me/certificates/:id/mirrors/:chainId/retry`.
- **Clave de firma independiente.** Web3Signer arranca con un único `--chain-id` y no puede firmar para otra cadena, así que las réplicas usan `MIRROR_SIGNER_PRIVATE_KEY`: una wallet de bajo valor que solo paga gas de testnet.

**Un detalle que costó un redespliegue.** El primer contrato en Fuji (`0x60521efB…`) indexaba las transferencias, pero la ficha de cada token salía vacía: sin `totalSupply()` el explorador no construye el inventario de la colección. Se añadió `ERC721Enumerable` y `contractURI`, y se redesplegó el 2026-09-12. Los certificados del contrato anterior siguen existiendo on-chain.

**Compruébelo.** Abra un certificado en https://testnet.snowtrace.io y compare con el mismo token en Amoy. Esa diferencia es exactamente la razón por la que Avalanche está en el proyecto.

---

### 2.2 Unlock Protocol — que la institución cobre

**El problema real.** El modelo de negocio solo tenía una dirección: la institución **paga** a Tessera por emitir. Nada permitía que la institución **cobrara** por su propio contenido. Un curso con material de valor no tenía forma de monetizarse dentro de la plataforma.

**Qué hicimos.** Cursos token-gated: la institución publica un curso, fija un Lock de Unlock, y el acceso al contenido depende de tener una llave válida. Al terminar, el estudiante recibe su certificado soulbound. La membresía queda **demostrada como causa** de la credencial, no como un adorno.

**La autorización vive en el servidor** — [`unlock.ts`](apps/api/src/services/unlock.ts). El contenido completo nunca sale de la API sin una llave válida. El candado sobre la portada es señalización; la barrera está en el servidor. No hay nada que saltarse desde el navegador.

**`getHasValidKey` autoriza; `balanceOf` solo informa.** Es una distinción deliberada: `balanceOf` cuenta también las llaves vencidas, así que autorizar con ella dejaría pasar membresías caducadas. `getHasValidKey` ya contempla la expiración.

**Consultar el Lock no basta.** Prueba que *esa wallet* tiene membresía, no que quien la pide sea su dueño. Por eso el estudiante firma un mensaje EIP-191, sin gas, y el servidor recupera la dirección desde la firma:

```
Tessera Portal: prueba de propiedad de wallet
Wallet: 0xAbC...              <- normalizado a checksum
Contenido: course:<courseId>
Emitido: 2026-09-13T10:00:00.000Z
Firmar no cuesta gas ni autoriza ningun pago.
```

> La normalización a checksum no es cosmética: las wallets del navegador devuelven la dirección en minúsculas, y sin normalizar el texto difería en varios bytes. La firma recuperaba otra dirección y **toda** verificación se rechazaba.

**Diagnóstico del Lock antes de aceptarlo** — [`lock-health.ts`](apps/api/src/services/lock-health.ts), 30 tests. La pantalla anterior daba por buena cualquier dirección con forma de `0x` más 40 caracteres. Ahora se distinguen tres fallos con consecuencias distintas:

| Veredicto | Qué significa | Por qué importa |
|---|---|---|
| `no se pudo leer` | Puede ser un RPC caído | No se afirma nada |
| `no es un Lock` | No hay contrato en esa dirección | Se rechaza: nunca abriría nada |
| `dueño ajeno` | Es un Lock, pero de otra persona | **Los pagos irían a esa wallet** |

**El recorrido completo.** Descubrir (el temario se muestra siempre: sin eso nadie sabe qué está comprando) → previsualizar (los primeros N módulos, acotados al número real para no prometer de más) → verificar (firma + `getHasValidKey`) → desbloquear.

**El círculo se cierra en los dos sentidos.** `POST /v1/portal/content/:slug/complete` exige las mismas dos barreras que leer el contenido —propiedad de wallet y membresía on-chain— porque emitir cuesta más que leer. Y desde el certificado ya emitido, `PortalOriginPanel` muestra el Lock concreto contra el que se comprobó el acceso.

**Una membresía vencida no retira el acceso ya concedido.** El panel lo dice sin alarmar: *"Conservas el acceso a este curso."*

**Dónde vive.** Unlock está desplegado en Sepolia y Base Sepolia, no en Amoy ni Fuji. Por eso las membresías viven en Sepolia mientras los certificados se emiten en la red de cada institución. Cada curso guarda su propio `lockAddress` y `lockChainId`.

---

### 2.3 HashKey Chain — que un auditor lo acepte

**El problema real.** Un diploma es un activo del mundo real: existe fuera de la cadena y alguien concreto responde por él. Para hablar con una institución regulada no basta con que el token exista; hace falta que un tercero pueda comprobar **quién lo emitió y si estaba autorizado**, sin pedirle permiso a Tessera ni confiar en nuestra API.

**Qué hicimos.** HashKey Chain es una cadena *compliance-first* orientada a tokenización de activos reales. Allí acreditamos instituciones on-chain y publicamos la procedencia completa de cada certificado.

**Acreditación institucional con trazabilidad** — [`institution-accreditation.ts`](apps/api/src/services/institution-accreditation.ts) y la tabla `institution_accreditations`. Aprobar una institución ya la registraba en `TesseraRegistry`, pero ese hecho vivía solo como `approved` en nuestra base: no quedaba constancia de **en qué cadena**, **con qué transacción**, ni **qué pasó si falló**.

Ahora cada acreditación guarda `chain_id`, `tx_hash`, `status`, `failure_reason` y `attempts`. Es trazabilidad, nunca autorización: **quien decide sigue siendo el contrato**; una fila solo dice que se intentó y cómo terminó. HashKey es la única red donde se **escribe** la acreditación (`WRITABLE_CHAIN_IDS = [133]`).

**Se comprueba el owner antes de escribir.** Un revert por falta de permisos llega envuelto en el detalle de cada transporte que viem intentó, y ahí es fácil confundirlo con un fallo de red. Preguntar `owner()` directamente da un mensaje exacto que dice qué wallet hay que autorizar. Si hay una transferencia `Ownable2Step` pendiente a nuestro nombre, se acepta en el momento.

**Reintento sin reaprobar.** El RPC de HSK testnet se cae y vuelve. Una acreditación fallida no es un error de datos, es una red que no respondió. `POST /v1/admin/institutions/:id/accredit/:chainId` reintenta solo esa red, sin tocar la aprobación de la institución.

**Procedencia pública y sin autenticación** — [`provenance.ts`](apps/api/src/services/provenance.ts). Tres preguntas, las tres leídas del contrato:

| Pregunta | Función | Contrato |
|---|---|---|
| ¿Quién lo emitió? | `certificateIssuer(tokenId)` | TesseraCertificate |
| ¿Estaba autorizado? | `isApprovedInstitution(issuer)` | TesseraRegistry |
| ¿Puede haberse vendido? | `locked(tokenId)` | ERC-5192 |

```bash
curl "http://localhost:3001/v1/certificates/1/provenance?chainId=133"
```

Es público **a propósito**: una afirmación de procedencia que solo puede comprobarse con una API key no prueba nada a un tercero. El endpoint tiene CORS abierto, acepta `?chainId=` para consultar cualquiera de las cuatro redes, y devuelve además **los comandos exactos para repetir la lectura sin usar Tessera**.

**Lo que no se puede hacer, dicho claramente.** El explorador de HashKey **no ofrece verificación de código fuente**, así que el bytecode no está publicado allí; la aplicación lo marca en `/status` con `verificationUnavailable: true` en vez de ocultarlo. Y el endpoint de respaldo que figuraba en la configuración (`hashkeychain-testnet.alt.technology`) **no existe**: su DNS no resuelve, y arrastraba un `fetch failed` dentro de errores que en realidad eran de permisos, mandando a diagnosticar caídas de red inexistentes. Se dejó un único endpoint real.

---

## 3. Contratos inteligentes

Cuatro contratos en Solidity `0.8.36`, compilados con Foundry (`evm_version = cancun`, optimizador a 200 runs, `bytecode_hash = ipfs` para que los exploradores identifiquen el compilador exacto).

Código fuente en el repositorio hermano `tessera-contracts/`.

### 3.1 TesseraRegistry — quién puede emitir

El registro de autoridad. El dueño del contrato aprueba instituciones; cada institución aprobada gestiona su propia lista de docentes.

```solidity
function isApprovedInstitution(address institution) external view returns (bool);
function isApprovedTeacher(address institution, address teacher) external view returns (bool);
function institutionName(address institution) external view returns (string memory);

function approveInstitution(address institution, string name) external;  // solo owner
function revokeInstitution(address institution) external;                // solo owner
```

**`Ownable2Step`:** transferir la propiedad exige que el nuevo dueño la acepte explícitamente. Un error de tipeo en la dirección no deja el contrato sin dueño.

**Revocación por *epochs*.** Los docentes se guardan como `mapping(address => mapping(address => uint256))` de epochs. Cuando se revoca una institución, su epoch avanza y **todos sus docentes quedan invalidados en una sola operación**, sin recorrer listas ni pagar gas proporcional al número de docentes.

### 3.2 TesseraCertificate — el certificado soulbound

`ERC-721` + `ERC721Enumerable` + `ERC721URIStorage` + `ERC-5192`.

```solidity
function locked(uint256 tokenId) external view returns (bool);         // ERC-5192: siempre true
function certificateIssuer(uint256 tokenId) external view returns (address);
function ownerOf(uint256 tokenId) external view returns (address);
function tokenURI(uint256 tokenId) external view returns (string);
function revoke(uint256 tokenId, string reason) external;
```

**`certificateIssuer(tokenId)` es la función central del diseño.** Devuelve la dirección de la institución que emitió ese token concreto, leída del propio contrato. No pasa por ninguna API. Es lo que convierte la credencial en verificable de forma independiente.

**No transferible.** Cualquier `transferFrom` o `safeTransferFrom` revierte con `Soulbound()`. Solo el owner puede quemar un token en casos excepcionales.

**Tres vías autorizadas de emisión:**
1. La institución aprobada, directamente (`msg.sender == institution`).
2. Un docente aprobado por esa institución.
3. El `TesseraAutoIssuer`, si el owner lo configuró.

**`ERC721Enumerable` es deliberado.** Sin `totalSupply()` los exploradores no construyen el inventario de la colección y la ficha de cada token aparece vacía. Se descubrió en producción y motivó un redespliegue en Avalanche Fuji.

```solidity
event CertificateMinted(uint256 indexed tokenId, address indexed to, address indexed institution, address minter, string uri);
event CertificateRevoked(uint256 indexed tokenId, string reason);
event Locked(uint256 tokenId);   // ERC-5192
```

### 3.3 TesseraBadge — insignias ERC-1155

Para hitos menores: participación, ranking, reconocimientos. También soulbound, con URI por token vía `ERC1155URIStorage`.

```solidity
function mintBadge(address to, uint256 tokenId, uint256 amount, string tokenURI_, address institution) external;
function uri(uint256 tokenId) external view returns (string);

event BadgeMinted(uint256 indexed tokenId, address indexed to, address indexed institution, uint256 amount, address minter, string uri);
```

### 3.4 TesseraAutoIssuer — emisión delegada por firma EIP-712

Permite que el backend autorice una emisión **sin pagar el gas**: firma un payload tipado y cualquier relayer puede enviar la transacción.

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

**Protecciones:**

| Riesgo | Mitigación |
|---|---|
| Reentrada | `ReentrancyGuard` |
| Replay de firma | Nonce estrictamente creciente por institución |
| Firma robada y usada tarde | `deadline` UNIX: la firma caduca |
| Signer comprometido | El owner puede rotarlo |

Dominio EIP-712: nombre `TesseraAutoIssuer`, versión `1`.

---

## 4. Redes desplegadas

Cuatro redes, cada una con un propósito distinto y medido. **Solo una emite en cada momento**: la que apunte `POLYGON_CHAIN_ID`. Presentar las cuatro como si todas emitieran sería falso, y un explorador lo desmiente en segundos.

### Polygon Amoy · chainId 80002 · **emisión**

https://amoy.polygonscan.com

| Contrato | Dirección |
|---|---|
| Registry | `0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb` |
| Certificate | `0x9571E4553636314A9A583B8c5c784d207D51F635` |
| Badge | `0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a` |
| AutoIssuer | `0x34df4378BC382A9D1EC6a2656f679C4b46Dce22d` |

**Por qué.** Gas barato y finalidad rápida. Una universidad con miles de egresados al año puede certificarlos a todos sin que el costo convierta la credencial en un lujo. Es lo que hace viable el volumen real.

### Avalanche Fuji · chainId 43113 · **visualización**

https://testnet.snowtrace.io

| Contrato | Dirección |
|---|---|
| Registry | `0xE821fEC944c5BFadB769EC5235D9D09F7e951Dae` |
| Certificate | `0x5F5164642D96cC3128AbF68019D72c426a895945` |
| Badge | `0x5390b92176e316846e6b199d2746DE5b03232E04` |
| AutoIssuer | `0x8f34224573A93086Ed7eA87c972DC70f5E5Bb814` |

**Por qué.** PolygonScan Amoy no renderiza imágenes de NFT: sirve siempre un marcador de posición. Snowtrace muestra el diseño real del diploma. Una credencial que no se ve no funciona como credencial — el egresado necesita poder enseñarla a un empleador.

Los certificados aquí son **réplicas**; el original vive en Amoy.

### Ethereum Sepolia · chainId 11155111 · **membresías**

https://sepolia.etherscan.io

| Contrato | Dirección |
|---|---|
| Registry | `0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b` |
| Certificate | `0x5c5018E212B6F295Af75E5Ff326b0bB3D375530a` |
| Badge | `0xa98D116E8a59ae21C832a3d25407Caf3B603DeD2` |
| AutoIssuer | `0x2017ee0C335A0f799562006B3d5DD00F345a5033` |

**Por qué.** Unlock Protocol está desplegado aquí, así que el Lock que controla el acceso al contenido vive en la misma cadena que estos contratos.

### HashKey Chain Testnet · chainId 133 · **emisión institucional**

https://testnet-explorer.hsk.xyz

| Contrato | Dirección |
|---|---|
| Registry | `0xdD80FA4FA7781135d5B4fb67054EDCcF17E58DE4` |
| Certificate | `0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b` |
| Badge | `0x52B13E3F00079c00824E68DC9f1dBCc7D0BE808B` |
| AutoIssuer | `0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b` |

**Por qué.** Cadena *compliance-first* para tokenización de activos del mundo real. Un diploma es exactamente eso: un activo real con emisor identificable. Donde la regulación exige emisor trazable, `certificateIssuer` responde on-chain.

> El explorador de HashKey **no ofrece verificación de código fuente**, así que el bytecode no puede publicarse allí. La aplicación lo marca explícitamente en `/status` en vez de ocultarlo.

---

## 5. Cómo verificar un certificado sin confiar en nosotros

Esta es la prueba que importa. Abra el explorador de cualquiera de las redes, pegue la dirección del contrato **Certificate**, y use la pestaña *Read Contract*:

| # | Llamada | Resultado esperado | Qué demuestra |
|---|---|---|---|
| 1 | `locked(tokenId)` | `true` | El certificado no es transferible (ERC-5192) |
| 2 | `certificateIssuer(tokenId)` | `0x…` | Qué institución lo emitió |
| 3 | `isApprovedInstitution(<resultado de 2>)` en **Registry** | `true` | Esa institución estaba autorizada |
| 4 | `ownerOf(tokenId)` | `0x…` | La wallet del estudiante |
| 5 | `tokenURI(tokenId)` | URL | La metadata: imagen y atributos |

**Cinco llamadas, ninguna a la API de Tessera.** Ese es el punto entero del diseño: la credencial no depende de que nosotros sigamos existiendo.

También desde la aplicación:

- **`/verify`** — pegue un ID, suba el PDF del certificado o escanee su QR. Sin cuenta.
- **`/verify/<tokenId>`** — ficha con panel de procedencia: emisor, si está aprobado en el Registry, si es transferible, y los comandos exactos para repetir la comprobación usted mismo.
- **`/status`** — estado operativo en vivo y las cuatro redes con sus contratos.

Endpoint público, sin autenticación:

```bash
curl -X POST http://localhost:3001/v1/certificates/verify \
  -H 'Content-Type: application/json' \
  -d '{"tokenId":"1"}'
```

---

## 6. Arquitectura

Monorepo con Turborepo y pnpm workspaces.

```
tessera/
├── apps/
│   ├── api/              Fastify 5 · Drizzle ORM · BullMQ
│   │   ├── src/modules/     20 módulos de rutas
│   │   ├── src/services/    Lógica de negocio
│   │   └── src/workers/     7 workers de cola
│   └── web/              Next.js 15 App Router · React 19
│       └── src/app/
│           ├── (public)/    Landing, catálogo, verificación
│           └── (app)/       Paneles: admin · institution · teacher · student
├── packages/
│   ├── contracts/        ABIs tipados · helpers EIP-712 · direcciones
│   ├── db/               Esquema Drizzle · 26 migraciones SQL
│   ├── i18n/             Diccionario EN/ES · 1613 claves por idioma
│   └── shared/           Tipos y constantes compartidas
└── ../tessera-contracts/ (repo hermano) Solidity · Foundry
```

**Base de datos:** PostgreSQL 17, **46 tablas**. Principales: `certificates`, `institutions`, `users`, `courses`, `modules`, `topics`, `assessments`, `enrollments`, `certificate_mirrors`, `portal_unlocks`, `credit_ledger`, `api_keys`, `webhook_endpoints`.

**Colas (BullMQ sobre Redis):** `certificate`, `badge`, `webhook`, `email`, `indexer`, `gdprExport`, `gdprDeletion`, `paymentSync`.

### 6.1 El ciclo de vida de un certificado

```
Institución encola   →  POST /v1/me/certificates/issue  (hasta 500 a la vez)
        ↓
Débito de crédito    →  atómico e idempotente por certificateId
        ↓
Generar imagen       →  SVG → PNG con los datos del estudiante
        ↓
Fijar en IPFS        →  imagen + metadata, ANTES de acuñar
        ↓
Acuñar on-chain      →  mint en la red principal
        ↓
Replicar (opcional)  →  redes espejo; si falla, el original sigue válido
```

**Por qué se fija en IPFS antes de acuñar.** Un indexador de NFT lee el `tokenURI` **una sola vez** y cachea el fallo. Si se acuñara antes de que Pinata confirme, el certificado quedaría sin imagen de forma permanente aunque fuera perfectamente válido.

**Por qué la réplica nunca lanza hacia el worker principal.** El certificado existe cuando la red principal lo confirma. Un mint no se puede deshacer: si la réplica falla, se registra y se puede reintentar, pero el original sigue siendo válido.

### 6.2 Bilingüismo

`@tessera/i18n` expone `useT()` (diccionario) y `useI18n()` (diccionario + locale + setter). Inglés por defecto, español conmutable **sin recargar la página**.

**1613 claves en cada idioma. Cero faltantes, cero sobrantes** — verificado comparando la estructura completa de ambos archivos.

Dos excepciones deliberadas y documentadas en el código:

- **Server Actions** — corren en el servidor sin contexto de React, así que no pueden leer el idioma activo con `useT()`. Sus mensajes de error quedan en español.
- **`global-error.tsx`** — reemplaza el árbol completo de providers, incluido el de i18n. Forzar el hook ahí podría romper el propio boundary de errores y dejar la pantalla en blanco.

---

## 7. Levantar el proyecto en local

### 7.1 Requisitos previos

| Requisito | Versión | Comprobar con |
|---|---|---|
| Node.js | ≥ 22.11.0 | `node -v` |
| pnpm | 11.3.0 | `pnpm -v` |
| Docker Desktop | reciente, **arrancado** | `docker info` |
| Git | cualquiera | `git --version` |

Si no tiene pnpm:

```bash
corepack enable
corepack prepare pnpm@11.3.0 --activate
```

### 7.2 Clonar e instalar

```bash
git clone <url-del-repositorio>
cd tessera
pnpm install
```

### 7.3 Los DOS archivos de entorno

Este es el paso donde más gente se atasca. **Hacen falta dos archivos**, porque el API y el frontend cargan su configuración de sitios distintos.

**Archivo 1 — `.env` en la raíz** (lo usan API y workers):

```bash
cp .env.example .env
```

**Archivo 2 — `apps/web/.env.local`** (lo usa Next.js, que **no** lee el `.env` de la raíz):

```bash
cat > apps/web/.env.local <<'EOF'
# Auth.js v5 — debe ser el MISMO AUTH_SECRET que el .env de la raíz
AUTH_SECRET=dev-secret-change-me-please-32-chars-minimum-ok
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# API de Tessera
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AUTH_URL=http://localhost:3000

# Blockchain — lecturas desde el navegador
NEXT_PUBLIC_POLYGON_CHAIN_ID=80002
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
NEXT_PUBLIC_CONTRACT_REGISTRY=0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb
NEXT_PUBLIC_CONTRACT_CERTIFICATE=0x9571E4553636314A9A583B8c5c784d207D51F635
NEXT_PUBLIC_CONTRACT_BADGE=0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a
EOF
```

> **`AUTH_SECRET` debe coincidir** en los dos archivos, y tener **32 caracteres o más**. Si no coinciden, el login falla sin mensaje claro. Ambos archivos están en `.gitignore`.

> El API lee, en este orden: `.env.local` y `.env` de la raíz, luego `.env.local` y `.env` de `apps/api/`. El primero que define una variable gana.

### 7.4 Levantar la infraestructura

```bash
docker compose up -d
```

Cuatro contenedores:

| Servicio | Imagen | Puertos | Acceso |
|---|---|---|---|
| PostgreSQL | `postgres:17-alpine` | 5432 | `tessera` / `tessera` / db `tessera` |
| Redis | `redis:7-alpine` | 6379 | sin contraseña |
| MailHog | `mailhog/mailhog` | 1025 SMTP · **8025 web** | http://localhost:8025 |
| MinIO | `quay.io/minio/minio` | 9000 API · **9001 consola** | `minioadmin` / `minioadmin` |

Comprobar que los cuatro están arriba:

```bash
docker compose ps
```

**Crear el bucket de MinIO** (el compose local no lo hace solo). Entre en http://localhost:9001, inicie sesión con `minioadmin`/`minioadmin` y cree un bucket llamado **`tessera-assets`**.

### 7.5 Migraciones y datos de ejemplo

```bash
pnpm db:migrate     # aplica las 26 migraciones
pnpm db:seed        # crea las 4 cuentas demo
```

El seed crea **solo cuatro usuarios y una institución**. No crea certificados ni cursos: eso se hace desde la aplicación.

| Rol | Email | Contraseña |
|---|---|---|
| Administrador de plataforma | `admin@tessera.io` | `admin123` |
| Institución | `institution@tessera.io` | `institution123` |
| Docente | `teacher@tessera.io` | `teacher123` |
| Estudiante | `student@tessera.io` | `student123` |

### 7.6 Arrancar la aplicación

Tres procesos. Lo más cómodo es una terminal para cada uno:

```bash
# Terminal 1 — API en :3001
pnpm api:dev

# Terminal 2 — Workers (procesan las colas)
pnpm workers:dev

# Terminal 3 — Frontend en :3000
pnpm --filter @tessera/web dev
```

O los tres a la vez, en una sola terminal:

```bash
pnpm dev
```

> **Los workers importan.** Sin ellos la aplicación se ve y navega perfectamente, pero los certificados se quedan en estado `queued` para siempre: nadie procesa la cola.

### 7.7 Comprobar que todo está vivo

**Abrir http://localhost:3000** y entrar con cualquiera de las cuatro cuentas.

Estado de las dependencias:

```bash
curl http://localhost:3001/v1/health
```

Devuelve el estado de 14 comprobaciones: base de datos, Redis, RPC, Arweave, Pinata, signer, fondos del signer, wallets de custodia, réplicas, OpenBao, webhook de Stripe, almacenamiento de objetos y correo.

En una instalación limpia verá varias como `not_configured` o `mock`. **Es lo esperado** y no impide usar la plataforma.

### 7.8 Empezar de cero

```bash
docker compose down -v      # borra contenedores Y volúmenes
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

---

## 8. Configuración completa

Con los valores por defecto **la plataforma arranca y funciona**. Lo que no esté configurado degrada con elegancia en vez de romper.

### 8.1 Qué pasa si no configura cada cosa

| Variable | Sin configurar | Para qué sirve |
|---|---|---|
| `SIGNER_PRIVATE_KEY` | La emisión on-chain **se simula**; todo lo demás funciona | Acuñar certificados de verdad |
| `ARWEAVE_JWK_JSON` | Storage en modo mock determinista | Metadata permanente en Arweave |
| `PINATA_JWT` | Storage en modo mock determinista | Fijar imagen y metadata en IPFS |
| `RESEND_API_KEY` | Los correos van a **MailHog** (:8025) | Envío real de correo |
| `STRIPE_SECRET_KEY` | Pagos desactivados | Suscripciones y paquetes de créditos |
| `UNLOCK_DEFAULT_LOCK_ADDRESS` | Solo es la sugerencia del panel | Cada curso guarda su propio Lock |
| `MIRROR_CHAIN_IDS` | No se replica en redes espejo | Certificados visibles en Snowtrace |
| `WEB3SIGNER_URL` / `OPENBAO_*` | Se usa `SIGNER_PRIVATE_KEY` | Custodia de claves en producción |
| `SENTRY_DSN` | Sin telemetría de errores | Observabilidad |

### 8.2 Variables principales

**API y autenticación**

```bash
API_PORT=3001
API_PUBLIC_URL=http://localhost:3001
API_CORS_ORIGINS=http://localhost:3000    # debe apuntar al frontend
AUTH_SECRET=<32 caracteres o más>          # el mismo en los dos archivos .env
AUTH_URL=http://localhost:3000
JWT_EXPIRES_IN=4h
REFRESH_TOKEN_EXPIRES_IN=30d
```

**Datos**

```bash
DATABASE_URL=postgres://tessera:tessera@localhost:5432/tessera
DATABASE_POOL_MAX=20
REDIS_URL=redis://localhost:6379
```

**Blockchain**

```bash
POLYGON_CHAIN=polygonAmoy
POLYGON_CHAIN_ID=80002                     # ← la red que EMITE
POLYGON_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
POLYGON_RPC_URL_FALLBACK=                  # RPC de respaldo, opcional

CONTRACT_REGISTRY_ADDRESS=0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb
CONTRACT_CERTIFICATE_ADDRESS=0x9571E4553636314A9A583B8c5c784d207D51F635
CONTRACT_BADGE_ADDRESS=0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a
CONTRACT_AUTO_ISSUER_ADDRESS=0x34df4378BC382A9D1EC6a2656f679C4b46Dce22d
```

**Emisión real (opcional)**

```bash
SIGNER_PRIVATE_KEY=0x...
BACKEND_SIGNER_ADDRESS=0x...
```

> La wallet de `SIGNER_PRIVATE_KEY` debe ser la **owner de TesseraRegistry**. Si no lo es, aprobar una institución falla con *"El signer de Tessera (0x…) no controla TesseraRegistry"*.
>
> Necesita fondos de testnet. Faucets: [Polygon Amoy](https://faucet.polygon.technology) · [Avalanche Fuji](https://core.app/tools/testnet-faucet) · [Sepolia](https://sepoliafaucet.com).
>
> El API **detecta y avisa** en el arranque y en `/v1/health` si usa una clave conocida de Anvil o Hardhat. Son públicas: sirven para una cadena local efímera, nunca para una red real.

**Réplicas en redes espejo (opcional)**

```bash
MIRROR_CHAIN_IDS=43113                     # vacío = no replicar
MIRROR_SIGNER_PRIVATE_KEY=0x...            # clave propia, distinta de la principal
MIRROR_RPC_URLS_FUJI=                      # RPC privados, si los públicos bloquean
```

> La réplica necesita su propia clave porque Web3Signer arranca con un único `--chain-id` y no puede firmar para otra cadena. Es una wallet de bajo valor: solo paga gas de testnet.

**Unlock Protocol (opcional)**

```bash
UNLOCK_DEFAULT_LOCK_ADDRESS=               # crear en app.unlock-protocol.com
UNLOCK_DEFAULT_CHAIN_ID=11155111           # Ethereum Sepolia
UNLOCK_RPC_URL=                            # vacío = RPC públicos
```

> Cree el Lock en [app.unlock-protocol.com](https://app.unlock-protocol.com) con la wallet conectada a **Sepolia**, opción *Deploy a custom membership*. Recomendado: precio mayor que cero y duración finita, para que la expiración se note al probar.

**Almacenamiento**

```bash
OBJECT_STORAGE_PROVIDER=minio
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=tessera-assets
```

### 8.3 Todos los comandos

```bash
# Desarrollo
pnpm dev                  # los tres procesos a la vez
pnpm api:dev              # solo el API
pnpm workers:dev          # solo los workers
pnpm --filter @tessera/web dev

# Base de datos
pnpm db:migrate           # aplicar migraciones
pnpm db:seed              # cuentas demo
pnpm db:generate          # generar migración tras cambiar el esquema
pnpm db:studio            # explorador visual de la base

# Calidad
pnpm typecheck            # TypeScript en todo el monorepo
pnpm lint                 # ESLint
pnpm test                 # Vitest
pnpm build                # build de producción
pnpm format               # Prettier
```

---

## 9. Verificación y pruebas

### 9.1 La aplicación

```bash
pnpm typecheck    # TypeScript — sin errores
pnpm lint         # ESLint
pnpm test         # Vitest — 231 casos en 24 archivos
pnpm build        # build de producción — 72 rutas
```

La suite se concentra en los servicios del API: emisión de certificados, metadata, obra gráfica, réplicas multi-cadena, procedencia, verificación de Unlock, acceso a cursos, almacenamiento, pagos y webhooks.

> **Un fallo conocido.** `certificate-mirror.test.ts` › *"no replica si MIRROR_CHAIN_IDS esta vacio"* falla por **timeout de 5 s**: ese test alcanza un RPC real y cae por red o por certificados TLS, no por el código. Los otros 230 pasan. Se aísla con `pnpm --filter @tessera/api test -- certificate-mirror`.

### 9.2 Los contratos

Desde `tessera-contracts/`. Todo corre dentro de Docker, **no hace falta instalar Foundry**:

```bash
make build           # compilar
make test            # 83 tests, fuzz a 1024 runs
make test-ci         # fuzz a 10.000 runs
make coverage        # reporte lcov
make gas             # reporte de gas
make fmt-check       # formato
```

Incluye **tests de invariantes** (`test/invariant/SoulboundInvariant.t.sol`) que comprueban de forma exhaustiva la propiedad central del sistema: **un certificado nunca puede cambiar de dueño**, hagas lo que hagas.

Despliegue y validación:

```bash
make deploy-amoy
make deploy-network NET=fuji            # o hsk, sepolia
make validate-network NET=fuji          # valida la topología desplegada
make verify-network NET=fuji            # publica el código en el explorador
make approve-institution-network NET=fuji ADDRESS=0x... NAME="Universidad X"
```

---

## 10. Solución de problemas

**El API no arranca y se queja de una variable**

`envalid` valida la configuración al inicio y corta si falta algo obligatorio. El mensaje dice exactamente cuál. Casi siempre es `AUTH_SECRET` con menos de 32 caracteres.

**El login no funciona, sin mensaje claro**

`AUTH_SECRET` no coincide entre `.env` (raíz) y `apps/web/.env.local`. Deben ser idénticos.

**Los certificados se quedan en `queued` para siempre**

Los workers no están corriendo. Levante `pnpm workers:dev`.

**`ECONNREFUSED` contra la base de datos o Redis**

Docker no está arrancado, o los contenedores no subieron. Compruebe con `docker compose ps` y levante con `docker compose up -d`.

**Conflicto en el puerto 9000**

`.env.example` trae `S3_ENDPOINT=http://localhost:9000` (MinIO) y `WEB3SIGNER_URL=http://localhost:9000` (Web3Signer) apuntando al mismo puerto. **En local MinIO ocupa el 9000.** Deje `WEB3SIGNER_URL` vacío mientras no use Web3Signer, o el API intentará firmar contra MinIO.

**"El signer de Tessera (0x…) no controla TesseraRegistry"**

La wallet de `SIGNER_PRIVATE_KEY` no es la owner del Registry. Solo esa wallet puede aprobar instituciones on-chain.

**Aviso de clave de desarrollo conocida al arrancar**

Está usando una clave pública de Anvil o Hardhat. En local es legítimo y no bloquea nada; el aviso existe para que nadie la lleve a un servidor creyendo que es propia.

**El frontend no encuentra el API**

`NEXT_PUBLIC_API_URL` debe apuntar a `http://localhost:3001`. Y ojo: las variables `NEXT_PUBLIC_*` **se hornean en el build**. Si las cambia, hay que reconstruir, no basta con reiniciar.

**No llegan los correos**

Es lo esperado sin `RESEND_API_KEY`. Los correos van a MailHog: http://localhost:8025

---

## 11. Alcance real del proyecto

**Lo que está hecho y funciona:**

- Cuatro contratos auditables desplegados en cuatro redes, con 83 tests incluyendo invariantes de no-transferibilidad.
- Emisión de certificados con metadata permanente en IPFS/Arweave, procesada por colas con reintentos.
- Verificación pública sin cuenta: por ID, por PDF o por QR.
- Réplica multi-cadena con reintento, que nunca compromete el certificado original.
- Cursos token-gated con Unlock Protocol verificado on-chain **en el servidor**.
- Cuatro paneles por rol, con permisos diferenciados.
- API pública con claves, scopes, límites de tasa y webhooks firmados con HMAC.
- Interfaz bilingüe EN/ES con 1613 claves por idioma, conmutable sin recargar.

**Lo que no, dicho sin adornos:**

- **Todo es testnet.** No hay despliegue en mainnet.
- El explorador de HashKey **no permite verificar código fuente**, así que allí el bytecode no está publicado.
- Algunas utilidades de formato —fechas, números, precios— siguen fijas en español (`es-PE`). Documentado en el código como pendiente.
- Las áreas de **institución** y **docente** conservan textos en español a la espera de traducción; el resto de la aplicación es bilingüe.
- Un test falla por red, como se explica en la sección 9.1.

---

<div align="center">

**Equipo Tessera** · [Blokis](https://blokislabs.com)

Software propietario — todos los derechos reservados. Ver [LICENSE](./LICENSE).

</div>
