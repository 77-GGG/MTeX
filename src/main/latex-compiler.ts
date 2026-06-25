import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export interface CompileResult {
  success: boolean;
  pdfPath?: string;
  log: string;
  errors: string[];
}

function detectTexBin(): { latex: string; bibtex: string } | null {
  const pairs = [
    { latex: '/Library/TeX/texbin/xelatex', bibtex: '/Library/TeX/texbin/bibtex' },
    { latex: '/Library/TeX/texbin/pdflatex', bibtex: '/Library/TeX/texbin/bibtex' },
  ];

  for (const p of pairs) {
    try {
      execSync(`test -x "${p.latex}"`, { stdio: 'ignore' });
      return p;
    } catch { /* continue */ }
  }
  return null;
}

let texBinPaths: { latex: string; bibtex: string } | null = null;

export function getTexBin(): { latex: string; bibtex: string } | null {
  if (!texBinPaths) texBinPaths = detectTexBin();
  return texBinPaths;
}

export async function compileLatex(filePath: string, workspaceRoot: string): Promise<CompileResult> {
  const texBins = getTexBin();
  if (!texBins) {
    return {
      success: false,
      log: '',
      errors: ['LaTeX distribution not found. Please install MacTeX (https://tug.org/mactex/) or TeX Live.'],
    };
  }

  const fullPath = path.join(workspaceRoot, filePath);
  const sourceDir = path.dirname(fullPath);
  const basename = path.basename(filePath, '.tex');
  const absPath = path.resolve(fullPath);

  // Create temp directory for build artifacts (.aux, .log, .pdf)
  const buildDir = path.join(os.tmpdir(), 'mtex-latex-' + Date.now());
  await fs.mkdir(buildDir, { recursive: true });

  const errors: string[] = [];

  return new Promise((resolve) => {
    const proc = spawn(texBins.latex, [
      '-interaction=nonstopmode',
      // Disable \write18 shell-escape so a malicious .tex cannot run commands.
      '-no-shell-escape',
      '-output-directory=' + buildDir,
      absPath,
    ], {
      cwd: sourceDir,
      timeout: 60000,
    });

    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.on('close', () => {
      // Parse errors from log
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('!')) {
          errors.push(line.substring(1).trim());
          const idx = lines.indexOf(line);
          if (idx >= 0 && idx + 2 < lines.length) {
            const ctx1 = lines[idx + 1]?.trim();
            const ctx2 = lines[idx + 2]?.trim();
            if (ctx1) errors.push('  ' + ctx1);
            if (ctx2) errors.push('  ' + ctx2);
          }
        }
      }

      // Check for LaTeX warnings that indicate missing packages
      for (const line of lines) {
        if (line.includes('LaTeX Error: File') && line.includes('not found')) {
          errors.push(line.trim());
        }
      }

      const pdfPath = path.join(buildDir, basename + '.pdf');
      fs.access(pdfPath).then(() => {
        resolve({ success: true, pdfPath, log: stdout, errors });
      }).catch(() => {
        resolve({ success: false, log: stdout, errors });
      });
    });

    proc.on('error', (err) => {
      resolve({ success: false, log: '', errors: [err.message] });
    });
  });
}
