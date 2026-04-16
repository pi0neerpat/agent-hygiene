import { homedir, platform } from "os";
import { join } from "path";

export type Platform = "darwin" | "linux" | "win32";

export function getPlatform(): Platform {
  const p = platform();
  if (p === "darwin" || p === "linux" || p === "win32") return p;
  return "linux"; // fallback
}

export function getHomeDir(): string {
  return homedir();
}

export function resolveConfigPath(
  template: string,
  home: string,
  projectDir: string,
): string {
  return template
    .replace("~", home)
    .replace("<project>", projectDir);
}

/**
 * Get XDG config dir or platform-specific equivalent
 */
export function getConfigDir(plat: Platform, home: string): string {
  switch (plat) {
    case "darwin":
      return join(home, "Library", "Application Support");
    case "win32":
      return process.env.APPDATA || join(home, "AppData", "Roaming");
    case "linux":
    default:
      return process.env.XDG_CONFIG_HOME || join(home, ".config");
  }
}
