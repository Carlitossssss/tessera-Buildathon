'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/api/endpoints/auth';

export function ProfileCompletionGate({
  role,
  profile,
}: {
  role: 'student' | 'teacher';
  profile: UserProfile | null | undefined;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const profilePath = role === 'student' ? '/student/profile' : '/teacher/profile';
  const status = profile?.status ?? 'incomplete';
  const studentBlockedPath =
    role === 'student' &&
    (pathname === '/student' ||
      pathname === '/student/courses' ||
      pathname.startsWith('/student/courses/'));
  const allowed =
    role === 'teacher'
      ? status === 'approved' || pathname === profilePath
      : status === 'incomplete'
        ? pathname === profilePath
        : status === 'approved'
          ? true
          : !studentBlockedPath;

  useEffect(() => {
    if (!allowed && pathname !== profilePath) {
      router.replace(profilePath);
    }
  }, [allowed, pathname, profilePath, router]);

  return null;
}
