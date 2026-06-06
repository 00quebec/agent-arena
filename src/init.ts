import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "./config.js";

export async function initConfig(targetPath: string, force = false): Promise<void> {
  const absolutePath = path.resolve(targetPath);

  if (!force) {
    try {
      await fs.access(absolutePath);
      throw new Error(`${absolutePath} already exists. Use --force to overwrite it.`);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
    }
  }

  await fs.writeFile(absolutePath, `${JSON.stringify(defaultConfig(), null, 2)}\n`, "utf8");
  console.log(`Wrote ${absolutePath}`);
}
