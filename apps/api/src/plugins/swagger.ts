import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { env, isProd } from '../config/env.js';

type OpenApiOperation = {
  responses?: Record<string, { description?: string }>;
  security?: Array<Record<string, string[]>>;
};

type OpenApiPathMethods = Record<string, OpenApiOperation>;

type OpenApiSpec = {
  paths?: Record<string, OpenApiPathMethods>;
  components?: {
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
};

const INTERNAL_DOCS_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="252" height="44" viewBox="0 0 252 44" fill="none">
  <rect x="2" y="6" width="12" height="12" rx="3" fill="#2563EB"/>
  <rect x="18" y="6" width="12" height="12" rx="3" fill="#60A5FA"/>
  <rect x="2" y="22" width="12" height="12" rx="3" fill="#93C5FD"/>
  <rect x="18" y="22" width="12" height="12" rx="3" fill="#1D4ED8"/>
  <text x="42" y="19" fill="#0F172A" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700">Tessera</text>
  <text x="42" y="31" fill="#475569" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="600" letter-spacing="1.6">INTERNAL API DOCS</text>
</svg>`;

const INTERNAL_DOCS_THEME_CSS = `
  :root {
    color-scheme: light;
    --tessera-bg: #f4f7fb;
    --tessera-surface: #ffffff;
    --tessera-surface-2: #f8fbff;
    --tessera-border: #d8e1ec;
    --tessera-accent: #2563eb;
    --tessera-accent-soft: #eff6ff;
    --tessera-text: #0f172a;
    --tessera-text-muted: #475569;
  }

  body {
    background: var(--tessera-bg);
  }

  .swagger-ui {
    color: var(--tessera-text);
  }

  .swagger-ui .topbar {
    background: var(--tessera-surface);
    border-bottom: 1px solid var(--tessera-border);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }

  .swagger-ui .topbar .download-url-wrapper {
    display: none;
  }

  .swagger-ui .topbar a span,
  .swagger-ui .topbar svg {
    color: var(--tessera-text);
    fill: currentColor;
  }

  .swagger-ui .topbar .topbar-wrapper,
  .swagger-ui .topbar .topbar-wrapper a {
    display: flex;
    align-items: center;
  }

  .swagger-ui .topbar .topbar-wrapper a {
    min-height: 40px;
  }

  .swagger-ui .topbar .topbar-wrapper img {
    width: auto;
    height: 34px;
  }

  .swagger-ui .info,
  .swagger-ui .scheme-container,
  .swagger-ui .wrapper {
    max-width: 1180px;
  }

  .swagger-ui .info {
    margin: 28px auto 0;
    padding: 32px;
    border-radius: 18px;
    border: 1px solid var(--tessera-border);
    background: var(--tessera-surface);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
  }

  .swagger-ui .info .title,
  .swagger-ui .info h1,
  .swagger-ui .info h2,
  .swagger-ui .opblock-tag,
  .swagger-ui .dialog-ux .modal-ux-header h3 {
    color: var(--tessera-text);
  }

  .swagger-ui .info p,
  .swagger-ui .info li,
  .swagger-ui .opblock .opblock-summary-description,
  .swagger-ui .parameter__name,
  .swagger-ui .parameter__type,
  .swagger-ui .parameter__deprecated,
  .swagger-ui .response-col_description,
  .swagger-ui .response-col_links,
  .swagger-ui .responses-inner h4,
  .swagger-ui .responses-inner h5,
  .swagger-ui .tab li,
  .swagger-ui label,
  .swagger-ui .model-title,
  .swagger-ui section.models h4 {
    color: var(--tessera-text-muted);
  }

  .swagger-ui .scheme-container {
    margin: 18px auto 26px;
    padding: 14px 20px;
    border-radius: 16px;
    border: 1px solid var(--tessera-border);
    background: var(--tessera-surface-2);
    box-shadow: none;
  }

  .swagger-ui .btn,
  .swagger-ui select,
  .swagger-ui input[type=text],
  .swagger-ui textarea {
    border-radius: 12px;
  }

  .swagger-ui .btn.authorize {
    border-color: #bfdbfe;
    color: var(--tessera-accent);
    background: var(--tessera-accent-soft);
  }

  .swagger-ui .opblock {
    border-radius: 14px;
    overflow: hidden;
    border-width: 1px;
    box-shadow: none;
  }

  .swagger-ui .opblock .opblock-summary {
    padding: 14px 18px;
  }

  .swagger-ui .dialog-ux .modal-ux {
    border: 1px solid var(--tessera-border);
    border-radius: 16px;
    background: var(--tessera-surface);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
  }

  .swagger-ui .dialog-ux .modal-ux-header {
    border-bottom: 1px solid var(--tessera-border);
  }

  .swagger-ui .servers,
  .swagger-ui section.models {
    border-radius: 16px;
    overflow: hidden;
  }
`;

const API_KEY_PATHS = [
  /^\/v1\/certificates(?:\/|$)/,
  /^\/v1\/jobs(?:\/|$)/,
  /^\/v1\/wallet(?:\/|$)/,
];
const DASHBOARD_BEARER_PATHS = [
  /^\/v1\/auth\/me$/,
  /^\/v1\/api-keys(?:\/|$)/,
  /^\/v1\/webhooks(?:\/|$)/,
  /^\/v1\/institutions(?:\/|$)/,
  /^\/v1\/me\/institution$/,
  /^\/v1\/privacy(?:\/|$)/,
  /^\/v1\/account(?:\/|$)/,
];
const OPEN_PATHS = new Set([
  '/',
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/certificates/verify',
  '/v1/health',
  '/v1/ready',
]);

function matchesPath(path: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(path));
}

function resolveSecurity(path: string): Array<Record<string, string[]>> | undefined {
  if (OPEN_PATHS.has(path)) return [];
  if (matchesPath(path, DASHBOARD_BEARER_PATHS)) return [{ DashboardJwt: [] }];
  if (matchesPath(path, API_KEY_PATHS)) return [{ InstitutionApiKey: [] }];
  return undefined;
}

function enrichOperation(operation: OpenApiOperation, path: string): OpenApiOperation {
  const security = resolveSecurity(path);
  const responses = { ...(operation.responses ?? {}) };

  if (security !== undefined) {
    operation.security = security;
  }

  if (security && security.length > 0) {
    responses['401'] ??= { description: 'Credencial faltante, expirada o invalida' };
    responses['403'] ??= { description: 'Credencial valida pero sin permisos suficientes' };
  }

  responses['429'] ??= { description: 'Limite de peticiones excedido' };

  return {
    ...operation,
    responses,
  };
}

function buildInternalDocsSpec(
  swaggerObject: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const full = swaggerObject as OpenApiSpec;
  const paths: Record<string, OpenApiPathMethods> = {};

  for (const [path, methods] of Object.entries(full.paths ?? {})) {
    if (
      path === '/' ||
      path === '/v1/ready' ||
      path === '/v1/status' ||
      path.startsWith('/v1/docs')
    ) {
      continue;
    }

    const nextMethods: OpenApiPathMethods = {};
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== 'object') continue;
      nextMethods[method] = enrichOperation(operation, path);
    }

    if (Object.keys(nextMethods).length > 0) {
      paths[path] = nextMethods;
    }
  }

  return {
    ...swaggerObject,
    info: {
      title: 'Tessera — Docs Internas',
      description:
        'Referencia operativa completa para el equipo interno. Incluye endpoints administrativos, autenticacion de dashboard y superficie de integracion.',
      version: '1.0.0',
    },
    components: {
      ...(full.components ?? {}),
      securitySchemes: {
        ...(full.components?.securitySchemes ?? {}),
        InstitutionApiKey: {
          ...(full.components?.securitySchemes?.InstitutionApiKey ?? {}),
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description:
            'Clave de integracion servidor-a-servidor. Pega solo el valor completo tss_xxx..., sin prefijo Bearer.',
        },
        DashboardJwt: {
          ...(full.components?.securitySchemes?.DashboardJwt ?? {}),
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT emitido por /v1/auth/login. Solo aplica a endpoints administrativos y de dashboard.',
        },
      },
    },
    paths,
  };
}

export const swaggerSpec = fp(
  async (app) => {
    await app.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'Tessera — Docs Internas',
          description: 'Referencia completa de la API para operaciones internas e integraciones.',
          version: '1.0.0',
        },
        servers: [{ url: env.API_PUBLIC_URL }],
        components: {
          securitySchemes: {
            InstitutionApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
            DashboardJwt: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
      transform: jsonSchemaTransform,
    });
  },
  { name: 'swagger-spec' },
);

export const swaggerUiPlugin = fp(
  async (app) => {
    const internalDocsRateLimit = app.rateLimit({
      max: 180,
      timeWindow: 60_000,
      keyGenerator: (req) => `internal-docs:${req.ip}`,
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        defaultModelsExpandDepth: -1,
        persistAuthorization: false,
      },
      theme: {
        title: 'Tessera — Docs Internas',
        css: [{ filename: 'tessera-docs.css', content: INTERNAL_DOCS_THEME_CSS }],
      },
      logo: {
        type: 'image/svg+xml',
        content: INTERNAL_DOCS_LOGO_SVG,
        href: '/v1/docs',
        target: '_self',
      },
      staticCSP: true,
      transformStaticCSP: (header) =>
        `${header.replace(' validator.swagger.io', '').replace("frame-ancestors 'self'", "frame-ancestors 'none'")} connect-src 'self';`,
      transformSpecification: (swaggerObject) => buildInternalDocsSpec(swaggerObject),
      validatorUrl: false,
      uiHooks: {
        onRequest: async (_req, reply) => {
          reply.header('Cache-Control', 'no-store, max-age=0');
          reply.header('Pragma', 'no-cache');
          reply.header('Referrer-Policy', 'no-referrer');
          reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
          reply.header('Cross-Origin-Opener-Policy', 'same-origin');
          reply.header('Cross-Origin-Resource-Policy', 'same-origin');
          reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
        },
        preHandler: async (req, reply) => {
          await internalDocsRateLimit.call(app, req, reply);

          const rawUrl = req.raw.url ?? '';
          if (rawUrl.includes('/docs/static/')) {
            return;
          }

          // /v1/docs expone TODA la superficie interna: rutas administrativas,
          // de plataforma y de soporte. Es documentacion de servidor y queda
          // restringida al equipo de Tessera. Las instituciones tienen su
          // propia referencia, acotada a lo que pueden integrar, en
          // /v1/docs/institutions.
          if (isProd) {
            await app.requireAuth(['admin'])(req);
          }
        },
      },
    });
  },
  { name: 'swagger-ui', dependencies: ['swagger-spec', 'rate-limit'] },
);

export default swaggerSpec;
