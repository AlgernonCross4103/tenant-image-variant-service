import assert from "node:assert/strict";
import test from "node:test";
import { selectAspects, variantRequestSchema } from "../src/tenant_image_variants.js";

const base = {
  tenantId: "clinic-north",
  sourceImage: "https://assets.example.org/team/ada.jpg",
  assetId: "clinician-42",
  purpose: "directory" as const,
};

test("active directory accounts receive all publishing variants", () => {
  const input = variantRequestSchema.parse({ ...base, accountState: "active" });
  assert.deepEqual(selectAspects(input), ["1:1", "16:9", "4:3"]);
});

test("suspended accounts receive only the admin-safe square", () => {
  const input = variantRequestSchema.parse({ ...base, accountState: "suspended" });
  assert.deepEqual(selectAspects(input), ["1:1"]);
});

test("closed accounts produce no new image variants", () => {
  const input = variantRequestSchema.parse({ ...base, accountState: "closed" });
  assert.deepEqual(selectAspects(input), []);
});
