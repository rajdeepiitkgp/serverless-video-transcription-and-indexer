import { describe, expect, it } from 'vitest';

import { isAdmin, parseClientPrincipal } from '../../src/core/principal.js';

function encode(principal: unknown): string {
  return Buffer.from(JSON.stringify(principal), 'utf8').toString('base64');
}

const signedIn = {
  identityProvider: 'aad',
  userId: 'user-1',
  userDetails: 'user@example.com',
  userRoles: ['anonymous', 'authenticated'],
};

describe('parseClientPrincipal', () => {
  it('parses a signed-in principal', () => {
    expect(parseClientPrincipal(encode(signedIn))).toEqual(signedIn);
  });

  it('returns null when the header is absent', () => {
    expect(parseClientPrincipal(undefined)).toBeNull();
  });

  it('returns null when the header is empty', () => {
    expect(parseClientPrincipal('')).toBeNull();
  });

  it('returns null for a payload that is not base64 JSON', () => {
    expect(parseClientPrincipal('not-base64-json!')).toBeNull();
  });

  it('returns null for JSON that is not a principal', () => {
    expect(parseClientPrincipal(encode({ hello: 'world' }))).toBeNull();
  });

  it('returns null for a principal without the authenticated role', () => {
    expect(parseClientPrincipal(encode({ ...signedIn, userRoles: ['anonymous'] }))).toBeNull();
  });

  it('returns null for a principal with an empty userId', () => {
    expect(parseClientPrincipal(encode({ ...signedIn, userId: '' }))).toBeNull();
  });
});

describe('isAdmin', () => {
  it('is false for a plain signed-in user', () => {
    expect(isAdmin({ ...signedIn })).toBe(false);
  });

  it('is true when the roles include admin', () => {
    expect(isAdmin({ ...signedIn, userRoles: [...signedIn.userRoles, 'admin'] })).toBe(true);
  });
});
