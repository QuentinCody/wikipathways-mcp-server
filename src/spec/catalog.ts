/**
 * WikiPathways API catalog — hand-built from the JSON API at
 * https://www.wikipathways.org/json/
 *
 * REPOINTED 2026-07-16: the classic SOAP/REST webservice at
 * webservice.wikipathways.org was retired upstream (it now returns HTTP 404 on
 * every endpoint) as part of WikiPathways' move to a GitHub-based system. The
 * official replacement is a set of static, real-time-generated JSON files under
 * https://www.wikipathways.org/json/ — "This set of JSON files contain all the
 * information needed to replace the prior, deprecated web services." The R
 * (rWikiPathways), Python (pywikipathways) and Java clients now read these same
 * files. Per-pathway content moved to the /wikipathways-assets/ tree.
 *
 * THE BIG SHAPE CHANGE — bulk files, not per-query endpoints:
 *   Old: GET /getPathwayInfo?pwId=WP554   → one pathway
 *   New: GET /json/getPathwayInfo.json    → ALL ~2,087 pathways in one file
 * There are no query parameters anywhere in this API.
 *
 * Which means the bulk files (>30KB) AUTO-STAGE into SQLite and you filter them
 * with SQL via api.query() — NOT with array methods. All shapes, table names and
 * columns below were verified live against the running server on 2026-07-16.
 *
 * Operations with no replacement in the new API (dropped from this catalog):
 *   findInteractions, getPathwayHistory, getCurationTags, getRecentChanges.
 *   History/curation now live in git (github.com/wikipathways/wikipathways-database);
 *   `revision` dates on pathway records cover most getRecentChanges use cases.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const wikipathwaysCatalog: ApiCatalog = {
    name: "WikiPathways JSON API",
    baseUrl: "https://www.wikipathways.org",
    version: "2026-07",
    auth: "none",
    endpointCount: 14,
    notes:
        "- BULK FILES, NOT QUERIES. Every /json/ endpoint is a static file covering ALL pathways and takes NO parameters. There is no server-side search or filtering.\n" +
        "- MOST /json/ FILES AUTO-STAGE. Anything over 30KB is materialized into SQLite and api.get() returns { __staged:true, data_access_id, columns, total_rows } — NOT the parsed JSON. Do NOT write r.pathwayInfo.find(...) on a staged result: the array is gone, it is a SQL table now. Use api.query(r.data_access_id, sql).\n" +
        "- Inline (small enough to use directly): getCounts.json (~0.1KB), listOrganisms.json (~0.8KB). Everything else stages.\n" +
        "- STAGED TABLE NAMES (verified live — the table is the lowercased top-level array key, and nested arrays become <parent>_<child> child tables joined by parent_id):\n" +
        "    getPathwayInfo.json          → pathwayinfo(id, url, name, species, revision, authors, description, citedIn) — 2,087 rows\n" +
        "    findPathwaysByText.json      → pathwayinfo(... + datanodes, annotations)\n" +
        "    findPathwaysByXref.json      → pathwayinfo(... + ncbigene, ensembl, hgnc, uniprot, wikidata, chebi, inchikey)\n" +
        "    findPathwaysByLiterature.json→ pathwayinfo(... + refs, citations)\n" +
        "    findPathwaysByOrcid.json     → pathwayinfo(... + orcids)\n" +
        "    listPathways.json            → organisms(id, latin, 'two-letter-code', common) + organisms_pathways(parent_id, id, url, name, species, revision)\n" +
        "    listCommunities.json         → communities(id, 'display-name', title, ...) + communities_pathways(parent_id, id, url, name, species, revision)\n" +
        "    getOntologyTermsByPathway.json → pathways(id) + pathways_terms(parent_id, ontology, id, name, parent) — 7,906 rows\n" +
        "    getPathwaysByOntologyTerm.json → ontology_terms(id, name, ontology, parent) + ontology_terms_pathways(parent_id, id, url, name, species, revision)\n" +
        "- Approximate fetch cost: getCounts 0.1KB, listOrganisms 0.8KB, getPathwaysByOntologyTerm 250KB, listCommunities 360KB, listPathways 600KB, getPathwayInfo 1.1MB, findPathwaysByOrcid 1.3MB, getOntologyTermsByPathway 1.4MB, findPathwaysByText 2.2MB, findPathwaysByLiterature 4.5MB, findPathwaysByXref 11.4MB. Fetch each file at most ONCE per program and reuse the data_access_id.\n" +
        "- Text search is CLIENT-SIDE: use SQL LIKE (e.g. lower(name) LIKE '%apoptosis%'), there is no query param.\n" +
        "- Xref columns are comma-separated CURIE strings, e.g. hgnc = 'hgnc.symbol:ACE, hgnc.symbol:TGFB1, ...', chebi = 'chebi:3165, ...'. Match with LIKE '%hgnc.symbol:TP53,%' style patterns — a bare LIKE '%TP53%' also matches TP53BP1.\n" +
        "- Pathway IDs: 'WP' prefix + number (e.g., WP1, WP554, WP4868). ~2,087 pathways across 39 organisms.\n" +
        "- `species` is the full Latin name ('Homo sapiens'); in the organisms table `latin` uses underscores ('Homo_sapiens'). `revision` is an ISO date ('2025-07-10'), not the old integer revision number.\n" +
        "- `citedIn` is camelCase in the payload (the upstream docs page spells it 'citedin').\n" +
        "- Per-pathway content (JSON/GPML/SVG) is under /wikipathways-assets/pathways/{pwId}/{pwId}.{ext} — genuinely one file per pathway. It does NOT stage (single-record rule) but IS 100–300KB, so extract fields instead of returning it whole (the 100KB structuredContent limit will silently drop an oversized result).\n" +
        "- Ontology terms: 'PW:...' (Pathway Ontology), 'DOID:...' (Disease Ontology), 'CL:...' (Cell Type Ontology).\n" +
        "- No authentication. Fully open, CC0 1.0. Complements Reactome (curated) with community-contributed pathways.",
    endpoints: [
        // === Summary / listing ===
        {
            method: "GET",
            path: "/json/getCounts.json",
            summary:
                "Summary statistics for WikiPathways: number of organisms, pathways, authors, communities. Tiny (~0.1KB) and returned INLINE — the cheapest live check.",
            category: "listing",
            responseShape:
                "{ organisms: string, pathways: string, authors: string, communities: string }  // values are numeric STRINGS",
            example: "const c = await api.get('/json/getCounts.json');\nreturn { pathways: Number(c.pathways), organisms: Number(c.organisms) };",
            featured: true,
        },
        {
            method: "GET",
            path: "/json/listOrganisms.json",
            summary:
                "All 39 organisms that have pathways in WikiPathways, as Latin genus-species names. Tiny (~0.8KB), returned INLINE.",
            category: "listing",
            responseShape: "{ organisms: string[] }  // e.g. ['Homo sapiens', 'Mus musculus', ...]",
            example: "const r = await api.get('/json/listOrganisms.json');\nreturn r.organisms;",
        },
        {
            method: "GET",
            path: "/json/listPathways.json",
            summary:
                "All pathways organized by organism. ~600KB → AUTO-STAGES to organisms + organisms_pathways.",
            category: "listing",
            responseShape:
                "STAGED → organisms(id, latin, 'two-letter-code', common) + organisms_pathways(parent_id, id, url, name, species, revision)",
            usageHint:
                "Replaces old listPathways?organism=... — filter with SQL on organisms_pathways.species ('Homo sapiens'), or join to organisms via parent_id. Note organisms.latin uses underscores.",
            example:
                "const r = await api.get('/json/listPathways.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT id, name, revision FROM organisms_pathways WHERE species = 'Homo sapiens' ORDER BY id LIMIT 20\");",
            featured: true,
        },
        {
            method: "GET",
            path: "/json/listCommunities.json",
            summary:
                "All WikiPathways communities (curated thematic collections) and their pathways. ~360KB → AUTO-STAGES to communities + communities_pathways.",
            category: "listing",
            responseShape:
                "STAGED → communities(id, 'display-name', title, 'short-description', 'community-tag', editors) + communities_pathways(parent_id, id, url, name, species, revision)",
            usageHint: "Hyphenated column names need double quotes in SQL, e.g. SELECT \"display-name\" FROM communities.",
        },

        // === Pathway metadata ===
        {
            method: "GET",
            path: "/json/getPathwayInfo.json",
            summary:
                "Key metadata for EVERY pathway: id, url, name, species, revision, authors, description, citedIn. ~1.1MB → AUTO-STAGES to the pathwayinfo table (2,087 rows).",
            category: "pathway",
            responseShape:
                "STAGED → pathwayinfo(id, url, name, species, revision, authors, description, citedIn)",
            usageHint:
                "Replaces the old getPathwayInfo?pwId=... — one pathway is now a SQL WHERE clause, not a query param.",
            example:
                "const r = await api.get('/json/getPathwayInfo.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT id, name, species, revision, description FROM pathwayinfo WHERE id = 'WP554'\");",
            featured: true,
        },

        // === Search (SQL over staged bulk files) ===
        {
            method: "GET",
            path: "/json/findPathwaysByText.json",
            summary:
                "Text-searchable metadata for every pathway — pathwayinfo plus `datanodes` (gene/metabolite labels) and `annotations`. ~2.2MB → AUTO-STAGES.",
            category: "search",
            responseShape:
                "STAGED → pathwayinfo(id, url, name, species, revision, authors, description, datanodes, annotations, citedIn)",
            usageHint:
                "Replaces old findPathwaysByText?query=..&species=.. — there is NO query param. Use SQL LIKE over name/description/datanodes; `datanodes` is where gene/metabolite labels live, so search it too for gene-name queries.",
            example:
                "const r = await api.get('/json/findPathwaysByText.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT id, name, species FROM pathwayinfo \" +\n  \"WHERE species = 'Homo sapiens' \" +\n  \"AND (lower(name) LIKE '%apoptosis%' OR lower(description) LIKE '%apoptosis%') LIMIT 20\");",
            featured: true,
        },
        {
            method: "GET",
            path: "/json/findPathwaysByXref.json",
            summary:
                "Every pathway plus the xrefs of its genes/proteins/metabolites (ncbigene, ensembl, hgnc, uniprot, wikidata, chebi, inchikey). ~11.4MB — the heaviest file; use ONLY for xref→pathway lookups.",
            category: "search",
            responseShape:
                "STAGED → pathwayinfo(id, url, name, species, revision, authors, description, ncbigene, ensembl, hgnc, uniprot, wikidata, chebi, inchikey)",
            usageHint:
                "Replaces BOTH old findPathwaysByXref?ids=..&codes=.. and getXrefList?pwId=..&systemCode=.. — the single-letter system codes (L, En, S, Ce, Ch, Wd) are gone; xrefs are named columns of comma-separated CURIEs ('hgnc.symbol:ACE, hgnc.symbol:TGFB1'). Anchor the LIKE on the CURIE prefix to avoid substring false positives (TP53 vs TP53BP1). For a single pathway's xref list, filter by id instead.",
            example:
                "const r = await api.get('/json/findPathwaysByXref.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT id, name, species FROM pathwayinfo \" +\n  \"WHERE species = 'Homo sapiens' \" +\n  \"AND (hgnc LIKE '%hgnc.symbol:TP53,%' OR hgnc LIKE '%hgnc.symbol:TP53' ) LIMIT 20\");",
        },
        {
            method: "GET",
            path: "/json/findPathwaysByLiterature.json",
            summary:
                "Every pathway plus its literature references — pathwayinfo plus `refs` (citation IDs, e.g. PMIDs) and `citations` (citation text). ~4.5MB → AUTO-STAGES.",
            category: "search",
            responseShape:
                "STAGED → pathwayinfo(id, url, name, species, revision, authors, description, refs, citations)",
            usageHint: "Find pathways citing a PMID with `WHERE refs LIKE '%<pmid>%'`, or pull one pathway's reference list by id.",
        },
        {
            method: "GET",
            path: "/json/findPathwaysByOrcid.json",
            summary:
                "Every pathway plus its author ORCIDs — pathwayinfo plus `orcids`. ~1.3MB → AUTO-STAGES.",
            category: "search",
            responseShape:
                "STAGED → pathwayinfo(id, url, name, species, revision, authors, description, orcids)",
        },

        // === Ontology ===
        {
            method: "GET",
            path: "/json/getOntologyTermsByPathway.json",
            summary:
                "Ontology term annotations for every pathway (Pathway / Disease / Cell Type Ontology). ~1.4MB → AUTO-STAGES to pathways + pathways_terms (7,906 term rows).",
            category: "ontology",
            responseShape:
                "STAGED → pathways(_rowid, id) + pathways_terms(parent_id, ontology, id, name, parent)",
            usageHint:
                "Replaces old getOntologyTermsByPathway?pwId=... Join pathways_terms.parent_id = pathways._rowid. This is also the file to use for a SPECIFIC (non-top-level) ontology term → pathways lookup, which getPathwaysByOntologyTerm.json cannot answer.",
            example:
                "const r = await api.get('/json/getOntologyTermsByPathway.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT t.ontology, t.id, t.name FROM pathways_terms t \" +\n  \"JOIN pathways p ON t.parent_id = p._rowid WHERE p.id = 'WP554'\");",
        },
        {
            method: "GET",
            path: "/json/getPathwaysByOntologyTerm.json",
            summary:
                "All pathways associated with each TOP-LEVEL ontology term (21 terms only). ~250KB → AUTO-STAGES to ontology_terms + ontology_terms_pathways.",
            category: "ontology",
            responseShape:
                "STAGED → ontology_terms(id, name, ontology, parent) + ontology_terms_pathways(parent_id, id, url, name, species, revision)",
            usageHint:
                "Replaces old getPathwaysByOntologyTerm?term=.. AND getPathwaysByParentOntologyTerm?term=.. (the `parent` column covers the parent search). Only TOP-LEVEL terms are here — for a leaf term, invert getOntologyTermsByPathway.json instead.",
            example:
                "const r = await api.get('/json/getPathwaysByOntologyTerm.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT p.id, p.name, p.species FROM ontology_terms_pathways p \" +\n  \"JOIN ontology_terms t ON p.parent_id = t._rowid WHERE t.id = 'PW:0000002' LIMIT 20\");",
        },

        // === Per-pathway content (assets tree) ===
        {
            method: "GET",
            path: "/wikipathways-assets/pathways/{pwId}/{pwId}.json",
            summary:
                "Full pathway content as JSON (nodes, edges, layout) for ONE pathway — the modern equivalent of GPML. 100–300KB, returned INLINE (does not stage).",
            category: "content",
            responseShape:
                "{ pathway: { ...metadata }, entitiesById: { [id: string]: { gpmlElementName, type, textContent?, xrefIdentifier?, xrefDataSource?, ... } } }",
            usageHint:
                "Replaces old getPathway?pwId=.. (which returned Base64 GPML); this is plain JSON. TWO gotchas: (1) the pathway ID appears TWICE in the path — build it with a template string and pass NO params object; api.get('/wikipathways-assets/pathways/{pwId}/{pwId}.json', { pwId }) THROWS 'Missing required path parameter' because a repeated path token is not supported. (2) It is 100–300KB and does not stage, so extract fields — never return the whole object.",
            example:
                "const id = 'WP554';\nconst p = await api.get(`/wikipathways-assets/pathways/${id}/${id}.json`);\nconst nodes = Object.values(p.entitiesById)\n  .filter(e => e.gpmlElementName === 'DataNode')\n  .map(e => ({ label: e.textContent, xref: e.xrefIdentifier, db: e.xrefDataSource }));\nreturn { name: p.pathway && p.pathway.name, nodeCount: nodes.length, nodes: nodes.slice(0, 25) };",
            featured: true,
        },
        {
            method: "GET",
            path: "/wikipathways-assets/pathways/{pwId}/{pwId}.gpml",
            summary:
                "Raw GPML (Graphical Pathway Markup Language, XML) for ONE pathway. Returned as a TEXT string, not JSON (~40KB for WP554).",
            category: "content",
            usageHint:
                "Replaces old getPathway / getPathwayAs(fileType='gpml'). No longer Base64-encoded — raw XML text. The ID repeats in the path: use a template string, pass no params object.",
            example: "const id = 'WP554';\nconst gpml = await api.get(`/wikipathways-assets/pathways/${id}/${id}.gpml`);\nreturn { bytes: String(gpml).length };",
        },
        {
            method: "GET",
            path: "/wikipathways-assets/pathways/{pwId}/{pwId}.svg",
            summary:
                "Rendered pathway diagram as SVG for ONE pathway. Returned as a TEXT string (~100KB for WP554).",
            category: "content",
            usageHint:
                "Replaces old getPathwayAs(fileType='svg'). No longer Base64-encoded. Large — return a length/summary, not the markup. The ID repeats in the path: use a template string, pass no params object.",
            example: "const id = 'WP554';\nconst svg = await api.get(`/wikipathways-assets/pathways/${id}/${id}.svg`);\nreturn { bytes: String(svg).length };",
        },
    ],
    workflows: [
        {
            title: "Find human pathways matching a term, then inspect one",
            description:
                "The canonical two-step: SQL text search over the staged bulk file, then pull one pathway's content from the assets tree.",
            keywords: ["search", "text", "pathway", "gene", "inspect"],
            code:
                "const r = await api.get('/json/findPathwaysByText.json');\nconst hits = await api.query(r.data_access_id,\n  \"SELECT id, name FROM pathwayinfo WHERE species = 'Homo sapiens' \" +\n  \"AND (lower(name) LIKE '%statin%' OR lower(datanodes) LIKE '%statin%') LIMIT 10\");\nif (!hits.results.length) return { hits: [] };\nconst id = hits.results[0].id;\nconst full = await api.get(`/wikipathways-assets/pathways/${id}/${id}.json`);\nconst nodes = Object.values(full.entitiesById).filter(e => e.gpmlElementName === 'DataNode');\nreturn { hits: hits.results, inspected: id, nodeCount: nodes.length };",
        },
        {
            title: "Gene → pathways (replaces findPathwaysByXref + getXrefList)",
            description:
                "Which pathways contain a gene. Note the ~11.4MB fetch — do it once and reuse the data_access_id.",
            keywords: ["xref", "gene", "uniprot", "ensembl", "ncbigene", "chebi", "metabolite"],
            code:
                "const r = await api.get('/json/findPathwaysByXref.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT id, name, species FROM pathwayinfo \" +\n  \"WHERE hgnc LIKE '%hgnc.symbol:TP53,%' OR hgnc LIKE '%hgnc.symbol:TP53' LIMIT 25\");",
        },
        {
            title: "Disease/pathway ontology term → pathways",
            description:
                "Works for ANY term (not just the 21 top-level ones) by inverting getOntologyTermsByPathway.",
            keywords: ["ontology", "disease", "DOID", "PW", "cell type", "annotation"],
            code:
                "const r = await api.get('/json/getOntologyTermsByPathway.json');\nreturn await api.query(r.data_access_id,\n  \"SELECT p.id, t.name AS term, t.ontology FROM pathways_terms t \" +\n  \"JOIN pathways p ON t.parent_id = p._rowid \" +\n  \"WHERE t.id = 'DOID:1287' LIMIT 20\");",
        },
    ],
};
