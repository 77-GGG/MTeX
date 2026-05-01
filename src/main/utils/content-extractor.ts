export function extractPlainContent(content: string, format: 'md' | 'tex'): string {
  if (format === 'md') return extractMarkdown(content);
  return extractLatex(content);
}

function extractMarkdown(content: string): string {
  let text = content;

  // Remove YAML frontmatter
  text = text.replace(/^---[\s\S]*?---\n*/m, '');

  // Remove code blocks (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, ' ');

  // Remove inline code
  text = text.replace(/`[^`]+`/g, ' ');

  // Remove images
  text = text.replace(/!\[.*?\]\(.*?\)/g, ' ');

  // Remove links but keep text: [text](url) -> text
  text = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove headings markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic markers
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // Remove blockquote markers
  text = text.replace(/^>\s?/gm, '');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, ' ');

  // Remove list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, ' ');
  text = text.replace(/^\d+\.\s+/gm, ' ');

  // Remove table formatting (keep cell content)
  text = text.replace(/\|/g, ' ');
  text = text.replace(/^[-:\s|]+$/gm, ' ');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Remove LaTeX math blocks
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  text = text.replace(/\$[^$\n]+?\$/g, ' ');

  // Remove wikilinks: [[page]] -> page, [[page|alias]] -> alias
  text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

function extractLatex(content: string): string {
  let text = content;

  // Remove comments
  text = text.replace(/(?<!\\)%.*/g, ' ');

  // Remove preamble (everything before \begin{document})
  const docStart = text.indexOf('\\begin{document}');
  if (docStart >= 0) {
    text = text.substring(docStart);
  }

  // Remove common LaTeX commands with arguments
  const removeCommands = [
    'documentclass', 'usepackage', 'begin', 'end',
    'newcommand', 'renewcommand', 'providecommand',
    'newenvironment', 'renewenvironment',
    'input', 'include', 'bibliography', 'bibliographystyle',
    'label', 'ref', 'cite', 'pageref', 'eqref',
    'emph', 'textbf', 'textit', 'texttt', 'textsc',
    'section', 'subsection', 'subsubsection',
    'caption', 'footnote', 'thanks',
    'centering', 'raggedright', 'raggedleft',
    'hline', 'cline', 'multicolumn', 'addcontentsline',
    'maketitle', 'tableofcontents', 'listoffigures', 'listoftables',
    'newpage', 'clearpage', 'pagebreak', 'linebreak',
  ];

  for (const cmd of removeCommands) {
    // \command{...}
    text = text.replace(new RegExp(`\\\\${cmd}\\s*\\{[^}]*\\}`, 'g'), ' ');
    // \command[...]{...}
    text = text.replace(new RegExp(`\\\\${cmd}\\s*\\[[^\\]]*\\]\\s*\\{[^}]*\\}`, 'g'), ' ');
    // \command*{...}
    text = text.replace(new RegExp(`\\\\${cmd}\\*\\s*\\{[^}]*\\}`, 'g'), ' ');
  }

  // Remove remaining simple commands \foo
  text = text.replace(/\\[a-zA-Z]+\*?\s*/g, ' ');

  // Remove math environments
  text = text.replace(/\$[^$\n]+?\$/g, ' ');
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  text = text.replace(/\\\[[\s\S]*?\\\]/g, ' ');
  text = text.replace(/\\\([\s\S]*?\\\)/g, ' ');

  // Remove braces but keep content
  text = text.replace(/[{}]/g, ' ');

  // Remove special characters
  text = text.replace(/[&~^_#]/g, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
