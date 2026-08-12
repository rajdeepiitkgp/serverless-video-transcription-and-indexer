/** Injectable time source so stage timestamps and SAS windows are deterministic in tests. */
export interface Clock {
  now(): Date;
}
