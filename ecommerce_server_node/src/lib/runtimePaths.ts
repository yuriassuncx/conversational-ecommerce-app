import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In containers (Railway, Docker) /tmp is always writable; use it as default.
// Locally we keep .data next to the package root for easy access.
const IS_CONTAINER = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID);
const DEFAULT_DATA_DIR = IS_CONTAINER
  ? "/tmp/.ecommerce-data"
  : path.resolve(__dirname, "..", "..", ".data");

function resolveDataDir(): string {
  const configuredDir = process.env.ECOMMERCE_DATA_DIR?.trim();
  if (!configuredDir) {
    return DEFAULT_DATA_DIR;
  }

  return path.resolve(configuredDir);
}

export const DATA_DIR = resolveDataDir();
