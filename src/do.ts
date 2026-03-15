/**
 * WikipathwaysDataDO — Durable Object for staging large WikiPathways responses.
 *
 * Extends RestStagingDO with pathway, interaction, and xref-specific schema hints.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class WikipathwaysDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        const obj = data as Record<string, unknown>;

        // Pathway search results: { result: [...] } from findPathwaysByText, findPathwaysByXref
        if (Array.isArray(obj.result) && obj.result.length > 0) {
            const first = obj.result[0] as Record<string, unknown> | undefined;
            if (first) {
                // Pathway results have 'id', 'name', 'species', 'url'
                if ("species" in first || "organism" in first) {
                    return {
                        tableName: "pathways",
                        indexes: ["id", "name", "species", "organism", "url"],
                    };
                }
                // Interaction results have 'name', 'pathway', 'fields'
                if ("pathway" in first || "pwId" in first) {
                    return {
                        tableName: "interactions",
                        indexes: ["name", "pathway", "pwId"],
                    };
                }
            }
            // Generic result array
            return {
                tableName: "results",
                indexes: ["id", "name"],
            };
        }

        // Pathway listing: { pathways: [...] } from listPathways
        if (Array.isArray(obj.pathways) && obj.pathways.length > 0) {
            return {
                tableName: "pathways",
                indexes: ["id", "name", "species", "organism", "url", "revision"],
            };
        }

        // Xref list: { xrefs: [...] } from getXrefList
        if (Array.isArray(obj.xrefs) && obj.xrefs.length > 0) {
            return {
                tableName: "xrefs",
                indexes: ["id", "system", "dataSource"],
            };
        }

        // Curation tags: { tags: [...] } from getCurationTags
        if (Array.isArray(obj.tags) && obj.tags.length > 0) {
            return {
                tableName: "curation_tags",
                indexes: ["name", "displayName", "pathway"],
            };
        }

        // Ontology terms: { terms: [...] } from getOntologyTermsByPathway
        if (Array.isArray(obj.terms) && obj.terms.length > 0) {
            return {
                tableName: "ontology_terms",
                indexes: ["id", "name", "ontology"],
            };
        }

        // Organisms list: { organisms: [...] } from listOrganisms
        if (Array.isArray(obj.organisms) && obj.organisms.length > 0) {
            return {
                tableName: "organisms",
                indexes: ["name"],
            };
        }

        // Recent changes: { ... } from getRecentChanges
        if (Array.isArray(obj.changes)) {
            return {
                tableName: "changes",
                indexes: ["id", "name", "timestamp", "comment"],
            };
        }

        // Pathway history: { history: [...] } from getPathwayHistory
        if (Array.isArray(obj.history)) {
            return {
                tableName: "history",
                indexes: ["revision", "timestamp", "comment", "user"],
            };
        }

        return undefined;
    }
}
