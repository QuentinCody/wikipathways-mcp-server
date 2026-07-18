/**
 * WikiPathways HTTP client with rate limit handling.
 *
 * WikiPathways is open access (CC0 license), no auth required.
 *
 * REPOINTED 2026-07-16: the classic webservice at webservice.wikipathways.org
 * was retired upstream (404 on every endpoint). The replacement is the static
 * JSON API under https://www.wikipathways.org/json/ plus the per-pathway
 * /wikipathways-assets/ tree. The old `?format=json` query param is gone — the
 * new endpoints are literal .json/.gpml/.svg files and take no parameters.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const WIKIPATHWAYS_BASE = "https://www.wikipathways.org";

export interface WikipathwaysFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    /** Override base URL */
    baseUrl?: string;
}

/**
 * Fetch from the WikiPathways JSON API / assets tree.
 *
 * The endpoints are static files, so no query params are sent unless a caller
 * explicitly passes them (path params are interpolated upstream of this call).
 */
export async function wikipathwaysFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: WikipathwaysFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? WIKIPATHWAYS_BASE;
    const headers: Record<string, string> = {
        // The assets tree serves .gpml/.svg as non-JSON; accept both.
        Accept: "application/json, text/plain, */*",
        ...(opts?.headers ?? {}),
    };

    return restFetch(baseUrl, path, params, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent:
            "wikipathways-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/wikipathways-mcp-server)",
    });
}
