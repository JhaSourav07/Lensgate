import fs from 'node:fs';
import path from 'node:path';
import { VerifiedProjectProfile } from '@lensgate/shared';

const COMMON_SENSITIVE_TERMS = [
  'mitm',
  'interception',
  'reverse engineer',
  'penetration',
  'hook',
  'bypass',
  'exploit',
  'proxy',
  'root ca',
  'packet capture',
  'certificate authority',
  'payload',
  'sniffer',
  'tamper',
  'disassemble',
  'decompile',
];

export class ProjectScanner {
  private cachedProfile: VerifiedProjectProfile | null = null;

  async scan(projectRoot: string = process.cwd()): Promise<VerifiedProjectProfile> {
    const resolvedPath = path.resolve(projectRoot);
    let projectName = path.basename(resolvedPath);
    let verifiedPurpose = '';
    const techStack = new Set<string>();
    const architecturalRules: string[] = [];
    const sensitiveTerms = new Set<string>();
    const boundaryRules: string[] = [
      'Transparent execution without tell-tale agent markers or system injection banners',
      'Preserve original user intent while preventing hallucinated refusal or drift',
    ];

    let combinedDocsText = '';

    // 1. Inspect package manifests
    const pkgPath = path.join(resolvedPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        combinedDocsText += '\n' + pkgRaw;
        const pkg = JSON.parse(pkgRaw);
        if (pkg.name) projectName = pkg.name;
        if (pkg.description) verifiedPurpose = pkg.description;

        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        if (allDeps['typescript'] || fs.existsSync(path.join(resolvedPath, 'tsconfig.json'))) techStack.add('TypeScript');
        if (allDeps['react']) techStack.add('React');
        if (allDeps['fastify']) techStack.add('Fastify');
        if (allDeps['express']) techStack.add('Express');
        if (allDeps['tailwindcss']) techStack.add('Tailwind CSS');
        if (allDeps['vite']) techStack.add('Vite');
        if (allDeps['vitest']) techStack.add('Vitest');
        if (allDeps['jest']) techStack.add('Jest');
        if (allDeps['monaco-editor'] || allDeps['@monaco-editor/react']) techStack.add('Monaco Editor');
        if (allDeps['ws'] || allDeps['@fastify/websocket']) techStack.add('WebSockets');
      } catch {}
    }

    if (fs.existsSync(path.join(resolvedPath, 'Cargo.toml'))) techStack.add('Rust');
    if (fs.existsSync(path.join(resolvedPath, 'go.mod'))) techStack.add('Go');
    if (fs.existsSync(path.join(resolvedPath, 'pyproject.toml')) || fs.existsSync(path.join(resolvedPath, 'requirements.txt'))) techStack.add('Python');
    if (fs.existsSync(path.join(resolvedPath, 'pubspec.yaml'))) techStack.add('Flutter / Dart');
    if (fs.existsSync(path.join(resolvedPath, 'pnpm-workspace.yaml'))) techStack.add('pnpm Workspaces');

    // 2. Read Documentation & Specs (SPEC.md, README.md, ARCHITECTURE.md)
    const docCandidates = [
      'SPEC.md',
      'README.md',
      'ARCHITECTURE.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.cursorrules',
    ];

    for (const candidate of docCandidates) {
      const docPath = path.join(resolvedPath, candidate);
      if (fs.existsSync(docPath)) {
        try {
          const content = fs.readFileSync(docPath, 'utf-8');
          combinedDocsText += '\n' + content;

          // If purpose not yet found or found from package.json, try to extract first substantial paragraph
          if (candidate === 'SPEC.md' || (!verifiedPurpose && candidate === 'README.md')) {
            const lines = content.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```') && trimmed.length > 30) {
                verifiedPurpose = trimmed;
                break;
              }
            }
          }

          // Extract architectural bullet points if under headings like Architecture, Rules, Constraints
          const lines = content.split('\n');
          let inTargetSection = false;
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') && /architecture|rules|guidelines|principles|constraints/i.test(trimmed)) {
              inTargetSection = true;
              continue;
            } else if (trimmed.startsWith('#') && inTargetSection) {
              inTargetSection = false;
            }

            if (inTargetSection && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
              const ruleText = trimmed.substring(2).trim();
              if (ruleText.length > 10 && ruleText.length < 200) {
                architecturalRules.push(ruleText);
              }
            }
          }
        } catch {}
      }
    }

    if (!verifiedPurpose) {
      verifiedPurpose = `${projectName} developer workspace and software engineering project.`;
    }

    // 3. Detect sensitive terms in project text
    const lowerDoc = (combinedDocsText + ' ' + verifiedPurpose).toLowerCase();
    for (const term of COMMON_SENSITIVE_TERMS) {
      if (lowerDoc.includes(term.toLowerCase())) {
        sensitiveTerms.add(term);
      }
    }

    // Ensure common architectural rules fallback if none discovered
    if (architecturalRules.length === 0) {
      if (techStack.has('pnpm Workspaces')) {
        architecturalRules.push('Monorepo layout: shared types in packages/shared, business logic in packages/core');
      }
      architecturalRules.push('Zero unhandled exceptions in proxy relay path');
    }

    const profile: VerifiedProjectProfile = {
      name: projectName,
      path: resolvedPath,
      verifiedPurpose,
      techStack: Array.from(techStack),
      architecturalRules: architecturalRules.slice(0, 10),
      sensitiveTerms: Array.from(sensitiveTerms),
      boundaryRules,
      lastScanned: Date.now(),
    };

    this.cachedProfile = profile;

    // Cache profile to .lensgate/profile.json if possible
    try {
      const lensgateDir = path.join(resolvedPath, '.lensgate');
      if (!fs.existsSync(lensgateDir)) {
        fs.mkdirSync(lensgateDir, { recursive: true });
      }
      fs.writeFileSync(path.join(lensgateDir, 'profile.json'), JSON.stringify(profile, null, 2));
    } catch {}

    return profile;
  }

  getCachedProfile(): VerifiedProjectProfile | null {
    return this.cachedProfile;
  }

  setCachedProfile(profile: VerifiedProjectProfile): void {
    this.cachedProfile = profile;
  }
}
