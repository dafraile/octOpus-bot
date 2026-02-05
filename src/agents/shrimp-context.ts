import fs from "node:fs/promises";
import path from "node:path";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";

const SHRIMP_DIR = ".shrimp";
const CONTEXT_FILES = ["US.md", "PRINCIPLES.md", "CONTEXT.md"] as const;
const MEMORY_DIR = "memory";
const MAX_MEMORY_FILES = 7;

export type ShrimpContext = {
  us: string | null;
  principles: string | null;
  context: string | null;
  recentMemory: string[];
  raw: string;
};

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const trimmed = content.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

function buildContextString(ctx: ShrimpContext): string {
  const parts: string[] = [];

  parts.push(
    "[CONTEXT FROM .shrimp/ - These files are your memory. You can read and update them.]",
  );
  parts.push("");

  if (ctx.us) {
    parts.push(ctx.us);
    parts.push("");
  }

  if (ctx.principles) {
    parts.push(ctx.principles);
    parts.push("");
  }

  if (ctx.context) {
    parts.push(ctx.context);
    parts.push("");
  }

  if (ctx.recentMemory.length > 0) {
    parts.push("[RECENT MEMORY]");
    parts.push("");
    for (const mem of ctx.recentMemory) {
      parts.push(mem);
      parts.push("");
    }
  }

  parts.push("[END CONTEXT]");
  parts.push("");

  return parts.join("\n");
}

export async function loadShrimpContextFiles(workspaceDir: string): Promise<EmbeddedContextFile[]> {
  const shrimpDir = path.join(workspaceDir, SHRIMP_DIR);
  try {
    const stat = await fs.stat(shrimpDir);
    if (!stat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const result: ShrimpContext = {
    us: null,
    principles: null,
    context: null,
    recentMemory: [],
    raw: "",
  };

  for (const file of CONTEXT_FILES) {
    const filePath = path.join(shrimpDir, file);
    const content = await readIfExists(filePath);
    if (!content) {
      continue;
    }
    if (file === "US.md") {
      result.us = content;
    } else if (file === "PRINCIPLES.md") {
      result.principles = content;
    } else if (file === "CONTEXT.md") {
      result.context = content;
    }
  }

  const memoryDir = path.join(shrimpDir, MEMORY_DIR);
  try {
    const memoryFiles = (await fs.readdir(memoryDir))
      .filter((entry) => entry.endsWith(".md"))
      .toSorted()
      .toReversed()
      .slice(0, MAX_MEMORY_FILES);

    for (const file of memoryFiles) {
      const filePath = path.join(memoryDir, file);
      const content = await readIfExists(filePath);
      if (content) {
        result.recentMemory.push(content);
      }
    }
  } catch {
    // Optional memory folder
  }

  result.raw = buildContextString(result).trim();
  if (!result.raw) {
    return [];
  }

  return [
    {
      path: ".shrimp/CONTEXT.md (combined)",
      content: result.raw,
    },
  ];
}
