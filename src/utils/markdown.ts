/**
 * Markdown utilities for the VanBlog Publisher plugin.
 *
 * Responsible for:
 *   - Parsing embedded file references (images, attachments) from markdown content.
 *   - Replacing local paths with remote URLs after upload.
 *   - Extracting front‑matter (title, tags, category).
 */


// ──────────────────── Embedded file detection ────────────────────

export interface EmbeddedFileRef {
	/**
	 * The full match string as it appears in the source, e.g.
	 *   `![[image.png]]` or `[asset](file:///path/to/file.pdf)`
	 */
	fullMatch: string;
	/** The raw link text as written in the markdown (e.g. "image.png" or "folder/image.png") */
	rawPath: string;
	/** The resolved file path inside the vault */
	filePath: string;
	/** File name (basename) */
	fileName: string;
}

/**
 * Regex patterns for Obsidian wiki‑style embeds and standard markdown links.
 *
 * Wiki‑style:   ![[file.png]]      or   ![[file.png|alt]]
 *                 [[file.pdf]]      (non‑image embed)
 * Markdown:     ![alt](path)       or   [text](path)
 */
const WIKI_IMAGE_RE = /!\[\[([^\]|]+(?:\.[a-zA-Z0-9]+))(?:\|[^\]]*)?\]\]/g;
const WIKI_LINK_RE = /\[\[([^\]|]+(?:\.[a-zA-Z0-9]+))(?:\|[^\]]*)?\]\]/g;
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

/** File extensions considered "embeddable media" that should be uploaded first. */
const MEDIA_EXTENSIONS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp',
	'mp4', 'webm', 'ogg', 'mov',
	'mp3', 'wav', 'flac', 'aac',
	'pdf',
]);

function isMediaFile(fileName: string): boolean {
	const ext = fileName.split('.').pop()?.toLowerCase();
	return ext ? MEDIA_EXTENSIONS.has(ext) : false;
}

/**
 * Scan markdown source and return all embedded file references.
 *
 * Both wiki‑style embeds (`![[image.png]]`) and standard markdown
 * images/links (`![alt](./path)`) are detected.
 */
export function findEmbeddedFiles(content: string, sourceDir: string): EmbeddedFileRef[] {
	const refs: EmbeddedFileRef[] = [];
	const seen = new Set<string>();

	const addRef = (fullMatch: string, rawPath: string) => {
		// Skip URLs (http://, https://, data:)
		if (/^(https?:|data:|file:\/\/)/i.test(rawPath)) return;
		// Skip anchor-only
		if (rawPath.startsWith('#')) return;
		// Skip obsidian internal links (no extension → probably a note)
		if (!rawPath.includes('.')) return;

		// Decode URI-encoded paths
		const decoded = decodeURIComponent(rawPath);
		// Resolve relative to the source file's directory
		const resolved = decoded.startsWith('/')
			? decoded.slice(1)
			: sourceDir
				? `${sourceDir}/${decoded.replace(/^\.\//, '')}`
				: decoded.replace(/^\.\//, '');

		const key = resolved.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);

		refs.push({
			fullMatch,
			rawPath: decoded,
			filePath: resolved,
			fileName: decoded.split('/').pop() ?? decoded,
		});
	};

	// Wiki-style image embeds: ![[file.png]]
	let match: RegExpExecArray | null;
	while ((match = WIKI_IMAGE_RE.exec(content)) !== null) {
		addRef(match[0], match[1]!);
	}

	// Wiki-style link embeds: [[file.pdf]]
	while ((match = WIKI_LINK_RE.exec(content)) !== null) {
		if (!isMediaFile(match[1]!)) continue;
		addRef(match[0], match[1]!);
	}

	// Markdown images: ![alt](path)
	while ((match = MD_IMAGE_RE.exec(content)) !== null) {
		addRef(match[0], match[2]!);
	}

	// Markdown links: [text](path)
	while ((match = MD_LINK_RE.exec(content)) !== null) {
		if (!isMediaFile(match[2]!)) continue;
		addRef(match[0], match[2]!);
	}

	return refs;
}

// ──────────────────── URL replacement ────────────────────

export interface Replacement {
	/** The full match string (e.g. `![[image.png]]` or `![alt](./path)`) */
	fullMatch: string;
	/** The raw path portion inside the match (e.g. `image.png` or `./path`) */
	rawPath: string;
	/** The remote URL to replace the raw path with */
	remoteUrl: string;
}

/**
 * Apply all replacements to the source content.
 *
 * Wiki-style embeds are converted to standard markdown format:
 *   `![[image.png]]`        → `![image](https://remote.url/img.png)`
 *   `![[image.png|alt]]`    → `![alt](https://remote.url/img.png)`
 *   `[[file.pdf]]`          → `[file](https://remote.url/file.pdf)`
 *
 * Standard markdown links keep their format:
 *   `![alt](./image.png)`   → `![alt](https://remote.url/img.png)`
 *
 * @param content   Original markdown text
 * @param replacements List of { fullMatch, rawPath, remoteUrl } triples
 * @returns Content with replacements applied
 */
