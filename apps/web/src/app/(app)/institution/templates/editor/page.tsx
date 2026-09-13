import { TemplateEditor } from './editor';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export default async function TemplateEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const templateId = params?.templateId;
  const returnTo = params?.returnTo?.startsWith('/institution/') ? params.returnTo : undefined;
  let initialTemplate: {
    id: string;
    name: string;
    backgroundUrl: string | null;
    layout: Record<string, unknown> | null;
  } | null = null;

  if (templateId) {
    const { token } = await requireSession();
    const list = await safeFetch(() => meApi.templates(token));
    const found = list?.data.find((template) => template.id === templateId);
    if (found) {
      initialTemplate = {
        id: found.id,
        name: found.name,
        backgroundUrl: found.backgroundUrl,
        layout: found.layout,
      };
    }
  }

  return <TemplateEditor initialTemplate={initialTemplate} returnTo={returnTo} />;
}
