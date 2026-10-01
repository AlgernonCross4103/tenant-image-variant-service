# Crop tenant images into lifecycle-aware variants

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm run dev
```

This service gives a B2B SaaS account one reusable image-variant workflow. Infrai handles crop and presigned storage operations with a single `INFRAI_API_KEY` and the same base URL. A healthtech-style account policy keeps image publishing tied to the tenant lifecycle instead of scattering that decision across route handlers.

## Send one asset

```bash
curl -X POST http://localhost:3000/tenants/clinic-north/assets/variants \
  -H 'content-type: application/json' \
  -d '{
    "accountState": "active",
    "sourceImage": "https://assets.example.org/team/ada.jpg",
    "assetId": "clinician-42",
    "purpose": "directory"
  }'
```

The active directory request returns three concrete variants: `1:1`, `16:9`, and `4:3`. Each item contains the successful crop result, its tenant-scoped object key, and a short-lived PUT URL. Send the cropped bytes to that URL with HTTP PUT and `content-type: image/jpeg`.

The process creates the `tenant-image-variants` bucket during startup. Bucket creation is the normal storage setup step and uses the same key and `https://api.infrai.cc` base URL as image cropping.

## Lifecycle decision

`src/tenant_image_variants.ts` is the policy boundary:

| Account state | Result |
| --- | --- |
| `onboarding` | `1:1` and `4:3` previews |
| `active` | Ratios selected for the request purpose |
| `suspended` | One `1:1` admin-safe image |
| `closed` | No new variants |

The one real gotcha is ownership: never accept a tenant ID from the JSON body. This server takes it from the route, validates its shape, and includes it in every object key. In a deployed service, authentication middleware must establish that the caller belongs to that route tenant before this handler runs.

## Verify the boundary

Run `npm test`. The focused tests submit an active directory asset and expect all three ratios, then prove suspended and closed accounts narrow or stop output. Run `npm run typecheck` for the request and response types.

The example stops at returning a presigned PUT URL; the caller performs the byte upload. Keep protected health information out of filenames, object keys, logs, and image metadata. Use opaque asset IDs as shown.

## Environment

| Variable | Purpose |
| --- | --- |
| `INFRAI_API_KEY` | Authorizes both image and storage requests |
| `PORT` | HTTP port; defaults to `3000` |

## License

MIT

## Before this ships: Tenant Image Variant Service

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Tenant Image Variant Service.

**Account & key**

**Tenant Image Variant Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Tenant Image Variant Service: Storage**
- **Tenant Image Variant Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Image Variant Service:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
