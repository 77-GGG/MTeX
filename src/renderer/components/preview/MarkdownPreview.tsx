import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import katex from 'katex';
import DOMPurify from 'dompurify';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(str: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
            '</code></pre>';
        } catch { /* fall through */ }
      }
      return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    },
  });

  // Wikilinks: [[target]] or [[target|alias]]
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x5b /* [ */) return false;
    if (state.src.charCodeAt(start + 1) !== 0x5b /* [ */) return false;

    const end = state.src.indexOf(']]', start + 2);
    if (end === -1) return false;

    if (!silent) {
      const raw = state.src.slice(start + 2, end);
      const pipe = raw.indexOf('|');
      const target = pipe >= 0 ? raw.slice(0, pipe) : raw;
      const alias = pipe >= 0 ? raw.slice(pipe + 1) : target;

      const token = state.push('wikilink', '', 0);
      token.attrSet('data-target', target.trim());
      token.content = alias.trim();
    }

    state.pos = end + 2;
    return true;
  });

  // Render wikilink tokens
  md.renderer.rules.wikilink = (tokens, idx) => {
    const token = tokens[idx];
    const target = token.attrGet('data-target') || token.content;
    const text = md.utils.escapeHtml(token.content);
    return `<a href="#" class="wikilink" data-target="${md.utils.escapeHtml(target)}">${text}</a>`;
  };

  // KaTeX math: $...$ and $$...$$
  const defaultText = md.renderer.rules.text || ((tokens, idx) => md.utils.escapeHtml(tokens[idx].content));

  md.renderer.rules.text = (tokens, idx) => {
    const content = tokens[idx].content;
    // Block math $$...$$
    if (/^\$\$[\s\S]+\$\$$/.test(content)) {
      const math = content.slice(2, -2);
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false });
      } catch {
        return `<pre>${md.utils.escapeHtml(content)}</pre>`;
      }
    }
    return defaultText(tokens, idx);
  };

  // Inline math: parse $...$ within text
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
    if (state.src.charCodeAt(start + 1) === 0x24) return false; // skip $$ block math

    // Find matching $
    let end = start + 1;
    let escaped = false;
    while (end < state.src.length) {
      if (state.src.charCodeAt(end) === 0x5c /* \ */) { escaped = true; end++; continue; }
      if (state.src.charCodeAt(end) === 0x24 /* $ */ && !escaped) break;
      escaped = false;
      end++;
    }
    if (end >= state.src.length || end === start + 1) return false;

    if (!silent) {
      const math = state.src.slice(start + 1, end);
      try {
        const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
        const token = state.push('html_inline', '', 0);
        token.content = html;
      } catch {
        // fall through to default
        const token = state.push('text', '', 0);
        token.content = state.src.slice(start, end + 1);
      }
    }

    state.pos = end + 1;
    return true;
  });

  return md;
}

let mdInstance: MarkdownIt | null = null;
function getMarkdownIt(): MarkdownIt {
  if (!mdInstance) mdInstance = createMarkdownIt();
  return mdInstance;
}

export default function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const md = getMarkdownIt();
    const rendered = md.render(content);
    return DOMPurify.sanitize(rendered, {
      ADD_ATTR: ['data-target'],
      ADD_TAGS: ['span', 'annotation', 'semantics', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext', 'menclose', 'mtable', 'mtr', 'mtd', 'munder', 'mover'],
    });
  }, [content]);

  return (
    <div
      className={`markdown-preview prose prose-sm dark:prose-invert max-w-none p-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
