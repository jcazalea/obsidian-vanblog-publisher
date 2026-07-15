/**
 * VanBlog API type definitions
 *
 * Based on VanBlog's NestJS Swagger API documentation.
 * See also: https://vanblog.mereith.com/reference/api.html
 */

/** API authentication header name used by VanBlog */
export const VANBLOG_AUTH_HEADER = 'token';

// ──────────────────── Article ────────────────────

/** Fields for creating or updating an article */
export interface ArticlePayload {
	title: string;
	content: string;
	tags?: string[];
	category?: string;
	/** Pin priority. 0 or omitted = not pinned. Higher = higher display */
	top?: number;
	/** Password-protect the article (optional) */
	password?: string;
	/** Hide from front‑end listing */
	hide?: boolean;
	/** ISO date string for the article date */
	date?: string;
	author?: string;
	/** Optional URL slug override */
	slug?: string;
}

/** Response returned by the VanBlog article endpoints */
export interface ArticleResponse {
	id: string | number;
	title: string;
	content: string;
	tags: string[];
	category: string;
	top: number;
	hide: boolean;
	date: string;
	author: string;
	slug: string;
	createdAt: string;
	updatedAt: string;
}

/** List‑articles response wrapper */
export interface ArticleListResponse {
	data: ArticleResponse[];
	total: number;
	page: number;
	pageSize: number;
}

// ──────────────────── Tags ────────────────────

/** A tag returned by the VanBlog tag API */
export interface TagItem {
	id: string;
	name: string;
	slug: string;
	articleCount: number;
	createdAt: string;
	updatedAt: string;
}

/** Paginated tag-list response */
export interface TagListResponse {
	data: TagItem[];
	total: number;
	page: number;
	pageSize: number;
}

// ──────────────────── Categories ────────────────────

/** A category returned by the VanBlog category API */
export interface CategoryItem {
	id: string;
	name: string;
	slug: string;
	articleCount: number;
	createdAt: string;
	updatedAt: string;
}

/** Paginated category-list response */
export interface CategoryListResponse {
	data: CategoryItem[];
	total: number;
	page: number;
	pageSize: number;
}

// ──────────────────── Media / Upload ────────────────────

/** Response from a file‑upload endpoint */
export interface UploadResponse {
	/** Public URL of the uploaded file */
	url: string;
	/** File id on the server (if returned) */
	id?: string | number;
	/** File name */
	name?: string;
	/** File size in bytes */
	size?: number;
}

// ──────────────────── Generic API Envelope ────────────────────

/** Standard VanBlog JSON‑API envelope */
export interface ApiResponse<T = unknown> {
	code: number;
	message: string;
	data?: T;
}

// ──────────────────── Plugin Local Data ────────────────────

/** Per‑article record persisted in plugin data */
export interface ArticleRecord {
	/** Absolute (or vault‑relative) path of the source markdown file */
	filePath: string;
	/** Article ID returned by VanBlog */
	articleId: string | number;
	/** Article title (cached for display) */
	title: string;
	/** ISO timestamp of the last publish */
	publishedAt: string;
	/** Whether the article is currently published (not revoked) */
	isPublished: boolean;
}

/** Shape persisted via plugin.loadData / saveData */
export interface PluginData {
	articles: Record<string, ArticleRecord>;
}
