import {
  extractJobPostingFromHtml,
  extractJobPostingFromText,
  extractMokaJobPosting,
  extractMokaPageConfig,
  extractPddJobPosting,
} from "./parser.ts";
import { decryptMokaPayload } from "./moka.ts";

const MAX_SOURCE_BYTES = 1_500_000;
const MAX_PASTED_TEXT = 80_000;
const MAX_REDIRECTS = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 30;
const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowAnyOrigin = configuredOrigins.length === 0;
  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": allowAnyOrigin ? "*" : (configuredOrigins.includes(origin) ? origin : "null"),
    "Vary": "Origin",
  };
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || "";
  return configuredOrigins.length === 0 || !origin || configuredOrigins.includes(origin);
}

function json(payload: unknown, status = 200, headers: Record<string, string> = BASE_CORS_HEADERS): Response {
  return Response.json(payload, { status, headers: { ...headers, "Cache-Control": "no-store" } });
}

function jwtSubject(request: Request): string {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const subject = JSON.parse(atob(normalized))?.sub;
    return typeof subject === "string" && subject ? subject : "anonymous";
  } catch {
    return "anonymous";
  }
}

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  const key = jwtSubject(request);
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    if (requestWindows.size > 500) {
      requestWindows.forEach((window, identity) => {
        if (now - window.startedAt >= RATE_LIMIT_WINDOW_MS) requestWindows.delete(identity);
      });
    }
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_REQUESTS;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^(0|10|127|169\.254|192\.168)\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

function safeUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) throw new Error("链接不是可访问的公开招聘页面。");
  if (url.username || url.password) throw new Error("链接中不能包含账号或密码。");
  return url;
}

async function limitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_SOURCE_BYTES) throw new Error("页面内容过大，请改为粘贴 JD 文本。");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("页面内容过大，请改为粘贴 JD 文本。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(bytes);
}

async function fetchPublicPage(initialUrl: string): Promise<{ html: string; finalUrl: string }> {
  let current = safeUrl(initialUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
        "User-Agent": "Mozilla/5.0 (compatible; HyperGradJobCapture/1.0)",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("招聘链接重定向次数过多。");
      current = safeUrl(new URL(location, current).href);
      continue;
    }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new Error("该页面需要登录或拒绝读取，请粘贴 JD 文本。");
      throw new Error(`页面读取失败（HTTP ${response.status}），请粘贴 JD 文本。`);
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      throw new Error("当前链接不是可识别的网页，请粘贴 JD 文本。");
    }
    return { html: await limitedText(response), finalUrl: current.href };
  }
  throw new Error("无法读取招聘页面。");
}

async function fetchPddPosition(url: URL) {
  if (url.hostname.toLowerCase() !== "careers.pddglobalhr.com") return null;
  const positionId = url.searchParams.get("positionId")?.trim();
  if (!positionId || !/^[a-z0-9-]{12,80}$/i.test(positionId)) return null;
  const shortToken = url.searchParams.get("t")?.trim() || "";
  const response = await fetch(new URL("/api/careers/api/recruit/position/detail", url.origin), {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; HyperGradJobCapture/1.1)",
    },
    body: JSON.stringify({ id: positionId, t: shortToken }),
  });
  if (!response.ok) throw new Error(`拼多多岗位详情读取失败（HTTP ${response.status}），请粘贴 JD 文本。`);
  const payload = await response.json();
  if (!payload?.success || !payload?.result) throw new Error("拼多多岗位详情暂时不可读取，请粘贴 JD 文本。");
  return extractPddJobPosting(payload);
}

function responseCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() || [];
  if (values.length) return values.map((value) => value.split(";", 1)[0]).filter(Boolean);
  const combined = response.headers.get("set-cookie") || "";
  return [...combined.matchAll(/(?:^|,\s*)([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=([^;,]*)/g)]
    .map((match) => `${match[1]}=${match[2]}`);
}

function mergeCookies(...groups: string[][]): string {
  const cookies = new Map<string, string>();
  groups.flat().forEach((cookie) => {
    const separator = cookie.indexOf("=");
    if (separator > 0) cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1));
  });
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function fetchMokaBootstrap(url: URL): Promise<{ company: string; orgId: string; siteId: string; aesIv: string; cookie: string }> {
  const pageUrl = new URL(url.pathname, url.origin);
  pageUrl.search = url.search;
  const baseHeaders = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
    "User-Agent": "Mozilla/5.0 (compatible; HyperGradJobCapture/1.2)",
  };
  let response = await fetch(pageUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: baseHeaders,
  });
  const initialCookies = responseCookies(response);
  let cookie = mergeCookies(initialCookies);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Moka 招聘页未返回有效地址，请粘贴 JD 文本。");
    const nextUrl = safeUrl(new URL(location, pageUrl).href);
    if (nextUrl.hostname.toLowerCase() !== "app.mokahr.com") throw new Error("Moka 招聘页跳转到了未知站点。");
    response = await fetch(nextUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { ...baseHeaders, ...(cookie ? { "Cookie": cookie } : {}) },
    });
    cookie = mergeCookies(initialCookies, responseCookies(response));
  }
  if (!response.ok) throw new Error(`Moka 招聘页读取失败（HTTP ${response.status}），请粘贴 JD 文本。`);
  const config = extractMokaPageConfig(await limitedText(response));
  if (!config) throw new Error("Moka 招聘页配置暂时无法识别，请粘贴 JD 文本。");
  return { ...config, cookie };
}

