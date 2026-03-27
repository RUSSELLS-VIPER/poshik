import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

type EndpointInfo = {
  path: string;
  methods: string[];
  source: string;
};

const HIDDEN_ENDPOINT_PREFIXES = ["/api/users"];

const SUPPORTED_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const;
type HttpMethod = (typeof SUPPORTED_METHODS)[number];

async function collectRouteFiles(
  directory: string,
  files: string[] = []
): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectRouteFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function routeSegmentToPath(segment: string): string {
  if (segment.startsWith("[[") && segment.endsWith("]]")) {
    const optionalSegment = segment.slice(2, -2);

    if (optionalSegment.startsWith("...")) {
      return `{...${optionalSegment.slice(3)}?}`;
    }

    return `{${optionalSegment}?}`;
  }

  if (segment.startsWith("[") && segment.endsWith("]")) {
    const dynamicSegment = segment.slice(1, -1);

    if (dynamicSegment.startsWith("...")) {
      return `{...${dynamicSegment.slice(3)}}`;
    }

    return `{${dynamicSegment}}`;
  }

  return segment;
}

function toApiPath(relativeRouteFile: string): string {
  const normalized = relativeRouteFile.replaceAll("\\", "/");
  const withoutSuffix = normalized.replace(/\/route\.ts$/, "");
  const parts = withoutSuffix
    .split("/")
    .filter(Boolean)
    .map((segment) => routeSegmentToPath(segment));

  return `/api/${parts.join("/")}`;
}

function extractMethods(content: string): string[] {
  const found = new Set<HttpMethod>();
  const functionMethodRegex =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
  const constMethodRegex =
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
  const exportBlockRegex = /export\s*{([\s\S]*?)}/g;

  const registerMethod = (candidate: string) => {
    const normalized = candidate.trim().toUpperCase() as HttpMethod;
    if (SUPPORTED_METHODS.includes(normalized)) {
      found.add(normalized);
    }
  };

  let functionMatch = functionMethodRegex.exec(content);
  while (functionMatch) {
    registerMethod(functionMatch[1]);
    functionMatch = functionMethodRegex.exec(content);
  }

  let constMatch = constMethodRegex.exec(content);
  while (constMatch) {
    registerMethod(constMatch[1]);
    constMatch = constMethodRegex.exec(content);
  }

  let exportBlockMatch = exportBlockRegex.exec(content);
  while (exportBlockMatch) {
    const specifiers = exportBlockMatch[1]
      .split(",")
      .map((specifier) => specifier.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (const specifier of specifiers) {
      const aliasMatch = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(specifier);
      registerMethod(aliasMatch ? aliasMatch[1] : specifier);
    }

    exportBlockMatch = exportBlockRegex.exec(content);
  }

  return SUPPORTED_METHODS.filter((method) => found.has(method));
}

export async function GET() {
  try {
    const apiRoot = path.join(process.cwd(), "src", "app", "api");
    const routeFiles = await collectRouteFiles(apiRoot);

    const endpoints: EndpointInfo[] = [];

    for (const file of routeFiles) {
      const relative = path.relative(apiRoot, file);
      const source = `src/app/api/${relative.replaceAll("\\", "/")}`;
      const content = await fs.readFile(file, "utf8");
      const methods = extractMethods(content);
      const endpointPath = toApiPath(relative);

      if (
        HIDDEN_ENDPOINT_PREFIXES.some((prefix) =>
          endpointPath.startsWith(prefix)
        )
      ) {
        continue;
      }

      endpoints.push({
        path: endpointPath,
        methods: methods.length > 0 ? methods : ["GET"],
        source,
      });
    }

    endpoints.sort((a, b) => a.path.localeCompare(b.path));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: endpoints.length,
      endpoints,
    });
  } catch (error) {
    console.error("API docs endpoint list error:", error);
    return NextResponse.json(
      { message: "Could not build API endpoint documentation." },
      { status: 500 }
    );
  }
}
