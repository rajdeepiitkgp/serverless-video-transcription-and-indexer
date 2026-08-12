/**
 * Transport-agnostic request/response shapes for the handlers. The functions layer
 * adapts `@azure/functions` types to these; tests build them directly.
 */
export interface ApiRequest {
  /** Raw `x-ms-client-principal` header as SWA forwards it (plan §2). */
  principalHeader: string | undefined;
  /** Route parameters (`{id}`). */
  params: Readonly<Record<string, string | undefined>>;
  /** Query string, first value per key. */
  query: Readonly<Record<string, string | undefined>>;
  /** Parsed JSON body; undefined when absent or unparseable. */
  body: unknown;
}

export interface ApiResponse {
  status: number;
  /** JSON payload (serialized by the functions layer). */
  jsonBody?: unknown;
  /** Raw text payload (transcript file downloads). */
  body?: string;
  headers?: Readonly<Record<string, string>>;
}
