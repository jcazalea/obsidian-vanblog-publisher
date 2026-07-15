/**
 * VanBlog HTTP API client
 *
 * Uses Obsidian's `requestUrl` (Electron main-process HTTP) so all requests
 * bypass the renderer's CORS restrictions automatically.
 *
 * Endpoint conventions (VanBlog / NestJS Swagger):
 *   ───────────────────────────────────────────────────────
 *   POST   /api/admin/article                       create article
 *   PUT    /api/admin/article/:id                   update article
 *   DELETE /api/admin/article/:id                   delete article
 *   GET    /api/admin/article/:id                   get single article
 *   GET    /api/admin/article                       list articles
 *   POST   /api/upload                        upload file (multipart)
 *   GET    /api/admin/tag/all   list tags
 *   GET    /api/admin/category/all  list categories
 *   ───────────────────────────────────────────────────────
 *
 * @see https://vanblog.mereith.com/reference/api.html
 */

import { requestUrl } from 'obsidian';
import { VANBLOG_AUTH_HEADER } from './types';
import type {
	ArticlePayload,
	ArticleResponse,
	ArticleListResponse,
	UploadResponse,
	TagItem,
	CategoryItem,
} from './types';

// ──── Errors ──────────────────────────────────────────────

/** Errors thrown by the API client */
export class VanBlogApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public body?: unknown,
	) {
		super(message);
		this.name = 'VanBlogApiError';
	}
}

// ──── Multipart helper ────────────────────────────────────

