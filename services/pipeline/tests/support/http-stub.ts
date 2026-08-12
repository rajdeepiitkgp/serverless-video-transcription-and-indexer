import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export interface StubResponse {
  status?: number;
  body?: string | Buffer;
  contentType?: string;
}

export interface HttpStub {
  baseUrl: string;
  requests: RecordedRequest[];
  /** Routes every incoming request; defaults to 200 `{}`. */
  respondWith(handler: (request: RecordedRequest) => StubResponse): void;
  close(): Promise<void>;
}

/** Local HTTP stub for adapter integration tests (docs/testing-principles.md §3). */
export async function startHttpStub(): Promise<HttpStub> {
  const requests: RecordedRequest[] = [];
  let handler: (request: RecordedRequest) => StubResponse = () => ({});

  const server: Server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.on('end', () => {
      const request: RecordedRequest = {
        method: incoming.method ?? '',
        url: incoming.url ?? '',
        headers: incoming.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(request);
      const { status = 200, body = '{}', contentType = 'application/json' } = handler(request);
      outgoing.writeHead(status, { 'content-type': contentType });
      outgoing.end(body);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    requests,
    respondWith(next) {
      handler = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
