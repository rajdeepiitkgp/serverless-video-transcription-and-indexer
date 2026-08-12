import { type DependencyHealth } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { overallHealth } from './health.js';

function check(
  name: DependencyHealth['name'],
  status: DependencyHealth['status'],
): DependencyHealth {
  return { name, status, latencyMs: status === 'ok' ? 5 : null };
}

describe('overallHealth', () => {
  it('is ok when every dependency is ok', () => {
    expect(overallHealth([check('cosmos', 'ok'), check('storage', 'ok')])).toBe('ok');
  });

  it('is degraded when some dependencies fail', () => {
    expect(overallHealth([check('cosmos', 'down'), check('storage', 'ok')])).toBe('degraded');
  });

  it('is down when every dependency fails', () => {
    expect(overallHealth([check('cosmos', 'down'), check('storage', 'down')])).toBe('down');
  });

  it('is ok with no dependencies to check', () => {
    expect(overallHealth([])).toBe('ok');
  });
});
