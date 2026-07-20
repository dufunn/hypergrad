export type ExtractedJobField = {
  value: string;
  confidence: "high" | "medium" | "low";
  source: "structured" | "page" | "text" | "unknown";
};

export type ExtractedJobPosting = {
  company: ExtractedJobField;
  role: ExtractedJobField;
  city: ExtractedJobField;
  direction: ExtractedJobField;
  deadline: ExtractedJobField;
  officeQuery: ExtractedJobField;
  snapshotText: string;
  pageTitle: string;
};

export type MokaPageConfig = {
  aesIv: string;
  company: string;
  orgId: string;
  siteId: string;
};

type PddPosition = {
  name?: unknown;
  workLocationName?: unknown;
  jobName?: unknown;
  recruitTypeName?: unknown;
  jobDuty?: unknown;
  serveRequirement?: unknown;
  bonus?: unknown;
  campusPositionDirectionListVOS?: unknown;
};

type MokaPosition = {
  commitment?: unknown;
  department?: unknown;
  education?: unknown;
  jobDescription?: unknown;
  locations?: unknown;
  title?: unknown;
  zhineng?: unknown;
};

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const EMPTY_FIELD: ExtractedJobField = { value: "", confidence: "low", source: "unknown" };
const GENERIC_SITE_NAMES = /BOSS直聘|猎聘|智联招聘|前程无忧|牛客|实习僧|应届生求职网|招聘官网|校园招聘|社会招聘|职位详情|职位列表|招聘平台/i;
const CITY_NAMES = [
  "北京", "上海", "天津", "重庆", "深圳", "广州", "杭州", "成都", "南京", "苏州", "武汉", "西安", "长沙", "青岛", "厦门", "福州", "济南", "合肥", "宁波", "东莞", "佛山", "珠海", "郑州", "昆明", "南昌", "沈阳", "大连", "哈尔滨", "长春", "太原", "石家庄", "南宁", "贵阳", "海口", "三亚", "兰州", "乌鲁木齐", "西宁", "银川", "呼和浩特", "无锡", "常州", "温州", "香港", "澳门", "台北",
];

function field(value: unknown, confidence: ExtractedJobField["confidence"], source: ExtractedJobField["source"]): ExtractedJobField {
  const normalized = cleanCandidate(String(value || ""));
  return normalized ? { value: normalized, confidence, source } : { ...EMPTY_FIELD };
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", ndash: "–", mdash: "—",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "));
}

function cleanCandidate(value: string, maxLength = 120): string {
  return decodeHtmlEntities(value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s|｜·•—–,:：;；\-]+|[\s|｜·•—–,:：;；\-]+$/g, "")
    .slice(0, maxLength)
    .trim();
}

function normalizeCompanyName(value: string): string {
  return cleanCandidate(value, 100).replace(/(?:官方)?(?:校园|社会)?招聘(?:官网|网站)?$/u, "").trim();
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/li|\/div|\/section|\/article|\/h[1-6])\s*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 60_000);
}

function tagContent(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanCandidate(stripTags(match?.[1] || ""), 180);
}

function tagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

export function extractMokaPageConfig(html: string): MokaPageConfig | null {
  const initTag = html.match(/<input\b[^>]*\bid\s*=\s*["']init-data["'][^>]*>/i)?.[0] || "";
  if (!initTag) return null;
  const encoded = tagAttributes(initTag).value || "";
  if (!encoded) return null;
  try {
    const data = JSON.parse(encoded) as Record<string, unknown>;
    const org = data.org && typeof data.org === "object" ? data.org as Record<string, unknown> : {};
    const company = cleanCandidate(String(org.displayName || org.name || ""), 100);
    const orgId = cleanCandidate(String(org.id || ""), 100);
    const siteId = cleanCandidate(String(data.siteId || org.siteId || ""), 40);
    const aesIv = cleanCandidate(String(data.aesIv || ""), 64);
    if (!orgId || !siteId || !aesIv) return null;
    return { aesIv, company, orgId, siteId };
  } catch {
    return null;
  }
}

function metaValues(html: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = tagAttributes(match[0]);
    const key = (attributes.property || attributes.name || attributes.itemprop || "").toLowerCase();
    if (key && attributes.content) values.set(key, cleanCandidate(attributes.content, 240));
  }
  return values;
}

function collectObjects(value: JsonValue, output: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item as JsonValue, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const object = value as Record<string, unknown>;
  const rawType = object["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  if (types.some((type) => String(type || "").toLowerCase() === "jobposting")) output.push(object);
  Object.values(object).forEach((item) => {
    if (item && typeof item === "object") collectObjects(item as JsonValue, output);
  });
  return output;
}

function structuredJobPosting(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1]).trim()) as JsonValue;
      const posting = collectObjects(parsed)[0];
      if (posting) return posting;
    } catch {
      // Invalid structured data is common; fall through to visible text extraction.
    }
  }
  return null;
}

