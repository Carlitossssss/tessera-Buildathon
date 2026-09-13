import fp from 'fastify-plugin';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const PUBLIC_TAG = 'Public API';

const PUBLIC_TAGS_ORDER = ['Certificates', 'Verify', 'Jobs', 'Wallet', 'Health'];

const PUBLIC_DOCS_RATE_LIMIT_MAX = 120;
const PUBLIC_DOCS_RATE_LIMIT_WINDOW_MS = 60_000;

type OpenApiOperation = Record<string, unknown> & {
  tags?: string[];
  responses?: Record<string, { description?: string }>;
  security?: Array<Record<string, string[]>>;
};

type OpenApiPathMethods = Record<string, OpenApiOperation>;

type OpenApiSpec = {
  components?: Record<string, unknown> & {
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
  info?: Record<string, unknown>;
  openapi?: string;
  paths?: Record<string, OpenApiPathMethods>;
  servers?: Array<Record<string, unknown>>;
  tags?: Array<Record<string, unknown>>;
};

type BuildHtmlOptions = {
  title: string;
  specUrl: string;
  assetsBase: string;
  nonce: string;
  apiBaseUrl: string;
  rateLimits: {
    starter: number;
    pro: number;
    proExtended: number;
  };
};

const INSTITUTION_PATHS = [
  /^\/v1\/certificates$/,
  /^\/v1\/certificates\/\{id\}$/,
  /^\/v1\/certificates\/\{id\}\/revoke$/,
  /^\/v1\/certificates\/verify$/,
  /^\/v1\/jobs\/\{jobId\}$/,
  /^\/v1\/wallet\/balance$/,
  /^\/v1\/health$/,
];

function buildHtml(opts: BuildHtmlOptions): string {
  const endpointRows = [
    {
      method: 'POST',
      path: '/v1/certificates',
      auth: 'X-API-Key',
      purpose: 'Encola la emision asincrona y devuelve jobId.',
    },
    {
      method: 'GET',
      path: '/v1/certificates',
      auth: 'X-API-Key',
      purpose: 'Lista certificados emitidos con filtros opcionales.',
    },
    {
      method: 'GET',
      path: '/v1/certificates/{id}',
      auth: 'X-API-Key',
      purpose: 'Consulta detalle por id interno o tokenId on-chain.',
    },
    {
      method: 'POST',
      path: '/v1/certificates/{id}/revoke',
      auth: 'X-API-Key',
      purpose: 'Revoca un certificado previamente emitido.',
    },
    {
      method: 'POST',
      path: '/v1/certificates/verify',
      auth: 'Publico',
      purpose: 'Verifica autenticidad y estado on-chain.',
    },
    {
      method: 'GET',
      path: '/v1/jobs/{jobId}',
      auth: 'X-API-Key',
      purpose: 'Consulta el estado de una emision o revocacion asincrona.',
    },
    {
      method: 'GET',
      path: '/v1/wallet/balance',
      auth: 'X-API-Key',
      purpose: 'Devuelve el balance operativo de la wallet institucional.',
    },
    {
      method: 'GET',
      path: '/v1/health',
      auth: 'Publico',
      purpose: 'Health check con dependencias y bloque actual de la red.',
    },
  ]
    .map(
      (endpoint) => `
        <tr>
          <td><span class="endpoint-method ${endpoint.method.toLowerCase()}">${endpoint.method}</span></td>
          <td><code>${endpoint.path}</code></td>
          <td>${endpoint.auth}</td>
          <td>${endpoint.purpose}</td>
        </tr>`,
    )
    .join('');

  const rateLimitRows = [
    ['Starter', opts.rateLimits.starter],
    ['Pro', opts.rateLimits.pro],
    ['Pro Extended', opts.rateLimits.proExtended],
  ]
    .map(
      ([plan, limit]) => `
        <tr>
          <td><strong>${plan}</strong></td>
          <td>${limit} req/min</td>
          <td>La respuesta 429 incluye codigo RATE_LIMIT_EXCEEDED y retryAfter.</td>
        </tr>`,
    )
    .join('');

  const curlSample = [
    `curl --request POST '${opts.apiBaseUrl}/v1/certificates' \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --header 'X-API-Key: tss_xxxxxxxxxxxxxxxxx' \\`,
    `  --data '{`,
    `    "student": {`,
    `      "email": "student@example.edu",`,
    `      "name": "Ada Lovelace",`,
    `      "walletAddress": "0x1111111111111111111111111111111111111111"`,
    `    },`,
    `    "achievement": {`,
    `      "name": "Blockchain Fundamentals",`,
    `      "completedAt": "2026-04-21T18:00:00.000Z"`,
    `    },`,
    `    "idempotencyKey": "issue-cert-2026-04-21-001"`,
    `  }'`,
  ].join('\n');

  const endpointCount = 8;
  const publicEndpointCount = 2;
  const privateEndpointCount = endpointCount - publicEndpointCount;
  const environmentLabel = (() => {
    const hostname = new URL(opts.apiBaseUrl).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' ? 'Entorno local' : 'Entorno API';
  })();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${opts.title}</title>
<link rel="stylesheet" href="${opts.assetsBase}/swagger-ui.css" />
<style nonce="${opts.nonce}">
  html {
    scroll-behavior: smooth;
    max-width: 100%;
    overflow-x: hidden;
  }

  :root {
    color-scheme: light;
    --bg: #f4f7fb;
    --panel: #ffffff;
    --panel-soft: #f8fbff;
    --panel-muted: #f8fafc;
    --line: #d8e1ec;
    --line-strong: #c4d1df;
    --text: #0f172a;
    --muted: #475569;
    --accent: #2563eb;
    --accent-soft: #eff6ff;
    --success-bg: #ecfdf5;
    --success-text: #166534;
    --warning-bg: #fffbeb;
    --warning-text: #92400e;
    --shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
    --radius-xl: 20px;
    --radius-lg: 16px;
    --radius-md: 12px;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Segoe UI", Aptos, Arial, sans-serif;
    color: var(--text);
    background: var(--bg);
    max-width: 100%;
    overflow-x: hidden;
  }

  body.docs-drawer-open {
    overflow: hidden;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  .docs-shell {
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 24px 20px 56px;
    position: relative;
  }

  .docs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 0 20px;
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 30;
    background: rgba(244, 247, 251, 0.92);
    backdrop-filter: blur(14px);
  }

  .brand-cluster {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .brand-mark {
    display: grid;
    grid-template-columns: repeat(2, 14px);
    gap: 4px;
    padding: 5px;
    border-radius: 12px;
    border: 1px solid #dbeafe;
    background: linear-gradient(180deg, #ffffff, #eff6ff);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
    flex: 0 0 auto;
  }

  .brand-mark span {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: var(--accent);
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.18);
  }

  .brand-mark span:nth-child(2) { background: #60a5fa; }
  .brand-mark span:nth-child(3) { background: #93c5fd; }
  .brand-mark span:nth-child(4) { background: #1d4ed8; }

  .brand-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .brand-kicker {
    color: var(--accent);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .brand-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .sidebar-toggle,
  .sidebar-close,
  .action-button,
  .text-button,
  .back-to-top {
    appearance: none;
    border: 0;
    cursor: pointer;
    font: inherit;
  }

  .sidebar-toggle,
  .sidebar-close {
    display: none;
    align-items: center;
    justify-content: center;
    padding: 10px 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .header-chip,
  .header-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--muted);
    font-size: 0.92rem;
    max-width: 100%;
  }

  .header-link {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: #bfdbfe;
  }

  .sidebar-backdrop {
    display: none;
  }

  .layout {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 28px;
    margin-top: 24px;
  }

  .sidebar {
    position: sticky;
    top: 24px;
    align-self: start;
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .nav-card,
  .note-card,
  .section-card,
  .reference-card {
    min-width: 0;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line);
    background: var(--panel);
    box-shadow: var(--shadow);
  }

  .nav-card,
  .note-card {
    padding: 16px;
  }

  .nav-title,
  .note-title {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
  }

  .nav-list {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }

  .nav-list a {
    display: block;
    padding: 10px 12px;
    border-radius: 10px;
    color: var(--muted);
    transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
  }

  .nav-list a:hover {
    background: var(--accent-soft);
    color: var(--accent);
    transform: translateX(2px);
  }

  .nav-list a.is-active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  .note-card {
    margin-top: 16px;
    display: grid;
    gap: 12px;
  }

  .note-card p,
  .note-card li {
    margin: 0;
    color: var(--muted);
    line-height: 1.65;
    font-size: 0.94rem;
  }

  .check-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .check-list li {
    padding-left: 18px;
    position: relative;
  }

  .check-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.7em;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--accent);
  }

  .content {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .section-card {
    padding: 24px 26px;
  }

  .section-card[id],
  .reference-card[id] {
    scroll-margin-top: 104px;
  }

  .section-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 10px 0 12px;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1.08;
    letter-spacing: -0.04em;
  }

  .lead {
    margin: 0;
    max-width: 76ch;
    color: var(--muted);
    line-height: 1.75;
    font-size: 1.02rem;
    overflow-wrap: anywhere;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
    min-width: 230px;
  }

  .action-button,
  .text-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 14px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--muted);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  .action-button:hover,
  .text-button:hover,
  .sidebar-toggle:hover,
  .sidebar-close:hover,
  .back-to-top:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
  }

  .action-button.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #ffffff;
  }

  .action-button.secondary,
  .text-button {
    background: var(--panel-soft);
    border-color: #dbeafe;
    color: var(--accent);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 20px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .summary-card {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: linear-gradient(180deg, #ffffff, var(--panel-soft));
    min-width: 0;
  }

  .summary-label {
    display: block;
    margin-bottom: 8px;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .summary-value {
    display: block;
    color: var(--text);
    font-size: 1.22rem;
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .summary-meta {
    display: block;
    margin-top: 8px;
    color: var(--muted);
    font-size: 0.92rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .two-column-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
    gap: 16px;
    align-items: start;
  }

  .note-panel {
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel-soft);
    min-width: 0;
  }

  .note-panel h3 {
    margin: 0 0 10px;
    font-size: 1rem;
  }

  .note-panel .check-list li {
    color: var(--muted);
  }

  .meta-card {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel-soft);
    min-width: 0;
  }

  .meta-card dt {
    margin: 0 0 8px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .meta-card dd {
    margin: 0;
    color: var(--text);
    font-size: 0.98rem;
    font-weight: 600;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .section-card h2 {
    margin: 0 0 12px;
    font-size: 1.22rem;
    letter-spacing: -0.02em;
  }

  .section-card p {
    margin: 0 0 14px;
    color: var(--muted);
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .callout {
    margin: 16px 0 0;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid #dbeafe;
    background: var(--accent-soft);
    color: #1e3a8a;
    line-height: 1.65;
  }

  .callout.warning {
    border-color: #fde68a;
    background: var(--warning-bg);
    color: var(--warning-text);
  }

  .doc-list {
    margin: 0;
    padding-left: 18px;
    color: var(--muted);
  }

  .doc-list li {
    margin: 10px 0;
    line-height: 1.7;
  }

  .table-wrap {
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel);
  }

  .table-wrap tbody tr:hover {
    background: var(--panel-soft);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
    font-size: 0.95rem;
  }

  th {
    background: var(--panel-muted);
    font-weight: 700;
  }

  td {
    color: var(--muted);
  }

  td strong,
  code {
    color: var(--text);
  }

  code,
  pre {
    font-family: Consolas, "Cascadia Code", monospace;
  }

  .code-card {
    margin-top: 14px;
    padding: 18px;
    border-radius: 14px;
    background: #0f172a;
    color: #e2e8f0;
    overflow: auto;
    border: 1px solid #0b1220;
  }

  .code-toolbar {
    margin-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .code-toolbar strong {
    font-size: 0.96rem;
  }

  .code-card pre {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .reference-card {
    padding: 22px 24px;
  }

  .reference-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .reference-head h2 {
    margin: 0;
  }

  .reference-toolbar {
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 999px;
    background: var(--success-bg);
    color: var(--success-text);
    font-size: 0.92rem;
    font-weight: 600;
  }

  .status-pill::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: currentColor;
  }

  .reference-links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .reference-links a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel-muted);
    color: var(--muted);
  }

  .reference-links a.primary {
    border-color: #bfdbfe;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .swagger-ui {
    color: var(--text);
    min-width: 0;
  }

  .swagger-ui .topbar,
  .swagger-ui .info,
  .swagger-ui .servers {
    display: none;
  }

  .swagger-ui .scheme-container {
    margin: 0 0 18px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel-soft);
    box-shadow: none;
  }

  .swagger-ui .authorize-wrapper .btn.authorize {
    border-color: #bfdbfe;
    background: var(--panel);
    color: var(--accent);
  }

  .swagger-ui .authorize-wrapper .btn.authorize svg {
    fill: currentColor;
  }

  .swagger-ui .opblock-tag {
    margin: 0 0 14px;
    padding: 18px 0 12px;
    border-bottom: 1px solid var(--line);
    color: var(--text);
    font-size: 1.08rem;
  }

  .swagger-ui .opblock {
    margin: 0 0 12px;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: none;
    border-width: 1px;
  }

  .swagger-ui .opblock .opblock-summary {
    padding: 12px 14px;
  }

  .swagger-ui .opblock .opblock-summary-description,
  .swagger-ui .parameter__name,
  .swagger-ui .parameter__type,
  .swagger-ui .response-col_description,
  .swagger-ui .response-col_links,
  .swagger-ui .responses-inner h4,
  .swagger-ui .responses-inner h5,
  .swagger-ui .model-title,
  .swagger-ui label,
  .swagger-ui .tab li,
  .swagger-ui section.models h4 {
    color: var(--muted);
  }

  .swagger-ui .dialog-ux .modal-ux {
    border: 1px solid var(--line-strong);
    border-radius: 16px;
    background: var(--panel);
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.16);
  }

  .swagger-ui .dialog-ux .modal-ux-header,
  .swagger-ui .dialog-ux .modal-ux-content {
    border-color: var(--line);
  }

  .swagger-ui .models {
    border-radius: 14px;
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .endpoint-method {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .endpoint-method.get {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .endpoint-method.post {
    background: #ecfdf5;
    color: #166534;
  }

  .back-to-top {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 28;
    opacity: 0;
    pointer-events: none;
    padding: 12px 14px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.94);
    color: var(--text);
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  .back-to-top.is-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .back-to-top:hover {
    transform: translateY(-2px);
  }

  @media (max-width: 1260px) {
    .sidebar-toggle,
    .sidebar-close {
      display: inline-flex;
    }

    .layout,
    .two-column-grid {
      grid-template-columns: 1fr;
    }

    .meta-grid,
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sidebar {
      position: fixed;
      top: 16px;
      left: 16px;
      bottom: 16px;
      width: min(84vw, 340px);
      max-width: calc(100vw - 32px);
      z-index: 40;
      overflow: auto;
      transform: translateX(-110%);
      transition: transform 0.22s ease;
    }

    .docs-drawer-open .sidebar {
      transform: translateX(0);
    }

    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 35;
      background: rgba(15, 23, 42, 0.34);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease;
    }

    .docs-drawer-open .sidebar-backdrop {
      opacity: 1;
      pointer-events: auto;
    }
  }

  @media (max-width: 1120px) {
    .docs-header,
    .reference-head,
    .section-hero,
    .hero-actions,
    .reference-toolbar,
    .code-toolbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-actions {
      width: 100%;
    }

    .hero-actions {
      width: 100%;
      min-width: 0;
      justify-content: flex-start;
    }
  }

  @media (max-width: 860px) {
    .meta-grid,
    .summary-grid {
      grid-template-columns: 1fr;
    }

    .header-chip,
    .header-link,
    .action-button,
    .text-button {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 720px) {
    .docs-shell {
      padding-left: 14px;
      padding-right: 14px;
    }

    .section-card,
    .reference-card,
    .nav-card,
    .note-card {
      padding: 18px;
    }

    h1 {
      font-size: clamp(1.75rem, 8vw, 2.45rem);
    }

    th,
    td {
      padding: 10px 12px;
      font-size: 0.9rem;
    }

    .back-to-top {
      right: 14px;
      bottom: 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }

    .nav-list a,
    .action-button,
    .text-button,
    .sidebar,
    .sidebar-backdrop,
    .back-to-top {
      transition: none;
    }
  }
</style>
</head>
<body>
<div class="sidebar-backdrop" data-nav-backdrop></div>
<div class="docs-shell">
  <header class="docs-header">
    <div class="brand-cluster">
      <button type="button" class="sidebar-toggle" data-nav-toggle aria-controls="docs-sidebar" aria-expanded="false">Contenido</button>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
        <div class="brand-copy">
          <span class="brand-kicker">Tessera API</span>
          <span class="brand-title">Referencia para integraciones institucionales</span>
        </div>
      </div>
    </div>
    <div class="header-actions">
      <span class="header-chip">OpenAPI 3.1</span>
      <span class="header-chip">${environmentLabel}</span>
      <span class="header-chip">Solo server-to-server</span>
      <a class="header-link" href="${opts.specUrl}">Ver JSON del spec</a>
    </div>
  </header>

  <div class="layout">
    <aside id="docs-sidebar" class="sidebar" data-sidebar>
      <nav class="nav-card" aria-label="Navegacion de la documentacion">
        <div class="sidebar-head">
          <p class="nav-title">Contenido</p>
          <button type="button" class="sidebar-close" data-nav-close aria-label="Cerrar navegacion">Cerrar</button>
        </div>
        <ul class="nav-list">
          <li><a href="#overview" data-nav-link>Overview</a></li>
          <li><a href="#auth" data-nav-link>Autenticacion</a></li>
          <li><a href="#conventions" data-nav-link>Convenciones</a></li>
          <li><a href="#limits" data-nav-link>Rate limits y reintentos</a></li>
          <li><a href="#errors" data-nav-link>Errores</a></li>
          <li><a href="#endpoints" data-nav-link>Surface map</a></li>
          <li><a href="#reference" data-nav-link>Endpoint reference</a></li>
        </ul>
      </nav>
      <section class="note-card">
        <p class="note-title">Seguridad operativa</p>
        <ul class="check-list">
          <li>La API key debe vivir solo en backend o workers privados.</li>
          <li>Usa scopes minimos y rota claves si detectas 401 o 403 inesperados.</li>
          <li>En emision usa idempotencyKey para reintentos seguros.</li>
          <li>La documentacion no persiste credenciales y entrega CSP estricta.</li>
        </ul>
      </section>
    </aside>

    <main class="content">
      <section id="overview" class="section-card">
        <div class="section-hero">
          <div>
            <p class="eyebrow">Institution API Reference</p>
            <h1>Documentacion tecnica clara, sobria y enfocada en integracion.</h1>
            <p class="lead">
              Esta referencia sigue el patron de documentacion de APIs maduras: primero explica base URL, autenticacion, convenciones, limites y manejo de errores; despues deja la referencia interactiva de endpoints. Aqui no se mezclan rutas de dashboard, JWT administrativos ni superficies internas.
            </p>
          </div>
          <div class="hero-actions">
            <a class="action-button primary" href="#reference">Abrir referencia</a>
            <button type="button" class="action-button secondary" data-copy-target="#base-url-value" data-copy-success="Base URL copiada">Copiar base URL</button>
          </div>
        </div>
        <div class="summary-grid">
          <article class="summary-card">
            <span class="summary-label">Base URL</span>
            <strong id="base-url-value" class="summary-value">${opts.apiBaseUrl}</strong>
            <span class="summary-meta">${environmentLabel}</span>
          </article>
          <article class="summary-card">
            <span class="summary-label">Endpoints visibles</span>
            <strong class="summary-value">${endpointCount}</strong>
            <span class="summary-meta">${privateEndpointCount} privados y ${publicEndpointCount} publicos</span>
          </article>
          <article class="summary-card">
            <span class="summary-label">Autenticacion</span>
            <strong class="summary-value">X-API-Key</strong>
            <span class="summary-meta">Una sola credencial para la capa privada</span>
          </article>
          <article class="summary-card">
            <span class="summary-label">Reintentos seguros</span>
            <strong class="summary-value">IdempotencyKey</strong>
            <span class="summary-meta">Evita emisiones duplicadas en reintentos</span>
          </article>
        </div>
        <div class="meta-grid">
          <dl class="meta-card">
            <dt>Base URL</dt>
            <dd>${opts.apiBaseUrl}</dd>
          </dl>
          <dl class="meta-card">
            <dt>Auth privada</dt>
            <dd>X-API-Key</dd>
          </dl>
          <dl class="meta-card">
            <dt>Formato</dt>
            <dd>JSON; HTTPS obligatorio fuera de local</dd>
          </dl>
          <dl class="meta-card">
            <dt>Version</dt>
            <dd>v1 estable</dd>
          </dl>
        </div>
      </section>

      <section id="auth" class="section-card">
        <h2>Autenticacion</h2>
        <div class="two-column-grid">
          <div>
            <p>
              Todos los endpoints privados de esta guia usan una sola credencial: <strong>X-API-Key</strong>. La clave se genera desde el dashboard institucional y se usa unicamente en llamadas servidor-a-servidor. Los endpoints <strong>/v1/health</strong> y <strong>/v1/certificates/verify</strong> son publicos y no requieren autenticacion.
            </p>
            <div class="callout warning">
              Nunca expongas la API key en frontend, aplicaciones moviles o codigo cliente. No uses Bearer para esta documentacion: envia el valor completo <strong>tss_...</strong> en el header <strong>X-API-Key</strong>.
            </div>
          </div>
          <aside class="note-panel">
            <h3>Checklist de autenticacion</h3>
            <ul class="check-list">
              <li>Genera la clave desde el dashboard institucional.</li>
              <li>Asigna scopes minimos segun el flujo que integras.</li>
              <li>Guarda la clave en secretos del servidor, no en cliente.</li>
              <li>Rota la clave si recibes 401 persistentes o sospechas fuga.</li>
            </ul>
          </aside>
        </div>
        <div class="code-toolbar">
          <strong>Ejemplo de emision</strong>
          <button type="button" class="text-button" data-copy-target="#issue-sample" data-copy-success="Snippet copiado">Copiar ejemplo</button>
        </div>
        <div class="code-card"><pre id="issue-sample"><code>${curlSample}</code></pre></div>
      </section>

      <section id="conventions" class="section-card">
        <h2>Convenciones de request y respuesta</h2>
        <ul class="doc-list">
          <li>Los request bodies y responses usan JSON.</li>
          <li>La emision es asincrona: <strong>POST /v1/certificates</strong> responde <strong>202 Accepted</strong> y devuelve un <strong>jobId</strong>.</li>
          <li>Para reintentos seguros en emision envia <strong>idempotencyKey</strong> dentro del body.</li>
          <li>Las fechas usan ISO 8601 y las wallet addresses deben respetar el formato <strong>0x...</strong> de 40 bytes.</li>
          <li>La verificacion publica acepta tokenId o txHash y contrasta estado almacenado y estado on-chain.</li>
        </ul>
        <div class="callout">
          Esta documentacion refleja solo la superficie de integracion. Acciones de login, gestion de API keys o webhooks administrativos quedan fuera a proposito para evitar ruido y errores de implementacion.
        </div>
      </section>

      <section id="limits" class="section-card">
        <h2>Rate limits y reintentos</h2>
        <p>
          El servicio aplica rate limiting por plan con ventana de un minuto. Cuando superas el limite, la API responde 429 con un payload estructurado que incluye <strong>RATE_LIMIT_EXCEEDED</strong> y el tiempo de espera sugerido.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Limite actual</th>
                <th>Comportamiento</th>
              </tr>
            </thead>
            <tbody>${rateLimitRows}</tbody>
          </table>
        </div>
        <div class="callout">
          Reintenta solo cuando el error sea transitorio. Para emisiones, combina backoff exponencial con <strong>idempotencyKey</strong> para no duplicar certificados.
        </div>
      </section>

      <section id="errors" class="section-card">
        <h2>Errores y codigos HTTP</h2>
        <p>
          La API usa codigos HTTP convencionales y errores JSON consistentes. La referencia interactiva ya incluye 401, 403 y 429 donde aplica; aqui tienes el mapa rapido para integracion.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Uso esperado</th>
                <th>Que hacer</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>200</strong></td><td>Consulta exitosa o idempotencia ya resuelta</td><td>Consumir el payload normalmente.</td></tr>
              <tr><td><strong>202</strong></td><td>Operacion asincrona aceptada</td><td>Guardar jobId y consultar /v1/jobs/{jobId}.</td></tr>
              <tr><td><strong>400 / 422</strong></td><td>Payload invalido o incompleto</td><td>Corregir campos y no reintentar sin cambios.</td></tr>
              <tr><td><strong>401</strong></td><td>API key faltante, expirada o invalida</td><td>Revisar header X-API-Key y rotacion de credenciales.</td></tr>
              <tr><td><strong>403</strong></td><td>API key valida pero sin permisos suficientes</td><td>Revisar scopes o estado de la institucion.</td></tr>
              <tr><td><strong>404</strong></td><td>Recurso inexistente</td><td>Verificar id interno, tokenId o jobId.</td></tr>
              <tr><td><strong>409</strong></td><td>Conflicto de estado</td><td>Validar si el recurso ya fue emitido o revocado.</td></tr>
              <tr><td><strong>429</strong></td><td>Rate limit excedido</td><td>Esperar retryAfter y aplicar backoff.</td></tr>
              <tr><td><strong>503</strong></td><td>Dependencia degradada</td><td>Reintento controlado y monitoreo operativo.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="endpoints" class="section-card">
        <h2>Surface map</h2>
        <p>
          Este es el inventario completo de la API institucional visible en esta vista. Si una ruta no aparece aqui, no forma parte de la integracion publica para instituciones.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metodo</th>
                <th>Path</th>
                <th>Auth</th>
                <th>Proposito</th>
              </tr>
            </thead>
            <tbody>${endpointRows}</tbody>
          </table>
        </div>
      </section>

      <section id="reference" class="reference-card">
        <div class="reference-head">
          <div>
            <h2>Endpoint reference</h2>
            <p class="lead">Referencia interactiva basada en OpenAPI. Puedes probar GET y POST desde aqui sin perder el contexto tecnico de la guia.</p>
          </div>
          <div class="reference-links">
            <a class="primary" href="${opts.specUrl}">OpenAPI JSON</a>
            <a href="#auth">Volver a autenticacion</a>
          </div>
        </div>
        <div class="reference-toolbar">
          <span class="status-pill">Try it out habilitado para GET y POST</span>
          <button type="button" class="text-button" data-copy-target="#base-url-value" data-copy-success="Base URL copiada">Copiar base URL</button>
        </div>
        <div id="swagger-ui"></div>
      </section>
    </main>
  </div>
</div>
<button type="button" class="back-to-top" data-back-to-top aria-label="Volver arriba">Subir</button>
<script src="${opts.assetsBase}/swagger-ui-bundle.js"></script>
<script src="${opts.assetsBase}/swagger-ui-standalone-preset.js"></script>
<script nonce="${opts.nonce}">
window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: '${opts.specUrl}',
    dom_id: '#swagger-ui',
    deepLinking: true,
    docExpansion: 'list',
    displayRequestDuration: true,
    filter: true,
    defaultModelsExpandDepth: -1,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: 'BaseLayout',
    persistAuthorization: false,
    tryItOutEnabled: true,
    validatorUrl: null,
    supportedSubmitMethods: ['get', 'post'],
  });

  const body = document.body;
  const drawerClass = 'docs-drawer-open';
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navClose = document.querySelector('[data-nav-close]');
  const navBackdrop = document.querySelector('[data-nav-backdrop]');
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));
  const backToTop = document.querySelector('[data-back-to-top]');

  const setDrawerState = (open) => {
    body.classList.toggle(drawerClass, open);
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', String(open));
    }
  };

  if (navToggle) {
    navToggle.addEventListener('click', () => setDrawerState(true));
  }
  if (navClose) {
    navClose.addEventListener('click', () => setDrawerState(false));
  }
  if (navBackdrop) {
    navBackdrop.addEventListener('click', () => setDrawerState(false));
  }
  navLinks.forEach((link) => {
    link.addEventListener('click', () => setDrawerState(false));
  });

  const setActiveLink = (sectionId) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === '#' + sectionId;
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  };

  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visibleEntry && visibleEntry.target.id) {
          setActiveLink(visibleEntry.target.id);
        }
      },
      { rootMargin: '-18% 0px -62% 0px', threshold: [0.15, 0.4, 0.7] },
    );

    sections.forEach((section) => observer.observe(section));
    if (sections[0] && sections[0].id) {
      setActiveLink(sections[0].id);
    }
  }

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    const defaultLabel = button.textContent || 'Copiar';
    button.addEventListener('click', async () => {
      const selector = button.getAttribute('data-copy-target');
      const target = selector ? document.querySelector(selector) : null;
      const text = target && target.textContent ? target.textContent.trim() : '';

      if (!text) {
        return;
      }

      try {
        await copyText(text);
        button.textContent = button.getAttribute('data-copy-success') || 'Copiado';
        button.disabled = true;
      } catch {
        button.textContent = 'No copiado';
      }

      setTimeout(() => {
        button.textContent = defaultLabel;
        button.disabled = false;
      }, 1600);
    });
  });

  const syncBackToTop = () => {
    if (backToTop) {
      backToTop.classList.toggle('is-visible', window.scrollY > 560);
    }
  };

  syncBackToTop();
  window.addEventListener('scroll', syncBackToTop, { passive: true });

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
};
</script>
</body>
</html>`;
}

function matchesInstitutionPath(path: string): boolean {
  return INSTITUTION_PATHS.some((pattern) => pattern.test(path));
}

function enrichOperation(operation: OpenApiOperation, path: string): OpenApiOperation {
  const isPublic = path === '/v1/certificates/verify' || path === '/v1/health';
  const responses = { ...(operation.responses ?? {}) };

  responses['429'] ??= { description: 'Limite de peticiones excedido' };

  if (!isPublic) {
    responses['401'] ??= { description: 'API Key faltante, expirada o invalida' };
    responses['403'] ??= { description: 'API Key valida pero sin scopes o permisos suficientes' };
  }

  return {
    ...operation,
    security: isPublic ? [] : [{ InstitutionApiKey: [] }],
    responses,
  };
}

function buildInstitutionSpec(full: OpenApiSpec): OpenApiSpec {
  const paths: Record<string, OpenApiPathMethods> = {};

  for (const [path, methods] of Object.entries(full.paths ?? {})) {
    if (!matchesInstitutionPath(path)) continue;

    const filteredMethods: OpenApiPathMethods = {};
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== 'object') continue;
      const tags = Array.isArray(op.tags) ? op.tags : [];
      if (!tags.includes(PUBLIC_TAG)) continue;

      const cleanedTags = tags.filter((tag) => tag !== PUBLIC_TAG);
      filteredMethods[method] = enrichOperation(
        {
          ...op,
          tags: cleanedTags.length > 0 ? cleanedTags : ['General'],
        },
        path,
      );
    }

    if (Object.keys(filteredMethods).length > 0) {
      paths[path] = filteredMethods;
    }
  }

  return {
    ...full,
    info: {
      title: 'Tessera — API para Instituciones',
      version: '1.0.0',
      description:
        'Superficie publica de integracion para instituciones. Incluye emision, seguimiento, verificacion y estado del servicio. Las acciones administrativas de dashboard quedaron fuera de esta vista.',
    },
    tags: [
      {
        name: 'Certificates',
        description: 'Emision asincrona, listado, detalle y revocacion de certificados SBT.',
      },
      { name: 'Verify', description: 'Verificacion publica de autenticidad on-chain.' },
      { name: 'Jobs', description: 'Seguimiento del procesamiento asincrono por jobId.' },
      { name: 'Wallet', description: 'Balance operativo de la wallet institucional configurada.' },
      { name: 'Health', description: 'Estado del servicio y de sus dependencias principales.' },
    ].filter((tag) => PUBLIC_TAGS_ORDER.includes(String(tag.name))),
    components: {
      ...(full.components ?? {}),
      securitySchemes: {
        InstitutionApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description:
            'Clave de integracion institucional. Pega el valor completo tss_xxx..., sin prefijo Bearer.',
        },
      },
    },
    paths,
  };
}

function setDocsHeaders(reply: { header: (name: string, value: string) => unknown }): void {
  reply.header('Cache-Control', 'no-store, max-age=0');
  reply.header('Pragma', 'no-cache');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header('Cross-Origin-Resource-Policy', 'same-origin');
  reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

export default fp(
  async (app) => {
    const publicDocsRateLimit = app.rateLimit({
      max: PUBLIC_DOCS_RATE_LIMIT_MAX,
      timeWindow: PUBLIC_DOCS_RATE_LIMIT_WINDOW_MS,
      keyGenerator: (req) => `public-docs:${req.ip}`,
    });

    // Esta referencia se abre desde el dashboard, que adjunta el JWT. Una
    // navegacion directa del navegador no manda cabecera Authorization, y la
    // cookie de Auth.js viaja cifrada (JWE), asi que el backend no puede
    // validarla: en ese caso mandamos al usuario a la guia del dashboard en
    // vez de dejarlo con un 401 sin explicacion.
    const institutionDocsAccess = async (
      req: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => {
      if (!env.INSTITUTION_DOCS_REQUIRE_AUTH) return;
      try {
        await app.requireAuth(['admin', 'institution_admin'])(req);
      } catch (err) {
        const wantsHtml = (req.headers.accept ?? '').includes('text/html');
        if (wantsHtml) {
          return reply.redirect(`${env.AUTH_URL.replace(/\/$/, '')}/institution/developers`, 302);
        }
        throw err;
      }
    };

    app.get(
      '/v1/docs/institutions/json',
      { logLevel: 'warn', preHandler: [publicDocsRateLimit, institutionDocsAccess] },
      async (_req, reply) => {
        setDocsHeaders(reply);
        return reply.send(buildInstitutionSpec(app.swagger() as OpenApiSpec));
      },
    );

    app.get(
      '/v1/docs/institutions',
      { logLevel: 'warn', preHandler: [publicDocsRateLimit, institutionDocsAccess] },
      async (_req, reply) => {
        const nonce = randomBytes(16).toString('base64');
        setDocsHeaders(reply);
        reply.header(
          'Content-Security-Policy',
          [
            "default-src 'self'",
            "base-uri 'self'",
            "connect-src 'self'",
            "font-src 'self' data:",
            "img-src 'self' data:",
            "object-src 'none'",
            `script-src 'self' 'nonce-${nonce}'`,
            "script-src-attr 'none'",
            `style-src 'self' 'nonce-${nonce}'`,
            "frame-ancestors 'none'",
            "form-action 'self'",
          ].join('; '),
        );
        reply.type('text/html').send(
          buildHtml({
            title: 'Tessera — Docs Instituciones',
            specUrl: '/v1/docs/institutions/json',
            assetsBase: '/v1/docs/static',
            nonce,
            apiBaseUrl: env.API_PUBLIC_URL,
            rateLimits: {
              starter: env.RATE_LIMIT_STARTER,
              pro: env.RATE_LIMIT_PRO,
              proExtended: env.RATE_LIMIT_PRO_EXTENDED,
            },
          }),
        );
      },
    );
  },
  { name: 'institution-docs', dependencies: ['auth', 'swagger-spec', 'rate-limit'] },
);