export function applyReplacements(
	content: string,
	replacements: Replacement[],
): string {
	let result = content;
	for (const { fullMatch, rawPath, remoteUrl } of replacements) {
		const escaped = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		result = result.replace(new RegExp(escaped, 'g'), () => {
			// Wiki-style image: ![[path]] or ![[path|alt]]
			const wikiImgMatch = fullMatch.match(/^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/);
			if (wikiImgMatch) {
				const alt = wikiImgMatch[2]?.trim()
					|| wikiImgMatch[1]!.replace(/\.[^.]+$/, '').split('/').pop()
					|| 'image';
				return `![${alt}](${remoteUrl})`;
			}

			// Wiki-style link: [[path]]
			const wikiLinkMatch = fullMatch.match(/^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/);
			if (wikiLinkMatch) {
				const text = wikiLinkMatch[2]?.trim()
					|| wikiLinkMatch[1]!.replace(/\.[^.]+$/, '').split('/').pop()
					|| 'file';
				return `[${text}](${remoteUrl})`;
			}

			// Standard markdown: replace path inside the match
			const idx = fullMatch.indexOf(rawPath);
			if (idx === -1) return remoteUrl;
			const prefix = fullMatch.slice(0, idx);
			const suffix = fullMatch.slice(idx + rawPath.length);
			return prefix + remoteUrl + suffix;
		});
	}
	return result;
}

// ──────────────────── Front‑matter parsing ────────────────────

/**
 * Minimal YAML front‑matter parser.
 *
 * Only handles the fields we need: title, tags, category, top, password, hide.
 */
export interface FrontMatter {
	title?: string;
	tags?: string[];
	category?: string;
	top?: number;
	password?: string;
	hide?: boolean;
	slug?: string;
		copyright?: string;
	vanblogId?: string | number;
	author?: string;
	date?: string;
}

/**
 * Extract front‑matter and content body from a markdown string.
 * Returns the parsed front‑matter and the body (with front‑matter stripped).
 */
export function parseFrontMatter(content: string): {
	frontmatter: FrontMatter;
	body: string;
} {
	const frontmatter: FrontMatter = {};
	let body = content;

	const fmMatch = /^---\n([\s\S]*?)\n---\n/.exec(content);
	if (fmMatch) {
		const raw = fmMatch[1] ?? '';
		body = content.slice(fmMatch[0].length);

		// Simple line‑by‑line YAML parsing for known fields
		const lines = raw.split('\n');
		for (const line of lines) {
			const colonIdx = line.indexOf(':');
			if (colonIdx === -1) continue;

			const key = line.slice(0, colonIdx).trim();
			const value: string = line.slice(colonIdx + 1).trim();

			if (key === 'tags') {
				// tags: [tag1, tag2] or tags: tag1, tag2
				const tagMatch = value.match(/^\[(.*)\]$/);
				if (tagMatch && tagMatch[1]) {
					frontmatter.tags = tagMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean);
				} else if (typeof value === 'string' && value) {
					frontmatter.tags = value.split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean);
				}
				continue;
			}

			if (key === 'title') {
				frontmatter.title = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'category') {
				frontmatter.category = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'top' || key === 'priority') {
				frontmatter.top = Number(value) || 0;
				continue;
			}

			if (key === 'password') {
				frontmatter.password = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'hide' || key === 'hidden') {
				frontmatter.hide =
					value === 'true' || value === 'yes' || value === '1';
				continue;
			}

			if (key === 'slug') {
				frontmatter.slug = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'copyright') {
				frontmatter.copyright = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'author') {
				frontmatter.author = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'date') {
				frontmatter.date = String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}

			if (key === 'vanblog-id') {
				frontmatter.vanblogId = Number(value) || String(value).replace(/^['"]|['"]$/g, '');
				continue;
			}
		}
	}

	return { frontmatter, body };
}

/**
 * Prepend front‑matter to content.
 * Useful when we need to add/update front-matter after publishing.
 */
export function withFrontMatter(
	body: string,
	frontmatter: FrontMatter,
): string {
	const lines = ['---'];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			lines.push(`${key}: [${value.join(', ')}]`);
		} else if (typeof value === 'boolean') {
			lines.push(`${key}: ${value}`);
		} else if (typeof value === 'number') {
			lines.push(`${key}: ${value}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	lines.push('---', '');
	return lines.join('\n') + body;
}

// ──────────────────── VanBlog file properties ────────────────────

/** VanBlog metadata stored as front-matter properties in the local file. */
export interface VanBlogFileProps {
	'vanblog-id': string | number;
	'vanblog-published-at': string;
	'vanblog-url': string;
	'vanblog-images'?: string;
}

/**
 * Remove all `vanblog-*` lines from the front-matter.
 */
export function stripVanBlogProperties(content: string): string {
	return content
		.replace(/^vanblog-.*$/gm, '')
		.replace(/\n{2,}/g, '\n')
		.trimStart();
}

/**
 * Merge VanBlog properties into the existing front-matter.
 * Creates front‑matter if none exists.
 */
export function addVanBlogProperties(
	content: string,
	props: VanBlogFileProps,
): string {
	// Remove any stale vanblog-* lines first
	const cleaned = stripVanBlogProperties(content);

	const fmMatch = /^---\n/.exec(cleaned);
	if (fmMatch) {
		const lines = buildPropsLines(props);
		return cleaned.slice(0, 4) + lines + cleaned.slice(4);
	}

	// No front‑matter — create one
	return '---\n' + buildPropsLines(props) + '---\n' + cleaned;
}

function buildPropsLines(props: VanBlogFileProps): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			if (value.length > 0) {
				lines.push(`${key}: [${value.join(', ')}]`);
			}
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	return lines.length > 0 ? lines.join('\n') + '\n' : '';
}
