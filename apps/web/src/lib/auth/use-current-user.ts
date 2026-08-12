'use client';

import { useEffect, useState } from 'react';
import * as z from 'zod';

/**
 * The caller's own identity from SWA built-in auth (`/.auth/me`, plan §4). This is a
 * platform payload, not a webapi route, so it has no `{ data }` envelope. `/.auth/me`
 * only ever returns the caller's principal — nobody can read anyone else's roles.
 */
export const clientPrincipalSchema = z.object({
  identityProvider: z.string(),
  userId: z.string(),
  userDetails: z.string(),
  userRoles: z.array(z.string()),
});

export type ClientPrincipal = z.infer<typeof clientPrincipalSchema>;

const authMeSchema = z.object({ clientPrincipal: clientPrincipalSchema.nullable() });

export type CurrentUserState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'signed-in'; user: ClientPrincipal };

/** Reads the signed-in user, e.g. for the forensic watermark and the user menu. */
export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading', user: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/.auth/me', { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => {
        const body: unknown = await response.json();
        const parsed = authMeSchema.safeParse(body);
        const principal = parsed.success ? parsed.data.clientPrincipal : null;
        setState(
          principal === null
            ? { status: 'anonymous', user: null }
            : { status: 'signed-in', user: principal },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'anonymous', user: null });
        }
      });
    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
