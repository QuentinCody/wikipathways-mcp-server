import { expect, it } from "vitest";
import { sha256Hex } from "@bio-mcp/shared";
import { nativeError } from "./native-error";

it("bounds large provider errors and hashes the retained decoded evidence", async () => {
  const text = "α".repeat(40000);
  const error = await nativeError(new Response(text, { status: 503, headers: { "set-cookie": "must-not-leak" } }), "https://sparql.wikipathways.org/sparql");
  const retained = "α".repeat(32768);
  expect(error).toMatchObject({ status: 503, data: { body_text: retained, body_complete: false, text_sha256: await sha256Hex(retained), hash_scope: "bounded decoded error prefix" } });
  expect(JSON.stringify(error.data)).not.toContain("must-not-leak");
});
