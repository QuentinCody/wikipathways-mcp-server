/**
 * WikiPathways API catalog — hand-built from
 * https://webservice.wikipathways.org
 *
 * Covers 15 endpoints across 5 categories: search, pathway, content,
 * listing, and ontology.
 *
 * Notes:
 *   - All endpoints are GET-only
 *   - format=json is auto-appended by the api-adapter (do NOT include in paths)
 *   - Pathway IDs use "WP" prefix + number (e.g., WP1, WP4868)
 *   - System codes for xref lookup:
 *       L = Entrez Gene, En = Ensembl, S = UniProt,
 *       Ce = ChEBI, Ch = HMDB, Wd = Wikidata
 *   - Species uses full name: "Homo sapiens", "Mus musculus", etc.
 *   - ~3,000+ pathways, fully open (CC0 license)
 *   - Complements Reactome (curated) with community-contributed pathways
 *   - Responses may contain Base64-encoded GPML (pathway markup) which can be large
 *   - fileType for exports: svg, png, pdf, gpml, pwml
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const wikipathwaysCatalog: ApiCatalog = {
    name: "WikiPathways Web Service",
    baseUrl: "https://webservice.wikipathways.org",
    version: "1.0",
    auth: "none",
    endpointCount: 15,
    notes:
        "- All endpoints are GET-only REST calls\n" +
        "- format=json is auto-appended to all requests — do NOT add it manually\n" +
        "- Pathway IDs: 'WP' prefix + number (e.g., WP1, WP4868, WP4876)\n" +
        "- System codes for xref lookup: L=Entrez Gene, En=Ensembl, S=UniProt, Ce=ChEBI, Ch=HMDB, Wd=Wikidata, Rk=Kegg Compound\n" +
        "- Species: full Latin name (e.g., 'Homo sapiens', 'Mus musculus', 'Rattus norvegicus', 'Danio rerio')\n" +
        "- No authentication required — fully open access, CC0 license\n" +
        "- ~3,000+ community-contributed pathways — complements Reactome curated pathways\n" +
        "- getPathway returns full GPML (Graphical Pathway Markup Language) which can be very large\n" +
        "- getPathwayAs can export as SVG, PNG, PDF, GPML, or PWML — response is Base64-encoded\n" +
        "- Rate limiting is lenient but add delays in loops to be respectful\n" +
        "- Ontology terms use identifiers like 'PW:0000001' (Pathway Ontology) or 'DOID:1234' (Disease Ontology)",
    endpoints: [
        // === Pathway Search ===
        {
            method: "GET",
            path: "/findPathwaysByText",
            summary:
                "Full-text search for pathways by keyword. Returns pathway IDs, names, species, and URLs.",
            category: "search",
            queryParams: [
                {
                    name: "query",
                    type: "string",
                    required: true,
                    description:
                        "Search text (e.g., 'apoptosis', 'BRCA1', 'insulin signaling')",
                },
                {
                    name: "species",
                    type: "string",
                    required: false,
                    description:
                        "Filter by organism (e.g., 'Homo sapiens', 'Mus musculus'). Omit for all species.",
                },
            ],
        },
        {
            method: "GET",
            path: "/findPathwaysByXref",
            summary:
                "Find pathways containing a specific gene, protein, or compound by external reference ID and database system code.",
            category: "search",
            queryParams: [
                {
                    name: "ids",
                    type: "string",
                    required: true,
                    description:
                        "External reference ID(s). Comma-separated for multiple (e.g., '1234', 'ENSG00000141510').",
                },
                {
                    name: "codes",
                    type: "string",
                    required: true,
                    description:
                        "System code identifying the database. L=Entrez Gene, En=Ensembl, S=UniProt, Ce=ChEBI, Ch=HMDB, Wd=Wikidata.",
                },
            ],
        },
        {
            method: "GET",
            path: "/findInteractions",
            summary:
                "Search for molecular interactions within pathways by keyword (e.g., gene name, protein).",
            category: "search",
            queryParams: [
                {
                    name: "query",
                    type: "string",
                    required: true,
                    description:
                        "Search text for interactions (e.g., 'TP53', 'EGFR', 'AKT1')",
                },
            ],
        },

        // === Pathway Retrieval ===
        {
            method: "GET",
            path: "/getPathway",
            summary:
                "Get the full pathway data in GPML format (Graphical Pathway Markup Language). Warning: responses can be very large.",
            category: "pathway",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP1', 'WP4868')",
                },
                {
                    name: "revision",
                    type: "number",
                    required: false,
                    description:
                        "Specific revision number. Omit for latest revision.",
                },
            ],
        },
        {
            method: "GET",
            path: "/getPathwayInfo",
            summary:
                "Get pathway metadata: name, organism, description, last revision, and URL. Lightweight alternative to getPathway.",
            category: "pathway",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP4868')",
                },
            ],
        },
        {
            method: "GET",
            path: "/getPathwayHistory",
            summary:
                "Get the edit history (revisions) for a pathway, including timestamps, authors, and comments.",
            category: "pathway",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP4868')",
                },
            ],
        },

        // === Pathway Content ===
        {
            method: "GET",
            path: "/getPathwayAs",
            summary:
                "Export a pathway in a specific format (SVG, PNG, PDF, GPML, PWML). Response is Base64-encoded.",
            category: "content",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP4868')",
                },
                {
                    name: "fileType",
                    type: "string",
                    required: true,
                    description:
                        "Export format: svg, png, pdf, gpml, or pwml",
                },
                {
                    name: "revision",
                    type: "number",
                    required: false,
                    description: "Specific revision number. Omit for latest.",
                },
            ],
        },
        {
            method: "GET",
            path: "/getXrefList",
            summary:
                "Get all external references (cross-references) for a pathway, filtered by database system code. " +
                "NOTE: This endpoint is currently broken upstream (returns empty responses). Use findPathwaysByXref as an alternative.",
            category: "content",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP4868')",
                },
                {
                    name: "systemCode",
                    type: "string",
                    required: true,
                    description:
                        "System code: L=Entrez Gene, En=Ensembl, S=UniProt, Ce=ChEBI, Ch=HMDB",
                },
            ],
        },
        {
            method: "GET",
            path: "/getCurationTags",
            summary:
                "Get curation status tags for a pathway (e.g., curated, needs work, featured).",
            category: "content",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP4868')",
                },
            ],
        },

        // === Organism & Listing ===
        {
            method: "GET",
            path: "/listOrganisms",
            summary:
                "List all organisms that have pathways in WikiPathways (e.g., Homo sapiens, Mus musculus).",
            category: "listing",
        },
        {
            method: "GET",
            path: "/listPathways",
            summary:
                "List all pathways for a given organism. Returns pathway IDs, names, species, URLs, and revision info.",
            category: "listing",
            queryParams: [
                {
                    name: "organism",
                    type: "string",
                    required: false,
                    description:
                        "Organism name (e.g., 'Homo sapiens'). Omit to list pathways for all organisms.",
                },
            ],
        },
        {
            method: "GET",
            path: "/getRecentChanges",
            summary:
                "Get recently updated pathways since a given timestamp. Useful for monitoring new or updated content.",
            category: "listing",
            queryParams: [
                {
                    name: "timestamp",
                    type: "string",
                    required: true,
                    description:
                        "Timestamp in yyyymmddhhmmss format (e.g., '20240101000000' for Jan 1 2024)",
                },
            ],
        },

        // === Ontology ===
        {
            method: "GET",
            path: "/getOntologyTermsByPathway",
            summary:
                "Get ontology term annotations for a pathway (Pathway Ontology, Disease Ontology, Cell Type Ontology).",
            category: "ontology",
            queryParams: [
                {
                    name: "pwId",
                    type: "string",
                    required: true,
                    description: "Pathway ID (e.g., 'WP4868')",
                },
            ],
        },
        {
            method: "GET",
            path: "/getPathwaysByOntologyTerm",
            summary:
                "Find pathways annotated with a specific ontology term (exact match).",
            category: "ontology",
            queryParams: [
                {
                    name: "term",
                    type: "string",
                    required: true,
                    description:
                        "Ontology term ID (e.g., 'PW:0000001' for metabolic pathway, 'DOID:162' for cancer)",
                },
            ],
        },
        {
            method: "GET",
            path: "/getPathwaysByParentOntologyTerm",
            summary:
                "Find pathways annotated with a parent ontology term or any of its child terms (hierarchical search).",
            category: "ontology",
            queryParams: [
                {
                    name: "term",
                    type: "string",
                    required: true,
                    description:
                        "Parent ontology term ID (e.g., 'PW:0000001'). Returns pathways annotated with this term or any descendant.",
                },
            ],
        },
    ],
};
