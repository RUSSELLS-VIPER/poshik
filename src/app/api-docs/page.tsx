"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Send, Trash2, ChevronDown, ChevronUp, Code, BookOpen, Zap, CheckCircle, XCircle } from "lucide-react";

type EndpointInfo = {
  path: string;
  methods: string[];
  source: string;
};

type EndpointListResponse = {
  generatedAt: string;
  count: number;
  endpoints: EndpointInfo[];
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type RequestConfig = {
  method: string;
  path: string;
  queryString?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type RequestResult = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Array<[string, string]>;
  bodyText: string;
};

type RequestPanelState = {
  isLoading: boolean;
  error: string;
  result: RequestResult | null;
};

const ALL_HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

const METHOD_COLORS: Record<string, { bg: string; hover: string; text: string; badge: string }> = {
  GET: { bg: "bg-emerald-50", hover: "hover:bg-emerald-100", text: "text-emerald-700", badge: "bg-emerald-600 text-white" },
  POST: { bg: "bg-blue-50", hover: "hover:bg-blue-100", text: "text-blue-700", badge: "bg-blue-600 text-white" },
  PUT: { bg: "bg-amber-50", hover: "hover:bg-amber-100", text: "text-amber-700", badge: "bg-amber-500 text-slate-900" },
  PATCH: { bg: "bg-orange-50", hover: "hover:bg-orange-100", text: "text-orange-700", badge: "bg-orange-500 text-slate-900" },
  DELETE: { bg: "bg-rose-50", hover: "hover:bg-rose-100", text: "text-rose-700", badge: "bg-rose-600 text-white" },
  OPTIONS: { bg: "bg-indigo-50", hover: "hover:bg-indigo-100", text: "text-indigo-700", badge: "bg-indigo-500 text-white" },
  HEAD: { bg: "bg-slate-50", hover: "hover:bg-slate-100", text: "text-slate-700", badge: "bg-slate-600 text-white" },
};

function createEmptyPanel(): RequestPanelState {
  return {
    isLoading: false,
    error: "",
    result: null,
  };
}

function formatResponseBody(text: string): string {
  if (!text) {
    return "(empty response)";
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-600 bg-emerald-50";
  if (status >= 300 && status < 400) return "text-amber-600 bg-amber-50";
  if (status >= 400 && status < 500) return "text-rose-600 bg-rose-50";
  if (status >= 500) return "text-red-600 bg-red-50";
  return "text-slate-600 bg-slate-50";
}

function MethodBadge({ method }: { method: string }) {
  const colors = METHOD_COLORS[method] || METHOD_COLORS.HEAD;
  return (
    <span
      className={`inline-flex min-w-[52px] items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold ${colors.badge} shadow-sm`}
    >
      {method}
    </span>
  );
}

function ResponsePanel({
  state,
  placeholder,
  maxHeightClass = "max-h-64",
}: {
  state: RequestPanelState;
  placeholder: string;
  maxHeightClass?: string;
}) {
  if (state.isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20" />
          </div>
          <span className="text-sm font-medium text-slate-600">
            Sending request...
          </span>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-800">Request Failed</p>
            <p className="mt-1 text-sm text-rose-700">{state.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!state.result) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-8 text-center">
        <Zap className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-2 text-sm text-slate-500">{placeholder}</p>
      </div>
    );
  }

  const statusColor = getStatusColor(state.result.status);
  const isSuccess = state.result.status >= 200 && state.result.status < 300;

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${statusColor}`}>
              {isSuccess ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm font-semibold">
                {state.result.status} {state.result.statusText}
              </span>
            </div>
            <div className="text-sm text-slate-500">
              ⚡ {state.result.durationMs} ms
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Code className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Response Body
          </span>
        </div>
        <pre
          className={`${maxHeightClass} overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-100 shadow-inner`}
        >
          <code>{state.result.bodyText}</code>
        </pre>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  const [endpointSearch, setEndpointSearch] = useState("");
  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(true);
  const [endpointError, setEndpointError] = useState("");
  const [showHeaders, setShowHeaders] = useState(false);

  const [docMethod, setDocMethod] = useState<HttpMethod>("GET");
  const [docPath, setDocPath] = useState("/api/events");
  const [docQuery, setDocQuery] = useState("");
  const [docHeaders, setDocHeaders] = useState("");
  const [docBody, setDocBody] = useState("");
  const [docPanel, setDocPanel] = useState<RequestPanelState>(createEmptyPanel);

  useEffect(() => {
    let cancelled = false;

    const loadEndpoints = async () => {
      setIsLoadingEndpoints(true);
      setEndpointError("");

      try {
        const response = await fetch("/api/docs/endpoints", { cache: "no-store" });
        const payload = (await response.json()) as EndpointListResponse & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "Could not load endpoint list.");
        }

        if (!cancelled) {
          const available = Array.isArray(payload.endpoints) ? payload.endpoints : [];
          setEndpoints(available);

          if (available.length > 0) {
            setDocPath(available[0].path);
            setDocMethod((available[0].methods[0] as HttpMethod) ?? "GET");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setEndpointError(
            error instanceof Error ? error.message : "Could not load endpoint list."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEndpoints(false);
        }
      }
    };

    void loadEndpoints();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEndpoints = useMemo(() => {
    const query = endpointSearch.trim().toLowerCase();
    if (!query) {
      return endpoints;
    }

    return endpoints.filter(
      (endpoint) =>
        endpoint.path.toLowerCase().includes(query) ||
        endpoint.source.toLowerCase().includes(query)
    );
  }, [endpointSearch, endpoints]);

  const runRequest = async (config: RequestConfig): Promise<RequestResult> => {
    const normalizedPath = config.path.trim();
    if (!normalizedPath.startsWith("/api/")) {
      throw new Error("Endpoint path must start with /api/.");
    }

    const queryString = (config.queryString ?? "").trim();
    const requestUrl = queryString
      ? `${normalizedPath}${normalizedPath.includes("?") ? "&" : "?"}${queryString}`
      : normalizedPath;

    const headers = { ...(config.headers ?? {}) };
    let bodyToSend: string | undefined;

    if (
      config.body !== undefined &&
      !["GET", "DELETE", "HEAD", "OPTIONS"].includes(config.method)
    ) {
      if (typeof config.body === "string") {
        bodyToSend = config.body;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "text/plain";
        }
      } else {
        bodyToSend = JSON.stringify(config.body);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const startedAt = performance.now();
    const response = await fetch(requestUrl, {
      method: config.method,
      headers,
      body: bodyToSend,
      credentials: "include",
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const text = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs,
      headers: Array.from(response.headers.entries()),
      bodyText: formatResponseBody(text),
    };
  };

  const runPanelRequest = async (config: RequestConfig) => {
    setDocPanel({
      isLoading: true,
      error: "",
      result: null,
    });

    try {
      const result = await runRequest(config);
      setDocPanel({
        isLoading: false,
        error: "",
        result,
      });
    } catch (error) {
      setDocPanel({
        isLoading: false,
        error: error instanceof Error ? error.message : "Request failed.",
        result: null,
      });
    }
  };

  const sendDocumentationRequest = async () => {
    let parsedHeaders: Record<string, string> = {};
    if (docHeaders.trim()) {
      try {
        const rawHeaders = JSON.parse(docHeaders) as Record<string, unknown>;
        parsedHeaders = Object.fromEntries(
          Object.entries(rawHeaders).map(([key, value]) => [
            key,
            typeof value === "string" ? value : JSON.stringify(value),
          ])
        );
      } catch {
        setDocPanel({
          isLoading: false,
          error: "Headers must be valid JSON.",
          result: null,
        });
        return;
      }
    }

    let parsedBody: unknown = undefined;
    if (docBody.trim() && !["GET", "DELETE", "HEAD", "OPTIONS"].includes(docMethod)) {
      try {
        parsedBody = JSON.parse(docBody);
      } catch {
        parsedBody = docBody;
      }
    }

    await runPanelRequest({
      method: docMethod,
      path: docPath,
      queryString: docQuery,
      headers: parsedHeaders,
      body: parsedBody,
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            API Documentation
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Explore endpoints and test API requests in real-time
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
          {/* Endpoint Catalog */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Endpoint Catalog
                </h2>
              </div>
            </div>

            <div className="p-5">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={endpointSearch}
                  onChange={(event) => setEndpointSearch(event.target.value)}
                  placeholder="Search endpoints by path or source file..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {isLoadingEndpoints ? (
                <div className="flex items-center justify-center py-12">
                  <div className="relative">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20" />
                  </div>
                </div>
              ) : null}

              {endpointError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 text-rose-700">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm">{endpointError}</span>
                  </div>
                </div>
              ) : null}

              {!isLoadingEndpoints && !endpointError && (
                <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
                  {filteredEndpoints.map((endpoint) => (
                    <button
                      key={`${endpoint.path}-${endpoint.source}`}
                      type="button"
                      onClick={() => {
                        setDocPath(endpoint.path);
                        const candidate = endpoint.methods[0] ?? "GET";
                        setDocMethod(
                          (ALL_HTTP_METHODS.includes(candidate as HttpMethod)
                            ? candidate
                            : "GET") as HttpMethod
                        );
                      }}
                      className={`group w-full rounded-xl border p-4 text-left transition-all duration-200 ${docPath === endpoint.path
                          ? "border-blue-400 bg-blue-50/50 shadow-md"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-mono text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                            {endpoint.path}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            📁 {endpoint.source}
                          </p>
                        </div>
                        {docPath === endpoint.path && (
                          <div className="h-2 w-2 rounded-full bg-blue-600 shadow-sm" />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {endpoint.methods.map((endpointMethod) => (
                          <MethodBadge
                            key={`${endpoint.path}-${endpointMethod}`}
                            method={endpointMethod}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* API Tester */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Universal API Tester
                </h2>
              </div>
            </div>

            <div className="p-5">
              {/* Method and Path */}
              <div className="mb-4 grid gap-3 sm:grid-cols-[140px,1fr]">
                <select
                  value={docMethod}
                  onChange={(event) => setDocMethod(event.target.value as HttpMethod)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {ALL_HTTP_METHODS.map((httpMethod) => (
                    <option key={httpMethod} value={httpMethod}>
                      {httpMethod}
                    </option>
                  ))}
                </select>

                <input
                  value={docPath}
                  onChange={(event) => setDocPath(event.target.value)}
                  placeholder="/api/example/{id}"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Query String */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Query Parameters
                </label>
                <input
                  value={docQuery}
                  onChange={(event) => setDocQuery(event.target.value)}
                  placeholder="page=1&limit=20&sort=desc"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Headers */}
              <div className="mb-4">
                <button
                  onClick={() => setShowHeaders(!showHeaders)}
                  className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  {showHeaders ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Headers
                </button>
                {showHeaders && (
                  <textarea
                    value={docHeaders}
                    onChange={(event) => setDocHeaders(event.target.value)}
                    placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                )}
              </div>

              {/* Body */}
              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Request Body
                </label>
                <textarea
                  value={docBody}
                  onChange={(event) => setDocBody(event.target.value)}
                  placeholder='{"name": "Milo", "type": "dog"}'
                  rows={6}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void sendDocumentationRequest()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  <Send className="h-4 w-4" />
                  Send Request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocQuery("");
                    setDocHeaders("");
                    setDocBody("");
                    setDocPanel(createEmptyPanel());
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              </div>

              {/* Response Panel */}
              <ResponsePanel
                state={docPanel}
                placeholder="Send a request to see the response"
                maxHeightClass="max-h-[400px]"
              />

              {/* Response Headers */}
              {docPanel.result && (
                <details className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900">
                    📋 Response Headers ({docPanel.result.headers.length})
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap border-t border-slate-200 p-4 text-xs text-slate-600">
                    <code>
                      {docPanel.result.headers
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\n") || "(none)"}
                    </code>
                  </pre>
                </details>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}