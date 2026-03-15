#!/usr/bin/env node

/**
 * Regression tests for wikipathways-mcp-server structuredContent responses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    failedTests++;
  }
}

function assertFileExists(relPath, testName) {
  totalTests++;
  const fullPath = path.join(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    failedTests++;
    return '';
  }
}

// Verify core server files exist
const index = assertFileExists('src/index.ts', 'index.ts exists');
const doFile = assertFileExists('src/do.ts', 'do.ts exists');
const catalog = assertFileExists('src/spec/catalog.ts', 'catalog.ts exists');
const adapter = assertFileExists('src/lib/api-adapter.ts', 'api-adapter.ts exists');
const http = assertFileExists('src/lib/http.ts', 'http.ts exists');
const codeMode = assertFileExists('src/tools/code-mode.ts', 'code-mode.ts exists');
const queryData = assertFileExists('src/tools/query-data.ts', 'query-data.ts exists');
const getSchema = assertFileExists('src/tools/get-schema.ts', 'get-schema.ts exists');

// Verify key patterns in source
if (index) {
  assertContains('src/index.ts', index, 'WikipathwaysDataDO', 'index exports WikipathwaysDataDO');
  assertContains('src/index.ts', index, 'MyMCP', 'index exports MyMCP');
  assertContains('src/index.ts', index, '/health', 'index has health endpoint');
  assertContains('src/index.ts', index, '/mcp', 'index has mcp endpoint');
}

if (doFile) {
  assertContains('src/do.ts', doFile, 'RestStagingDO', 'DO extends RestStagingDO');
}

if (catalog) {
  assertContains('src/spec/catalog.ts', catalog, 'ApiCatalog', 'catalog exports ApiCatalog');
  assertContains('src/spec/catalog.ts', catalog, 'findPathwaysByText', 'catalog has findPathwaysByText endpoint');
  assertContains('src/spec/catalog.ts', catalog, 'findPathwaysByXref', 'catalog has findPathwaysByXref endpoint');
  assertContains('src/spec/catalog.ts', catalog, 'listOrganisms', 'catalog has listOrganisms endpoint');
  assertContains('src/spec/catalog.ts', catalog, 'getPathwayInfo', 'catalog has getPathwayInfo endpoint');
  assertContains('src/spec/catalog.ts', catalog, 'getOntologyTermsByPathway', 'catalog has ontology endpoint');
}

if (codeMode) {
  assertContains('src/tools/code-mode.ts', codeMode, 'wikipathways_search', 'code-mode registers wikipathways_search');
  assertContains('src/tools/code-mode.ts', codeMode, 'wikipathways_execute', 'code-mode registers wikipathways_execute');
}

if (queryData) {
  assertContains('src/tools/query-data.ts', queryData, 'wikipathways_query_data', 'registers wikipathways_query_data');
}

if (getSchema) {
  assertContains('src/tools/get-schema.ts', getSchema, 'wikipathways_get_schema', 'registers wikipathways_get_schema');
}

if (http) {
  assertContains('src/lib/http.ts', http, 'webservice.wikipathways.org', 'http.ts has correct base URL');
  assertContains('src/lib/http.ts', http, 'format', 'http.ts auto-appends format param');
}

if (adapter) {
  assertContains('src/lib/api-adapter.ts', adapter, 'ApiFetchFn', 'adapter implements ApiFetchFn');
  assertContains('src/lib/api-adapter.ts', adapter, 'wikipathwaysFetch', 'adapter uses wikipathwaysFetch');
}

// Summary
console.log(`\n${passedTests}/${totalTests} tests passed`);
if (failedTests > 0) {
  console.log(`${RED}${failedTests} tests FAILED${RESET}`);
  process.exit(1);
}
