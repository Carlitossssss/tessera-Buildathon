import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Code2,
  Building2,
  Coins,
  FileSignature,
  Home,
  KeyRound,
  LayoutTemplate,
  MailQuestion,
  Medal,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  User,
  UserCog,
  Users,
  Wallet,
  Webhook,
  Zap,
} from 'lucide-react';
import type { Dictionary } from '@tessera/i18n';
import type { Role } from '@/server/auth';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Etiqueta informativa opcional (ej. "Pro", "Beta") */
  badge?: string;
  disabledReason?: string;
  openInNewTab?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Navegacion de cada panel, en el idioma activo.
 *
 * Antes era una constante con las etiquetas escritas dentro. Ahora recibe el
 * diccionario; las rutas, los iconos y el orden siguen siendo los mismos y lo
 * unico que cambia con el idioma es el texto, asi que no hay dos copias del
 * menu que puedan separarse.
 *
 * Los nombres propios de producto viven igual en los dos diccionarios: son
 * nombres, no palabras.
 */
export function navByRole(t: Dictionary): Record<Role, NavSection[]> {
  return {
  // ── Institución admin ────────────────────────────────────────────
  institution_admin: [
    {
      label: t.nav.sections.workspace,
      items: [
        { label: t.nav.institution.home, href: '/institution', icon: Home },
        { label: t.nav.institution.certificates, href: '/institution/certificates', icon: FileSignature },
        { label: t.nav.institution.courses, href: '/institution/courses', icon: BookOpen },
        { label: t.nav.institution.students, href: '/institution/students', icon: Users },
        { label: t.nav.institution.badges, href: '/institution/badges', icon: Award },
      ],
    },
    {
      label: t.nav.sections.economy,
      items: [
        { label: t.nav.institution.credits, href: '/institution/credits', icon: Coins },
        { label: t.nav.institution.wallet, href: '/institution/wallet', icon: Wallet },
        { label: t.nav.institution.analytics, href: '/institution/analytics', icon: BarChart3 },
        { label: t.nav.institution.revenue, href: '/institution/revenue', icon: TrendingUp },
      ],
    },
    {
      label: t.nav.sections.integration,
      items: [
        { label: t.nav.institution.templates, href: '/institution/templates', icon: LayoutTemplate },
        { label: t.nav.institution.apiKeys, href: '/institution/api-keys', icon: KeyRound },
        { label: t.nav.institution.webhooks, href: '/institution/webhooks', icon: Webhook },
        { label: t.nav.institution.documentation, href: '/institution/developers', icon: Code2 },
      ],
    },
    {
      label: t.nav.sections.configuration,
      items: [
        { label: t.nav.institution.profile, href: '/institution/settings', icon: Settings },
        { label: t.nav.institution.team, href: '/institution/team', icon: UserCog },
        { label: t.nav.institution.plan, href: '/institution/plan', icon: Zap },
      ],
    },
  ],

  // ── Docente ──────────────────────────────────────────────────────
  teacher: [
    {
      label: t.nav.sections.workspace,
      items: [
        { label: t.nav.teacher.panel, href: '/teacher', icon: Home },
        { label: t.nav.teacher.myCourses, href: '/teacher/courses', icon: BookOpen },
        { label: t.nav.teacher.students, href: '/teacher/students', icon: Users },
        {
          label: t.nav.teacher.grading,
          href: '/teacher/grading',
          icon: FileSignature,
          badge: t.nav.teacher.gradingBadge,
        },
      ],
    },
    {
      label: t.nav.sections.myAccount,
      items: [{ label: t.nav.teacher.myProfile, href: '/teacher/profile', icon: User }],
    },
  ],

  // ── Estudiante ───────────────────────────────────────────────────
  student: [
    {
      label: t.nav.sections.learning,
      items: [
        { label: t.nav.student.home, href: '/student', icon: Home },
        { label: t.nav.student.myCourses, href: '/student/courses', icon: BookOpen },
        { label: t.nav.student.availableCourses, href: '/cursos', icon: BookOpen, openInNewTab: true },
      ],
    },
    {
      label: t.nav.sections.myCredentials,
      items: [
        { label: t.nav.student.credentials, href: '/student/credentials', icon: Award },
        { label: t.nav.student.badges, href: '/student/badges', icon: Medal },
      ],
    },
    {
      label: t.nav.sections.myAccount,
      items: [
        { label: t.nav.student.wallet, href: '/student/wallet', icon: Wallet },
        { label: t.nav.student.profile, href: '/student/profile', icon: User },
        { label: t.nav.student.privacy, href: '/student/privacy', icon: ShieldCheck },
      ],
    },
  ],

  // ── Admin Tessera ────────────────────────────────────────────────
  admin: [
    {
      label: t.nav.sections.platform,
      items: [
        { label: t.nav.admin.home, href: '/admin', icon: Home },
        { label: t.nav.admin.institutions, href: '/admin/institutions', icon: Building2 },
        { label: t.nav.admin.certificates, href: '/admin/certificates', icon: FileSignature },
        { label: t.nav.admin.users, href: '/admin/users', icon: Users },
        { label: t.nav.admin.suspensionRequests, href: '/admin/suspension-requests', icon: MailQuestion },
      ],
    },
    {
      label: t.nav.sections.system,
      items: [
        { label: t.nav.admin.plans, href: '/admin/plans', icon: Coins },
        { label: t.nav.admin.alerts, href: '/admin/alerts', icon: ShieldAlert },
        { label: t.nav.admin.health, href: '/admin/health', icon: Activity },
      ],
    },
  ],
  };
}
