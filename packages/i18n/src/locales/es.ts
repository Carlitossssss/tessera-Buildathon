import type { Dictionary } from './en';

/**
 * Español.
 *
 * Está tipado como `Dictionary`, así que si el inglés gana una clave y aquí
 * falta, el typecheck falla. Es deliberado: una traducción incompleta que
 * compila termina mostrando una etiqueta en blanco a un usuario real.
 *
 * Lo que NO se traduce: los nombres propios de producto y de protocolo
 * —Tessera, Badges, Wallet, Analytics, Templates, API Keys, Webhooks,
 * Changelog, Polygon, Arweave, IPFS, LinkedIn— se dejan igual en ambos
 * idiomas. Son nombres, no palabras: quien busca «Webhooks» en la
 * documentación no encontraría «Ganchos web».
 */
export const es: Dictionary = {
  language: {
    label: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
    changed: 'Idioma cambiado a español',
  },

  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    back: 'Volver',
    next: 'Siguiente',
    loading: 'Cargando…',
    search: 'Buscar',
    confirm: 'Confirmar',
    copy: 'Copiar',
    copied: 'Copiado',
    open: 'Abrir',
    retry: 'Reintentar',
    optional: 'opcional',
    required: 'obligatorio',
    notFound: 'La página solicitada no existe.',
  },

  nav: {
    sections: {
      workspace: 'Workspace',
      economy: 'Economía',
      integration: 'Integración',
      configuration: 'Configuración',
      myAccount: 'Mi cuenta',
      learning: 'Aprendizaje',
      myCredentials: 'Mis credenciales',
      platform: 'Plataforma',
      system: 'Sistema',
    },

    institution: {
      home: 'Inicio',
      certificates: 'Certificados',
      courses: 'Cursos',
      students: 'Estudiantes',
      badges: 'Badges',
      credits: 'Créditos',
      wallet: 'Wallet',
      analytics: 'Analytics',
      revenue: 'Ingresos',
      templates: 'Templates',
      apiKeys: 'API Keys',
      webhooks: 'Webhooks',
      documentation: 'Documentación',
      profile: 'Perfil',
      team: 'Equipo',
      plan: 'Plan y facturación',
    },

    teacher: {
      panel: 'Panel',
      myCourses: 'Mis cursos',
      students: 'Estudiantes',
      grading: 'Calificaciones',
      gradingBadge: 'Pendientes',
      myProfile: 'Mi perfil',
    },

    student: {
      home: 'Inicio',
      myCourses: 'Mis cursos',
      availableCourses: 'Cursos disponibles',
      credentials: 'Credenciales',
      badges: 'Badges',
      wallet: 'Wallet',
      profile: 'Perfil',
      privacy: 'Privacidad',
    },

    admin: {
      home: 'Inicio',
      institutions: 'Instituciones',
      certificates: 'Certificados',
      users: 'Usuarios',
      suspensionRequests: 'Revisión de suspensión',
      plans: 'Planes',
      alerts: 'Alertas',
      health: 'Health API',
    },
  },

  shell: {
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    home: 'Inicio de Tessera',
    profile: 'Perfil',
    privacy: 'Privacidad',
    signOut: 'Cerrar sesión',
    help: {
      title: '¿Necesitas ayuda?',
      body: 'Soporte prioritario según tu plan.',
    },
    blocked: {
      pending:
        'Tu institución está pendiente de aprobación. Cursos, certificados y badges estarán disponibles cuando un admin la apruebe.',
      rejected:
        'Tu solicitud institucional fue rechazada. Revisá el perfil para ver el comentario y corregir la información.',
      profileRequired:
        'Completa la validación institucional en tu perfil para enviar la universidad a revisión.',
      suspended:
        'Esta institución ha sido suspendida. Cursos, estudiantes y calificaciones no están disponibles temporalmente.',
      teacherProfile: 'Completa tu perfil docente para habilitar estas opciones.',
      studentProfile: 'Completa tu perfil para enviar tus datos a revisión.',
      studentRejected: 'Tu perfil necesita correcciones antes de habilitar inicio y cursos.',
      studentPending:
        'Tu perfil está en revisión. Inicio y cursos se habilitarán cuando el admin lo apruebe.',
    },
    suspendedNotice: {
      title: 'Esta institución ha sido suspendida.',
      body: 'Las acciones de cursos, estudiantes y calificaciones estarán bloqueadas hasta que Tessera reactive la institución.',
    },
  },

  auth: {
    layout: {
      secureAccess: 'Acceso seguro',
      footer: 'Credenciales verificables on-chain',
    },

    roles: {
      ariaLabel: 'Tipo de cuenta',
      institution: 'Institución',
      student: 'Estudiante',
      teacherChip: 'Acceso docente',
    },

    fields: {
      email: 'Email',
      institutionalEmail: 'Email institucional',
      password: 'Contraseña',
      fullName: 'Tu nombre',
      institution: 'Institución',
      forgot: '¿Olvidaste?',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      passwordHint: 'Una mayúscula, un número, mínimo 8 caracteres.',
      passwordPlaceholder: 'Mínimo 8 caracteres',
    },

    validation: {
      invalidEmail: 'Email inválido',
      minChars: 'Mínimo 8 caracteres',
      minTwoChars: 'Mínimo 2 caracteres',
      needsUppercase: 'Debe incluir una mayúscula',
      needsNumber: 'Debe incluir un número',
      acceptTerms: 'Debes aceptar los términos',
      institutionalEmailRequired: 'Usa un email institucional para crear un workspace',
    },

    login: {
      submit: 'Iniciar sesión',
      validating: 'Validando…',
      acceptingInvite: 'Aceptando invitación…',
      noAccount: '¿No tienes cuenta?',
      createStudent: 'Crear cuenta de estudiante',
      createInstitution: 'Crear workspace institucional',
      titles: {
        institution: {
          eyebrow: 'Workspace institucional',
          title: 'Bienvenido de vuelta',
          sub: 'Accede a la consola de emisión, auditoría y verificación de tu institución.',
        },
        student: {
          eyebrow: 'Tu portafolio verificable',
          title: 'Hola de nuevo',
          sub: 'Entra para revisar y compartir tus credenciales on-chain.',
        },
        teacher: {
          eyebrow: 'Acceso docente',
          title: 'Inicia sesión como docente',
          sub: 'Tu institución te invitó para validar entregas y solicitar emisiones.',
        },
      },
      teacherWall: {
        badge: 'Acceso docente',
        title: 'Tu institución debe haberte registrado antes para que puedas entrar como docente.',
        body: 'Usa el correo con el que te invitaron y la contraseña que te compartió el administrador. Si todavía no puedes entrar, pide que verifiquen tu acceso desde Equipo o que restablezcan tu contraseña.',
      },
      toasts: {
        invalidCredentials: 'Credenciales inválidas. Verifica tu email y contraseña.',
        noApi: 'No pudimos conectar con el API. Revisa que el servidor esté levantado.',
        noSession: 'No pudimos crear la sesión local. Intenta nuevamente.',
        inviteAccepted: 'Invitación aceptada',
        inviteFailed: 'No pudimos aceptar la invitación',
        signedIn: 'Sesión iniciada',
      },
      placeholders: {
        student: 'tu@correo.com',
        teacher: 'docente@institucion.edu',
        institution: 'tu@institucion.edu',
      },
    },

    register: {
      titles: {
        institution: {
          eyebrow: 'Provisioning institucional',
          title: 'Activa tu workspace',
          sub: 'Configura tu organización, invita a tu equipo y emite credenciales en minutos.',
        },
        student: {
          eyebrow: 'Tu portafolio verificable',
          title: 'Crea tu cuenta',
          sub: 'Reúne tus credenciales en un perfil compartible y verificable on-chain.',
        },
        teacher: {
          eyebrow: 'Acceso docente',
          title: 'Invitación requerida',
          sub: 'Los docentes se dan de alta desde el workspace de su institución.',
        },
      },
      haveAccount: '¿Ya tienes cuenta?',
      signIn: 'Iniciar sesión',
      createWorkspace: 'Crear workspace gratis',
      startPlan: 'Empezar plan {plan}',
      creatingWorkspace: 'Creando workspace…',
      createStudent: 'Crear cuenta de estudiante',
      creatingPortfolio: 'Creando tu portafolio…',
      createTeacher: 'Crear cuenta docente',
      creatingAccount: 'Creando cuenta…',
      accept: {
        prefix: 'Acepto los',
        terms: 'Términos',
        and: 'y la',
        privacy: 'Política de Privacidad',
      },
      strength: {
        weak: 'Débil',
        fair: 'Mejorable',
        good: 'Buena',
        strong: 'Fuerte',
        excellent: 'Excelente',
      },
      verify: {
        title: 'Revisa tu correo',
        body: 'Enviamos un código de 6 dígitos a',
        bodyEnd: '. La cuenta se creará recién cuando lo verifiques.',
        codeLabel: 'Código de verificación',
        submit: 'Verificar y crear cuenta',
        verifying: 'Verificando…',
        edit: 'Editar datos',
      },
      teacherWall: {
        badge: 'Sin auto-registro',
        title: 'Los docentes no se registran de forma libre. Reciben una invitación de su institución.',
        body: 'Si eres una institución y necesitas dar de alta a tus docentes, crea tu workspace y úsanos desde el panel',
        panel: 'Equipo · Docentes',
        cta: 'Crear workspace institucional →',
      },
      invite: {
        validating: 'Validando invitación…',
        needLink: 'Necesitas un enlace de invitación para crear una cuenta docente.',
        wrongRole: 'Este email ya pertenece a una cuenta con otro rol.',
        loadFailed: 'No pudimos cargar la invitación',
        existingPrefix: 'Ya existe una cuenta para',
        existingSuffix: '. Inicia sesión para aceptar la invitación.',
        invitedCourse: 'Curso invitado:',
        signInAndAccept: 'Iniciar sesión y aceptar',
        invitationFor: 'Invitación para',
        institution: 'Institución:',
        course: 'Curso:',
      },
      toasts: {
        codeSent: 'Te enviamos un código para verificar tu email.',
        createFailed: 'No pudimos crear tu cuenta',
        verifyFailed: 'No pudimos verificar el código',
        verifiedSignIn: 'Email verificado. Inicia sesión para continuar.',
        workspaceCreated: 'Workspace creado. Puedes completar tu configuración mientras espera aprobación.',
        portfolioReady: '¡Listo! Tu portafolio te espera.',
        teacherCreated: 'Cuenta docente creada. Inicia sesión para continuar.',
        teacherCreatedProfile: 'Cuenta docente creada. Completa tu perfil para continuar.',
        teacherFailed: 'No pudimos crear tu cuenta docente',
      },
    },

    aside: {
      institution: {
        title: 'Operación con grado profesional.',
        description:
          'Emisión, revocación, auditoría y verificación pública en un workspace pensado para academia, producto y compliance.',
        bullets: {
          sla: 'SLA 99.9% · auditoría completa',
          roles: 'Roles, SSO y API keys',
          wallets: 'Wallets custodiadas · sin gestionar claves',
        },
      },
      student: {
        title: 'Tus credenciales, tuyas para siempre.',
        description:
          'Recibe certificados que se verifican en segundos y compártelos en LinkedIn, GitHub o tu portfolio.',
        bullets: {
          onchain: 'Verificable on-chain',
          linkedin: 'Listos para LinkedIn',
          yours: 'Permanecen contigo',
        },
        mockRecipient: 'Tú',
        mockCourse: 'Tu próximo logro',
      },
      teacher: {
        title: 'Solicita emisiones con respaldo institucional.',
        description:
          'Tu institución te invitó para validar entregas y solicitar emisiones de certificados dentro de los cursos asignados.',
        bullets: {
          linked: 'Vinculado a tu institución',
          doubleSign: 'Aprobaciones con doble firma',
          cohort: 'Trazabilidad por cohorte',
        },
      },
    },
  },

  marketing: {
    hero: {
      eyebrow: 'Infraestructura para credenciales verificables',
      title: 'Emite y verifica credenciales on-chain con estándar institucional.',
      body: 'Tessera convierte certificados, badges y constancias en credenciales auditables, compartibles y listas para compliance. API, custodia, emisión y verificación pública en una sola capa operativa.',
      signals: {
        custody: 'Custodia opcional y wallets por estudiante',
        api: 'API, webhooks firmados y trazabilidad completa',
        storage: 'Arweave + IPFS con verificación pública inmediata',
      },
      ctaPrimary: 'Crear cuenta institucional',
      ctaSecondary: 'Ver planes y SLA',
      stats: {
        issued: 'Certificados emitidos',
        uptime: 'Uptime API',
        emission: 'Tiempo emisión',
      },
      compliance: 'ERC-5192 · Auditoría OpenZeppelin · Cumple GDPR',
      panel: {
        webhookEvents: 'Webhook events',
        activeNetwork: 'Red activa',
        status: 'Estado',
        operational: 'Operativo',
        audit: 'Auditoría',
        auditValue: 'Trail activo · 24/7',
        verification: 'Verificación',
        verificationValue: 'QR público · listo',
      },
    },

    studentHero: {
      titleStart: 'Un diploma que',
      titleAccent: 'nadie puede falsificar',
      body: 'Tus certificados dejan de ser un PDF que cualquiera edita. Se convierten en credenciales firmadas on-chain que un empleador comprueba en segundos, sin llamarte ni escribirnos.',
      signals: {
        verifiable: 'Verificable por cualquiera, en segundos',
        linkedin: 'Con preview profesional para LinkedIn',
        forever: 'Tuyo para siempre, aunque Tessera no exista',
      },
      ctaPrimary: 'Crear mi portafolio gratis',
      ctaSecondary: 'Soy una institución',
      free: 'Gratis para estudiantes · no necesitás wallet ni saber de blockchain',
      proof: {
        verification: {
          title: 'Verificación pública',
          body: 'Cualquier persona puede comprobar una credencial, en segundos.',
        },
        onchain: {
          title: 'Credenciales on-chain',
          body: 'Registradas en múltiples blockchains para mayor seguridad y transparencia.',
        },
        fast: {
          title: 'Emisión rápida',
          body: 'Convierte tus logros en credenciales en menos de 10 segundos.',
        },
      },
      tagline: 'Logros reales. Oportunidades sin límites.',
      poweredBy: 'Impulsado por',
    },

    problem: {
      eyebrow: 'El problema',
      title: 'El título que tanto te costó cabe en un archivo que cualquiera falsifica.',
      body: 'Un PDF no prueba nada por sí solo. Tessera cambia el soporte, no el esfuerzo que hay detrás.',
      old: {
        title: 'El certificado PDF',
        subtitle: 'como hasta hoy',
        items: {
          edited: 'Un PDF se edita en dos minutos con cualquier editor',
          phone: 'Verificar significa llamar por teléfono a la institución',
          lost: 'Si perdés el archivo, perdiste el logro',
          proof: 'Nada demuestra que el título es realmente tuyo',
        },
      },
      new: {
        title: 'La credencial SBT',
        subtitle: 'con Tessera',
        items: {
          signed: 'Firmado on-chain: alterarlo es imposible',
          selfCheck: 'Cualquiera lo comprueba solo, en segundos',
          lives: 'Vive en la blockchain, no en tu disco duro',
          soulbound: 'Soulbound: ligado a vos, intransferible',
        },
      },
    },

    journey: {
      eyebrow: 'Cómo funciona',
      title: 'De tu diploma a la blockchain, sin que tengas que entender la blockchain.',
      step: 'Paso',
      steps: {
        finish: {
          title: 'Terminás tu curso',
          body: 'Tu institución emite la credencial desde Tessera. No tenés que hacer absolutamente nada.',
        },
        receive: {
          title: 'Recibís tu credencial',
          body: 'Te llega por email con una wallet ya creada para vos. Sin frases semilla, sin comisiones, sin criptomonedas.',
        },
        share: {
          title: 'La compartís donde quieras',
          body: 'Un enlace con preview profesional para LinkedIn, tu CV o tu portfolio. Se ve bien en todos lados.',
        },
        verify: {
          title: 'Cualquiera la verifica',
          body: 'El empleador abre el enlace y comprueba la autenticidad al instante, directo contra la blockchain.',
        },
      },
    },

    trust: {
      eyebrow: 'Bajo el capó',
      title: 'No te pedimos que confíes en nosotros.',
      body: 'Todo se apoya en estándares públicos y auditables. Si Tessera desapareciera mañana, tus credenciales seguirían siendo verificables.',
      pillars: {
        soulbound: 'Soulbound. La credencial queda ligada a su dueño: no se vende, no se transfiere, no se presta.',
        standards: 'Estándares abiertos que cualquier wallet, explorador o indexador del ecosistema entiende.',
        polygon: 'Red pública y de bajo costo. Verificar no depende de nuestros servidores ni de nuestro permiso.',
        hash: 'El identificador del archivo se deriva de su contenido. Un solo byte alterado cambia el CID.',
        storage: 'La metadata y el diseño del certificado quedan replicados y accesibles de forma permanente.',
        signature: 'Cada emisión va firmada con nonce por institución. Nadie puede reutilizar ni duplicar una firma.',
      },
    },

    features: {
      eyebrow: 'Plataforma',
      title: 'La infraestructura completa para emitir credenciales con superpoderes.',
      body: 'Diseñada para que tu equipo de producto, ingeniería y compliance trabajen sin fricción.',
      cells: {
        soulbound: {
          eyebrow: 'Soulbound · ERC-5192',
          title: 'Credenciales que no se transfieren ni se falsifican.',
          description: 'Cada certificado se mintea en Polygon mediante nuestro estándar revisado por OpenZeppelin. Ni el dueño puede revenderlo, ni un hacker puede clonarlo.',
        },
        storage: {
          eyebrow: 'Almacenamiento permanente',
          title: 'Arweave + IPFS, doble redundancia.',
          description: 'Los metadatos viven para siempre en Arweave y se sincronizan a IPFS. Cero coste recurrente, máxima durabilidad.',
          permanent: 'permanente',
          replicated: 'replicado',
        },
        webhooks: {
          eyebrow: 'Webhooks · HMAC SHA-256',
          title: 'Integra tu LMS en minutos.',
          description: 'Eventos firmados, reintentos exponenciales, idempotencia por header.',
        },
        gdpr: {
          eyebrow: 'GDPR · Off-chain PII',
          title: 'Cumple sin sacrificar verificabilidad.',
          description: 'Solo el hash se publica on-chain. Borrado y consentimiento automatizados.',
        },
        api: {
          eyebrow: 'API · 99.9% uptime',
          title: 'Latencia < 60s end-to-end.',
          description: 'Cola asíncrona, BullMQ y observabilidad con OpenTelemetry.',
        },
        verification: {
          eyebrow: 'Verificación pública',
          title: 'Comparte un enlace, conviertes verificación en marketing.',
          description: 'Open Graph dinámico, QR firmado y badge embebible.',
        },
      },
    },

    howItWorks: {
      eyebrow: 'Flujo',
      title: 'De la plantilla al QR público en cuatro pasos.',
      body: 'Cero conocimientos de Web3 requeridos. La complejidad cripto está abstraída por completo.',
      step: 'Paso',
      steps: {
        template: {
          title: 'Sube tu plantilla',
          description: 'Importa diseño, define metadatos y conecta tu institución. Nuestro editor genera el JSON ERC-721 listo para producción.',
        },
        launch: {
          title: 'Lanza una emisión',
          description: 'Sube un CSV o llama al endpoint /v1/certificates/issue. Procesamos en lote, gestionamos gas y reintentos por ti.',
        },
        mint: {
          title: 'Minteamos on-chain',
          description: 'Tessera mintea en Polygon como SBT (ERC-5192) y publica metadatos en Arweave + IPFS con doble pinning.',
        },
        verify: {
          title: 'Verificación pública',
          description: 'Tu alumno recibe enlace + QR firmado. Cualquier reclutador verifica autenticidad sin crear cuentas.',
        },
      },
    },

    studentFeatures: {
      eyebrow: 'Tu portafolio profesional',
      title: 'Mucho más que un PDF',
      body: 'Tus certificados pasan a ser activos verificables, compartibles y permanentes. Pensados para que el mundo confíe en tus logros sin pedir explicaciones.',
      items: {
        verifiable: {
          title: 'Credenciales verificables',
          desc: 'Cada certificado se firma on-chain. Cualquier persona puede comprobar su autenticidad sin depender de Tessera.',
        },
        linkedin: {
          title: 'Lista para LinkedIn',
          desc: 'Comparte tu logro con preview profesional. Genera más visibilidad y oportunidades reales.',
        },
        unforgeable: {
          title: 'Imposible falsificar',
          desc: 'Estándar ERC-5192 (soulbound). Nadie puede transferir, duplicar ni manipular tu credencial.',
        },
        noWallet: {
          title: 'Sin necesidad de wallet',
          desc: 'Tessera custodia tus credenciales por ti. Cuando quieras, puedes vincular tu propia wallet.',
        },
        forever: {
          title: 'Permanece para siempre',
          desc: 'Archivado en Arweave + IPFS. Aunque cambie la plataforma, tu credencial sigue siendo verificable.',
        },
        publicPage: {
          title: 'Página pública por logro',
          desc: 'Cada certificado tiene su propia URL con QR de verificación, listo para tu CV o portfolio.',
        },
      },
      institutionQuestion: '¿Eres una institución? Mira',
      institutionLink: 'Tessera para instituciones →',
    },

    ecosystem: {
      title: 'Construido sobre las mejores piezas del ecosistema',
    },

    /**
     * Demo de verificacion en vivo de la landing. No toca la red: reproduce
     * la secuencia exacta que ejecuta /verify, asi que las etiquetas de campo
     * son interfaz (se traducen) mientras los valores de ejemplo son datos
     * de muestra y se dejan tal como estan.
     */
    verifyDemo: {
      steps: {
        readToken: { label: 'Leyendo el token on-chain', detail: 'ownerOf(1) · TesseraCertificate' },
        resolveMetadata: { label: 'Resolviendo la metadata', detail: 'tokenURI → JSON público' },
        compareHash: { label: 'Comparando huella criptográfica', detail: 'sha256 del certificado vs. CID' },
        checkLock: { label: 'Comprobando el candado soulbound', detail: 'ERC-5192 · locked = true' },
      },
      fields: {
        student: 'Estudiante',
        program: 'Programa',
        institution: 'Institución',
        issued: 'Emitido',
        network: 'Red',
        standard: 'Estándar',
      },
      idle: {
        title: 'Verificá un certificado real',
        body: 'Ingresá el enlace o escaneá el código QR de cualquier credencial emitida en Tessera.',
        cta: 'Ejecutar verificación',
        note: 'Sin cuenta. Sin permisos. Solo la verdad.',
      },
      result: {
        authentic: 'Credencial auténtica',
        valid: 'válida',
        repeat: 'Repetir',
      },
    },

    testimonials: {
      eyebrow: 'Lo que dicen',
      title: 'Equipos académicos y de producto que ya emiten en Tessera.',
    },

    pricing: {
      eyebrow: 'Planes',
      title: 'Precios honestos. Sin sorpresas en gas.',
      body: 'Tú pagas la suscripción, nosotros absorbemos el gas en Polygon. Cada certificado consume exactamente {tsc} TSC.',
      recommended: 'Recomendado',
      discount: 'Descuento -',
      perMonth: '/mes',
      custom: 'A medida',
      packages: {
        eyebrow: 'Paquetes TSC',
        title: 'Compra monedas sin suscripción',
        body: 'Para campañas puntuales o instituciones que prefieren recargar saldo cuando lo necesitan. Los TSC comprados se acreditan a la wallet institucional y cada certificado consume {tsc} TSC.',
        toIssue: 'TSC para emitir cuando los necesites.',
        estimated: 'certificados estimados',
        validity: 'Vigencia: {months} meses',
        noRenewal: 'Sin renovación automática',
      },
      pageTitle: 'Un precio por institución, no por estudiante.',
      pageBody: 'Precios honestos, sin sorpresas en gas. Elige entre {plans} según tu volumen. Cada certificado consume exactamente {tsc} TSC y cada plan informa su compromiso mínimo vigente.',
      defaultPlans: 'Essential, Growth, Institutional y Scale',
    },

    cta: {
      eyebrow: 'Empieza hoy',
      title: 'La próxima generación de credenciales se emite en Tessera.',
      body: 'Crea tu cuenta gratis, emite tu primer certificado SBT en menos de 5 minutos y deja atrás los PDFs falsificables.',
      primary: 'Crear cuenta gratis',
      secondary: 'Hablar con ventas',
    },

    studentCta: {
      eyebrow: 'Tu portafolio te espera',
      title: 'Empieza con tu primer logro verificable. Es gratis para siempre.',
      body: 'Crea tu cuenta, conecta los certificados que ya tienes y empieza a compartirlos con preview profesional en LinkedIn.',
      primary: 'Crear mi portafolio gratis',
      secondary: 'Ya tengo cuenta',
      noCard: 'Sin tarjeta · sin wallet · sin letra pequeña',
    },

    faq: {
      title: 'Objeciones resueltas antes de tu primera emisión.',
      body: 'Esta parte también importa: blockchain, compliance y pagos suelen sonar complejos. Aquí lo dejamos claro, directo y verificable para un comprador serio.',
      card: {
        title: 'Diseñado para ventas institucionales',
        body: 'Compliance, custodia, gas y continuidad operativa',
      },
      items: {
        wallet: {
          q: '¿Mis estudiantes necesitan tener una wallet?',
          a: 'No. Tessera crea wallets custodiadas por defecto. Si el estudiante quiere autonomía completa, puede vincular su propia wallet (MetaMask, Coinbase, etc.).',
        },
        shutdown: {
          q: '¿Qué pasa si Tessera deja de operar?',
          a: 'Los certificados siguen siendo válidos para siempre. La metadata vive en Arweave (almacenamiento permanente), el smart contract en Polygon es público y cualquier persona puede verificar on-chain sin nuestra intervención.',
        },
        gdpr: {
          q: '¿Cómo cumplen con GDPR si los datos están en blockchain?',
          a: 'On-chain solo se almacena el hash del certificado y el wallet del receptor. La PII (nombre, email, foto) vive off-chain en nuestra DB cifrada. Soportamos export y deletion endpoints obligatorios desde el día uno.',
        },
        lms: {
          q: '¿Puedo usarlo desde mi LMS actual (Moodle, Canvas, etc.)?',
          a: 'Sí. Nuestra API pública v1 permite emitir y verificar certificados desde cualquier sistema. Webhooks firmados HMAC notifican eventos en tiempo real.',
        },
        gas: {
          q: '¿Quién paga el gas de Polygon?',
          a: 'Cada emisión consume el costo TSC vigente configurado por Tessera. La institución no necesita recargar MATIC: Tessera cubre el gas internamente.',
        },
        payments: {
          q: '¿Cómo se cobra a los estudiantes los cursos pagos?',
          a: 'Usamos Stripe para procesar pagos. Las condiciones fiscales y de facturación aplicables dependen de tu jurisdicción.',
        },
      },
    },
  },

  public: {
    verify: {
      eyebrow: 'Verificación on-chain',
      title: 'Verificar certificado',
      body: 'Comprobá la autenticidad de cualquier certificado emitido en Tessera. Verificamos el estado del SBT directamente en la blockchain, y el contrato guarda on-chain qué institución lo emitió: si Tessera desapareciera, el certificado seguiría diciendo quién lo dio.',
      howTitle: 'Cómo funciona la verificación',
      steps: {
        id: {
          title: 'Obtené el ID',
          desc: 'Cada certificado tiene un Token ID único. Lo encontrás en el certificado, badge o en la URL de verificación.',
        },
        onchain: {
          title: 'Verificá on-chain',
          desc: 'Consultamos el smart contract para confirmar que el SBT existe, quién lo emitió y que no ha sido revocado.',
        },
        independent: {
          title: 'Validación independiente',
          desc: 'Podés comprobarlo por tu cuenta en el explorador con el hash de transacción. No necesitás confiar en Tessera.',
        },
      },
      form: {
        card: {
          eyebrow: 'Verificación on-chain',
          title: 'Verificar certificado',
          body: 'Verificá la autenticidad de cualquier certificado emitido en Tessera. Elegí uno de los tres métodos: ingresá el hash de transacción, subí el certificado (imagen o PDF) con su QR, o escanealo directamente con tu cámara.',
        },
        hashLabel: 'Hash de transacción en Polygon',
        verifying: 'Verificando…',
        verifyByHash: 'Verificar por hash',
        upload: {
          processing: 'Procesando archivo y buscando QR…',
          title: 'Hacé clic para subir un archivo',
          body: 'O arrastrá y soltá aquí. PNG, JPG, WebP o PDF. Detectamos el QR automáticamente.',
        },
        camera: {
          title: 'Abrir cámara para escanear QR',
          body: 'Apuntá la cámara al código QR del certificado. Detectamos el token automáticamente.',
        },
        tabs: {
          txhash: 'Tx Hash',
          file: 'Subir archivo',
          camera: 'Escanear QR',
        },
        errors: {
          verifyFailed: 'Error al verificar el certificado.',
          fileType: 'Solo se permiten imágenes (PNG, JPG, WebP) o archivos PDF.',
          noQrPdf: 'No se encontró ningún código QR en el PDF. Verificá que el certificado incluya un QR visible.',
          noQrImage: 'No se encontró ningún código QR en la imagen. Asegurate de que la imagen contenga un QR del certificado.',
          invalidQrFile: 'El QR detectado no contiene un identificador de certificado válido. Contenido: ',
          invalidQrScan: 'El QR escaneado no contiene un identificador de certificado válido. Contenido: ',
          fileFailed: 'Error al procesar el archivo.',
        },
      },
      result: {
        verifying: 'Verificando certificado #{id}…',
        certificateTitle: 'Certificado #{id}',
      },
      provenance: {
        loading: 'Leyendo la procedencia on-chain…',
        title: 'Procedencia on-chain',
        body: 'Todo lo de abajo se lee del contrato, no de la base de datos de Tessera. Si este servidor desapareciera, la respuesta seguiría siendo la misma.',
        issuedBy: 'Emitido por',
        issuerApproved: 'Emisor autorizado',
        approvedYes: 'Sí, en el registro',
        approvedNo: 'No consta',
        transferable: 'Transferible',
        soulboundYes: 'No · soulbound',
        soulboundNo: 'Sí',
        viewContract: 'Ver el contrato',
        checkYourself: 'Comprobalo vos mismo',
        commandsIntro: 'Con Foundry instalado, estos comandos consultan la cadena directamente y devuelven lo mismo que ves arriba:',
      },
    },

    legal: {
      lastUpdated: 'Última actualización:',
      terms: {
        title: 'Términos de Servicio',
        intro: 'Al utilizar Tessera, las instituciones aceptan ser responsables del contenido de los certificados emitidos y de obtener el consentimiento de sus estudiantes para la publicación on-chain de hashes y wallets.',
        serviceTitle: 'Servicio',
        serviceBody: 'Tessera presta un SaaS de emisión y verificación de certificados educativos como Soulbound Tokens en la blockchain Polygon, con metadata almacenada en Arweave e IPFS.',
        paymentsTitle: 'Pagos',
        paymentsBody: 'Las suscripciones se facturan mensualmente mediante Stripe. Pruebas gratuitas no requieren tarjeta.',
      },
      privacy: {
        title: 'Política de Privacidad',
        intro: 'Tessera procesa datos personales conforme al Reglamento (UE) 2016/679 (GDPR) y la Ley Orgánica de Protección de Datos. La PII (nombre, email, foto) se almacena cifrada en nuestra base de datos. On-chain solo se publica el hash del certificado y la wallet del receptor.',
        rightsTitle: 'Derechos del usuario',
        rightsBody: 'Acceso, rectificación, supresión, portabilidad, oposición y limitación. Solicitudes a',
        retentionTitle: 'Retención',
        retentionBody: 'Datos de cuenta mientras la institución mantenga su contrato activo. Logs de auditoría 12 meses. Backups cifrados 30 días.',
      },
      compliance: {
        title: 'Cumplimiento',
        subtitle: 'Controles operativos y de privacidad de Tessera.',
        sections: {
          privacy: {
            title: 'Privacidad por diseño',
            body: 'La información personal se mantiene off-chain. En blockchain se publica únicamente una referencia verificable y no reversible.',
          },
          audit: {
            title: 'Auditoría',
            body: 'Las acciones críticas quedan registradas con actor, fecha, objetivo y metadatos operativos para trazabilidad institucional.',
          },
          continuity: {
            title: 'Continuidad',
            body: 'Los metadatos se respaldan en almacenamiento permanente y las verificaciones públicas no requieren cuenta de usuario.',
          },
        },
      },
      cookies: {
        title: 'Política de Cookies',
        intro: 'Tessera utiliza cookies esenciales para autenticación, seguridad y preferencias de sesión. Estas cookies permiten mantener la sesión activa y proteger accesos no autorizados.',
        analyticsTitle: 'Analítica',
        analyticsBody: 'Podemos usar analítica agregada para entender rendimiento, errores y uso general del producto. No vendemos datos personales ni perfiles de estudiantes.',
        managementTitle: 'Gestión',
        managementBody: 'Puedes bloquear cookies desde tu navegador. Algunas funciones, como login o paneles autenticados, podrían dejar de funcionar correctamente.',
      },
    },

    changelog: {
      eyebrow: 'Producto',
      title: 'Changelog',
      body: 'Registro de cambios principales de la plataforma, API y experiencia de emisión.',
      entries: {
        v10: {
          issuing: 'Emisión de certificados soulbound en Polygon.',
          verification: 'Verificación pública por hash, token y QR.',
          courses: 'Cursos públicos, códigos de canje y paneles por rol.',
        },
        v09: {
          webhooks: 'Webhooks firmados con reintentos.',
          tsc: 'TSC prepagado y ledger institucional.',
          gdpr: 'Exportación y borrado GDPR para estudiantes.',
        },
      },
    },

    docs: {
      eyebrow: 'Desarrolladores',
      title: 'API pública',
      body: 'Integra Tessera con tu LMS, CRM o backoffice para emitir credenciales verificables, consultar estados y automatizar notificaciones.',
      createKey: 'Crear API key',
      viewDocs: 'Ver documentación',
      baseEndpoint: 'Endpoint base',
      sections: {
        auth: {
          title: 'Autenticación',
          description: 'Usa API keys institucionales con scopes para emitir, consultar y revocar credenciales desde tu LMS.',
        },
        webhooks: {
          title: 'Webhooks firmados',
          description: 'Recibe eventos de emisión, fallo y revocación con firma HMAC y reintentos automáticos.',
        },
        verification: {
          title: 'Verificación pública',
          description: 'Consulta certificados por token, hash o QR sin exponer información personal innecesaria.',
        },
      },
    },

    courses: {
      eyebrow: 'Catálogo abierto',
      title: 'Cursos verificables on-chain',
      body: 'Programas creados por instituciones reales. Inscríbete con tu cuenta y, al completar, tu certificado queda disponible y verificable públicamente.',
      redeemCode: 'Tengo un código de canje',
      createAccount: 'Crear cuenta',
      empty: {
        title: 'Aún no hay cursos públicos',
        body: 'Las instituciones todavía están preparando sus catálogos. Vuelve pronto.',
      },
      visibility: {
        free: 'Gratis',
        paid: 'De pago',
        hybrid: 'Híbrido',
        membership: 'Membresía',
      },
      modules: 'mód.',
      hours: 'h',
      redeem: {
        back: 'Volver al catálogo',
        eyebrow: 'Acceso por código',
        title: 'Canjear curso',
        body: 'Pega el código que te entregó tu institución. Si es válido, te inscribimos al curso al instante. Para cursos híbridos necesitas estar registrado como estudiante de esa institución.',
        codeLabel: 'Código',
        submit: 'Canjear código',
        invalidCode: 'Ingresa un código válido.',
        confirmedPrefix: 'Acceso confirmado al curso',
      },
    },

    /**
     * Pagina publica de detalle de curso y su gate de Unlock. `formatPrice` y
     * `formatDuration` (apps/web/src/lib/portal/api.ts) son utilidades
     * compartidas usadas en toda la libreria del portal y devuelven texto
     * fijo en espanol ('Gratis', 'Sin vencimiento', 'año(s)'); hacerlas
     * conscientes del idioma exige pasar el diccionario por cada llamador,
     * lo cual queda fuera de esta pasada y se documenta aqui como pendiente.
     */
    courseDetail: {
      backToCatalogue: 'Volver al catálogo',
      stats: {
        modules: 'Módulos',
        duration: 'Duración',
        passing: 'Aprobación',
      },
      coursePlan: 'Plan del curso',
      enrolment: 'Inscripción',
      membershipPrice: 'Membresía',
      priceFree: 'Gratis',
      enrolmentHint: {
        membership: 'El acceso lo concede tu membresía de Unlock. Probá la muestra y desbloqueá el curso desde el panel de la izquierda.',
        hybrid: 'Si ya perteneces a esta institución, puedes acceder gratis. También puedes canjear un código institucional.',
        free: 'Curso abierto. Inicia sesión para inscribirte.',
        paid: 'Inicia sesión y completa la compra para acceder al recorrido.',
      },
      getMembership: 'Obtener membresía en Unlock',
      enrolAsStudent: 'Inscribirme como estudiante',
      enrolFree: 'Inscribirme gratis',
      signInToContinue: 'Iniciar sesión para continuar',
      haveCode: 'Tengo un código',
      gate: {
        fullAccess: 'acceso completo',
        openOfTotal: '{open} de {total} abierto',
        sampleClosed: 'muestra cerrada',
        loadingSample: 'Cargando muestra…',
        noContent: 'Este módulo todavía no tiene contenido cargado.',
        membershipAccess: 'Acceso con membresía',
        alreadyEnrolledTitle: 'Ya tenés acceso a este curso',
        alreadyEnrolledBody: 'Tu membresía abrió el curso completo. Continuá donde lo dejaste.',
        continueCourse: 'Continuar el curso',
        deniedTitle: 'Todavía no tenés la membresía',
        deniedDefault: 'Consegí la llave en Unlock y volvé: el acceso se comprueba en la blockchain.',
        getMembership: 'Obtener membresía',
        alreadyBought: 'Ya la compré',
        signInToContinue: 'Iniciar sesión para continuar',
        connectWallet: 'Conectar wallet',
        verifyMembership: 'Verificar mi membresía',
        installWallet: 'Instalá una wallet como MetaMask para desbloquear este curso.',
        wrongChainPrefix: 'Tu wallet está en',
        wrongChainMid: '; la membresía vive en',
        wrongChainEnd: '. Te vamos a pedir el cambio.',
        switchChainPrompt: 'Cambiá tu wallet a {chain} para verificar la llave.',
        cantReachChain: 'No pudimos consultar la blockchain. Probá de nuevo.',
        needSignature: 'Necesitamos tu firma para comprobar que la wallet es tuya.',
        waitingOnchain: 'Estamos esperando que la membresía aparezca on-chain. Esto puede tardar unos segundos.',
        stillVerifying: 'Seguimos verificando la membresía en la blockchain…',
        moduleNeedsMembership: 'Este módulo requiere membresía.',
        verifyingOnchain: 'Verificando en la blockchain…',
        signing: 'Firmando…',
        enrolling: 'Matriculando…',
        checkedEveryAttempt: 'El acceso se comprueba contra el contrato del Lock en cada intento. Tessera no guarda permisos: la llave on-chain es la que decide.',
        row: {
          lock: 'Lock',
          network: 'Red',
          price: 'Precio',
          duration: 'Duración',
        },
        badges: {
          sample: 'muestra',
          availableInCourse: 'Disponible en el curso',
        },
        steps: {
          wallet: 'Conectar wallet',
          check: 'Verificar membresía on-chain',
          sign: 'Firmar propiedad',
          open: 'Matricularme',
        },
        signInBeforeEnrol: 'Iniciá sesión para matricularte.',
        studentAccountOnly: 'Sólo una cuenta de estudiante puede matricularse.',
        completeFailed: 'No pudimos completar la matrícula.',
      },
    },

    /**
     * Pagina publica de estado (/status). El shell --etiquetas, estados,
     * titulos-- se traduce. `role`, `rationale` y `value` de cada red vienen
     * del payload de health del API (apps/api/src/config/networks.ts),
     * escritos en espanol del lado del servidor; bilingualizar ese texto
     * exige bilingualizar la respuesta del API, que queda fuera de esta
     * pasada de frontend y sigue pendiente.
     */
    status: {
      eyebrow: 'Status',
      title: 'Estado del servicio',
      body: 'Health check público de API, cola y dependencias de emisión.',
      operational: 'Operativo',
      degraded: 'Degradado',
      metrics: {
        apiVersion: 'Versión API',
        response: 'Respuesta',
        network: 'Red',
      },
      checks: {
        db: 'PostgreSQL',
        redis: 'Redis',
        rpc: 'Polygon RPC',
        arweave: 'Arweave',
        signer: 'Signer',
        openbao: 'OpenBao (bóveda)',
        stripeWebhook: 'Stripe Webhook',
        email: 'SMTP / Email',
      },
      noChecks: 'No se pudo consultar el estado del API.',
      networksTitle: 'Redes y contratos',
      networksBody: 'Los mismos contratos corren en cuatro redes de prueba, cada una con un propósito distinto. Las direcciones son públicas a propósito: cualquiera puede auditar la emisión en el explorador sin pedirnos nada.',
      issuing: 'emitiendo',
      deployed: 'desplegado',
      contracts: {
        registry: 'Registry',
        certificate: 'Certificate',
        badge: 'Badge',
        autoIssuer: 'AutoIssuer',
      },
      verificationUnavailable: 'El explorador de esta cadena tiene la verificación de código fuera de servicio; los contratos quedan validados on-chain igualmente.',
    },
  },

  student: {
    layout: {
      title: 'Espacio del estudiante',
      description: 'Portafolio verificable y credenciales activas',
    },

    home: {
      eyebrow: 'Mi aprendizaje',
      greeting: 'Hola, {name}.',
      fallbackName: 'estudiante',
      subtitle: {
        empty: 'Aún no tienes cursos. Canjea un código de invitación para empezar tu primera credencial verificable.',
        inProgressOne: 'Tienes {courses} curso en marcha y {credentials} credencial on-chain.',
        inProgressMany: 'Tienes {courses} cursos en marcha y {credentials} credenciales on-chain.',
        completedOne: '{completed} curso completado y {credentials} credencial verificable.',
        completedMany: '{completed} cursos completados y {credentials} credenciales verificables.',
        failed: 'No pudimos cargar tus datos. Intenta refrescar en unos segundos.',
      },
      viewCourses: 'Ver mis cursos',
      myCredentials: 'Mis credenciales',
      stats: {
        activeCourses: 'Cursos activos',
        activeCoursesHint: '{n} inscripciones en total',
        completed: 'Cursos completados',
        average: 'Promedio {score}',
        noAverage: 'Sin promedio aún',
        credentials: 'Credenciales on-chain',
        inFlight: '{n} en proceso',
        allIssued: 'Todas emitidas',
        badges: 'Badges',
        pendingGrading: '{n} pendiente(s) de revisar',
        noPending: 'Sin pendientes',
      },
      continueTitle: 'Continúa donde lo dejaste',
      continueBody: 'Tus cursos en progreso, ordenados por última actividad.',
      viewAll: 'Ver todos',
      noActive: {
        title: 'No tienes cursos activos',
        body: 'Canjea un código de invitación de tu institución para inscribirte y empezar a ganar credenciales.',
      },
      activity: {
        title: 'Actividad reciente',
        body: 'Tus últimos intentos de evaluación.',
        empty: 'Aún no tienes intentos enviados.',
        graded: 'Calificado',
        submitted: 'Enviado',
      },
      wallet: {
        title: 'Tu wallet Tessera',
        body: 'Custodiada de forma segura por Tessera para guardar tus SBT y badges en Polygon.',
        address: 'Dirección',
        detail: 'Ver detalle de wallet',
        verifiedOn: 'Cuenta verificada el {date}',
        unverified: 'Tu correo aún no está verificado',
      },
      startedAgo: 'Iniciado {time}',
      noActivityYet: 'Sin actividad todavía',
      modulesOf: '{done} de {total} módulos',
    },

    courses: {
      metaTitle: 'Mis cursos',
      eyebrow: 'Mis cursos',
      title: 'Tu portafolio de aprendizaje',
      subtitleEmpty: 'Todavía no estás inscrito en ningún curso. Canjea un código para empezar.',
      subtitleOne: 'Tienes {total} inscripción: {inProgress} en curso, {completed} completado.',
      subtitleMany: 'Tienes {total} inscripciones: {inProgress} en curso, {completed} completados.',
      empty: {
        title: 'Sin cursos todavía',
        body: 'Cuando una institución te invite a un curso o te dé un código de canje, aparecerá aquí.',
      },
      groups: {
        inProgress: 'En curso',
        notStarted: 'Sin iniciar',
        completed: 'Completados',
      },
      status: {
        suspended: 'Suspendida',
        completed: 'Completado',
        inProgress: 'En curso',
        notStarted: 'Por iniciar',
        pendingStart: 'Pendiente de iniciar',
      },
      suspendedNotice: 'Esta institución ha sido suspendida.',
      modules: '{done} / {total} módulos',
      completedOn: 'Completado el {date}',
      lastActivity: 'Última actividad {time}',
      noActivity: 'Sin actividad',
      score: 'nota {n}',
      actions: {
        blocked: 'Bloqueado',
        view: 'Ver',
        continue: 'Continuar',
        start: 'Empezar',
      },
      institutionFallback: 'Institución',
    },

    redeem: {
      label: 'Código de invitación',
      srLabel: 'Código',
      placeholder: 'EJ. PROD2025',
      submit: 'Canjear',
      hint: 'Pídele a tu institución el código para inscribirte en un curso.',
      alreadyEnrolled: 'Ya estabas inscrito en este curso.',
      created: '¡Inscripción creada!',
    },

    credentials: {
      metaTitle: 'Mis credenciales',
      eyebrow: 'Verificable on-chain',
      title: 'Mis credenciales',
      body: 'Soulbound Tokens (SBT) emitidos por las instituciones donde aprendiste. Cada credencial es única, intransferible y auditable en las redes donde fue emitida.',
      stats: {
        issued: 'Emitidas',
        inProgress: 'En proceso',
        total: 'Total',
      },
      empty: {
        title: 'Aún no tienes credenciales',
        body: 'Cuando completes un curso aprobado y la institución emita tu credencial, aparecerá aquí.',
      },
      groups: {
        issued: 'Emitidas',
        inProgress: 'En proceso',
        failed: 'Con incidencias',
      },
      status: {
        issued: 'Emitido',
        queued: 'En cola',
        processing: 'Procesando',
        failed: 'Falló',
        revoked: 'Revocado',
      },
      grade: 'Nota {n}',
      fields: {
        issued: 'Emitido',
        yourWallet: 'Tu wallet',
        txHash: 'Tx hash',
      },
      networks: 'Redes',
      confirmed: 'confirmado',
      viewSbt: 'Ver SBT',
      viewTx: 'Ver transacción',
      publicVerification: 'Verificación pública',
      copyLink: 'Copiar enlace',
    },

    badges: {
      metaTitle: 'Badges',
      title: 'Mis badges',
      body: 'Insignias semi-fungibles otorgadas por hitos, cohortes o eventos. Las puedes mostrar públicamente y se quedan en tu wallet de Tessera.',
      empty: {
        title: 'Aún no tienes badges',
        body: 'Las instituciones suelen entregar badges al completar talleres, hackathones o cohortes.',
      },
      amount: 'Cantidad',
      received: 'Recibido',
      wallet: 'Wallet',
      viewTx: 'Ver tx',
    },

    wallet: {
      metaTitle: 'Mi wallet',
      eyebrow: 'Wallet custodiada',
      title: 'Tu wallet en Polygon',
      body: 'Tessera mantiene tu wallet de forma segura para que recibas SBT y badges sin pagar gas. Toda emisión es verificable en Polygon.',
      yourAddress: 'Tu dirección',
      notAssigned: 'Aún no asignada',
      copy: 'Copiar',
      stats: {
        network: 'Red',
        credentials: 'Credenciales (SBT)',
        badges: 'Badges',
      },
      assetsTitle: 'Activos en tu wallet',
      assetsBody: 'Soulbound Tokens emitidos a tu nombre. Son únicos e intransferibles.',
      table: {
        credential: 'Credencial',
        token: 'Token',
        issued: 'Emitido',
        tx: 'Tx',
      },
      empty: {
        title: 'Tu wallet aún está vacía',
        body: 'Cuando completes un curso aprobado, las credenciales emitidas aparecerán aquí.',
      },
      why: {
        title: '¿Por qué una wallet custodiada?',
        body: 'No necesitas instalar Metamask ni gestionar frases semilla para empezar. Tus credenciales soulbound permanecen protegidas por la infraestructura de Tessera.',
      },
    },

    profile: {
      metaTitle: 'Mi perfil',
      role: 'Estudiante',
      noName: 'Sin nombre',
      createdOn: 'Cuenta creada el {date}',
      emailVerified: ' · correo verificado',
      emailUnverified: ' · correo sin verificar',
      loadFailed: 'No pudimos cargar tu perfil ahora mismo. Intenta refrescar.',
      stats: {
        enrolments: 'Inscripciones',
        completed: 'Cursos completados',
        credentials: 'Credenciales',
      },
      rejected: {
        title: 'Tu perfil necesita correcciones.',
      },
      pending: 'Tu perfil está en revisión por el administrador global.',
      personalTitle: 'Información personal',
      personalBody: 'Tu nombre aparecerá en los certificados que se emitan a partir de este momento. El email requiere verificación y no puede cambiarse desde aquí.',
      publicTitle: 'Preferencias públicas',
      publicBody: 'Estos datos controlan cómo se ve tu perfil dentro de Tessera.',
      form: {
        fullName: 'Nombre completo',
        namePlaceholder: 'Cómo quieres aparecer en tus credenciales',
        avatarUrl: 'URL del avatar',
        avatarHint: 'Opcional. Próximamente podrás subir directamente una imagen.',
        preferredLanguage: 'Idioma preferido',
        save: 'Guardar cambios',
        saving: 'Guardando…',
        saved: 'Perfil actualizado correctamente.',
      },
    },

    privacy: {
      metaTitle: 'Privacidad',
      title: 'Privacidad y datos',
      body: 'Control total sobre tus datos personales. Puedes solicitar una copia, ejercer tus derechos ARCO o iniciar la eliminación definitiva.',
      export: {
        title: 'Exportar mis datos',
        body: 'Recibe un archivo con todos tus datos personales: perfil, credenciales, actividad y preferencias. Te enviaremos un enlace por email cuando esté listo (máx. 14 días).',
        submit: 'Solicitar exportación',
        submitting: 'Solicitando…',
        requested: 'Solicitud creada. Te enviaremos un correo cuando esté lista.',
      },
      categoriesTitle: 'Tus datos en Tessera',
      categoriesBody: 'Resumen de las categorías de información que tratamos y la base jurídica de cada una.',
      categories: {
        profile: {
          label: 'Datos de perfil',
          desc: 'Nombre, email, idioma, avatar y wallet asociada.',
        },
        onchain: {
          label: 'Credenciales on-chain',
          desc: 'Token IDs y metadatos de tus SBT y badges. Permanecen en blockchain por su naturaleza inmutable.',
        },
        progress: {
          label: 'Progreso de cursos',
          desc: 'Inscripciones, intentos, calificaciones y avance por módulo.',
        },
        session: {
          label: 'Datos de sesión',
          desc: 'Logs de acceso anonimizados después de 90 días.',
        },
      },
      basis: {
        contract: 'Contrato',
        legitimate: 'Interés legítimo',
      },
      delete: {
        title: 'Eliminar mi cuenta',
        bodyStart: 'Inicia un proceso de eliminación de',
        bodyDays: '30 días',
        bodyEnd: 'durante el cual puedes cancelar. Al confirmar, tus datos personales se anonimizan. Los tokens en blockchain permanecen por su naturaleza inmutable.',
      },
      contact: 'Para ejercer derechos ARCO o consultas, escribe a',
      myAccount: 'Mi cuenta',
    },

    actions: {
      profileFailed: 'No se pudo actualizar el perfil.',
      attemptStartFailed: 'Error al iniciar intento',
      attemptSubmitFailed: 'Error al enviar intento',
      progressFailed: 'No se pudo registrar el avance.',
      codeLength: 'El código debe tener entre 4 y 16 caracteres.',
      redeemFailed: 'No se pudo canjear el código.',
      exportFailed: 'No se pudo solicitar la exportación.',
      deletionFailed: 'No se pudo iniciar la eliminación.',
      cancelDeletionFailed: 'No se pudo cancelar la eliminación.',
    },
  },

  header: {
    nav: {
      courses: 'Cursos',
      pricing: 'Precios',
      verify: 'Verificar',
      faq: 'Preguntas',
    },
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    dashboard: 'Panel',
    ariaMain: 'Principal',
  },

  footer: {
    tagline:
      'Certificados educativos verificables on-chain. Soulbound Tokens en Polygon, metadata permanente en Arweave + IPFS, badges sociales para LinkedIn.',
    rights: 'Todos los derechos reservados.',
    product: {
      title: 'Producto',
      institutions: 'Para instituciones',
      howItWorks: 'Cómo funciona',
      pricing: 'Precios',
      api: 'API pública',
    },
    resources: {
      title: 'Recursos',
      verify: 'Verificar certificado',
      status: 'Estado del servicio',
      changelog: 'Changelog',
      support: 'Soporte',
    },
    legal: {
      title: 'Legal',
      terms: 'Términos',
      privacy: 'Privacidad',
      compliance: 'Cumplimiento',
      cookies: 'Cookies',
    },
  },

  account: {
    restricted: {
      title: 'Tu cuenta ha sido suspendida',
      subtitle: 'No puedes acceder temporalmente a Tessera.',
      reasonLabel: 'Razón de suspensión',
      fallbackReason: 'El administrador no informó un motivo específico.',
      secure: 'Tus certificados y datos permanecen seguros.',
      nextTitle: '¿Qué puedes hacer?',
      steps: {
        request: 'Solicita una revisión de la suspensión.',
        wait: 'Recibirás la respuesta por correo electrónico.',
      },
      messageLabel: 'Explicación para revisión',
      messageHelp: 'Contanos brevemente por qué deberíamos revisar la suspensión.',
      messageMinHelp: 'Necesitás escribir al menos 20 caracteres para activar el envío.',
      messagePlaceholder: 'Agregá el contexto que ayude al equipo a revisar tu cuenta.',
      requestReview: 'Solicitar revisión',
      sentReview: 'Solicitud enviada',
      signOut: 'Cerrar sesión',
      note: 'La revisión puede tardar hasta 10 días hábiles.',
      sending: 'Enviando solicitud…',
      success: 'Solicitud enviada. Esperá la respuesta de soporte en tu correo electrónico antes de enviar otra consulta.',
      minMessage: 'Escribí al menos 20 caracteres para enviar la solicitud.',
    },

    detailedProfile: {
      countries: {
        AR: 'Argentina', BO: 'Bolivia', BR: 'Brasil', CA: 'Canadá', CL: 'Chile',
        CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', EC: 'Ecuador', SV: 'El Salvador',
        ES: 'España', US: 'Estados Unidos', FR: 'Francia', GT: 'Guatemala', HN: 'Honduras',
        IT: 'Italia', MX: 'México', NI: 'Nicaragua', PA: 'Panamá', PY: 'Paraguay',
        PE: 'Perú', PT: 'Portugal', PR: 'Puerto Rico', GB: 'Reino Unido',
        DO: 'República Dominicana', UY: 'Uruguay', VE: 'Venezuela',
      },
      documentTypes: {
        idCard: 'Carnet de identidad',
        dni: 'DNI',
        passport: 'Pasaporte',
        cedula: 'Cédula',
        other: 'Otro',
      },
      fields: {
        firstName: 'Nombre *',
        lastName: 'Apellido *',
        documentType: 'Tipo de documento *',
        documentNumber: 'Número de documento *',
        birthDate: 'Fecha de nacimiento *',
        phone: 'Teléfono *',
        country: 'País *',
        selectCountry: 'Selecciona un país',
        city: 'Ciudad *',
        addressLine: 'Dirección *',
      },
      requiredFields: 'Completa todos los campos obligatorios.',
      changesSaved: 'Cambios guardados.',
      studentSubmitted: 'Perfil enviado a revisión. Te avisaremos cuando el admin lo apruebe.',
      teacherCompleted: 'Perfil completado. Ya puedes usar el espacio docente.',
      saving: 'Guardando…',
      saveChanges: 'Guardar cambios',
      submitForReview: 'Enviar a revisión',
      completeProfile: 'Completar perfil',
    },
  },

  admin: {
    layout: {
      title: 'Tessera Admin',
      description: 'Operación de la plataforma',
    },
    dashboard: {
      pendingInstitutions: {
        badge: 'Pendiente',
        title: 'Instituciones por revisar',
        description: 'Perfiles enviados y listos para aprobación.',
        deltaLabel: 'este mes',
      },
      awaitingCorrections: {
        badge: 'Seguimiento',
        title: 'Esperando correcciones',
        description: 'Instituciones rechazadas con observaciones.',
        deltaLabel: 'esta semana',
      },
      suspendedAccounts: {
        badge: 'Restringidas',
        title: 'Cuentas suspendidas',
        usersInstitutions: '{users} usuarios · {institutions} instituciones',
        deltaRequests: 'peticiones por revisar',
        deltaNoChange: 'sin cambios este mes',
        deltaThisMonth: 'este mes',
      },
      emissionIssues: {
        badge: 'Requiere atención',
        title: 'Emisiones con problemas',
        certificatesWebhooks: '{certificates} certificados · {webhooks} webhooks',
        deltaLabel: 'últimas 24 h',
      },
      issuesRequireReview: '{count} asuntos requieren revisión',
      autoUpdated: 'Actualizado automáticamente',
      suspensionRequests: {
        title: 'Peticiones de retiro de suspensión',
        description: 'Usuarios suspendidos que ya enviaron su explicación al correo de soporte.',
        viewAll: 'Ver peticiones',
        account: 'Cuenta',
        type: 'Tipo',
        submitted: 'Enviada',
        action: 'Acción',
        reviewSupportEmail: 'Revisar email de soporte',
      },
      pendingInstitutionsTable: {
        title: 'Instituciones pendientes de aprobar',
        description: 'KYC y verificación de dominio',
        viewAll: 'Ver todas',
        institution: 'Institución',
        country: 'País',
        requested: 'Solicitada',
        status: 'Estado',
        pending: 'Pendiente',
        review: 'Revisar',
        empty: 'No hay instituciones pendientes de aprobación.',
      },
    },
    confirmationDialog: {
      close: 'Cerrar',
      cancel: 'Cancelar',
      reactivateUser: {
        title: 'Reactivar usuario',
        description: 'El usuario recuperará el acceso completo a su cuenta.',
        status: 'Suspendido',
        infoTitle: 'Al reactivar la cuenta:',
        infoText: 'Recuperará el acceso a sus certificados, datos y funcionalidades disponibles.',
        question: '¿Confirmas que deseas reactivar este usuario?',
        submit: 'Reactivar usuario',
        pending: 'Reactivando…',
      },
      reactivateInstitution: {
        title: 'Reactivar institución',
        description: 'La institución recuperará el acceso operativo a su workspace.',
        status: 'Suspendida',
        infoTitle: 'Al reactivar la institución:',
        infoText:
          'Se quitará la suspensión del workspace y también del encargado institucional asociado.',
        question: '¿Confirmas que deseas reactivar esta institución?',
        submit: 'Reactivar institución',
        pending: 'Reactivando…',
      },
      delete: {
        title: 'Eliminar usuario',
        description: 'La cuenta quedará eliminada de forma lógica en el sistema.',
        status: 'Activo',
        infoTitle: 'Al eliminar la cuenta:',
        infoText: 'Se bloqueará el acceso y la cuenta dejará de aparecer como usuario activo.',
        question: '¿Confirmas que deseas eliminar este usuario?',
        submit: 'Eliminar usuario',
        pending: 'Eliminando…',
      },
      removeTeamMember: {
        title: 'Quitar integrante',
        description: 'La persona perderá el acceso al equipo de esta institución.',
        status: 'Miembro del equipo',
        infoTitle: 'Al quitarlo del equipo:',
        infoText:
          'Se removerá su acceso a este workspace institucional. Su cuenta personal y sus datos no serán eliminados.',
        question: '¿Confirmas que deseas quitar a esta persona del equipo?',
        submit: 'Quitar integrante',
        pending: 'Quitando…',
      },
      deleteAccount: {
        title: 'Eliminar mi cuenta',
        description: 'Tu cuenta quedará programada para eliminación lógica.',
        status: 'Cuenta personal',
        infoTitle: 'Al eliminar tu cuenta:',
        infoText:
          'Se bloqueará tu acceso y se iniciará el período de 30 días antes de anonimizar tus datos personales.',
        question: '¿Confirmas que deseas eliminar tu cuenta?',
        submit: 'Eliminar mi cuenta',
        pending: 'Programando…',
      },
      deleteInstitutionAdminAccount: {
        title: 'Eliminar mi cuenta',
        description:
          'Tu cuenta y la institución asociada quedarán programadas para eliminación lógica.',
        status: 'Admin institución',
        infoTitle: 'Al eliminar tu cuenta:',
        infoText:
          'Se bloqueará tu acceso y la institución asociada dejará de operar en Tessera. Esta acción afecta cursos, certificados, equipo y automatizaciones de ese workspace.',
        question: '¿Confirmas que deseas eliminar tu cuenta y la institución asociada?',
        submit: 'Eliminar cuenta',
        pending: 'Programando…',
      },
    },
    suspensionDialog: {
      close: 'Cerrar',
      required: 'obligatorio',
      reasonLabel: 'Razón de suspensión',
      reasonHelp: 'Este mensaje se mostrará al usuario cuando intente ingresar.',
      placeholder: 'Ej. Actividad inusual detectada en la cuenta.',
      info: 'Sus certificados y datos permanecerán seguros durante la suspensión.',
      later: 'Podrás reactivar la cuenta más adelante.',
      cancel: 'Cancelar',
      invalid: 'Ingresá un motivo de suspensión válido.',
      suspending: 'Suspendiendo…',
      charactersWritten: '{count} caracteres escritos',
    },
    alerts: {
      cards: {
        open: {
          badge: 'Abiertas',
          title: 'Alertas abiertas',
          description: 'Eventos que requieren atención operativa.',
        },
        critical: {
          badge: 'Críticas',
          title: 'Errores críticos',
          description: 'Incidentes con impacto directo.',
        },
        warnings: {
          badge: 'Avisos',
          title: 'Avisos',
          description: 'Señales preventivas del sistema.',
        },
      },
      heading: {
        title: 'Alertas del sistema',
        description: 'Eventos que requieren atención del equipo de operaciones',
      },
      resolved: 'Resuelto',
      resolve: 'Resolver',
    },
    certificates: {
      status: {
        issued: 'Válido',
        revoked: 'Revocado',
        queued: 'En cola',
        processing: 'Procesando',
        failed: 'Fallido',
      },
      cards: {
        total: {
          badge: 'Total',
          title: 'Certificados totales',
          description: 'Credenciales registradas en la plataforma.',
        },
        revoked: {
          badge: 'Revocados',
          title: 'Certificados revocados',
          description: 'Credenciales invalidadas por revisión.',
        },
        today: {
          badge: 'Hoy',
          title: 'Emitidos hoy',
          description: 'Emisiones recientes en todas las instituciones.',
        },
      },
      activity: {
        title: 'Actividad de certificados',
        description: 'Distribución operativa por estado e institución.',
      },
      byStatus: 'Por estado',
      byInstitution: 'Por institución',
      list: {
        title: 'Certificados',
        description: 'Mostrando {shown} de {total} registros históricos.',
        page: 'Página {page} de {totalPages}',
        noInstitution: 'Sin institución',
        viewTx: 'Ver transacción',
        empty: 'Sin certificados todavía.',
        recordsPerPage: '{total} registros · {limit} por página',
        previous: 'Anterior',
        next: 'Siguiente',
      },
      revocationNotice:
        'Revocación on-chain. Revocar llama a TesseraCertificate.revoke(tokenId) en Polygon. El token permanece en la wallet del titular pero queda marcado como inválido (ERC-5192 + event Revoked). Esta acción es irreversible.',
    },
    health: {
      status: { healthy: 'Saludable', degraded: 'Degradado' },
      cards: {
        overall: { badge: 'API', title: 'Estado general', description: '{ok}/{total} servicios OK' },
        version: { badge: 'Versión', title: 'Versión API', description: 'Fastify 5' },
        services: { badge: 'Servicios', title: 'Servicios OK', description: 'Dependencias actualmente saludables.' },
      },
      heading: {
        title: 'Health de servicios',
        description: 'Réplica de GET /v1/health — actualizado al cargar la página',
      },
      note: 'En producción este panel hace GET /v1/health y refresca cada 30 segundos.',
      checkNames: {
        db: 'PostgreSQL',
        redis: 'Redis',
        rpc: 'Polygon RPC',
        arweave: 'Arweave',
        pinata: 'Pinata / IPFS',
        signer: 'Web3Signer / OpenBao',
        stripeWebhook: 'Stripe Webhook',
        objectStorage: 'MinIO / Object Storage',
        email: 'Resend Email',
      },
      details: {
        rpcBlock: 'Polygon — bloque #{block}',
        dbOk: 'Conexión pool activo',
        dbDown: 'Conexión no disponible',
        redisOk: 'Cache activo',
        redisDown: 'Cache no disponible',
        arweaveNotConfigured: 'Sin wallet JWK; se utilizará Pinata/IPFS',
        arweaveOk: 'Wallet y gateway accesibles',
        arweaveDegraded: 'Gateway o wallet degradados',
        notConfigured: 'No configurado',
        pinataOk: 'API de Pinata accesible',
        pinataDegraded: 'Pinata degradado',
        objectStorageMinio: 'MinIO privado configurado',
        objectStorageOther: '{status} configurado',
        stripeWebhookOk: 'Webhook configurado',
        stripeWebhookDown: 'Webhook no configurado',
        signerWeb3: 'Web3Signer conectado a OpenBao KV',
        signerOpenbao: 'Fallback OpenBao directo configurado',
        signerLocal: 'Signer local de desarrollo',
        emailOk: 'Resend configurado',
        emailMock: 'Modo mock',
      },
    },
    plans: {
      cards: {
        costPerCertificate: {
          badge: 'Emisión',
          title: 'Costo por certificado',
          description: 'TSC descontados por cada certificado emitido.',
        },
        tscValue: {
          badge: 'Nominal',
          title: 'Valor por TSC',
          description: 'Referencia contable estable del crédito interno.',
        },
        continuity: {
          badge: 'Reserva',
          title: 'Continuidad',
          description: 'Reserva técnica por certificado emitido.',
        },
        monthlyTsc: {
          badge: 'Planes',
          title: 'TSC mensual total',
          description: 'Suma del saldo mensual ofrecido por los planes activos.',
        },
      },
      issuingConfig: {
        title: 'Configuración de emisión',
        description: 'Este valor impacta nuevas emisiones y los textos de planes públicos.',
      },
      fields: {
        tscPerCertificate: 'TSC por certificado',
        tscNominalValueUsd: 'Valor nominal TSC USD',
        continuityReserveUsd: 'Reserva continuidad USD',
        packageValidityMonths: 'Vigencia paquetes meses',
        currentVersion: 'Versión actual',
        autoUpdateOnSave: 'Se actualiza automáticamente al guardar.',
        name: 'Nombre',
        monthlyTsc: 'TSC mensual',
        monthlyPriceUsd: 'Precio mensual USD',
        discountPct: 'Descuento %',
        extraTscPriceUsd: 'Precio TSC adicional USD',
        commitmentMonths: 'Compromiso meses',
        description: 'Descripción',
        priceUsd: 'Precio USD',
        tsc: 'TSC',
        status: 'Estado',
        toggleActive: 'Cambiar estado activo',
      },
      subscriptionPlans: {
        title: 'Planes de suscripción',
        description: 'Edita valores visibles en landing, pricing y checkout de suscripción.',
      },
      tscPackages: {
        title: 'Paquetes TSC',
        description: 'Configura recargas comprables desde créditos institucionales.',
      },
      save: 'Guardar configuración',
      saved: 'Cambios guardados',
    },
    institutions: {
      status: { approved: 'Activa', pending: 'Pendiente', suspended: 'Suspendida', revoked: 'Revocada' },
      noCountry: 'Sin país',
      noSubscription: 'Sin suscripción activa',
      kpis: {
        active: {
          badge: 'Activas',
          title: 'Instituciones activas',
          description: 'Workspaces aprobados y operativos.',
        },
        pending: {
          badge: 'Pendiente',
          title: 'Pendientes de aprobación',
          description: 'Perfiles enviados que requieren revisión.',
        },
        certificates: {
          badge: 'Emitidos',
          title: 'Certificados totales',
          description: 'Emisiones acumuladas por instituciones.',
        },
      },
      approvalQueue: { title: 'Cola de aprobación', description: 'Nuevas instituciones que han solicitado acceso' },
      review: 'Revisar',
      allInstitutions: {
        title: 'Todas las instituciones',
        headers: {
          institution: 'Institución',
          country: 'País',
          plan: 'Plan',
          certificates: 'Certificados',
          status: 'Estado',
          suspension: 'Suspensión',
        },
        view: 'Ver',
      },
      detail: {
        back: 'Volver',
        backToList: 'Volver a instituciones',
        notFoundTitle: 'Institución no encontrada',
        notFoundDescription: 'No pudimos cargar esta institución desde la base.',
        needsProfile: 'La institución debe completar su perfil detallado',
        approve: 'Aprobar',
        syncRegistry: 'Sincronizar Registry',
        registrySynced: 'Registry sincronizado: la institución está autorizada para emitir en Polygon Amoy.',
        createdOn: 'Alta {date}',
        stats: { certificates: 'Certificados', members: 'Miembros', subscription: 'Suscripción', status: 'Estado' },
        dataTitle: 'Datos institucionales',
        slug: 'Slug',
        country: 'País',
        website: 'Web',
        detailedProfile: 'Perfil detallado',
        submitted: 'Enviado',
        pending: 'Pendiente',
        rejectionComment: 'Comentario de rechazo',
        wallet: 'Wallet',
        certificatesByStatusTitle: 'Certificados por estado',
        reviewTitle: 'Registro detallado para revisión',
        sentOn: 'Enviado {date}',
        notSent: 'Sin enviar',
        fields: {
          legalName: 'Razón social',
          taxId: 'Identificación fiscal',
          accreditation: 'Registro / acreditación',
          contactName: 'Responsable',
          contactEmail: 'Email de contacto',
          contactPhone: 'Teléfono',
          address: 'Dirección',
          cityRegion: 'Ciudad / región',
          postalCode: 'Código postal',
        },
        teamTitle: 'Equipo asociado',
        teamHeaders: { user: 'Usuario', role: 'Rol', since: 'Desde' },
      },
      reviewAction: {
        waitingChanges: 'Esperando cambios',
        waitingChangesTitle:
          'La institución debe corregir y reenviar su perfil para volver a revisión.',
        reject: 'Rechazar',
        rejectTitle: 'Rechazar institución',
        rejectDescription: 'La institución recibirá este comentario para corregir su solicitud.',
        rejected: 'Institución rechazada',
        rejectFailed: 'No se pudo rechazar la institución',
        workspaceLabel: 'Workspace institucional',
        pendingStatus: 'Pendiente',
        reasonLabel: 'Comentario de rechazo',
        reasonHelp: 'Este comentario se mostrará a la institución en su inicio y perfil.',
        placeholder: 'Ej. Falta documentación de acreditación vigente.',
        info: 'La institución podrá revisar sus datos y solicitar una nueva evaluación.',
        later: 'Volverá a revisión cuando la institución corrija y guarde su perfil.',
        loading: 'Rechazando…',
      },
      suspensionAction: {
        reactivate: 'Reactivar institución',
        suspend: 'Suspender institución',
        reactivated: 'Institución reactivada',
        suspended: 'Institución suspendida',
        toggleFailed: 'No se pudo cambiar el estado de la institución',
        description: 'La institución perderá temporalmente el acceso operativo.',
        activeStatus: 'Activa',
        workspaceLabel: 'Workspace institucional',
      },
    },
    users: {
      roles: {
        institutionAdmin: 'Admin institución',
        teacher: 'Docente',
        student: 'Estudiante',
        admin: 'Admin plataforma',
        apiClient: 'API client',
      },
      status: { active: 'Activo', restricted: 'Suspendido', deleted: 'Eliminado' },
      profileStatus: {
        incomplete: 'Perfil incompleto',
        pending: 'Perfil por revisar',
        approved: 'Perfil aprobado',
        rejected: 'Perfil rechazado',
        pendingApproval: 'Pendiente de aprobación',
        correctionNeeded: 'Corrección requerida',
        pendingProfile: 'Pendiente de perfil',
      },
      kpis: {
        total: { badge: 'Total', title: 'Usuarios totales', description: 'Cuentas registradas en Tessera.' },
        institutionAdmins: {
          badge: 'Institución',
          title: 'Instituciones admin',
          description: 'Encargados de workspaces institucionales.',
        },
        restricted: {
          badge: 'Suspendidos',
          title: 'Cuentas suspendidas',
          description: 'Usuarios con acceso restringido.',
        },
      },
      heading: { title: 'Gestión de usuarios', description: 'Control de roles, suspensiones y eliminación de cuentas' },
      filters: {
        roles: {
          institutionAdmin: 'Admin institución',
          admin: 'Admin plataforma',
          apiClient: 'API client',
          teacher: 'Docente',
          student: 'Estudiante',
        },
        statuses: {
          active: 'Activos',
          deleted: 'Eliminados',
          profileIncomplete: 'Perfil incompleto',
          profilePending: 'Perfil por revisar',
          profileRejected: 'Perfil rechazado',
          restricted: 'Suspendidos',
        },
        searchPlaceholder: 'Buscar por nombre, email o institución',
        allRoles: 'Todos los roles',
        allStatuses: 'Todos los estados',
        clear: 'Limpiar',
      },
      table: {
        headers: {
          user: 'Usuario',
          role: 'Rol',
          institution: 'Institución',
          registered: 'Registro',
          status: 'Estado',
          suspension: 'Suspensión',
        },
        managedByInstitution: 'Desde institución',
        noActions: 'Sin acciones',
        view: 'Ver',
        resultsSummary: 'Mostrando {shown} de {total} resultado(s) · página {page} de {totalPages}',
        previous: 'Anterior',
        next: 'Siguiente',
      },
      actions: {
        notAvailable: 'Acción no disponible',
        reactivate: 'Reactivar usuario',
        suspend: 'Suspender usuario',
        suspendTitle: 'Suspender usuario',
        suspendDescription: 'El usuario perderá temporalmente el acceso a su cuenta.',
        suspendDisabledReason: 'No se puede suspender mientras el perfil del estudiante no esté aprobado.',
        active: 'Activo',
        reactivated: 'Usuario reactivado',
        suspended: 'Usuario suspendido',
        toggleFailed: 'No se pudo cambiar el estado del usuario',
        approveProfile: 'Aprobar perfil',
        reject: 'Rechazar',
        rejectProfileTitle: 'Rechazar perfil',
        rejectProfileDescription:
          'El comentario se mostrará al estudiante para que pueda corregir sus datos.',
        profileApproved: 'Perfil aprobado',
        profileApproveFailed: 'No se pudo aprobar el perfil',
        profileRejected: 'Perfil rechazado',
        profileRejectFailed: 'No se pudo rechazar el perfil',
      },
      detail: {
        back: 'Volver',
        backToList: 'Volver a usuarios',
        notFoundTitle: 'Usuario no encontrado',
        notFoundDescription: 'No pudimos cargar este usuario desde la base.',
        createdOn: 'Alta {date}',
        stats: { role: 'Rol', student: 'Estudiante', profile: 'Perfil', status: 'Estado' },
        profileTitle: 'Perfil detallado del estudiante',
        rejectionComment: 'Comentario de rechazo',
        fields: {
          firstName: 'Nombre',
          lastName: 'Apellido',
          documentType: 'Tipo de documento',
          documentNumber: 'Número de documento',
          birthDate: 'Fecha de nacimiento',
          phone: 'Teléfono',
          country: 'País',
          city: 'Ciudad',
          address: 'Dirección',
          wallet: 'Wallet',
        },
        institutionsTitle: 'Instituciones relacionadas',
        noInstitutions: 'Este estudiante todavía no tiene instituciones relacionadas.',
      },
    },
    suspensionRequests: {
      roles: { admin: 'Admin', institutionAdmin: 'Institución', teacher: 'Docente', student: 'Estudiante', apiClient: 'API' },
      kpis: {
        open: {
          badge: 'Pendientes',
          title: 'Peticiones por revisar',
          description: 'Cuentas suspendidas que escribieron al correo de soporte.',
        },
        reviewed: {
          badge: 'Revisadas',
          title: 'Peticiones atendidas',
          description: 'Señales ya marcadas como revisadas por el equipo.',
        },
        total: {
          badge: 'Historial',
          title: 'Total recibido',
          description: 'Registro operativo sin guardar el mensaje enviado por email.',
        },
      },
      heading: {
        title: 'Revisión de suspensión',
        description:
          'Usa esta cola para saber quién ya envió su explicación. El contenido está en el email de soporte.',
      },
      table: {
        headers: {
          account: 'Cuenta',
          type: 'Tipo',
          institution: 'Institución',
          supportEmail: 'Correo de soporte',
          submitted: 'Enviada',
          status: 'Estado',
          action: 'Acción',
        },
        reviewed: 'Revisada',
        reviewEmail: 'Revisar email',
        alreadyReactivated: 'Cuenta ya reactivada.',
        done: 'Listo',
        markReviewed: 'Marcar revisada',
        empty: 'No hay peticiones de retiro de suspensión registradas.',
      },
      footnote:
        'Esta vista no guarda la explicación del usuario. Sólo muestra que la solicitud fue enviada; el mensaje completo queda en el correo configurado para soporte.',
    },
  },

  institution: {
    layout: {
      title: 'Workspace institucional',
      description: 'Operación, certificados y automatización',
    },
    approvalGate: {
      suspended: {
        title: 'Institución suspendida',
        description:
          'Tu institución está suspendida temporalmente. Cursos, Certificados y Badges estarán bloqueados hasta que un admin la reactive.',
      },
      pending: {
        title: 'Institución pendiente de aprobación',
        description:
          'Podés ingresar al workspace y completar la configuración, pero Cursos, Certificados y Badges estarán disponibles cuando un admin apruebe tu institución.',
      },
    },
    rejectionNotice: {
      title: 'Solicitud institucional rechazada',
      reviewProfile: 'Revisar perfil',
    },
    dashboard: {
      noCredits: 'Sin saldo TSC.',
      lowCredits: 'Saldo TSC bajo.',
      noCreditsBody: 'Compra un paquete para poder emitir nuevos certificados.',
      lowCreditsBody: 'Te quedan {balance} TSC. Recarga tu cuenta para evitar interrupciones.',
      buyTsc: 'Comprar TSC',
      quickActions: {
        title: 'Acciones rápidas',
        issue: { title: 'Emitir certificado', hint: 'Manual o vía API' },
        invite: { title: 'Invitar estudiantes', hint: 'Importar CSV / SSO' },
        wallet: { title: 'Gestionar wallet', hint: 'Custodia Tessera' },
      },
      summary: {
        title: 'Resumen',
        live: 'Métricas en tiempo real desde la API.',
        unavailable: 'No se pudieron cargar las métricas.',
      },
      stats: {
        issuedThisMonth: 'Emitidos este mes',
        issuedTotalHint: 'Total histórico: {total}',
        students: 'Estudiantes',
        studentsHint: 'Registrados en cursos · {count} miembros del equipo',
        tscAvailable: 'TSC disponible',
        rechargeToIssue: 'Recarga para emitir',
        approxDaysHint: '≈ {value} al ritmo actual',
        moreThanYear: '> 1 año',
        daysUnit: '{days} días',
        emissionsRemainingOne: '1 emisión restante',
        emissionsRemainingMany: '{count} emisiones restantes',
        lowBadge: 'Bajo',
        queuedFailed: 'En cola / fallidos',
        queuedFailedHint: '{count} revocados históricos',
      },
      recentActivity: {
        title: 'Actividad reciente',
        description: 'Últimos certificados procesados por tu institución',
        viewAll: 'Ver todo',
        headers: { student: 'Estudiante', certificate: 'Certificado', token: 'Token', ago: 'Hace', status: 'Estado' },
        empty: {
          title: 'Aún no has emitido certificados',
          description: 'Comienza emitiendo manualmente desde el panel o conecta tu LMS vía API key.',
          issueManual: 'Emitir manual',
          createApiKey: 'Crear API Key',
        },
      },
      status: {
        issued: 'Emitido',
        queued: 'En cola',
        processing: 'Procesando',
        failed: 'Falló',
        revoked: 'Revocado',
      },
      setup: {
        title: 'Setup recomendado',
        issueFirst: 'Emitir tu primer certificado',
        buyTscItem: 'Comprar TSC',
        createApiKeyItem: 'Crear una API key para tu LMS',
        configureWebhooksItem: 'Configurar webhooks para eventos en tiempo real',
      },
      planUsage: {
        title: 'Plan & uso',
        subscriptionQuota: 'Cuota de suscripción',
        noSubscription: 'No tienes suscripción activa. Puedes emitir con TSC prepagados cuando tengas saldo.',
        viewPlan: 'Ver mi plan',
        getPlan: 'Contratar un plan',
      },
    },
  },
};
