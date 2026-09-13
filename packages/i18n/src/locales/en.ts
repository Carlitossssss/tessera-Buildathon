/**
 * English — the default language of Tessera.
 *
 * This file is the source of truth for the shape of every dictionary: the
 * `Dictionary` type is derived from it, so a key added here and missing in
 * another language becomes a compile error rather than a blank label in
 * production.
 *
 * Keys are grouped by where they appear, not by word, so translating a screen
 * means reading one block instead of hunting through an alphabetical list.
 *
 * What is NOT translated: product and protocol names —Tessera, Badges, Wallet,
 * Analytics, Templates, API Keys, Webhooks, Changelog, Polygon, Arweave, IPFS,
 * LinkedIn— stay as they are in both languages. They are names, not words: a
 * user looking for "Webhooks" in the docs would not find "Ganchos web".
 */
export const en = {
  /** Language switcher and anything about languages itself. */
  language: {
    label: 'Language',
    english: 'English',
    spanish: 'Spanish',
    /** Announced to screen readers after switching. */
    changed: 'Language changed to English',
  },

  /** Words that appear across the whole product. */
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    back: 'Back',
    next: 'Next',
    loading: 'Loading…',
    search: 'Search',
    confirm: 'Confirm',
    copy: 'Copy',
    copied: 'Copied',
    open: 'Open',
    retry: 'Retry',
    optional: 'optional',
    required: 'required',
    notFound: 'The requested page does not exist.',
  },

  /** Main navigation of the dashboards, grouped by role. */
  nav: {
    /** Section headings of the sidebar. */
    sections: {
      workspace: 'Workspace',
      economy: 'Economy',
      integration: 'Integration',
      configuration: 'Settings',
      myAccount: 'My account',
      learning: 'Learning',
      myCredentials: 'My credentials',
      platform: 'Platform',
      system: 'System',
    },

    institution: {
      home: 'Home',
      certificates: 'Certificates',
      courses: 'Courses',
      students: 'Students',
      badges: 'Badges',
      credits: 'Credits',
      wallet: 'Wallet',
      analytics: 'Analytics',
      revenue: 'Revenue',
      templates: 'Templates',
      apiKeys: 'API Keys',
      webhooks: 'Webhooks',
      documentation: 'Documentation',
      profile: 'Profile',
      team: 'Team',
      plan: 'Plan and billing',
    },

    teacher: {
      panel: 'Dashboard',
      myCourses: 'My courses',
      students: 'Students',
      grading: 'Grading',
      gradingBadge: 'Pending',
      myProfile: 'My profile',
    },

    student: {
      home: 'Home',
      myCourses: 'My courses',
      availableCourses: 'Available courses',
      credentials: 'Credentials',
      badges: 'Badges',
      wallet: 'Wallet',
      profile: 'Profile',
      privacy: 'Privacy',
    },

    admin: {
      home: 'Home',
      institutions: 'Institutions',
      certificates: 'Certificates',
      users: 'Users',
      suspensionRequests: 'Suspension review',
      plans: 'Plans',
      alerts: 'Alerts',
      health: 'API health',
    },
  },

  /** The dashboard frame: header, user menu, side panel. */
  shell: {
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    home: 'Tessera home',
    profile: 'Profile',
    privacy: 'Privacy',
    signOut: 'Sign out',
    help: {
      title: 'Need help?',
      body: 'Priority support according to your plan.',
    },
    /** Why a section is unavailable. Each one explains what to do next. */
    blocked: {
      pending:
        'Your institution is pending approval. Courses, certificates and badges will be available once an admin approves it.',
      rejected:
        'Your institution request was rejected. Check the profile to read the comment and correct the information.',
      profileRequired:
        'Complete the institutional validation in your profile to submit the university for review.',
      suspended:
        'This institution has been suspended. Courses, students and grading are temporarily unavailable.',
      teacherProfile: 'Complete your teaching profile to enable these options.',
      studentProfile: 'Complete your profile to submit your details for review.',
      studentRejected: 'Your profile needs corrections before home and courses are enabled.',
      studentPending:
        'Your profile is under review. Home and courses will be enabled once an admin approves it.',
    },
    suspendedNotice: {
      title: 'This institution has been suspended.',
      body: 'Course, student and grading actions will be blocked until Tessera reactivates the institution.',
    },
  },

  /** Sign in, sign up and everything around the authentication screens. */
  auth: {
    /** The frame both screens share. */
    layout: {
      secureAccess: 'Secure access',
      footer: 'Verifiable credentials on-chain',
    },

    /** Account-type tabs. */
    roles: {
      ariaLabel: 'Account type',
      institution: 'Institution',
      student: 'Student',
      teacherChip: 'Teacher access',
    },

    /** Shared form fields. */
    fields: {
      email: 'Email',
      institutionalEmail: 'Institutional email',
      password: 'Password',
      fullName: 'Your name',
      institution: 'Institution',
      forgot: 'Forgot it?',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      passwordHint: 'One uppercase letter, one number, at least 8 characters.',
      passwordPlaceholder: 'At least 8 characters',
    },

    /** Validation messages. They are read by a person, so they say what to fix. */
    validation: {
      invalidEmail: 'Invalid email',
      minChars: 'At least 8 characters',
      minTwoChars: 'At least 2 characters',
      needsUppercase: 'Must include an uppercase letter',
      needsNumber: 'Must include a number',
      acceptTerms: 'You must accept the terms',
      institutionalEmailRequired: 'Use an institutional email to create a workspace',
    },

    /** Sign in. */
    login: {
      submit: 'Sign in',
      validating: 'Validating…',
      acceptingInvite: 'Accepting invitation…',
      noAccount: "Don't have an account?",
      createStudent: 'Create a student account',
      createInstitution: 'Create an institutional workspace',
      titles: {
        institution: {
          eyebrow: 'Institutional workspace',
          title: 'Welcome back',
          sub: 'Access your institution console for issuing, auditing and verification.',
        },
        student: {
          eyebrow: 'Your verifiable portfolio',
          title: 'Hello again',
          sub: 'Sign in to review and share your on-chain credentials.',
        },
        teacher: {
          eyebrow: 'Teacher access',
          title: 'Sign in as a teacher',
          sub: 'Your institution invited you to validate submissions and request issuances.',
        },
      },
      teacherWall: {
        badge: 'Teacher access',
        title: 'Your institution must register you before you can sign in as a teacher.',
        body: 'Use the email you were invited with and the password the administrator shared with you. If you still cannot get in, ask them to check your access from Team or to reset your password.',
      },
      toasts: {
        invalidCredentials: 'Invalid credentials. Check your email and password.',
        noApi: 'We could not reach the API. Check that the server is running.',
        noSession: 'We could not create the local session. Please try again.',
        inviteAccepted: 'Invitation accepted',
        inviteFailed: 'We could not accept the invitation',
        signedIn: 'Signed in',
      },
      placeholders: {
        student: 'you@email.com',
        teacher: 'teacher@institution.edu',
        institution: 'you@institution.edu',
      },
    },

    /** Sign up. */
    register: {
      titles: {
        institution: {
          eyebrow: 'Institutional provisioning',
          title: 'Activate your workspace',
          sub: 'Set up your organisation, invite your team and issue credentials in minutes.',
        },
        student: {
          eyebrow: 'Your verifiable portfolio',
          title: 'Create your account',
          sub: 'Gather your credentials in a shareable profile, verifiable on-chain.',
        },
        teacher: {
          eyebrow: 'Teacher access',
          title: 'Invitation required',
          sub: 'Teachers are registered from their institution workspace.',
        },
      },
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
      createWorkspace: 'Create a free workspace',
      startPlan: 'Start the {plan} plan',
      creatingWorkspace: 'Creating workspace…',
      createStudent: 'Create a student account',
      creatingPortfolio: 'Creating your portfolio…',
      createTeacher: 'Create a teacher account',
      creatingAccount: 'Creating account…',
      accept: {
        prefix: 'I accept the',
        terms: 'Terms',
        and: 'and the',
        privacy: 'Privacy Policy',
      },
      strength: {
        weak: 'Weak',
        fair: 'Fair',
        good: 'Good',
        strong: 'Strong',
        excellent: 'Excellent',
      },
      verify: {
        title: 'Check your inbox',
        body: 'We sent a 6-digit code to',
        bodyEnd: '. The account will only be created once you verify it.',
        codeLabel: 'Verification code',
        submit: 'Verify and create account',
        verifying: 'Verifying…',
        edit: 'Edit details',
      },
      teacherWall: {
        badge: 'No self sign-up',
        title: 'Teachers do not sign up on their own. They receive an invitation from their institution.',
        body: 'If you are an institution and need to register your teachers, create your workspace and use it from the panel',
        panel: 'Team · Teachers',
        cta: 'Create an institutional workspace →',
      },
      invite: {
        validating: 'Validating invitation…',
        needLink: 'You need an invitation link to create a teacher account.',
        wrongRole: 'This email already belongs to an account with a different role.',
        loadFailed: 'We could not load the invitation',
        existingPrefix: 'An account already exists for',
        existingSuffix: '. Sign in to accept the invitation.',
        invitedCourse: 'Invited course:',
        signInAndAccept: 'Sign in and accept',
        invitationFor: 'Invitation for',
        institution: 'Institution:',
        course: 'Course:',
      },
      toasts: {
        codeSent: 'We sent you a code to verify your email.',
        createFailed: 'We could not create your account',
        verifyFailed: 'We could not verify the code',
        verifiedSignIn: 'Email verified. Sign in to continue.',
        workspaceCreated: 'Workspace created. You can finish setting it up while it awaits approval.',
        portfolioReady: 'All set! Your portfolio is waiting.',
        teacherCreated: 'Teacher account created. Sign in to continue.',
        teacherCreatedProfile: 'Teacher account created. Complete your profile to continue.',
        teacherFailed: 'We could not create your teacher account',
      },
    },

    /** Right-hand panel of the auth screens. */
    aside: {
      institution: {
        title: 'Professional-grade operations.',
        description:
          'Issuing, revocation, auditing and public verification in a workspace built for academia, product and compliance.',
        bullets: {
          sla: '99.9% SLA · full audit trail',
          roles: 'Roles, SSO and API keys',
          wallets: 'Custodial wallets · no key management',
        },
      },
      student: {
        title: 'Your credentials, yours forever.',
        description:
          'Receive certificates that verify in seconds and share them on LinkedIn, GitHub or your portfolio.',
        bullets: {
          onchain: 'Verifiable on-chain',
          linkedin: 'Ready for LinkedIn',
          yours: 'They stay with you',
        },
        mockRecipient: 'You',
        mockCourse: 'Your next achievement',
      },
      teacher: {
        title: 'Request issuances with institutional backing.',
        description:
          'Your institution invited you to validate submissions and request certificate issuances within your assigned courses.',
        bullets: {
          linked: 'Linked to your institution',
          doubleSign: 'Approvals with double signature',
          cohort: 'Traceability by cohort',
        },
      },
    },
  },

  /**
   * Public marketing pages.
   *
   * Not translated here, on purpose: the testimonial quotes (they are what a
   * named person said — translating a quote changes their words), the
   * wordmarks of the ecosystem strip (company names) and the code sample in
   * the features grid (it is code, not interface).
   */
  marketing: {
    /** Institutions landing hero. */
    hero: {
      eyebrow: 'Infrastructure for verifiable credentials',
      title: 'Issue and verify credentials on-chain, to institutional standard.',
      body: 'Tessera turns certificates, badges and records into auditable, shareable credentials that are ready for compliance. API, custody, issuing and public verification in a single operational layer.',
      signals: {
        custody: 'Optional custody and per-student wallets',
        api: 'API, signed webhooks and full traceability',
        storage: 'Arweave + IPFS with immediate public verification',
      },
      ctaPrimary: 'Create an institutional account',
      ctaSecondary: 'See plans and SLA',
      stats: {
        issued: 'Certificates issued',
        uptime: 'API uptime',
        emission: 'Issuing time',
      },
      compliance: 'ERC-5192 · OpenZeppelin audit · GDPR compliant',
      panel: {
        webhookEvents: 'Webhook events',
        activeNetwork: 'Active network',
        status: 'Status',
        operational: 'Operational',
        audit: 'Audit',
        auditValue: 'Trail active · 24/7',
        verification: 'Verification',
        verificationValue: 'Public QR · ready',
      },
    },

    /** Student landing hero. */
    studentHero: {
      titleStart: 'A diploma that',
      titleAccent: 'nobody can forge',
      body: 'Your certificates stop being a PDF anyone can edit. They become credentials signed on-chain that an employer checks in seconds, without calling you or writing to us.',
      signals: {
        verifiable: 'Verifiable by anyone, in seconds',
        linkedin: 'With a professional preview for LinkedIn',
        forever: 'Yours forever, even if Tessera is gone',
      },
      ctaPrimary: 'Create my portfolio for free',
      ctaSecondary: 'I am an institution',
      free: 'Free for students · no wallet or blockchain knowledge needed',
      proof: {
        verification: {
          title: 'Public verification',
          body: 'Anyone can check a credential, in seconds.',
        },
        onchain: {
          title: 'On-chain credentials',
          body: 'Recorded across several blockchains for more security and transparency.',
        },
        fast: {
          title: 'Fast issuing',
          body: 'Turn your achievements into credentials in under 10 seconds.',
        },
      },
      tagline: 'Real achievements. Opportunities without limits.',
      poweredBy: 'Powered by',
    },

    /** PDF versus SBT comparison. */
    problem: {
      eyebrow: 'The problem',
      title: 'The degree you worked so hard for fits in a file anyone can forge.',
      body: 'A PDF proves nothing on its own. Tessera changes the format, not the effort behind it.',
      old: {
        title: 'The PDF certificate',
        subtitle: 'as it is today',
        items: {
          edited: 'A PDF can be edited in two minutes with any editor',
          phone: 'Verifying means phoning the institution',
          lost: 'If you lose the file, you lost the achievement',
          proof: 'Nothing proves the degree is really yours',
        },
      },
      new: {
        title: 'The SBT credential',
        subtitle: 'with Tessera',
        items: {
          signed: 'Signed on-chain: altering it is impossible',
          selfCheck: 'Anyone checks it themselves, in seconds',
          lives: 'It lives on the blockchain, not on your hard drive',
          soulbound: 'Soulbound: tied to you, non-transferable',
        },
      },
    },

    /** Student journey, four steps. */
    journey: {
      eyebrow: 'How it works',
      title: 'From your diploma to the blockchain, without having to understand the blockchain.',
      step: 'Step',
      steps: {
        finish: {
          title: 'You finish your course',
          body: 'Your institution issues the credential from Tessera. You do not have to do anything at all.',
        },
        receive: {
          title: 'You receive your credential',
          body: 'It arrives by email with a wallet already created for you. No seed phrases, no fees, no cryptocurrency.',
        },
        share: {
          title: 'You share it wherever you want',
          body: 'A link with a professional preview for LinkedIn, your CV or your portfolio. It looks good everywhere.',
        },
        verify: {
          title: 'Anyone verifies it',
          body: 'The employer opens the link and checks its authenticity instantly, straight against the blockchain.',
        },
      },
    },

    /** Standards and trust pillars. */
    trust: {
      eyebrow: 'Under the hood',
      title: 'We are not asking you to trust us.',
      body: 'Everything rests on public, auditable standards. If Tessera disappeared tomorrow, your credentials would still be verifiable.',
      pillars: {
        soulbound: 'Soulbound. The credential stays bound to its owner: it cannot be sold, transferred or lent.',
        standards: 'Open standards that any wallet, explorer or indexer in the ecosystem understands.',
        polygon: 'A public, low-cost network. Verifying does not depend on our servers or our permission.',
        hash: 'The file identifier is derived from its content. A single altered byte changes the CID.',
        storage: 'The metadata and the certificate design stay replicated and permanently accessible.',
        signature: 'Every issuance is signed with a per-institution nonce. Nobody can reuse or duplicate a signature.',
      },
    },

    /** Platform features grid. */
    features: {
      eyebrow: 'Platform',
      title: 'The complete infrastructure for issuing credentials with superpowers.',
      body: 'Designed so your product, engineering and compliance teams work without friction.',
      cells: {
        soulbound: {
          eyebrow: 'Soulbound · ERC-5192',
          title: 'Credentials that cannot be transferred or forged.',
          description: 'Every certificate is minted on Polygon through our standard, reviewed by OpenZeppelin. Neither the owner can resell it, nor a hacker clone it.',
        },
        storage: {
          eyebrow: 'Permanent storage',
          title: 'Arweave + IPFS, double redundancy.',
          description: 'Metadata lives forever on Arweave and is synced to IPFS. Zero recurring cost, maximum durability.',
          permanent: 'permanent',
          replicated: 'replicated',
        },
        webhooks: {
          eyebrow: 'Webhooks · HMAC SHA-256',
          title: 'Integrate your LMS in minutes.',
          description: 'Signed events, exponential retries, idempotency by header.',
        },
        gdpr: {
          eyebrow: 'GDPR · Off-chain PII',
          title: 'Comply without sacrificing verifiability.',
          description: 'Only the hash is published on-chain. Deletion and consent automated.',
        },
        api: {
          eyebrow: 'API · 99.9% uptime',
          title: 'Latency under 60s end-to-end.',
          description: 'Async queue, BullMQ and observability with OpenTelemetry.',
        },
        verification: {
          eyebrow: 'Public verification',
          title: 'Share a link, turn verification into marketing.',
          description: 'Dynamic Open Graph, signed QR and embeddable badge.',
        },
      },
    },

    /** Four-step issuing flow. */
    howItWorks: {
      eyebrow: 'Flow',
      title: 'From template to public QR in four steps.',
      body: 'No Web3 knowledge required. The crypto complexity is fully abstracted away.',
      step: 'Step',
      steps: {
        template: {
          title: 'Upload your template',
          description: 'Import the design, define the metadata and connect your institution. Our editor generates production-ready ERC-721 JSON.',
        },
        launch: {
          title: 'Launch an issuance',
          description: 'Upload a CSV or call the /v1/certificates/issue endpoint. We process in batches and handle gas and retries for you.',
        },
        mint: {
          title: 'We mint on-chain',
          description: 'Tessera mints on Polygon as an SBT (ERC-5192) and publishes metadata to Arweave + IPFS with double pinning.',
        },
        verify: {
          title: 'Public verification',
          description: 'Your student gets a link and a signed QR. Any recruiter verifies authenticity without creating an account.',
        },
      },
    },

    /** Student-facing feature grid. */
    studentFeatures: {
      eyebrow: 'Your professional portfolio',
      title: 'Much more than a PDF',
      body: 'Your certificates become verifiable, shareable and permanent assets. Made so the world trusts your achievements without asking for explanations.',
      items: {
        verifiable: {
          title: 'Verifiable credentials',
          desc: 'Every certificate is signed on-chain. Anyone can check its authenticity without depending on Tessera.',
        },
        linkedin: {
          title: 'Ready for LinkedIn',
          desc: 'Share your achievement with a professional preview. It generates more visibility and real opportunities.',
        },
        unforgeable: {
          title: 'Impossible to forge',
          desc: 'ERC-5192 (soulbound) standard. Nobody can transfer, duplicate or tamper with your credential.',
        },
        noWallet: {
          title: 'No wallet needed',
          desc: 'Tessera holds your credentials for you. Whenever you want, you can link your own wallet.',
        },
        forever: {
          title: 'It stays forever',
          desc: 'Archived on Arweave + IPFS. Even if the platform changes, your credential remains verifiable.',
        },
        publicPage: {
          title: 'A public page per achievement',
          desc: 'Every certificate has its own URL with a verification QR, ready for your CV or portfolio.',
        },
      },
      institutionQuestion: 'Are you an institution? See',
      institutionLink: 'Tessera for institutions →',
    },

    /** Ecosystem strip. */
    ecosystem: {
      title: 'Built on the best pieces of the ecosystem',
    },

    /**
     * Live verification demo on the landing page. It does not touch the
     * network: it replays the exact sequence that /verify runs, so the field
     * labels are interface (translated) while the sample values are example
     * data, kept as authored.
     */
    verifyDemo: {
      steps: {
        readToken: { label: 'Reading the token on-chain', detail: 'ownerOf(1) · TesseraCertificate' },
        resolveMetadata: { label: 'Resolving the metadata', detail: 'tokenURI → public JSON' },
        compareHash: { label: 'Comparing cryptographic fingerprint', detail: 'sha256 of the certificate vs. CID' },
        checkLock: { label: 'Checking the soulbound lock', detail: 'ERC-5192 · locked = true' },
      },
      fields: {
        student: 'Student',
        program: 'Program',
        institution: 'Institution',
        issued: 'Issued',
        network: 'Network',
        standard: 'Standard',
      },
      idle: {
        title: 'Verify a real certificate',
        body: 'Enter the link or scan the QR code of any credential issued on Tessera.',
        cta: 'Run verification',
        note: 'No account. No permissions. Just the truth.',
      },
      result: {
        authentic: 'Authentic credential',
        valid: 'valid',
        repeat: 'Repeat',
      },
    },

    /** Testimonials: only the section heading is translated. */
    testimonials: {
      eyebrow: 'What they say',
      title: 'Academic and product teams already issuing on Tessera.',
    },

    /** Plans and TSC packages. */
    pricing: {
      eyebrow: 'Plans',
      title: 'Honest pricing. No surprises on gas.',
      body: 'You pay the subscription, we absorb the gas on Polygon. Each certificate consumes exactly {tsc} TSC.',
      recommended: 'Recommended',
      discount: 'Discount -',
      perMonth: '/mo',
      custom: 'Custom',
      packages: {
        eyebrow: 'TSC packages',
        title: 'Buy coins without a subscription',
        body: 'For one-off campaigns or institutions that prefer to top up when they need it. Purchased TSC are credited to the institutional wallet and each certificate consumes {tsc} TSC.',
        toIssue: 'TSC to issue whenever you need them.',
        estimated: 'estimated certificates',
        validity: 'Validity: {months} months',
        noRenewal: 'No automatic renewal',
      },
      pageTitle: 'One price per institution, not per student.',
      pageBody: 'Honest pricing, no surprises on gas. Choose between {plans} depending on your volume. Each certificate consumes exactly {tsc} TSC and every plan states its current minimum commitment.',
      defaultPlans: 'Essential, Growth, Institutional and Scale',
    },

    /** Closing call to action, institutions. */
    cta: {
      eyebrow: 'Start today',
      title: 'The next generation of credentials is issued on Tessera.',
      body: 'Create your free account, issue your first SBT certificate in under 5 minutes and leave forgeable PDFs behind.',
      primary: 'Create a free account',
      secondary: 'Talk to sales',
    },

    /** Closing call to action, students. */
    studentCta: {
      eyebrow: 'Your portfolio is waiting',
      title: 'Start with your first verifiable achievement. It is free forever.',
      body: 'Create your account, connect the certificates you already have and start sharing them with a professional preview on LinkedIn.',
      primary: 'Create my portfolio for free',
      secondary: 'I already have an account',
      noCard: 'No card · no wallet · no small print',
    },

    /** Frequently asked questions. */
    faq: {
      title: 'Objections answered before your first issuance.',
      body: 'This part matters too: blockchain, compliance and payments usually sound complex. Here we make it clear, direct and verifiable for a serious buyer.',
      card: {
        title: 'Built for institutional sales',
        body: 'Compliance, custody, gas and operational continuity',
      },
      items: {
        wallet: {
          q: 'Do my students need to have a wallet?',
          a: 'No. Tessera creates custodial wallets by default. If a student wants full autonomy, they can link their own wallet (MetaMask, Coinbase, etc.).',
        },
        shutdown: {
          q: 'What happens if Tessera stops operating?',
          a: 'The certificates remain valid forever. The metadata lives on Arweave (permanent storage), the smart contract on Polygon is public, and anyone can verify on-chain without our involvement.',
        },
        gdpr: {
          q: 'How do you comply with GDPR if the data is on a blockchain?',
          a: 'Only the certificate hash and the recipient wallet are stored on-chain. PII (name, email, photo) lives off-chain in our encrypted database. We support the mandatory export and deletion endpoints from day one.',
        },
        lms: {
          q: 'Can I use it from my current LMS (Moodle, Canvas, etc.)?',
          a: 'Yes. Our public v1 API lets you issue and verify certificates from any system. HMAC-signed webhooks notify events in real time.',
        },
        gas: {
          q: 'Who pays for the Polygon gas?',
          a: 'Each issuance consumes the current TSC cost set by Tessera. The institution does not need to top up MATIC: Tessera covers the gas internally.',
        },
        payments: {
          q: 'How are students charged for paid courses?',
          a: 'We use Stripe to process payments. The applicable tax and billing conditions depend on your jurisdiction.',
        },
      },
    },
  },

  /**
   * Public pages that are not marketing: verification, legal, changelog,
   * developer docs and the open course catalogue.
   */
  public: {
    /** Certificate verification. */
    verify: {
      eyebrow: 'On-chain verification',
      title: 'Verify certificate',
      body: 'Check the authenticity of any certificate issued on Tessera. We verify the SBT status directly on the blockchain, and the contract stores on-chain which institution issued it: if Tessera disappeared, the certificate would still say who granted it.',
      howTitle: 'How verification works',
      steps: {
        id: {
          title: 'Get the ID',
          desc: 'Every certificate has a unique Token ID. You will find it on the certificate, the badge or in the verification URL.',
        },
        onchain: {
          title: 'Verify on-chain',
          desc: 'We query the smart contract to confirm the SBT exists, who issued it and that it has not been revoked.',
        },
        independent: {
          title: 'Independent validation',
          desc: 'You can check it yourself in the explorer with the transaction hash. You do not need to trust Tessera.',
        },
      },
      form: {
        card: {
          eyebrow: 'On-chain verification',
          title: 'Verify certificate',
          body: 'Check the authenticity of any certificate issued on Tessera. Choose one of the three methods: enter the transaction hash, upload the certificate (image or PDF) with its QR, or scan it directly with your camera.',
        },
        hashLabel: 'Polygon transaction hash',
        verifying: 'Verifying…',
        verifyByHash: 'Verify by hash',
        upload: {
          processing: 'Processing the file and looking for a QR…',
          title: 'Click to upload a file',
          body: 'Or drag and drop here. PNG, JPG, WebP or PDF. We detect the QR automatically.',
        },
        camera: {
          title: 'Open the camera to scan a QR',
          body: 'Point the camera at the certificate QR code. We detect the token automatically.',
        },
        tabs: {
          txhash: 'Tx Hash',
          file: 'Upload file',
          camera: 'Scan QR',
        },
        errors: {
          verifyFailed: 'Error verifying the certificate.',
          fileType: 'Only images (PNG, JPG, WebP) or PDF files are allowed.',
          noQrPdf: 'No QR code was found in the PDF. Check that the certificate includes a visible QR.',
          noQrImage: 'No QR code was found in the image. Make sure the image contains the certificate QR.',
          invalidQrFile: 'The detected QR does not contain a valid certificate identifier. Content: ',
          invalidQrScan: 'The scanned QR does not contain a valid certificate identifier. Content: ',
          fileFailed: 'Error processing the file.',
        },
      },
      /** Verification-by-token page (/verify/[tokenId]). */
      result: {
        verifying: 'Verifying certificate #{id}…',
        certificateTitle: 'Certificate #{id}',
      },
      /**
       * On-chain provenance panel. Contract method names —certificateIssuer(),
       * isApprovedInstitution(), locked()— are not translated: they are real
       * Solidity function names, not interface text.
       */
      provenance: {
        loading: 'Reading provenance on-chain…',
        title: 'On-chain provenance',
        body: 'Everything below is read from the contract, not from the Tessera database. If this server disappeared, the answer would still be the same.',
        issuedBy: 'Issued by',
        issuerApproved: 'Issuer authorised',
        approvedYes: 'Yes, in the registry',
        approvedNo: 'Not on record',
        transferable: 'Transferable',
        soulboundYes: 'No · soulbound',
        soulboundNo: 'Yes',
        viewContract: 'View contract',
        checkYourself: 'Check it yourself',
        commandsIntro: 'With Foundry installed, these commands query the chain directly and return the same thing you see above:',
      },
    },

    /**
     * Legal pages.
     *
     * These carry legal weight. The English version is a translation for
     * product consistency and has not been reviewed by counsel: it should be
     * before operating in an English-speaking jurisdiction.
     */
    legal: {
      lastUpdated: 'Last updated:',
      terms: {
        title: 'Terms of Service',
        intro: 'By using Tessera, institutions accept responsibility for the content of the certificates they issue and for obtaining their students consent for the on-chain publication of hashes and wallets.',
        serviceTitle: 'Service',
        serviceBody: 'Tessera provides a SaaS for issuing and verifying educational certificates as Soulbound Tokens on the Polygon blockchain, with metadata stored on Arweave and IPFS.',
        paymentsTitle: 'Payments',
        paymentsBody: 'Subscriptions are billed monthly through Stripe. Free trials do not require a card.',
      },
      privacy: {
        title: 'Privacy Policy',
        intro: 'Tessera processes personal data in accordance with Regulation (EU) 2016/679 (GDPR) and the Spanish Organic Law on Data Protection. PII (name, email, photo) is stored encrypted in our database. Only the certificate hash and the recipient wallet are published on-chain.',
        rightsTitle: 'User rights',
        rightsBody: 'Access, rectification, erasure, portability, objection and restriction. Requests to',
        retentionTitle: 'Retention',
        retentionBody: 'Account data for as long as the institution keeps an active contract. Audit logs 12 months. Encrypted backups 30 days.',
      },
      compliance: {
        title: 'Compliance',
        subtitle: 'Tessera operational and privacy controls.',
        sections: {
          privacy: {
            title: 'Privacy by design',
            body: 'Personal information is kept off-chain. Only a verifiable, non-reversible reference is published on the blockchain.',
          },
          audit: {
            title: 'Audit',
            body: 'Critical actions are recorded with actor, date, target and operational metadata for institutional traceability.',
          },
          continuity: {
            title: 'Continuity',
            body: 'Metadata is backed up in permanent storage and public verifications do not require a user account.',
          },
        },
      },
      cookies: {
        title: 'Cookie Policy',
        intro: 'Tessera uses essential cookies for authentication, security and session preferences. These cookies keep the session active and protect against unauthorised access.',
        analyticsTitle: 'Analytics',
        analyticsBody: 'We may use aggregated analytics to understand performance, errors and general product usage. We do not sell personal data or student profiles.',
        managementTitle: 'Management',
        managementBody: 'You can block cookies from your browser. Some features, such as login or authenticated panels, may stop working correctly.',
      },
    },

    /** Product changelog. */
    changelog: {
      eyebrow: 'Product',
      title: 'Changelog',
      body: 'Record of the main changes to the platform, the API and the issuing experience.',
      entries: {
        v10: {
          issuing: 'Issuing of soulbound certificates on Polygon.',
          verification: 'Public verification by hash, token and QR.',
          courses: 'Public courses, redemption codes and panels per role.',
        },
        v09: {
          webhooks: 'Signed webhooks with retries.',
          tsc: 'Prepaid TSC and institutional ledger.',
          gdpr: 'GDPR export and deletion for students.',
        },
      },
    },

    /** Public API documentation. */
    docs: {
      eyebrow: 'Developers',
      title: 'Public API',
      body: 'Integrate Tessera with your LMS, CRM or back office to issue verifiable credentials, query statuses and automate notifications.',
      createKey: 'Create API key',
      viewDocs: 'View documentation',
      baseEndpoint: 'Base endpoint',
      sections: {
        auth: {
          title: 'Authentication',
          description: 'Use institutional API keys with scopes to issue, query and revoke credentials from your LMS.',
        },
        webhooks: {
          title: 'Signed webhooks',
          description: 'Receive issuing, failure and revocation events with an HMAC signature and automatic retries.',
        },
        verification: {
          title: 'Public verification',
          description: 'Query certificates by token, hash or QR without exposing unnecessary personal information.',
        },
      },
    },

    /** Open course catalogue. */
    courses: {
      eyebrow: 'Open catalogue',
      title: 'Courses verifiable on-chain',
      body: 'Programmes created by real institutions. Enrol with your account and, once you complete it, your certificate becomes available and publicly verifiable.',
      redeemCode: 'I have a redemption code',
      createAccount: 'Create account',
      empty: {
        title: 'There are no public courses yet',
        body: 'Institutions are still preparing their catalogues. Come back soon.',
      },
      visibility: {
        free: 'Free',
        paid: 'Paid',
        hybrid: 'Hybrid',
        membership: 'Membership',
      },
      modules: 'mod.',
      hours: 'h',
      redeem: {
        back: 'Back to catalogue',
        eyebrow: 'Access by code',
        title: 'Redeem course',
        body: 'Paste the code your institution gave you. If it is valid, we enrol you in the course instantly. For hybrid courses you need to be registered as a student of that institution.',
        codeLabel: 'Code',
        submit: 'Redeem code',
        invalidCode: 'Enter a valid code.',
        confirmedPrefix: 'Access confirmed for the course',
      },
    },

    /**
     * Public course detail page and its Unlock gate. `formatPrice` and
     * `formatDuration` (apps/web/src/lib/portal/api.ts) are shared utilities
     * used across the portal library and return hardcoded Spanish text
     * ('Gratis', 'Sin vencimiento', 'año(s)'); making them locale-aware means
     * threading the dictionary through every caller, which stays out of
     * scope for this pass and is documented here as pending.
     */
    courseDetail: {
      backToCatalogue: 'Back to catalogue',
      stats: {
        modules: 'Modules',
        duration: 'Duration',
        passing: 'Passing score',
      },
      coursePlan: 'Course plan',
      enrolment: 'Enrolment',
      membershipPrice: 'Membership',
      priceFree: 'Free',
      enrolmentHint: {
        membership: 'Access is granted by your Unlock membership. Try the sample and unlock the course from the panel on the left.',
        hybrid: 'If you already belong to this institution, you can access it for free. You can also redeem an institutional code.',
        free: 'Open course. Sign in to enrol.',
        paid: 'Sign in and complete the purchase to access the content.',
      },
      getMembership: 'Get membership on Unlock',
      enrolAsStudent: 'Enrol as a student',
      enrolFree: 'Enrol for free',
      signInToContinue: 'Sign in to continue',
      haveCode: 'I have a code',
      gate: {
        fullAccess: 'full access',
        openOfTotal: '{open} of {total} open',
        sampleClosed: 'sample closed',
        loadingSample: 'Loading sample…',
        noContent: 'This module does not have content loaded yet.',
        membershipAccess: 'Access with membership',
        alreadyEnrolledTitle: 'You already have access to this course',
        alreadyEnrolledBody: 'Your membership opened the entire course. Continue where you left off.',
        continueCourse: 'Continue the course',
        deniedTitle: "You don't have the membership yet",
        deniedDefault: 'Get the key on Unlock and come back: access is checked on the blockchain.',
        getMembership: 'Get membership',
        alreadyBought: 'I already bought it',
        signInToContinue: 'Sign in to continue',
        connectWallet: 'Connect wallet',
        verifyMembership: 'Verify my membership',
        installWallet: 'Install a wallet like MetaMask to unlock this course.',
        wrongChainPrefix: 'Your wallet is on',
        wrongChainMid: '; the membership lives on',
        wrongChainEnd: ". We're going to ask you to switch.",
        switchChainPrompt: 'Switch your wallet to {chain} to verify the key.',
        cantReachChain: 'We could not query the blockchain. Try again.',
        needSignature: 'We need your signature to prove the wallet is yours.',
        waitingOnchain: 'We are waiting for the membership to show up on-chain. This can take a few seconds.',
        stillVerifying: 'Still verifying the membership on the blockchain…',
        moduleNeedsMembership: 'This module requires a membership.',
        verifyingOnchain: 'Verifying on the blockchain…',
        signing: 'Signing…',
        enrolling: 'Enrolling…',
        checkedEveryAttempt: 'Access is checked against the Lock contract on every attempt. Tessera does not store permissions: the on-chain key is what decides.',
        row: {
          lock: 'Lock',
          network: 'Network',
          price: 'Price',
          duration: 'Duration',
        },
        badges: {
          sample: 'sample',
          availableInCourse: 'Available in the course',
        },
        steps: {
          wallet: 'Connect wallet',
          check: 'Verify membership on-chain',
          sign: 'Sign ownership',
          open: 'Enrol',
        },
        signInBeforeEnrol: 'Sign in to enrol.',
        studentAccountOnly: 'Only a student account can enrol.',
        completeFailed: 'We could not complete the enrolment.',
      },
    },

    /**
     * Public status page (/status). The shell —labels, states, titles— is
     * translated. `role`, `rationale` and `value` for each network come from
     * the API's health payload (apps/api/src/config/networks.ts) hardcoded
     * in Spanish server-side; bilingualising that text means bilingualising
     * the API response itself, which is out of scope for this frontend pass
     * and stays pending.
     */
    status: {
      eyebrow: 'Status',
      title: 'Service status',
      body: 'Public health check of the API, queue and issuance dependencies.',
      operational: 'Operational',
      degraded: 'Degraded',
      metrics: {
        apiVersion: 'API version',
        response: 'Response',
        network: 'Network',
      },
      checks: {
        db: 'PostgreSQL',
        redis: 'Redis',
        rpc: 'Polygon RPC',
        arweave: 'Arweave',
        signer: 'Signer',
        openbao: 'OpenBao (vault)',
        stripeWebhook: 'Stripe Webhook',
        email: 'SMTP / Email',
      },
      noChecks: 'Could not query the API status.',
      networksTitle: 'Networks and contracts',
      networksBody: 'The same contracts run on four test networks, each with a different purpose. Addresses are public on purpose: anyone can audit the issuance in the explorer without asking us for anything.',
      issuing: 'issuing',
      deployed: 'deployed',
      contracts: {
        registry: 'Registry',
        certificate: 'Certificate',
        badge: 'Badge',
        autoIssuer: 'AutoIssuer',
      },
      verificationUnavailable: "This chain's explorer has code verification out of service; the contracts remain validated on-chain regardless.",
    },
  },

  /**
   * Student panel.
   *
   * Counts come with {n} placeholders and separate singular/plural variants
   * instead of being stitched together from fragments: word order changes
   * between languages, so a sentence built by concatenation translates badly.
   */
  student: {
    layout: {
      title: 'Student space',
      description: 'Verifiable portfolio and active credentials',
    },

    /** Home. */
    home: {
      eyebrow: 'My learning',
      greeting: 'Hello, {name}.',
      fallbackName: 'student',
      subtitle: {
        empty: 'You have no courses yet. Redeem an invitation code to start your first verifiable credential.',
        inProgressOne: 'You have {courses} course under way and {credentials} credential on-chain.',
        inProgressMany: 'You have {courses} courses under way and {credentials} credentials on-chain.',
        completedOne: '{completed} course completed and {credentials} verifiable credential.',
        completedMany: '{completed} courses completed and {credentials} verifiable credentials.',
        failed: 'We could not load your data. Try refreshing in a few seconds.',
      },
      viewCourses: 'View my courses',
      myCredentials: 'My credentials',
      stats: {
        activeCourses: 'Active courses',
        activeCoursesHint: '{n} enrolments in total',
        completed: 'Completed courses',
        average: 'Average {score}',
        noAverage: 'No average yet',
        credentials: 'On-chain credentials',
        inFlight: '{n} in progress',
        allIssued: 'All issued',
        badges: 'Badges',
        pendingGrading: '{n} pending review',
        noPending: 'Nothing pending',
      },
      continueTitle: 'Pick up where you left off',
      continueBody: 'Your courses in progress, ordered by latest activity.',
      viewAll: 'View all',
      noActive: {
        title: 'You have no active courses',
        body: 'Redeem an invitation code from your institution to enrol and start earning credentials.',
      },
      activity: {
        title: 'Recent activity',
        body: 'Your latest assessment attempts.',
        empty: 'You have not submitted any attempts yet.',
        graded: 'Graded',
        submitted: 'Submitted',
      },
      wallet: {
        title: 'Your Tessera wallet',
        body: 'Held securely by Tessera to keep your SBTs and badges on Polygon.',
        address: 'Address',
        detail: 'View wallet details',
        verifiedOn: 'Account verified on {date}',
        unverified: 'Your email is not verified yet',
      },
      startedAgo: 'Started {time}',
      noActivityYet: 'No activity yet',
      modulesOf: '{done} of {total} modules',
    },

    /** Course list. */
    courses: {
      metaTitle: 'My courses',
      eyebrow: 'My courses',
      title: 'Your learning portfolio',
      subtitleEmpty: 'You are not enrolled in any course yet. Redeem a code to get started.',
      subtitleOne: 'You have {total} enrolment: {inProgress} in progress, {completed} completed.',
      subtitleMany: 'You have {total} enrolments: {inProgress} in progress, {completed} completed.',
      empty: {
        title: 'No courses yet',
        body: 'When an institution invites you to a course or gives you a redemption code, it will show up here.',
      },
      groups: {
        inProgress: 'In progress',
        notStarted: 'Not started',
        completed: 'Completed',
      },
      status: {
        suspended: 'Suspended',
        completed: 'Completed',
        inProgress: 'In progress',
        notStarted: 'To start',
        pendingStart: 'Pending start',
      },
      suspendedNotice: 'This institution has been suspended.',
      modules: '{done} / {total} modules',
      completedOn: 'Completed on {date}',
      lastActivity: 'Last activity {time}',
      noActivity: 'No activity',
      score: 'score {n}',
      actions: {
        blocked: 'Blocked',
        view: 'View',
        continue: 'Continue',
        start: 'Start',
      },
      institutionFallback: 'Institution',
    },

    /** Redemption code form. */
    redeem: {
      label: 'Invitation code',
      srLabel: 'Code',
      placeholder: 'E.G. PROD2025',
      submit: 'Redeem',
      hint: 'Ask your institution for the code to enrol in a course.',
      alreadyEnrolled: 'You were already enrolled in this course.',
      created: 'Enrolment created!',
    },

    /** Credentials. */
    credentials: {
      metaTitle: 'My credentials',
      eyebrow: 'Verifiable on-chain',
      title: 'My credentials',
      body: 'Soulbound Tokens (SBT) issued by the institutions where you learned. Each credential is unique, non-transferable and auditable on the networks where it was issued.',
      stats: {
        issued: 'Issued',
        inProgress: 'In progress',
        total: 'Total',
      },
      empty: {
        title: 'You have no credentials yet',
        body: 'Once you complete an approved course and the institution issues your credential, it will show up here.',
      },
      groups: {
        issued: 'Issued',
        inProgress: 'In progress',
        failed: 'With issues',
      },
      status: {
        issued: 'Issued',
        queued: 'Queued',
        processing: 'Processing',
        failed: 'Failed',
        revoked: 'Revoked',
      },
      grade: 'Grade {n}',
      fields: {
        issued: 'Issued',
        yourWallet: 'Your wallet',
        txHash: 'Tx hash',
      },
      networks: 'Networks',
      confirmed: 'confirmed',
      viewSbt: 'View SBT',
      viewTx: 'View transaction',
      publicVerification: 'Public verification',
      copyLink: 'Copy link',
    },

    /** Badges. */
    badges: {
      metaTitle: 'Badges',
      title: 'My badges',
      body: 'Semi-fungible badges awarded for milestones, cohorts or events. You can show them publicly and they stay in your Tessera wallet.',
      empty: {
        title: 'You have no badges yet',
        body: 'Institutions usually award badges for completing workshops, hackathons or cohorts.',
      },
      amount: 'Amount',
      received: 'Received',
      wallet: 'Wallet',
      viewTx: 'View tx',
    },

    /** Wallet. */
    wallet: {
      metaTitle: 'My wallet',
      eyebrow: 'Custodial wallet',
      title: 'Your wallet on Polygon',
      body: 'Tessera keeps your wallet secure so you can receive SBTs and badges without paying gas. Every issuance is verifiable on Polygon.',
      yourAddress: 'Your address',
      notAssigned: 'Not assigned yet',
      copy: 'Copy',
      stats: {
        network: 'Network',
        credentials: 'Credentials (SBT)',
        badges: 'Badges',
      },
      assetsTitle: 'Assets in your wallet',
      assetsBody: 'Soulbound Tokens issued in your name. They are unique and non-transferable.',
      table: {
        credential: 'Credential',
        token: 'Token',
        issued: 'Issued',
        tx: 'Tx',
      },
      empty: {
        title: 'Your wallet is still empty',
        body: 'When you complete an approved course, the issued credentials will show up here.',
      },
      why: {
        title: 'Why a custodial wallet?',
        body: 'You do not need to install MetaMask or manage seed phrases to get started. Your soulbound credentials stay protected by Tessera infrastructure.',
      },
    },

    /** Profile. */
    profile: {
      metaTitle: 'My profile',
      role: 'Student',
      noName: 'No name',
      createdOn: 'Account created on {date}',
      emailVerified: ' · email verified',
      emailUnverified: ' · email not verified',
      loadFailed: 'We could not load your profile right now. Try refreshing.',
      stats: {
        enrolments: 'Enrolments',
        completed: 'Completed courses',
        credentials: 'Credentials',
      },
      rejected: {
        title: 'Your profile needs corrections.',
      },
      pending: 'Your profile is under review by the global administrator.',
      personalTitle: 'Personal information',
      personalBody: 'Your name will appear on the certificates issued from now on. The email requires verification and cannot be changed here.',
      publicTitle: 'Public preferences',
      publicBody: 'These settings control how your profile looks inside Tessera.',
      form: {
        fullName: 'Full name',
        namePlaceholder: 'How you want to appear on your credentials',
        avatarUrl: 'Avatar URL',
        avatarHint: 'Optional. Soon you will be able to upload an image directly.',
        preferredLanguage: 'Preferred language',
        save: 'Save changes',
        saving: 'Saving…',
        saved: 'Profile updated successfully.',
      },
    },

    /** Privacy. */
    privacy: {
      metaTitle: 'Privacy',
      title: 'Privacy and data',
      body: 'Full control over your personal data. You can request a copy, exercise your rights or start permanent deletion.',
      export: {
        title: 'Export my data',
        body: 'Get a file with all your personal data: profile, credentials, activity and preferences. We will email you a link when it is ready (max. 14 days).',
        submit: 'Request export',
        submitting: 'Requesting…',
        requested: 'Request created. We will email you when it is ready.',
      },
      categoriesTitle: 'Your data on Tessera',
      categoriesBody: 'A summary of the categories of information we process and the legal basis for each.',
      categories: {
        profile: {
          label: 'Profile data',
          desc: 'Name, email, language, avatar and linked wallet.',
        },
        onchain: {
          label: 'On-chain credentials',
          desc: 'Token IDs and metadata of your SBTs and badges. They stay on the blockchain by their immutable nature.',
        },
        progress: {
          label: 'Course progress',
          desc: 'Enrolments, attempts, grades and progress by module.',
        },
        session: {
          label: 'Session data',
          desc: 'Access logs anonymised after 90 days.',
        },
      },
      basis: {
        contract: 'Contract',
        legitimate: 'Legitimate interest',
      },
      delete: {
        title: 'Delete my account',
        bodyStart: 'Starts a',
        bodyDays: '30-day',
        bodyEnd: 'deletion process during which you can cancel. On confirmation, your personal data is anonymised. Tokens on the blockchain remain by their immutable nature.',
      },
      contact: 'To exercise your rights or ask a question, write to',
      myAccount: 'My account',
    },

    /** Messages from the server actions. */
    actions: {
      profileFailed: 'We could not update the profile.',
      attemptStartFailed: 'Error starting the attempt',
      attemptSubmitFailed: 'Error submitting the attempt',
      progressFailed: 'We could not record your progress.',
      codeLength: 'The code must be between 4 and 16 characters.',
      redeemFailed: 'We could not redeem the code.',
      exportFailed: 'We could not request the export.',
      deletionFailed: 'We could not start the deletion.',
      cancelDeletionFailed: 'We could not cancel the deletion.',
    },
  },

  /** Public site header. */
  header: {
    nav: {
      courses: 'Courses',
      pricing: 'Pricing',
      verify: 'Verify',
      faq: 'FAQ',
    },
    signIn: 'Sign in',
    signUp: 'Sign up',
    dashboard: 'Dashboard',
    ariaMain: 'Main',
  },

  /** Public site footer. */
  footer: {
    tagline:
      'Verifiable educational certificates on-chain. Soulbound Tokens on Polygon, permanent metadata on Arweave + IPFS, social badges for LinkedIn.',
    rights: 'All rights reserved.',
    product: {
      title: 'Product',
      institutions: 'For institutions',
      howItWorks: 'How it works',
      pricing: 'Pricing',
      api: 'Public API',
    },
    resources: {
      title: 'Resources',
      verify: 'Verify certificate',
      status: 'Service status',
      changelog: 'Changelog',
      support: 'Support',
    },
    legal: {
      title: 'Legal',
      terms: 'Terms',
      privacy: 'Privacy',
      compliance: 'Compliance',
      cookies: 'Cookies',
    },
  },

  /**
   * Restricted-account screen, shown when an admin suspends an account. The
   * server action that submits the appeal (sendRestrictionAppealAction) has
   * no React context, so its fallback error message stays in Spanish,
   * documented in restricted-actions.ts the same way as other server
   * actions in the project.
   */
  account: {
    restricted: {
      title: 'Your account has been suspended',
      subtitle: 'You cannot access Tessera temporarily.',
      reasonLabel: 'Suspension reason',
      fallbackReason: 'The administrator did not provide a specific reason.',
      secure: 'Your certificates and data remain secure.',
      nextTitle: 'What can you do?',
      steps: {
        request: 'Request a review of the suspension.',
        wait: 'You will receive the answer by email.',
      },
      messageLabel: 'Explanation for review',
      messageHelp: 'Briefly tell us why we should review the suspension.',
      messageMinHelp: 'You need to write at least 20 characters to enable sending.',
      messagePlaceholder: 'Add context that helps the team review your account.',
      requestReview: 'Request review',
      sentReview: 'Request sent',
      signOut: 'Sign out',
      note: 'The review can take up to 10 business days.',
      sending: 'Sending request…',
      success: 'Request sent. Wait for the support reply in your email before sending another one.',
      minMessage: 'Write at least 20 characters to send the request.',
    },

    /** Detailed profile form, shared by students and teachers. */
    detailedProfile: {
      countries: {
        AR: 'Argentina', BO: 'Bolivia', BR: 'Brazil', CA: 'Canada', CL: 'Chile',
        CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', EC: 'Ecuador', SV: 'El Salvador',
        ES: 'Spain', US: 'United States', FR: 'France', GT: 'Guatemala', HN: 'Honduras',
        IT: 'Italy', MX: 'Mexico', NI: 'Nicaragua', PA: 'Panama', PY: 'Paraguay',
        PE: 'Peru', PT: 'Portugal', PR: 'Puerto Rico', GB: 'United Kingdom',
        DO: 'Dominican Republic', UY: 'Uruguay', VE: 'Venezuela',
      },
      documentTypes: {
        idCard: 'ID card',
        dni: 'National ID (DNI)',
        passport: 'Passport',
        cedula: 'Cedula',
        other: 'Other',
      },
      fields: {
        firstName: 'First name *',
        lastName: 'Last name *',
        documentType: 'Document type *',
        documentNumber: 'Document number *',
        birthDate: 'Date of birth *',
        phone: 'Phone *',
        country: 'Country *',
        selectCountry: 'Select a country',
        city: 'City *',
        addressLine: 'Address *',
      },
      requiredFields: 'Complete all required fields.',
      changesSaved: 'Changes saved.',
      studentSubmitted: 'Profile submitted for review. We will let you know when the admin approves it.',
      teacherCompleted: 'Profile completed. You can now use the teacher space.',
      saving: 'Saving…',
      saveChanges: 'Save changes',
      submitForReview: 'Submit for review',
      completeProfile: 'Complete profile',
    },
  },

  /** Platform admin dashboards. */
  admin: {
    layout: {
      title: 'Tessera Admin',
      description: 'Platform operations',
    },
    dashboard: {
      pendingInstitutions: {
        badge: 'Pending',
        title: 'Institutions to review',
        description: 'Profiles submitted and ready for approval.',
        deltaLabel: 'this month',
      },
      awaitingCorrections: {
        badge: 'Follow-up',
        title: 'Awaiting corrections',
        description: 'Rejected institutions with observations.',
        deltaLabel: 'this week',
      },
      suspendedAccounts: {
        badge: 'Restricted',
        title: 'Suspended accounts',
        usersInstitutions: '{users} users · {institutions} institutions',
        deltaRequests: 'requests to review',
        deltaNoChange: 'no changes this month',
        deltaThisMonth: 'this month',
      },
      emissionIssues: {
        badge: 'Needs attention',
        title: 'Issuing problems',
        certificatesWebhooks: '{certificates} certificates · {webhooks} webhooks',
        deltaLabel: 'last 24 h',
      },
      issuesRequireReview: '{count} issues require review',
      autoUpdated: 'Automatically updated',
      suspensionRequests: {
        title: 'Suspension review requests',
        description: 'Suspended users who already sent their explanation to the support inbox.',
        viewAll: 'View requests',
        account: 'Account',
        type: 'Type',
        submitted: 'Submitted',
        action: 'Action',
        reviewSupportEmail: 'Check support email',
      },
      pendingInstitutionsTable: {
        title: 'Institutions pending approval',
        description: 'KYC and domain verification',
        viewAll: 'View all',
        institution: 'Institution',
        country: 'Country',
        requested: 'Requested',
        status: 'Status',
        pending: 'Pending',
        review: 'Review',
        empty: 'There are no institutions pending approval.',
      },
    },
    confirmationDialog: {
      close: 'Close',
      cancel: 'Cancel',
      reactivateUser: {
        title: 'Reactivate user',
        description: 'The user will regain full access to their account.',
        status: 'Suspended',
        infoTitle: 'When reactivating the account:',
        infoText: 'They will regain access to their certificates, data and available features.',
        question: 'Do you confirm you want to reactivate this user?',
        submit: 'Reactivate user',
        pending: 'Reactivating…',
      },
      reactivateInstitution: {
        title: 'Reactivate institution',
        description: 'The institution will regain operational access to its workspace.',
        status: 'Suspended',
        infoTitle: 'When reactivating the institution:',
        infoText:
          'The suspension will be lifted from the workspace and from its associated institutional admin.',
        question: 'Do you confirm you want to reactivate this institution?',
        submit: 'Reactivate institution',
        pending: 'Reactivating…',
      },
      delete: {
        title: 'Delete user',
        description: 'The account will be logically deleted from the system.',
        status: 'Active',
        infoTitle: 'When deleting the account:',
        infoText: 'Access will be blocked and the account will stop appearing as an active user.',
        question: 'Do you confirm you want to delete this user?',
        submit: 'Delete user',
        pending: 'Deleting…',
      },
      removeTeamMember: {
        title: 'Remove member',
        description: "This person will lose access to this institution's team.",
        status: 'Team member',
        infoTitle: 'When removing them from the team:',
        infoText:
          'Their access to this institutional workspace will be removed. Their personal account and data will not be deleted.',
        question: 'Do you confirm you want to remove this person from the team?',
        submit: 'Remove member',
        pending: 'Removing…',
      },
      deleteAccount: {
        title: 'Delete my account',
        description: 'Your account will be scheduled for logical deletion.',
        status: 'Personal account',
        infoTitle: 'When deleting your account:',
        infoText:
          'Your access will be blocked and the 30-day period will start before your personal data is anonymised.',
        question: 'Do you confirm you want to delete your account?',
        submit: 'Delete my account',
        pending: 'Scheduling…',
      },
      deleteInstitutionAdminAccount: {
        title: 'Delete my account',
        description:
          'Your account and the associated institution will be scheduled for logical deletion.',
        status: 'Institution admin',
        infoTitle: 'When deleting your account:',
        infoText:
          'Your access will be blocked and the associated institution will stop operating on Tessera. This affects the courses, certificates, team and automations of that workspace.',
        question: 'Do you confirm you want to delete your account and the associated institution?',
        submit: 'Delete account',
        pending: 'Scheduling…',
      },
    },
    suspensionDialog: {
      close: 'Close',
      required: 'required',
      reasonLabel: 'Suspension reason',
      reasonHelp: 'This message will be shown to the user when they try to sign in.',
      placeholder: 'E.g. Unusual activity detected on the account.',
      info: 'Their certificates and data will remain secure during the suspension.',
      later: 'You can reactivate the account later.',
      cancel: 'Cancel',
      invalid: 'Enter a valid suspension reason.',
      suspending: 'Suspending…',
      charactersWritten: '{count} characters written',
    },
    alerts: {
      cards: {
        open: {
          badge: 'Open',
          title: 'Open alerts',
          description: 'Events that require operational attention.',
        },
        critical: {
          badge: 'Critical',
          title: 'Critical errors',
          description: 'Incidents with direct impact.',
        },
        warnings: {
          badge: 'Warnings',
          title: 'Warnings',
          description: 'Preventive system signals.',
        },
      },
      heading: {
        title: 'System alerts',
        description: "Events that require the operations team's attention",
      },
      resolved: 'Resolved',
      resolve: 'Resolve',
    },
    certificates: {
      status: {
        issued: 'Valid',
        revoked: 'Revoked',
        queued: 'Queued',
        processing: 'Processing',
        failed: 'Failed',
      },
      cards: {
        total: {
          badge: 'Total',
          title: 'Total certificates',
          description: 'Credentials registered on the platform.',
        },
        revoked: {
          badge: 'Revoked',
          title: 'Revoked certificates',
          description: 'Credentials invalidated by review.',
        },
        today: {
          badge: 'Today',
          title: 'Issued today',
          description: 'Recent issuances across all institutions.',
        },
      },
      activity: {
        title: 'Certificate activity',
        description: 'Operational breakdown by status and institution.',
      },
      byStatus: 'By status',
      byInstitution: 'By institution',
      list: {
        title: 'Certificates',
        description: 'Showing {shown} of {total} historical records.',
        page: 'Page {page} of {totalPages}',
        noInstitution: 'No institution',
        viewTx: 'View transaction',
        empty: 'No certificates yet.',
        recordsPerPage: '{total} records · {limit} per page',
        previous: 'Previous',
        next: 'Next',
      },
      revocationNotice:
        'On-chain revocation. Revoking calls TesseraCertificate.revoke(tokenId) on Polygon. The token remains in the holder\'s wallet but is marked invalid (ERC-5192 + Revoked event). This action is irreversible.',
    },
    health: {
      status: { healthy: 'Healthy', degraded: 'Degraded' },
      cards: {
        overall: { badge: 'API', title: 'Overall status', description: '{ok}/{total} services OK' },
        version: { badge: 'Version', title: 'API version', description: 'Fastify 5' },
        services: { badge: 'Services', title: 'Services OK', description: 'Currently healthy dependencies.' },
      },
      heading: {
        title: 'Service health',
        description: 'Replica of GET /v1/health — refreshed on page load',
      },
      note: 'In production this panel calls GET /v1/health and refreshes every 30 seconds.',
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
        rpcBlock: 'Polygon — block #{block}',
        dbOk: 'Connection pool active',
        dbDown: 'Connection unavailable',
        redisOk: 'Cache active',
        redisDown: 'Cache unavailable',
        arweaveNotConfigured: 'No JWK wallet; Pinata/IPFS will be used',
        arweaveOk: 'Wallet and gateway reachable',
        arweaveDegraded: 'Gateway or wallet degraded',
        notConfigured: 'Not configured',
        pinataOk: 'Pinata API reachable',
        pinataDegraded: 'Pinata degraded',
        objectStorageMinio: 'Private MinIO configured',
        objectStorageOther: '{status} configured',
        stripeWebhookOk: 'Webhook configured',
        stripeWebhookDown: 'Webhook not configured',
        signerWeb3: 'Web3Signer connected to OpenBao KV',
        signerOpenbao: 'Direct OpenBao fallback configured',
        signerLocal: 'Local development signer',
        emailOk: 'Resend configured',
        emailMock: 'Mock mode',
      },
    },
    plans: {
      cards: {
        costPerCertificate: {
          badge: 'Issuing',
          title: 'Cost per certificate',
          description: 'TSC deducted for every certificate issued.',
        },
        tscValue: {
          badge: 'Nominal',
          title: 'Value per TSC',
          description: 'Stable accounting reference of the internal credit.',
        },
        continuity: {
          badge: 'Reserve',
          title: 'Continuity',
          description: 'Technical reserve per certificate issued.',
        },
        monthlyTsc: {
          badge: 'Plans',
          title: 'Total monthly TSC',
          description: 'Sum of the monthly balance offered by active plans.',
        },
      },
      issuingConfig: {
        title: 'Issuing configuration',
        description: 'This value affects new issuances and the public plan copy.',
      },
      fields: {
        tscPerCertificate: 'TSC per certificate',
        tscNominalValueUsd: 'TSC nominal value USD',
        continuityReserveUsd: 'Continuity reserve USD',
        packageValidityMonths: 'Package validity months',
        currentVersion: 'Current version',
        autoUpdateOnSave: 'Updates automatically on save.',
        name: 'Name',
        monthlyTsc: 'Monthly TSC',
        monthlyPriceUsd: 'Monthly price USD',
        discountPct: 'Discount %',
        extraTscPriceUsd: 'Extra TSC price USD',
        commitmentMonths: 'Commitment months',
        description: 'Description',
        priceUsd: 'Price USD',
        tsc: 'TSC',
        status: 'Status',
        toggleActive: 'Toggle active status',
      },
      subscriptionPlans: {
        title: 'Subscription plans',
        description: 'Edit values visible on the landing page, pricing and subscription checkout.',
      },
      tscPackages: {
        title: 'TSC packages',
        description: 'Configure top-ups purchasable from institutional credits.',
      },
      save: 'Save configuration',
      saved: 'Changes saved',
    },
    institutions: {
      status: { approved: 'Active', pending: 'Pending', suspended: 'Suspended', revoked: 'Revoked' },
      noCountry: 'No country',
      noSubscription: 'No active subscription',
      kpis: {
        active: {
          badge: 'Active',
          title: 'Active institutions',
          description: 'Approved and operating workspaces.',
        },
        pending: {
          badge: 'Pending',
          title: 'Pending approval',
          description: 'Submitted profiles that require review.',
        },
        certificates: {
          badge: 'Issued',
          title: 'Total certificates',
          description: 'Cumulative issuances by institutions.',
        },
      },
      approvalQueue: { title: 'Approval queue', description: 'New institutions that requested access' },
      review: 'Review',
      allInstitutions: {
        title: 'All institutions',
        headers: {
          institution: 'Institution',
          country: 'Country',
          plan: 'Plan',
          certificates: 'Certificates',
          status: 'Status',
          suspension: 'Suspension',
        },
        view: 'View',
      },
      detail: {
        back: 'Back',
        backToList: 'Back to institutions',
        notFoundTitle: 'Institution not found',
        notFoundDescription: 'We could not load this institution from the database.',
        needsProfile: 'The institution must complete its detailed profile',
        approve: 'Approve',
        syncRegistry: 'Sync Registry',
        registrySynced: 'Registry synced: the institution is authorised to issue on Polygon Amoy.',
        createdOn: 'Created {date}',
        stats: { certificates: 'Certificates', members: 'Members', subscription: 'Subscription', status: 'Status' },
        dataTitle: 'Institutional data',
        slug: 'Slug',
        country: 'Country',
        website: 'Website',
        detailedProfile: 'Detailed profile',
        submitted: 'Submitted',
        pending: 'Pending',
        rejectionComment: 'Rejection comment',
        wallet: 'Wallet',
        certificatesByStatusTitle: 'Certificates by status',
        reviewTitle: 'Detailed record for review',
        sentOn: 'Sent {date}',
        notSent: 'Not sent',
        fields: {
          legalName: 'Legal name',
          taxId: 'Tax ID',
          accreditation: 'Registration / accreditation',
          contactName: 'Contact person',
          contactEmail: 'Contact email',
          contactPhone: 'Phone',
          address: 'Address',
          cityRegion: 'City / region',
          postalCode: 'Postal code',
        },
        teamTitle: 'Associated team',
        teamHeaders: { user: 'User', role: 'Role', since: 'Since' },
      },
      reviewAction: {
        waitingChanges: 'Awaiting changes',
        waitingChangesTitle:
          'The institution must correct and resubmit its profile to go back to review.',
        reject: 'Reject',
        rejectTitle: 'Reject institution',
        rejectDescription: 'The institution will receive this comment to correct its request.',
        rejected: 'Institution rejected',
        rejectFailed: 'We could not reject the institution',
        workspaceLabel: 'Institutional workspace',
        pendingStatus: 'Pending',
        reasonLabel: 'Rejection comment',
        reasonHelp: 'This comment will be shown to the institution on its home and profile.',
        placeholder: 'E.g. Missing current accreditation documentation.',
        info: 'The institution will be able to review its details and request a new evaluation.',
        later: 'It will go back to review once the institution corrects and saves its profile.',
        loading: 'Rejecting…',
      },
      suspensionAction: {
        reactivate: 'Reactivate institution',
        suspend: 'Suspend institution',
        reactivated: 'Institution reactivated',
        suspended: 'Institution suspended',
        toggleFailed: 'We could not change the institution status',
        description: 'The institution will temporarily lose operational access.',
        activeStatus: 'Active',
        workspaceLabel: 'Institutional workspace',
      },
    },
    users: {
      roles: {
        institutionAdmin: 'Institution admin',
        teacher: 'Teacher',
        student: 'Student',
        admin: 'Platform admin',
        apiClient: 'API client',
      },
      status: { active: 'Active', restricted: 'Suspended', deleted: 'Deleted' },
      profileStatus: {
        incomplete: 'Incomplete profile',
        pending: 'Profile to review',
        approved: 'Profile approved',
        rejected: 'Profile rejected',
        pendingApproval: 'Pending approval',
        correctionNeeded: 'Correction needed',
        pendingProfile: 'Profile pending',
      },
      kpis: {
        total: { badge: 'Total', title: 'Total users', description: 'Accounts registered on Tessera.' },
        institutionAdmins: {
          badge: 'Institution',
          title: 'Institution admins',
          description: 'People in charge of institutional workspaces.',
        },
        restricted: {
          badge: 'Suspended',
          title: 'Suspended accounts',
          description: 'Users with restricted access.',
        },
      },
      heading: { title: 'User management', description: 'Manage roles, suspensions and account deletion' },
      filters: {
        roles: {
          institutionAdmin: 'Institution admin',
          admin: 'Platform admin',
          apiClient: 'API client',
          teacher: 'Teacher',
          student: 'Student',
        },
        statuses: {
          active: 'Active',
          deleted: 'Deleted',
          profileIncomplete: 'Incomplete profile',
          profilePending: 'Profile to review',
          profileRejected: 'Profile rejected',
          restricted: 'Suspended',
        },
        searchPlaceholder: 'Search by name, email or institution',
        allRoles: 'All roles',
        allStatuses: 'All statuses',
        clear: 'Clear',
      },
      table: {
        headers: {
          user: 'User',
          role: 'Role',
          institution: 'Institution',
          registered: 'Registered',
          status: 'Status',
          suspension: 'Suspension',
        },
        managedByInstitution: 'From institution',
        noActions: 'No actions',
        view: 'View',
        resultsSummary: 'Showing {shown} of {total} result(s) · page {page} of {totalPages}',
        previous: 'Previous',
        next: 'Next',
      },
      actions: {
        notAvailable: 'Action not available',
        reactivate: 'Reactivate user',
        suspend: 'Suspend user',
        suspendTitle: 'Suspend user',
        suspendDescription: 'The user will temporarily lose access to their account.',
        suspendDisabledReason: 'Cannot suspend while the student profile is not approved.',
        active: 'Active',
        reactivated: 'User reactivated',
        suspended: 'User suspended',
        toggleFailed: 'We could not change the user status',
        approveProfile: 'Approve profile',
        reject: 'Reject',
        rejectProfileTitle: 'Reject profile',
        rejectProfileDescription:
          'The comment will be shown to the student so they can correct their details.',
        profileApproved: 'Profile approved',
        profileApproveFailed: 'We could not approve the profile',
        profileRejected: 'Profile rejected',
        profileRejectFailed: 'We could not reject the profile',
      },
      detail: {
        back: 'Back',
        backToList: 'Back to users',
        notFoundTitle: 'User not found',
        notFoundDescription: 'We could not load this user from the database.',
        createdOn: 'Created {date}',
        stats: { role: 'Role', student: 'Student', profile: 'Profile', status: 'Status' },
        profileTitle: 'Student detailed profile',
        rejectionComment: 'Rejection comment',
        fields: {
          firstName: 'First name',
          lastName: 'Last name',
          documentType: 'Document type',
          documentNumber: 'Document number',
          birthDate: 'Date of birth',
          phone: 'Phone',
          country: 'Country',
          city: 'City',
          address: 'Address',
          wallet: 'Wallet',
        },
        institutionsTitle: 'Related institutions',
        noInstitutions: 'This student does not have related institutions yet.',
      },
    },
    suspensionRequests: {
      roles: { admin: 'Admin', institutionAdmin: 'Institution', teacher: 'Teacher', student: 'Student', apiClient: 'API' },
      kpis: {
        open: {
          badge: 'Pending',
          title: 'Requests to review',
          description: 'Suspended accounts that wrote to the support inbox.',
        },
        reviewed: {
          badge: 'Reviewed',
          title: 'Handled requests',
          description: 'Signals already marked as reviewed by the team.',
        },
        total: {
          badge: 'History',
          title: 'Total received',
          description: 'Operational record without storing the email message.',
        },
      },
      heading: {
        title: 'Suspension review',
        description:
          "Use this queue to know who already sent their explanation. The content is in the support email.",
      },
      table: {
        headers: {
          account: 'Account',
          type: 'Type',
          institution: 'Institution',
          supportEmail: 'Support email',
          submitted: 'Submitted',
          status: 'Status',
          action: 'Action',
        },
        reviewed: 'Reviewed',
        reviewEmail: 'Check email',
        alreadyReactivated: 'Account already reactivated.',
        done: 'Done',
        markReviewed: 'Mark reviewed',
        empty: 'There are no suspension review requests recorded.',
      },
      footnote:
        "This view does not store the user's explanation. It only shows that the request was sent; the full message stays in the mailbox configured for support.",
    },
  },

  /** Institution admin dashboards. */
  institution: {
    layout: {
      title: 'Institutional workspace',
      description: 'Operations, certificates and automation',
    },
    approvalGate: {
      suspended: {
        title: 'Institution suspended',
        description:
          'Your institution is temporarily suspended. Courses, Certificates and Badges will be blocked until an admin reactivates it.',
      },
      pending: {
        title: 'Institution pending approval',
        description:
          'You can enter the workspace and finish the setup, but Courses, Certificates and Badges will be available once an admin approves your institution.',
      },
    },
    rejectionNotice: {
      title: 'Institutional request rejected',
      reviewProfile: 'Review profile',
    },
    dashboard: {
      noCredits: 'No TSC balance.',
      lowCredits: 'Low TSC balance.',
      noCreditsBody: 'Buy a package to be able to issue new certificates.',
      lowCreditsBody: 'You have {balance} TSC left. Top up your account to avoid interruptions.',
      buyTsc: 'Buy TSC',
      quickActions: {
        title: 'Quick actions',
        issue: { title: 'Issue certificate', hint: 'Manual or via API' },
        invite: { title: 'Invite students', hint: 'Import CSV / SSO' },
        wallet: { title: 'Manage wallet', hint: 'Tessera custody' },
      },
      summary: {
        title: 'Summary',
        live: 'Real-time metrics from the API.',
        unavailable: 'The metrics could not be loaded.',
      },
      stats: {
        issuedThisMonth: 'Issued this month',
        issuedTotalHint: 'Historical total: {total}',
        students: 'Students',
        studentsHint: 'Enrolled in courses · {count} team members',
        tscAvailable: 'TSC available',
        rechargeToIssue: 'Top up to issue',
        approxDaysHint: '≈ {value} at the current pace',
        moreThanYear: '> 1 year',
        daysUnit: '{days} days',
        emissionsRemainingOne: '1 issuance left',
        emissionsRemainingMany: '{count} issuances left',
        lowBadge: 'Low',
        queuedFailed: 'Queued / failed',
        queuedFailedHint: '{count} historical revocations',
      },
      recentActivity: {
        title: 'Recent activity',
        description: 'Latest certificates processed by your institution',
        viewAll: 'View all',
        headers: { student: 'Student', certificate: 'Certificate', token: 'Token', ago: 'Ago', status: 'Status' },
        empty: {
          title: 'You have not issued certificates yet',
          description: 'Start by issuing manually from the panel or connect your LMS via API key.',
          issueManual: 'Issue manually',
          createApiKey: 'Create API key',
        },
      },
      status: {
        issued: 'Issued',
        queued: 'Queued',
        processing: 'Processing',
        failed: 'Failed',
        revoked: 'Revoked',
      },
      setup: {
        title: 'Recommended setup',
        issueFirst: 'Issue your first certificate',
        buyTscItem: 'Buy TSC',
        createApiKeyItem: 'Create an API key for your LMS',
        configureWebhooksItem: 'Configure webhooks for real-time events',
      },
      planUsage: {
        title: 'Plan & usage',
        subscriptionQuota: 'Subscription quota',
        noSubscription: 'You have no active subscription. You can issue with prepaid TSC whenever you have balance.',
        viewPlan: 'View my plan',
        getPlan: 'Get a plan',
      },
    },
  },
} as const;

/**
 * The shape every dictionary must satisfy.
 *
 * Derived from English rather than hand-written: a hand-written type drifts
 * from the file it describes, and then a missing translation ships silently.
 *
 * `as const` above freezes every value to its exact literal --'Certificates'
 * and not `string`-- which is what makes a missing KEY a compile error. But it
 * would also reject 'Certificados', since that is a different literal. So the
 * structure is kept and the leaves are widened back to `string`: same keys
 * required, any text allowed.
 */
type Translated<T> = {
  [K in keyof T]: T[K] extends string ? string : Translated<T[K]>;
};

export type Dictionary = Translated<typeof en>;
