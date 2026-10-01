import { createServer } from "node:http";
import { z } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { TenantVariantService, variantRequestSchema } from "./tenant_image_variants.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const port = Number(process.env.PORT ?? 3000);
const service = new TenantVariantService(new InfraiClient(apiKey), "tenant-image-variants");
await service.prepareStorage();

const send = (response: import("node:http").ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
};

createServer(async (request, response) => {
  const match = request.url?.match(/^\/tenants\/([^/]+)\/assets\/variants$/);
  if (request.method !== "POST" || !match) {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const input = variantRequestSchema.parse({ ...raw, tenantId: match[1] });
    send(response, 201, await service.create(input));
  } catch (error) {
    if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message,
      });
      return;
    }
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      send(response, 400, { error: "INVALID_REQUEST" });
      return;
    }
    send(response, 500, { error: "INTERNAL_ERROR" });
  }
}).listen(port, () => console.log(`Tenant variant service listening on :${port}`));
