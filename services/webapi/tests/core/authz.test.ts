import { describe, expect, it } from 'vitest';

import { canDeleteVideo } from '../../src/core/authz.js';
import { adminPrincipal, principal, videoDocument } from '../support/builders.js';

describe('canDeleteVideo', () => {
  const ownVideo = videoDocument({
    uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
  });

  it('allows the owner to delete their own upload', () => {
    expect(canDeleteVideo(principal({ userId: 'user-1' }), ownVideo)).toBe(true);
  });

  it('denies a different signed-in user', () => {
    expect(canDeleteVideo(principal({ userId: 'user-2' }), ownVideo)).toBe(false);
  });

  it("allows an admin to delete anyone's upload", () => {
    expect(canDeleteVideo(adminPrincipal(), ownVideo)).toBe(true);
  });
});
