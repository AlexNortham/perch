import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Playwright browser for e2e and shots: the installed Microsoft Edge, so nobody downloads a browser.
// Without Edge it falls back to Playwright's bundled Chromium (`npx playwright install chromium` once).
const edgePaths =
  process.platform === 'win32'
    ? ['LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)'].map((v) =>
        join(process.env[v] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
      )
    : process.platform === 'darwin'
      ? ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/opt/microsoft/msedge/msedge'];

export const channel = edgePaths.some((p) => existsSync(p)) ? 'msedge' : undefined;

// Headless WebGL uses the real GPU through ANGLE where there is one (D-BUILD-004). Without a usable GPU,
// recent Chromium refuses WebGL unless SwiftShader is explicitly allowed as the software fallback.
export const args = ['--enable-unsafe-swiftshader'];
