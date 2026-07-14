import vm from "node:vm";
import { readFileSync } from "node:fs";

/**
 * Read a Figma plugin script and evaluate it in a sandbox with a mock figma API.
 *
 * @param {string} filePath  - Absolute path to the .mjs script file
 * @param {object} figmaMock - Mock `figma` object (getNodeById, getNodeByIdAsync, currentPage, ...)
 * @param {object} sourceOverrides - Key/value pairs to replace `const KEY = <orig>;` declarations in source
 * @returns {Promise<object>} Parsed JSON result from the script's return value
 */
export async function runFigmaScript(filePath, figmaMock, sourceOverrides = {}) {
  let code = readFileSync(filePath, "utf8");

  for (const [key, value] of Object.entries(sourceOverrides)) {
    code = code.replace(
      new RegExp(`(const\\s+${key}\\s*=\\s*)[^;]+;`),
      `$1${JSON.stringify(value)};`,
    );
  }

  const context = vm.createContext({
    figma: figmaMock,
    Promise,
    JSON,
    Error,
    console,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
  });

  const raw = vm.runInContext(code, context);
  const jsonString =
    raw != null && typeof raw.then === "function" ? await raw : raw;
  return JSON.parse(jsonString);
}