function buildMultipartBody(
	fileName: string,
	fileData: ArrayBuffer,
	mimeType: string,
	boundary: string,
): { body: ArrayBuffer; contentType: string } {
	const encoder = new TextEncoder();

	// Use RFC 5987 encoding for non-ASCII filenames
	const hasNonAscii = /[^\x20-\x7E]/.test(fileName);
	const safeFileName = fileName.replace(/"/g, '\\"');
	const filenameParam = hasNonAscii
		? `filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
		: `filename="${safeFileName}"`;

	const header = encoder.encode(
		`--${boundary}\r\n`
		+ `Content-Disposition: form-data; name="file"; ${filenameParam}\r\n`
		+ `Content-Type: ${mimeType}\r\n\r\n`,
	);
	const footer = encoder.encode(`\r\n--${boundary}--\r\n`);

	const total = header.byteLength + fileData.byteLength + footer.byteLength;
	const combined = new Uint8Array(total);
	combined.set(new Uint8Array(header), 0);
	combined.set(new Uint8Array(fileData), header.byteLength);
	combined.set(new Uint8Array(footer), header.byteLength + fileData.byteLength);

	return {
		body: combined.buffer as ArrayBuffer,
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

// ──── Client ──────────────────────────────────────────────

export class VanBlogApiClient {
	private baseUrl: string;
	private token: string;

	constructor(baseUrl: string, token: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.token = token;
	}

	// ──── Auth ─────────────────────────────────────────────

	setCredentials(baseUrl: string, token: string): void {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.token = token;
	}

	// ──── Articles ─────────────────────────────────────────

	async createArticle(payload: ArticlePayload): Promise<ArticleResponse> {
		return this.request<ArticleResponse>('/api/admin/article', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	}

	async updateArticle(
		id: string | number,
		payload: Partial<ArticlePayload>,
	): Promise<ArticleResponse> {
		return this.request<ArticleResponse>(`/api/admin/article/${id}`, {
			method: 'PUT',
			body: JSON.stringify(payload),
		});
	}

	async deleteArticle(id: string | number): Promise<void> {
		await this.request<unknown>(`/api/admin/article/${id}`, {
			method: 'DELETE',
		});
	}

	async getArticle(id: string | number): Promise<ArticleResponse> {
		return this.request<ArticleResponse>(`/api/admin/article/${id}`, {
			method: 'GET',
		});
	}

	async listArticles(
		page = 1,
		pageSize = 10,
	): Promise<ArticleListResponse> {
		return this.request<ArticleListResponse>(
			`/api/admin/article?page=${page}&pageSize=${pageSize}`,
			{ method: 'GET' },
		);
	}

	// ──── Tags & Categories ──────────────────────────────

	async getTags(): Promise<string[]> {
		return this.request<string[]>(
			'/api/admin/tag/all',
			{ method: 'GET' },
		);
	}

	async getCategories(): Promise<string[]> {
		return this.request<string[]>(
			'/api/admin/category/all',
			{ method: 'GET' },
		);
	}

		/** Create a new tag. */
		async createTag(name: string): Promise<TagItem> {
			return this.request<TagItem>('/api/admin/tag', {
				method: 'PUT',
				body: JSON.stringify({ name }),
			});
		}

		/** Update an existing tag. */
		async updateTag(id: string | number, name: string): Promise<TagItem> {
			return this.request<TagItem>(`/api/admin/tag/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ name }),
			});
		}

		/** Delete a tag. */
		async deleteTag(id: string | number): Promise<void> {
			await this.request<unknown>(`/api/admin/tag/${id}`, {
				method: 'DELETE',
			});
		}

		/** Create a new category. */
		async createCategory(name: string): Promise<CategoryItem> {
			return this.request<CategoryItem>('/api/admin/category', {
				method: 'POST',
				body: JSON.stringify({ name }),
			});
		}

		/** Update an existing category. */
		async updateCategory(id: string | number, name: string): Promise<CategoryItem> {
			return this.request<CategoryItem>(`/api/admin/category/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ name }),
			});
		}

		/** Delete a category. */
		async deleteCategory(id: string | number): Promise<void> {
			await this.request<unknown>(`/api/admin/category/${id}`, {
				method: 'DELETE',
			});
		}

		/** Verify that the configured baseUrl + token work. */
		async testConnection(): Promise<boolean> {
			try {
				await this.request<unknown>('/api/admin/tag/all', { method: 'GET' });
				return true;
			} catch {
				return false;
			}
		}

		// ---- Media - Upload (placeholder) ----

	/**
	 * Upload a file to the VanBlog built‑in image hosting.
	 *
	 * Builds a multipart/form-data body manually so it works over
	 * `requestUrl` (which does not support the FormData API).
	 */
	async uploadFile(
		fileName: string,
		blob: ArrayBuffer,
		mimeType: string,
	): Promise<UploadResponse> {
		const boundary = `----VanBlogBoundary${Date.now()}`;
		const { body, contentType } = buildMultipartBody(
			fileName,
			blob,
			mimeType,
			boundary,
		);

		const url = `${this.baseUrl}/api/admin/img/upload`;
		const res = await requestUrl({
			url,
			method: 'POST',
			contentType,
			body,
			headers: {
				[VANBLOG_AUTH_HEADER]: this.token,
			},
		});

		return this.parseResponse<UploadResponse>(res);
	}

	async deleteFile(id: string): Promise<void> {
		await this.request<unknown>(`/api/admin/img/${id}`, {
			method: 'DELETE',
		});
	}

	// ──── Internal helpers ─────────────────────────────────

	/**
	 * JSON request with Content-Type: application/json.
	 */
	private async request<T>(
		path: string,
		init: { method: string; body?: string },
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const res = await requestUrl({
			url,
			method: init.method,
			contentType: 'application/json',
			body: init.body,
			headers: {
				[VANBLOG_AUTH_HEADER]: this.token,
			},
		});
		return this.parseResponse<T>(res);
	}

	/**
	 * Parse the `requestUrl` response, unwrapping the VanBlog
	 * `{ code, message, data }` envelope when present.
	 */
	private parseResponse<T>(
		res: { status: number; json: unknown; text: string },
	): T {
		if (res.status < 200 || res.status >= 300) {
			const msg =
				typeof res.json === 'object' && res.json !== null
					? ((res.json as Record<string, unknown>).message as string) ??
						res.text
					: res.text;
			throw new VanBlogApiError(msg, res.status, res.json);
		}

		// VanBlog endpoints normally wrap the result in { code, message, data }
		const body = res.json as { code?: number; statusCode?: number; message?: string; data?: unknown };

		if (body.data !== undefined) {
			return body.data as T;
		}

		// Some endpoints return the resource directly
		return body as unknown as T;
	}
}
