'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { type ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/*
 * shadcn-style wrappers over Radix AlertDialog (plan §4: destructive actions always
 * confirm via dialog). Consumers compose Title/Description/Footer and style the
 * action buttons with `Button`.
 */

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-md border border-line bg-surface p-6 shadow-xl',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Title
      className={cn('font-display text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-sm text-fg-muted', className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('flex flex-wrap justify-end gap-2', className)} {...props} />;
}
