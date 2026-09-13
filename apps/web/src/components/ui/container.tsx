'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
} as const;

export const Container = ({ size = 'lg', className, ...props }: ContainerProps) => (
  <div className={cn('mx-auto w-full px-6 sm:px-8', sizes[size], className)} {...props} />
);
