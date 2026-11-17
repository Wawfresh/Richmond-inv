import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const serverBundle = path.join(root, 'server.js');
const htaccessTemplate = path.join(root, 'deploy', 'public_html.htaccess');
const envExample = path.join(root, '.env.example');
const packageJsonPath = path.join(root, 'package.json');

if (!fs.existsSync(distDir) || !fs.existsSync(serverBundle)) {
  console.error('Error: Build outputs missing. Run "npm run build" first.');
  process.exit(1);
}

const outRoot = path.join(root, 'deploy-dist');
const publicHtmlOut = path.join(outRoot, 'public_html');
const nodeAppOut = path.join(outRoot, 'richmond-inv-app');
const singleRootNodeOut = path.join(outRoot, 'richmond-inv-app-single-root');

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(publicHtmlOut, { recursive: true });
fs.mkdirSync(nodeAppOut, { recursive: true });
fs.mkdirSync(singleRootNodeOut, { recursive: true });

// 1. Assemble public_html/ (Apache static frontend + .htaccess)
fs.cpSync(distDir, publicHtmlOut, { recursive: true });
if (fs.existsSync(htaccessTemplate)) {
  fs.copyFileSync(htaccessTemplate, path.join(publicHtmlOut, '.htaccess'));
}

// 2. Build a clean runtime package.json for Namecheap cPanel "Run NPM Install"
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const EXCLUDED_RUNTIME_PACKAGES = new Set([
  '@google/genai',
  '@tailwindcss/vite',
  '@vitejs/plugin-react',
  'lucide-react',
  'motion',
  'react',
  'react-dom',
  'react-router-dom',
  'vite',
  ...(process.env.KEEP_SQLITE === 'true' ? [] : ['better-sqlite3']),
]);

const runtimeDeps = { ...pkg.dependencies };
for (const key of Object.keys(runtimeDeps)) {
  if (key.startsWith('@types/') || EXCLUDED_RUNTIME_PACKAGES.has(key)) {
    delete runtimeDeps[key];
  }
}

const productionPkg = {
  name: pkg.name || 'richmond-inv',
  private: true,
  version: pkg.version || '1.0.0',
  description: pkg.description || '',
  type: 'module',
  main: 'server.js',
  engines: pkg.engines || { node: '>=20.0.0' },
  scripts: {
    start: 'NODE_ENV=production node server.js',
  },
  dependencies: runtimeDeps,
};

function populateNodeApp(targetDir, includeDist) {
  fs.copyFileSync(serverBundle, path.join(targetDir, 'server.js'));
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(productionPkg, null, 2) + '\n', 'utf8');
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, path.join(targetDir, '.env.example'));
  }
  const uploadsDir = path.join(targetDir, 'storage', 'private_uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), '', 'utf8');
  if (includeDist) {
    fs.cpSync(distDir, path.join(targetDir, 'dist'), { recursive: true });
  }
}

// Mode A: Split Apache public_html/ (SERVE_STATIC=false) + /api Node app
populateNodeApp(nodeAppOut, false);

// Mode B: Single-root Node.js Passenger app serving both dist/ and /api (SERVE_STATIC=true)
populateNodeApp(singleRootNodeOut, true);

console.log('Namecheap deployment package assembled cleanly at ./deploy-dist/:');
console.log('  - deploy-dist/public_html/               -> Upload contents to cPanel public_html/ (includes .htaccess)');
console.log('  - deploy-dist/richmond-inv-app/          -> Upload outside public_html/ when cPanel Node is mounted at /api (SERVE_STATIC=false)');
console.log('  - deploy-dist/richmond-inv-app-single-root/ -> Alternative single-folder deploy when cPanel Node serves / directly (SERVE_STATIC=true)');
