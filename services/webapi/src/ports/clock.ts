/** Injectable time source so SAS windows and health timings are deterministic in tests. */
export interface Clock {
  now(): Date;
}
