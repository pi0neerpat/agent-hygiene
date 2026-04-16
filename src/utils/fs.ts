import { readFile, readdir, access } from "fs/promises";
import { join, resolve, isAbsolute } from "path";
import { glob as tinyGlob } from "tinyglobby";

/**
 * Read a file, returning null if it doesn't exist.
 */
export async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Check if a path exists.
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * List directory contents, returning empty array if dir doesn't exist.
 */
export async function safeListDir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

/**
 * Resolve a path relative to a base directory.
 */
export function resolvePath(base: string, path: string): string {
  if (isAbsolute(path)) return path;
  return resolve(base, path);
}

/**
 * Glob files from a base directory.
 */
export async function globFiles(
  pattern: string,
  cwd: string,
): Promise<string[]> {
  try {
    return await tinyGlob([pattern], { cwd, absolute: true });
  } catch {
    return [];
  }
}
