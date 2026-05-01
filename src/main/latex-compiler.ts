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

function detectTexBin(): string | null {
  const paths = [
    '/Library/TeX/texbin/pdflatex',  // macOS MacTeX
    '/usr/bin/pdflatex',              // Linux
    '/usr/local/texlive/2025/bin/x86_64-linux/pdflatex',
  ];

  for (const p of paths) {
    try {
      execSync(`test -x "${p}"`, { stdio: 'ignore' });
      return p;
    } catch { /* continue */ }
  }
  return null;
}

let texBinPath: string | null = null;

export function getTexBin(): string | null {
  if (!texBinPath) texBinPath = detectTexBin();
  return texBinPath;
}

export async function compileLatex(filePath: string, workspaceRoot: string): Promise<CompileResult> {
  const pdflatex = getTexBin();
  if (!pdflatex) {
    return {
      success: false,
      log: '',
      errors: ['LaTeX distribution not found. Please install MacTeX (https://tug.org/mactex/) or TeX Live.'],
    };
  }

  const fullPath = path.join(workspaceRoot, filePath);
  const dir = path.dirname(fullPath);
  const basename = path.basename(filePath, '.tex');

  // Create temp directory for build artifacts
  const buildDir = path.join(os.tmpdir(), 'mtex-latex-' + Date.now());
  await fs.mkdir(buildDir, { recursive: true });

  // Copy .tex file to build dir
  const texFile = path.join(buildDir, basename + '.tex');
  await fs.copyFile(fullPath, texFile);

  const logLines: string[] = [];
  const errors: string[] = [];

  return new Promise((resolve) => {
    const proc = spawn(pdflatex!, [
      '-interaction=nonstopmode',
      '-output-directory=' + buildDir,
      texFile,
    ], { timeout: 60000 });

    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
    });

    proc.on('close', () => {
      logLines.push(stdout);

      // Parse errors
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('!')) {
          errors.push(line.substring(1).trim());
          // Collect context lines
          const idx = lines.indexOf(line);
          if (idx >= 0 && idx + 2 < lines.length) {
            errors.push('  ' + lines[idx + 1]?.trim() || '');
            errors.push('  ' + lines[idx + 2]?.trim() || '');
          }
        }
      }

      const pdfPath = path.join(buildDir, basename + '.pdf');
      fs.access(pdfPath).then(() => {
        resolve({ success: true, pdfPath, log: logLines.join('\n'), errors });
      }).catch(() => {
        resolve({ success: false, log: logLines.join('\n'), errors });
      });
    });

    proc.on('error', (err) => {
      resolve({ success: false, log: '', errors: [err.message] });
    });
  });
}
