type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// @ts-ignore The generated entrypoint has no source declaration file.
import generatedServer from "../dist/server/server.js";

const server = generatedServer as ServerEntry;

type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on: (event: "data" | "end" | "error", callback: (chunk?: Buffer) => void) => void;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string | string[]) => void;
  end: (body?: string | Uint8Array) => void;
};

function readBody(request: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      if (chunk) chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const host = request.headers["host"] ?? "localhost";
  const protocol = request.headers["x-forwarded-proto"] ?? "https";
  const protocolValue = Array.isArray(protocol) ? protocol[0] : protocol;
  const requestUrl = new URL(request.url ?? "/", `${protocolValue}://${host}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = request.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(request);
  const webRequest = new Request(requestUrl, {
    method,
    headers,
    body: body?.length ? body.toString() : null,
  });
  const webResponse = await server.fetch(webRequest, {}, {});

  response.status(webResponse.status);
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(new Uint8Array(await webResponse.arrayBuffer()));
}