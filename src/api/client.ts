/**
 * VanBlog HTTP API client
 *
 * Thin wrapper around fetch() that injects the auth token and
 * centralises error handling.
 *
 * Endpoint conventions (VanBlog / NestJS Swagger):
 *   ───────────────────────────────────────────
 *   POST   /api/article         create article
 *   PUT    /api/article/:id     update article
 *   DELETE /api/article/:id     delete article
 *   GET    /api/article/:id     get single article
 *   GET    /api/article         list articles
 *   POST   /api/upload          upload file (multipart)
 *   ───────────────────────────────────────────
 *
 * @see https://vanblog.mereith.com/reference/api.html
 */

import { VANBLOG_AUTH_HEADER } from './types';
import type {
	ApiResponse,
	ArticlePayload,
	ArticleResponse,
	ArticleListResponse,
	UploadResponse,
} from './types';

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

export class VanBlogApiClient {
	private baseUrl: string;
	private token: string;

	constructor(baseUrl: string, token: string) {
		// Strip trailing slash
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.token = token;
	}

	// ──── Auth ─────────────────────────────────────────────

	setCredentials(baseUrl: string, token: string): void {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.token = token;
	}

	// ──── Articles ─────────────────────────────────────────

	/** Create a new article. Returns the created article. */
	async createArticle(payload: ArticlePayload): Promise<ArticleResponse> {
		return this.request<ArticleResponse>('/api/article', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	}

	/** Update an existing article identified by its numeric id. */
	async updateArticle(
		id: string | number,
		payload: Partial<ArticlePayload>,
	): Promise<ArticleResponse> {
		return this.request<ArticleResponse>(`/api/article/${id}`, {
			method: 'PUT',
			body: JSON.stringify(payload),
		});
	}

	/** Delete an article. */
	async deleteArticle(id: string | number): Promise<void> {
		await this.request<unknown>(`/api/article/${id}`, {
			method: 'DELETE',
		});
	}

	/** Get a single article by id. */
	async getArticle(id: string | number): Promise<ArticleResponse> {
		return this.request<ArticleResponse>(`/api/article/${id}`, {
			method: 'GET',
		});
	}

	/**
	 * List articles (paginated).
	 * @param page  Page number (1‑based)
	 * @param pageSize  Items per page (default 10)
	 */
	async listArticles(
		page = 1,
		pageSize = 10,
	): Promise<ArticleListResponse> {
		return this.request<ArticleListResponse>(
			`/api/article?page=${page}&pageSize=${pageSize}`,
			{ method: 'GET' },
		);
	}

	// ──── Media – Upload ───────────────────────────────────

	/**
	 * Upload a file (image / attachment) to the VanBlog built‑in image
	 * hosting service.
	 *
	 * Sends the raw binary data as multipart/form-data.
	 *
	 * @param fileName  Original file name (used for Content-Disposition)
	 * @param blob       File content as a Blob / ArrayBuffer
	 * @param mimeType   MIME type (e.g. image/png, image/jpeg)
	 */
	async uploadFile(
		fileName: string,
		blob: ArrayBuffer,
		mimeType: string,
	): Promise<UploadResponse> {
		const formData = new FormData();
		formData.append('file', new Blob([blob], { type: mimeType }), fileName);

		return this.requestRaw<UploadResponse>('/api/upload', {
			method: 'POST',
			body: formData,
		});
	}

	// ──── Internal helpers ─────────────────────────────────

	private headers(extra: Record<string, string> = {}): Record<string, string> {
		return {
			[VANBLOG_AUTH_HEADER]: this.token,
			'Content-Type': 'application/json',
			...extra,
		};
	}

	/**
	 * JSON request with Content-Type: application/json.
	 * Automatically injects the auth token.
	 */
	private async request<T>(
		path: string,
		init: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const res = await fetch(url, {
			...init,
			headers: {
				...this.headers(),
				...((init.headers as Record<string, string>) ?? {}),
			},
		});

		return this.handleResponse<T>(res);
	}

	/**
	 * Raw request – does NOT set Content-Type so the browser sets it
	 * automatically for FormData (multipart boundary).
	 */
	private async requestRaw<T>(
		path: string,
		init: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const res = await fetch(url, {
			...init,
			headers: {
				[VANBLOG_AUTH_HEADER]: this.token,
				...((init.headers as Record<string, string>) ?? {}),
			},
		});

		return this.handleResponse<T>(res);
	}

	private async handleResponse<T>(res: Response): Promise<T> {
		if (!res.ok) {
			let body: unknown;
			try {
				body = await res.json();
			} catch {
				body = await res.text().catch(() => null);
			}
			const msg =
				typeof body === 'object' && body !== null
					? (body as ApiResponse).message ?? res.statusText
					: res.statusText;
			throw new VanBlogApiError(msg, res.status, body);
		}

		// Some endpoints return { code, message, data } wrapper
		const body = (await res.json()) as ApiResponse<T>;

		// If the response follows the standard envelope, unwrap .data
		if (body.code !== undefined && body.data !== undefined) {
			return body.data as T;
		}

		// Otherwise return the body directly (some endpoints return the resource directly)
		return body as unknown as T;
	}
}
