import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface Frontmatter {
  title?: string;
  tags?: string[];
  date?: string;
  [key: string]: unknown;
}

export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter | null;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!match) return { frontmatter: null, body: content };

  try {
    const parsed = parseYaml(match[1]);
    return {
      frontmatter: (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        ? parsed as Frontmatter
        : null,
      body: content.substring(match[0].length),
    };
  } catch {
    return { frontmatter: null, body: content };
  }
}

export function serializeFrontmatter(frontmatter: Frontmatter, body: string): string {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trim();
  return `---\n${yaml}\n---\n\n${body}`;
}

export function updateFrontmatterTags(
  content: string,
  tags: string[]
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const updated = { ...(frontmatter || {}), tags };
  return serializeFrontmatter(updated, body);
}

export function extractTitle(filePath: string, content: string, format: 'md' | 'tex'): string {
  // First check frontmatter for title
  if (format === 'md') {
    const { frontmatter } = parseFrontmatter(content);
    if (frontmatter?.title) return frontmatter.title;
  }

  // Then check first heading
  if (format === 'md') {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();
  }

  // Fall back to filename without extension
  const basename = filePath.split('/').pop() || filePath;
  return basename.replace(/\.(md|tex)$/, '');
}
