import { expect, it } from "vitest";
import { rdfTables } from "./rdf-staging";

it("preserves duplicate bindings, unbound terms, RDF attributes and numeric lexical strings", () => {
  const binding = { node: { type: "bnode", value: "b1" }, label: { type: "literal", value: "α", "xml:lang": "el" },
    number: { type: "typed-literal", value: "0009007199254740993", datatype: "http://www.w3.org/2001/XMLSchema#integer" } };
  const native = { head: { vars: ["node", "label", "number", "unbound"] }, results: { bindings: [binding, binding, {}] },
    _sparql: { offset: 100, complete: false, provider_partial: true } };
  const tables = rdfTables(native)!;
  expect(tables.rdf_bindings.map(row => JSON.parse(String(row.native_json)))).toEqual(native.results.bindings);
  expect(tables.rdf_terms.filter(row => row.variable === "unbound")).toEqual([]);
  expect(tables.rdf_terms.filter(row => row.variable === "number").map(row => row.value)).toEqual(["0009007199254740993", "0009007199254740993"]);
  expect(tables.rdf_terms[1]).toMatchObject({ binding_index: 0, language: "el", datatype: null });
  for (const index of [0, 1, 2]) {
    const restored = Object.fromEntries(tables.rdf_terms.filter(row => row.binding_index === index).map(row => [row.variable, JSON.parse(String(row.native_json))]));
    expect(restored).toEqual(native.results.bindings[index]);
  }
  expect(JSON.parse(String(tables.rdf_context[0].native_json))).toEqual({ head: native.head, results: {}, _sparql: native._sparql });
  expect(rdfTables({ content: [], structuredContent: { data: native } })).toEqual(tables);
});

it("leaves static API and unrelated SQL results to existing inference", () => {
  for (const value of [null, "text", { organisms: ["Homo sapiens"] }, { head: {}, results: { bindings: [] } }]) expect(rdfTables(value)).toBeUndefined();
});
