import { spawn } from 'child_process';
import { createServer } from 'vite';

async function startDev() {
  // Start Vite dev server
  const viteServer = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5173, strictPort: true },
  });
  await viteServer.listen();
  console.log('[vite] Dev server running at http://localhost:5173');

  // Build main & preload in watch mode
  const mainBuild = spawn('npx', ['tsc', '-p', 'tsconfig.main.json', '--watch', '--preserveWatchOutput'], {
    shell: true,
    stdio: 'inherit',
  });

  const preloadBuild = spawn('npx', ['tsc', '-p', 'tsconfig.preload.json', '--watch', '--preserveWatchOutput'], {
    shell: true,
    stdio: 'inherit',
  });

  // Wait for initial build, then start Electron
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
      NODE_ENV: 'development',
    },
  });

  electron.on('close', () => {
    mainBuild.kill();
    preloadBuild.kill();
    viteServer.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error(err);
  process.exit(1);
});
