import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const variantRequestSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,48}$/),
  accountState: z.enum(["onboarding", "active", "suspended", "closed"]),
  sourceImage: z.string().url(),
  assetId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  purpose: z.enum(["onboarding", "directory", "admin-review"]),
});

export type VariantRequest = z.infer<typeof variantRequestSchema>;

const aspectByPurpose = {
  onboarding: ["1:1", "4:3"],
  directory: ["1:1", "16:9", "4:3"],
  "admin-review": ["1:1"],
} as const;

export function selectAspects(input: VariantRequest): readonly string[] {
  if (input.accountState === "closed") return [];
  if (input.accountState === "suspended") return ["1:1"];
  if (input.accountState === "onboarding") return aspectByPurpose.onboarding;
  return aspectByPurpose[input.purpose];
}

type PresignData = { url: string };

export class TenantVariantService {
  private readonly infrai: InfraiClient;
  private readonly bucket: string;

  constructor(
    infrai: InfraiClient,
    bucket: string,
  ) {
    this.infrai = infrai;
    this.bucket = bucket;
  }

  async prepareStorage(): Promise<void> {
    await this.infrai.post("/v1/storage/bucket/create", { name: this.bucket });
  }

  async create(input: VariantRequest) {
    const aspects = selectAspects(input);
    const variants = await Promise.all(
      aspects.map(async (aspect) => {
        const crop = await this.infrai.post<unknown>("/v1/image/smart_crop", {
          image: input.sourceImage,
          aspect,
        });
        const objectKey = `${input.tenantId}/${input.assetId}/${aspect.replace(":", "x")}.jpg`;
        const signed = await this.infrai.post<PresignData>(
          `/v1/storage/object/presign/${encodeURIComponent(this.bucket)}/${encodeURIComponent(objectKey)}`,
          {
            op: "put",
            expires_seconds: 900,
            content_type: "image/jpeg",
            idempotency_key: `${input.tenantId}-${input.assetId}-${aspect}`,
          },
        );
        return { aspect, crop, objectKey, uploadUrl: signed.url };
      }),
    );
    return { tenantId: input.tenantId, accountState: input.accountState, variants };
  }
}
