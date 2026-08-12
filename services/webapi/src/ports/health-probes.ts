/**
 * Cheapest-possible liveness checks against each dependency (plan §4 health
 * endpoints). A probe resolves when the dependency answered and rejects otherwise;
 * timing and status classification live in the app layer.
 */
export interface HealthProbes {
  cosmos(): Promise<void>;
  storage(): Promise<void>;
}
