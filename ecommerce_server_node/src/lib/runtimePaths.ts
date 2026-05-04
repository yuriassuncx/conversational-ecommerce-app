import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "..", "..", ".data");

function resolveDataDir(): string {
  const configuredDir = process.env.ECOMMERCE_DATA_DIR?.trim();
  if (!configuredDir) {
    return DEFAULT_DATA_DIR;
  }

  return path.resolve(configuredDir);
}

export const DATA_DIR = resolveDataDir();
