import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AntigravityIntegrationStatus {
  pluginInstalled: boolean;
  pluginPath: string;
  proxyConfigured: boolean;
  settingsPaths: string[];
  active: boolean;
}

export class AntigravityIntegrationManager {
  private pluginsDir: string;
  private targetPluginDir: string;
  private sourcePluginDir: string;
  private settingsPaths: string[];

  constructor() {
    this.pluginsDir = path.join(os.homedir(), '.gemini', 'config', 'plugins');
    this.targetPluginDir = path.join(this.pluginsDir, 'lensgate');
    this.sourcePluginDir = path.resolve(process.cwd(), 'packages', 'antigravity-plugin');

    this.settingsPaths = [
      path.join(os.homedir(), '.config', 'Antigravity IDE', 'User', 'settings.json'),
      path.join(os.homedir(), '.config', 'Antigravity', 'User', 'settings.json'),
    ];
  }

  getStatus(): AntigravityIntegrationStatus {
    const pluginInstalled = fs.existsSync(this.targetPluginDir);
    let proxyConfigured = false;

    for (const sp of this.settingsPaths) {
      if (fs.existsSync(sp)) {
        try {
          const content = JSON.parse(fs.readFileSync(sp, 'utf-8'));
          if (content['http.proxy'] && content['http.proxy'].includes('8088')) {
            proxyConfigured = true;
            break;
          }
        } catch {}
      }
    }

    return {
      pluginInstalled,
      pluginPath: this.targetPluginDir,
      proxyConfigured,
      settingsPaths: this.settingsPaths.filter((p) => fs.existsSync(p)),
      active: pluginInstalled || proxyConfigured,
    };
  }

  attach(options: { configureProxy?: boolean } = { configureProxy: true }): { success: boolean; message: string } {
    try {
      // 1. Install Plugin
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir, { recursive: true });
      }

      if (fs.existsSync(this.targetPluginDir)) {
        try {
          fs.rmSync(this.targetPluginDir, { recursive: true, force: true });
        } catch {}
      }

      // Create symlink to packages/antigravity-plugin
      try {
        fs.symlinkSync(this.sourcePluginDir, this.targetPluginDir, 'dir');
      } catch {
        // Fallback to copy if symlink fails
        fs.cpSync(this.sourcePluginDir, this.targetPluginDir, { recursive: true });
      }

      // 2. Configure IDE proxy if requested
      if (options.configureProxy) {
        for (const sp of this.settingsPaths) {
          if (fs.existsSync(sp)) {
            try {
              const content = JSON.parse(fs.readFileSync(sp, 'utf-8') || '{}');
              content['http.proxy'] = 'http://localhost:8088';
              content['http.proxyStrictSSL'] = false;
              fs.writeFileSync(sp, JSON.stringify(content, null, 2), 'utf-8');
            } catch {}
          }
        }
      }

      return {
        success: true,
        message: 'Successfully attached Lensgate to Antigravity IDE and installed lifecycle plugin.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to attach to Antigravity: ${err.message}`,
      };
    }
  }

  detach(): { success: boolean; message: string } {
    try {
      // 1. Remove plugin
      if (fs.existsSync(this.targetPluginDir)) {
        try {
          const stat = fs.lstatSync(this.targetPluginDir);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(this.targetPluginDir);
          } else {
            fs.rmSync(this.targetPluginDir, { recursive: true, force: true });
          }
        } catch {}
      }

      // 2. Restore IDE proxy
      for (const sp of this.settingsPaths) {
        if (fs.existsSync(sp)) {
          try {
            const content = JSON.parse(fs.readFileSync(sp, 'utf-8') || '{}');
            delete content['http.proxy'];
            delete content['http.proxyStrictSSL'];
            fs.writeFileSync(sp, JSON.stringify(content, null, 2), 'utf-8');
          } catch {}
        }
      }

      return {
        success: true,
        message: 'Successfully detached Lensgate from Antigravity IDE.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to detach from Antigravity: ${err.message}`,
      };
    }
  }
}
