import { type VideoDocument } from '@vidx/shared';

import { type ClientPrincipal, isAdmin } from './principal.js';

/**
 * The delete rule (plan §4, round-3 decision): the whole library is open to every
 * signed-in user — browse, watch, search, downloads — so authorization only
 * differentiates on delete. Owners delete their own uploads; admins delete any.
 */
export function canDeleteVideo(principal: ClientPrincipal, video: VideoDocument): boolean {
  return isAdmin(principal) || video.uploadedBy.userId === principal.userId;
}
