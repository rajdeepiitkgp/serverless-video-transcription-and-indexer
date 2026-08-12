import * as z from 'zod';

/**
 * The identity SWA injects as the `x-ms-client-principal` header on every proxied
 * request (base64-encoded JSON). The webapi is reachable only through SWA (Easy Auth
 * linked-backend lockdown, plan §2), so the header is trustworthy — parsing it *is*
 * the authentication step. A missing/malformed header, or one without the
 * `authenticated` role, means an anonymous caller.
 */
const clientPrincipalSchema = z.object({
  identityProvider: z.string().min(1),
  userId: z.string().min(1),
  userDetails: z.string().min(1),
  userRoles: z.array(z.string()).default([]),
});

export type ClientPrincipal = z.infer<typeof clientPrincipalSchema>;

/** SWA's marker role for any signed-in user. */
export const AUTHENTICATED_ROLE = 'authenticated';

/** Custom SWA role granted by invitation (plan §4); differentiates on delete only. */
export const ADMIN_ROLE = 'admin';

/**
 * Decodes and validates the client principal header. Returns null for anything that
 * is not a signed-in user — absent header, undecodable payload, or a principal
 * lacking the `authenticated` role (SWA sends `anonymous`-only principals for
 * unauthenticated requests on routes it doesn't gate).
 */
export function parseClientPrincipal(header: string | undefined): ClientPrincipal | null {
  if (header === undefined || header === '') return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return null;
  }

  const result = clientPrincipalSchema.safeParse(decoded);
  if (!result.success) return null;
  return result.data.userRoles.includes(AUTHENTICATED_ROLE) ? result.data : null;
}

export function isAdmin(principal: ClientPrincipal): boolean {
  return principal.userRoles.includes(ADMIN_ROLE);
}