function objectName(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String((value as Record<string, unknown>).name || "");
  return "";
}

function structuredLocation(posting: Record<string, unknown>): { city: string; office: string } {
  const rawLocations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
  for (const rawLocation of rawLocations) {
    if (!rawLocation || typeof rawLocation !== "object") continue;
    const location = rawLocation as Record<string, unknown>;
    const rawAddress = location.address;
    const address = rawAddress && typeof rawAddress === "object" ? rawAddress as Record<string, unknown> : {};
    const city = cleanCity(String(address.addressLocality || address.addressRegion || ""));
    const office = cleanCandidate([
      objectName(location), address.streetAddress, address.addressLocality, address.addressRegion,
    ].filter(Boolean).join(" "), 180);
    if (city || office) return { city, office };
  }
  return { city: "", office: "" };
}

function labeledValue(text: string, labels: string[]): string {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const patterns = [
    new RegExp(`(?:${labelPattern})\\s*[:：]\\s*([^\\n]{2,100})`, "i"),
    new RegExp(`(?:${labelPattern})\\s*\\n\\s*([^\\n]{2,100})`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanCandidate(match[1]);
  }
  return "";
}

function cleanCity(value: string): string {
  const normalized = cleanCandidate(value, 80);
  const exact = CITY_NAMES.find((city) => normalized.includes(city));
  if (exact) return exact;
  return normalized.replace(/(?:特别行政区|自治州|自治区|省|市|地区)$/u, "").slice(0, 20);
}

function cityFromText(text: string): string {
  const labeled = labeledValue(text, ["工作地点", "办公地点", "工作城市", "工作地", "Base", "工作区域"]);
  if (labeled) {
    const known = CITY_NAMES.find((city) => labeled.includes(city));
    if (known) return known;
    const shortValue = cleanCity(labeled.split(/[、,，/｜|]/)[0]);
    if (shortValue.length >= 2 && shortValue.length <= 12) return shortValue;
  }
  return "";
}

function normalizeDateCandidate(value: string, now = new Date()): string {
  const normalized = cleanCandidate(value, 80);
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  const full = normalized.match(/(20\d{2})\s*[年\-\/.]\s*(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日?/);
  const iso = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  const short = normalized.match(/(?:^|\D)(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  const match = full || iso;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if (short) {
    year = now.getUTCFullYear();
    month = Number(short[1]);
    day = Number(short[2]);
    const candidate = Date.UTC(year, month - 1, day);
    if (candidate < now.getTime() - 180 * 24 * 60 * 60 * 1000) year += 1;
  }
  if (!year || !month || !day || month > 12 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function deadlineFromText(text: string): string {
  const context = text.match(/(?:投递|申请|网申|报名|招聘)?\s*截止(?:日期|时间)?\s*[:：]?\s*([^\n。；;]{3,80})/i)?.[1] || "";
  return normalizeDateCandidate(context);
}

function companyFromPage(pageTitle: string, siteName: string, text: string): string {
  const labeled = labeledValue(text, ["公司名称", "招聘单位", "用人单位", "雇主名称"]);
  if (labeled && !GENERIC_SITE_NAMES.test(labeled)) return normalizeCompanyName(labeled);
  if (siteName && !GENERIC_SITE_NAMES.test(siteName)) return normalizeCompanyName(siteName);
  const titleParts = pageTitle.split(/\s*[|｜·—–_-]\s*/).map((part) => cleanCandidate(part)).filter(Boolean);
  const likelyCompany = titleParts.find((part) => !GENERIC_SITE_NAMES.test(part) && /公司|集团|科技|银行|证券|咨询|互娱|网络|智能|汽车|云|研究院/u.test(part));
  const recruitingBrand = titleParts.find((part) => !GENERIC_SITE_NAMES.test(part) && /招聘$/u.test(part) && part.length <= 32);
  return normalizeCompanyName(likelyCompany || recruitingBrand || "");
}

function roleFromPage(pageTitle: string, heading: string, text: string): string {
  const labeled = labeledValue(text, ["职位名称", "岗位名称", "招聘职位", "应聘职位"]);
  if (labeled) return labeled;
  if (heading && !GENERIC_SITE_NAMES.test(heading)) return heading;
  return pageTitle.split(/\s*[|｜·—–]\s*/).map((part) => cleanCandidate(part)).find((part) => part && !GENERIC_SITE_NAMES.test(part)) || "";
}

export function extractPddJobPosting(payload: unknown): ExtractedJobPosting {
  const wrapper = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawResult = wrapper.result && typeof wrapper.result === "object" ? wrapper.result : wrapper;
  const position = rawResult as PddPosition;
  const company = "拼多多集团";
  const role = cleanCandidate(String(position.name || ""), 180);
  const city = cleanCity(String(position.workLocationName || ""));
  const jobName = cleanCandidate(String(position.jobName || ""), 80);
  const recruitTypeName = cleanCandidate(String(position.recruitTypeName || ""), 80);
  const directions = Array.isArray(position.campusPositionDirectionListVOS)
    ? position.campusPositionDirectionListVOS
        .map((item) => item && typeof item === "object" ? cleanCandidate(String((item as Record<string, unknown>).positionDirectionName || ""), 60) : "")
        .filter(Boolean)
    : [];
  const duty = String(position.jobDuty || "").trim();
  const requirement = String(position.serveRequirement || "").trim();
  const bonus = String(position.bonus || "").trim();
  const snapshotText = [
    `公司名称：${company}`,
    role ? `职位名称：${role}` : "",
    city ? `工作地点：${city}` : "",
    jobName ? `岗位类别：${jobName}` : "",
    recruitTypeName ? `招聘类型：${recruitTypeName}` : "",
    directions.length ? `职位方向：${directions.join("、")}` : "",
    duty ? `岗位职责\n${duty}` : "",
    requirement ? `任职要求\n${requirement}` : "",
    bonus ? `加分项\n${bonus}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 60_000);

  return {
    company: field(company, "high", "structured"),
    role: field(role, role ? "high" : "low", role ? "structured" : "unknown"),
    city: field(city, city ? "high" : "low", city ? "structured" : "unknown"),
    direction: { ...EMPTY_FIELD },
    deadline: { ...EMPTY_FIELD },
    officeQuery: field(company, city ? "medium" : "low", city ? "structured" : "unknown"),
    snapshotText,
    pageTitle: role ? `${role} - ${company}` : company,
  };
}

export function extractMokaJobPosting(payload: unknown, companyName = ""): ExtractedJobPosting {
  const wrapper = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawData = wrapper.data && typeof wrapper.data === "object" ? wrapper.data : wrapper;
  const position = rawData as MokaPosition;
  const company = cleanCandidate(companyName, 100);
  const role = cleanCandidate(String(position.title || ""), 180);
  const department = objectName(position.department);
  const direction = objectName(position.zhineng);
  const locations = Array.isArray(position.locations) ? position.locations : [];
  const firstLocation = locations.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const provinceName = cleanCandidate(String(firstLocation?.provinceName || ""), 40);
  const locationName = cleanCandidate(String(firstLocation?.cityName || ""), 40);
  const municipality = ["北京", "上海", "天津", "重庆"].find((name) => provinceName.includes(name)) || "";
  const city = municipality || cleanCity(locationName) || cleanCity(provinceName);
  const commitment = cleanCandidate(String(position.commitment || ""), 80);
  const education = cleanCandidate(String(position.education || ""), 80);
  const description = htmlToText(String(position.jobDescription || ""));
  const snapshotText = [
    company ? `公司名称：${company}` : "",
    role ? `职位名称：${role}` : "",
    city ? `工作地点：${city}${locationName && locationName !== city ? ` ${locationName}` : ""}` : "",
    department ? `所属部门：${department}` : "",
    direction ? `职位方向：${direction}` : "",
    commitment ? `职位性质：${commitment}` : "",
    education ? `学历要求：${education}` : "",
    description ? `职位描述\n${description}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 60_000);

  return {
    company: field(company, company ? "high" : "low", company ? "structured" : "unknown"),
    role: field(role, role ? "high" : "low", role ? "structured" : "unknown"),
    city: field(city, city ? "high" : "low", city ? "structured" : "unknown"),
    direction: field(direction, direction ? "high" : "low", direction ? "structured" : "unknown"),
    deadline: { ...EMPTY_FIELD },
    officeQuery: field(company, company && city ? "medium" : "low", company && city ? "structured" : "unknown"),
    snapshotText,
    pageTitle: role && company ? `${role} - ${company}` : role || company,
  };
}

export function extractJobPostingFromText(rawText: string): ExtractedJobPosting {
  const text = rawText.replace(/\r/g, "").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60_000);
  const shortLines = text.split("\n").map((line) => cleanCandidate(line, 100)).filter((line) => line.length >= 2 && line.length <= 80);
  const role = labeledValue(text, ["职位名称", "岗位名称", "招聘职位", "应聘职位"])
    || shortLines.find((line) => !/岗位职责|职位描述|任职要求|职位要求/u.test(line) && /经理|专员|分析师|研究员|顾问|工程师|设计师|运营|产品|研发|开发|算法|销售|市场|品牌|策划|采购|供应链|实习生|管培生|management trainee/i.test(line))
    || "";
  const company = normalizeCompanyName(
    labeledValue(text, ["公司名称", "招聘单位", "用人单位"])
      || shortLines.find((line) => !GENERIC_SITE_NAMES.test(line) && /公司|集团|科技|银行|证券|咨询|互娱|网络|智能|汽车|云|研究院|股份|有限/u.test(line))
      || "",
  );
  const city = cityFromText(text);
  const office = labeledValue(text, ["详细地址", "办公地址", "办公地点", "工作地点"]);
  const deadline = deadlineFromText(text);
  return {
    company: field(company, company ? "medium" : "low", company ? "text" : "unknown"),
    role: field(role, role ? "medium" : "low", role ? "text" : "unknown"),
    city: field(city, city ? "medium" : "low", city ? "text" : "unknown"),
    direction: { ...EMPTY_FIELD },
    deadline: field(deadline, deadline ? "medium" : "low", deadline ? "text" : "unknown"),
    officeQuery: field(office, office ? "medium" : "low", office ? "text" : "unknown"),
    snapshotText: text,
    pageTitle: "",
  };
}

export function extractJobPostingFromHtml(html: string): ExtractedJobPosting {
  const meta = metaValues(html);
  const pageTitle = tagContent(html, "title") || meta.get("og:title") || meta.get("twitter:title") || "";
  const heading = tagContent(html, "h1");
  const siteName = meta.get("og:site_name") || meta.get("application-name") || "";
  const text = htmlToText(html);
  const posting = structuredJobPosting(html);

  if (posting) {
    const location = structuredLocation(posting);
    const rawDeadline = String(posting.validThrough || "");
    const company = objectName(posting.hiringOrganization);
    const role = String(posting.title || posting.name || "");
    return {
      company: field(company || companyFromPage(pageTitle, siteName, text), company ? "high" : "medium", company ? "structured" : "page"),
      role: field(role || roleFromPage(pageTitle, heading, text), role ? "high" : "medium", role ? "structured" : "page"),
      city: field(location.city || cityFromText(text), location.city ? "high" : "medium", location.city ? "structured" : "text"),
      direction: { ...EMPTY_FIELD },
      deadline: field(normalizeDateCandidate(rawDeadline) || deadlineFromText(text), rawDeadline ? "high" : "medium", rawDeadline ? "structured" : "text"),
      officeQuery: field(location.office, location.office ? "high" : "low", location.office ? "structured" : "unknown"),
      snapshotText: text,
      pageTitle,
    };
  }

  const company = companyFromPage(pageTitle, siteName, text);
  const role = roleFromPage(pageTitle, heading, text);
  const city = cityFromText(text);
  const deadline = deadlineFromText(text);
  const office = labeledValue(text, ["详细地址", "办公地址", "办公地点", "工作地点"]);
  return {
    company: field(company, company ? "medium" : "low", company ? "page" : "unknown"),
    role: field(role, role ? "medium" : "low", role ? "page" : "unknown"),
    city: field(city, city ? "medium" : "low", city ? "text" : "unknown"),
    direction: { ...EMPTY_FIELD },
    deadline: field(deadline, deadline ? "medium" : "low", deadline ? "text" : "unknown"),
    officeQuery: field(office, office ? "medium" : "low", office ? "text" : "unknown"),
    snapshotText: text,
    pageTitle,
  };
}
