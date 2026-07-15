/**
 * Plugin data store – persists the mapping between local markdown files and
 * their corresponding VanBlog article IDs so we can revoke / update later.
 */

import type { PluginData, ArticleRecord } from './api/types';

/**
 * Key used in the settings object to store the entire map alongside the
 * user‑facing settings.
 */
export const DATA_KEY = 'vanblog-articles';

// ──────── Helpers ───────────────────────────────────────────

/**
 * Create a fresh empty data store.
 */
export function emptyData(): PluginData {
	return { articles: {} };
}

/**
 * Return the record for a given file path, or `null`.
 */
export function getRecord(
	data: PluginData,
	filePath: string,
): ArticleRecord | null {
	return data.articles[filePath] ?? null;
}

/**
 * Upsert a record.
 */
export function setRecord(
	data: PluginData,
	filePath: string,
	record: ArticleRecord,
): void {
	data.articles[filePath] = record;
}

/**
 * Remove a record.
 */
export function removeRecord(data: PluginData, filePath: string): void {
	delete data.articles[filePath];
}

/**
 * Return all records (useful for listing published articles).
 */
export function getAllRecords(data: PluginData): ArticleRecord[] {
	return Object.values(data.articles);
}
