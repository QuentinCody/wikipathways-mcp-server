/// <reference types="node" />
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { sparqlRead } from "./sparql";
import { rdfTables } from "./rdf-staging";

// First three bindings per native response captured 2026-10-05; full receipts in the audit artifact.
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/rdf-native.json", import.meta.url), "utf8"));
afterEach(() => vi.unstubAllGlobals());
it.each(["datasets", "xrefs", "interactions"])("preserves provider-native %s RDF through validation and SQL projection", async key => {
  const native = fixtures[key];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(native)));
  const result = await sparqlRead({ method: "GET", path: key === "datasets" ? "/sparql/datasets" : `/sparql/pathway-${key}`, params: key === "datasets" ? {} : { pathway_id: "WP554" } });
  expect(result.data).toMatchObject({ head: native.head, results: native.results });
  const rows = rdfTables(result.data)!.rdf_bindings;
  expect(rows.map(row => JSON.parse(String(row.native_json)))).toEqual(native.results.bindings);
});