async function fetchMokaPosition(url: URL) {
  if (url.hostname.toLowerCase() !== "app.mokahr.com") return null;
  const pathMatch = url.pathname.match(/^\/campus_apply\/([^/]+)\/(\d+)\/?$/i);
  const hashMatch = url.hash.match(/(?:^#|\/)job\/([a-z0-9-]{12,80})(?:$|[/?])/i);
  if (!pathMatch || !hashMatch) return null;
  const [, pathOrgId, pathSiteId] = pathMatch;
  const jobId = hashMatch[1];
  const config = await fetchMokaBootstrap(url);
  const orgId = config.orgId || pathOrgId;
  const siteId = config.siteId || pathSiteId;
  const response = await fetch("https://app.mokahr.com/api/outer/ats-apply/website/job", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; HyperGradJobCapture/1.2)",
      ...(config.cookie ? { "Cookie": config.cookie } : {}),
    },
    body: JSON.stringify({ siteId, orgId, jobId, locale: "zh-CN" }),
  });
  if (!response.ok) throw new Error(`Moka 岗位详情读取失败（HTTP ${response.status}），请粘贴 JD 文本。`);
  const encrypted = JSON.parse(await limitedText(response));
  const decrypted = await decryptMokaPayload(encrypted, config.aesIv) as Record<string, unknown>;
  if (!decrypted?.success || !decrypted?.data) throw new Error("Moka 岗位详情暂时不可读取，请粘贴 JD 文本。");
  return extractMokaJobPosting(decrypted, config.company);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (!isAllowedOrigin(request)) return json({ error: "当前来源不在允许列表中。" }, 403, headers);
  if (request.method !== "POST") return json({ error: "仅支持 POST 请求。" }, 405, headers);
  if (isRateLimited(request)) return json({ error: "请求过于频繁，请稍后再试。" }, 429, headers);
  try {
    const body = await request.json();
    const rawUrl = String(body?.url || "").trim();
    const pastedText = String(body?.text || "").trim().slice(0, MAX_PASTED_TEXT);
    if (!rawUrl && pastedText.length < 20) return json({ error: "请粘贴招聘链接或至少 20 个字符的 JD 文本。" }, 400, headers);

    let sourceUrl = rawUrl;
    let mode: "url" | "text" = "text";
    let extracted;
    if (pastedText.length >= 20) {
      if (rawUrl) safeUrl(rawUrl);
      extracted = extractJobPostingFromText(pastedText);
    } else {
      const parsedUrl = safeUrl(rawUrl);
      const providerPosting = await fetchMokaPosition(parsedUrl) || await fetchPddPosition(parsedUrl);
      if (providerPosting) {
        extracted = providerPosting;
        sourceUrl = parsedUrl.href;
        mode = "url";
      } else {
        const fetched = await fetchPublicPage(parsedUrl.href);
        sourceUrl = fetched.finalUrl;
        mode = "url";
        extracted = extractJobPostingFromHtml(fetched.html);
      }
    }

    const capturedAt = new Date().toISOString();
    const contentHash = await sha256(extracted.snapshotText);
    return json({
      mode,
      sourceUrl,
      capturedAt,
      contentHash,
      fields: {
        company: extracted.company,
        role: extracted.role,
        city: extracted.city,
        direction: extracted.direction,
        deadline: extracted.deadline,
        officeQuery: extracted.officeQuery,
      },
      snapshot: {
        // Keep the personal archive useful without making 200 local records exceed
        // common browser storage limits. The hash still covers the full cleaned JD.
        text: extracted.snapshotText.slice(0, 12_000),
        pageTitle: extracted.pageTitle,
        capturedAt,
        contentHash,
      },
    }, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "招聘信息识别失败。";
    return json({ error: message }, 422, headers);
  }
});
