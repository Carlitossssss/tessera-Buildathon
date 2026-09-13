'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useT } from '@tessera/i18n';
import { updateStudentProfileAction } from '../actions';

interface Props {
  initial: { name: string; locale: 'es' | 'en' | 'pt'; avatarUrl: string };
}

export function ProfileForm({ initial }: Props) {
  const t = useT();
  const [name, setName] = useState(initial.name);
  const [locale, setLocale] = useState<'es' | 'en' | 'pt'>(initial.locale);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const dirty =
    name !== initial.name || locale !== initial.locale || avatarUrl !== initial.avatarUrl;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateStudentProfileAction({
        name: name.trim() || undefined,
        locale,
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error });
        return;
      }
      setFeedback({ kind: 'ok', msg: t.student.profile.form.saved });
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 lg:max-w-2xl">
      <div className="grid gap-2">
        <Label htmlFor="name">{t.student.profile.form.fullName}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={200}
          required
          placeholder={t.student.profile.form.namePlaceholder}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="avatar">{t.student.profile.form.avatarUrl}</Label>
        <Input
          id="avatar"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          maxLength={500}
          placeholder="https://..."
        />
        <p className="text-[11.5px] text-[var(--color-fg-subtle)]">
          {t.student.profile.form.avatarHint}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="locale">{t.student.profile.form.preferredLanguage}</Label>
        <Select
          id="locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'es' | 'en' | 'pt')}
          className="h-10 px-3 text-[13.5px]"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t.student.profile.form.saving}
            </>
          ) : (
            t.student.profile.form.save
          )}
        </Button>
        {feedback ? (
          <span
            className={
              feedback.kind === 'ok'
                ? 'text-[12.5px] text-emerald-300'
                : 'text-[12.5px] text-red-300'
            }
          >
            {feedback.msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}
