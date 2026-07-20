import assert from "node:assert/strict";
import {
  extractJobPostingFromHtml,
  extractJobPostingFromText,
  extractMokaJobPosting,
  extractMokaPageConfig,
  extractPddJobPosting,
} from "../supabase/functions/job-import/parser.ts";
import { decryptMokaPayload } from "../supabase/functions/job-import/moka.ts";

const structured = extractJobPostingFromHtml(`<!doctype html><html><head>
  <title>AI 产品经理 | 示例招聘</title>
  <script type="application/ld+json">{
    "@context":"https://schema.org","@type":"JobPosting","title":"AI 产品经理",
    "hiringOrganization":{"@type":"Organization","name":"未来科技"},
    "validThrough":"2026-08-16T23:59:00+08:00",
    "jobLocation":{"@type":"Place","name":"未来中心","address":{"@type":"PostalAddress","addressLocality":"深圳市","streetAddress":"南山区科技南路1号"}}
  }</script></head><body><h1>AI 产品经理</h1><p>负责智能产品规划。</p></body></html>`);

assert.equal(structured.company.value, "未来科技");
assert.equal(structured.role.value, "AI 产品经理");
assert.equal(structured.city.value, "深圳");
assert.equal(structured.deadline.value, "2026-08-16");
assert.match(structured.officeQuery.value, /未来中心/);

const pasted = extractJobPostingFromText(`
公司名称：远航互娱
岗位名称：海外产品运营
工作地点：上海市浦东新区
投递截止日期：2026年9月2日 23:59
岗位职责：负责海外市场产品运营。
`);

assert.equal(pasted.company.value, "远航互娱");
assert.equal(pasted.role.value, "海外产品运营");
assert.equal(pasted.city.value, "上海");
assert.equal(pasted.deadline.value, "2026-09-02");

const loosePaste = extractJobPostingFromText(`
星河智能科技有限公司
国际化产品运营实习生
工作城市：杭州
我们正在寻找对海外市场有兴趣的同学。
网申截止时间：8月20日
`);

assert.equal(loosePaste.company.value, "星河智能科技有限公司");
assert.equal(loosePaste.role.value, "国际化产品运营实习生");
assert.equal(loosePaste.city.value, "杭州");
assert.equal(loosePaste.deadline.value, "2026-08-20");

const pdd = extractPddJobPosting({
  success: true,
  result: {
    name: "商家运营（多语种优势-上海）",
    workLocationName: "上海",
    jobName: "语言",
    recruitTypeName: "管培生",
    jobDuty: "负责品类商家的引入、管理和运营策略。",
    serveRequirement: "有数据及业务分析能力，具备多语种优势。",
    campusPositionDirectionListVOS: [
      { positionDirectionName: "日语" },
      { positionDirectionName: "西班牙语" },
    ],
  },
});
assert.equal(pdd.company.value, "拼多多集团");
assert.equal(pdd.role.value, "商家运营（多语种优势-上海）");
assert.equal(pdd.city.value, "上海");
assert.match(pdd.snapshotText, /岗位类别：语言/);
assert.match(pdd.snapshotText, /职位方向：日语、西班牙语/);

const mokaConfig = extractMokaPageConfig(`<html><body><input id="init-data" type="hidden" value="{&quot;org&quot;:{&quot;id&quot;:&quot;sohu&quot;,&quot;name&quot;:&quot;搜狐&quot;,&quot;siteId&quot;:28313},&quot;aesIv&quot;:&quot;de7c21ed8d6f50fe&quot;,&quot;siteId&quot;:&quot;28313&quot;}"></body></html>`);
assert.deepEqual(mokaConfig, {
  aesIv: "de7c21ed8d6f50fe",
  company: "搜狐",
  orgId: "sohu",
  siteId: "28313",
});

const moka = extractMokaJobPosting({
  success: true,
  data: {
    title: "生态运营实习生",
    department: { id: 133855, name: "智能媒体研发中心" },
    zhineng: { id: 207479, name: "运营" },
    commitment: "实习",
    education: "本科",
    locations: [{ cityName: "海淀区", provinceName: "北京市", country: "中国" }],
    jobDescription: "<p>工作职责：</p><p>负责生态活动和投稿话题运营。</p>",
  },
}, "搜狐");
assert.equal(moka.company.value, "搜狐");
assert.equal(moka.role.value, "生态运营实习生");
assert.equal(moka.city.value, "北京");
assert.equal(moka.direction.value, "运营");
assert.match(moka.snapshotText, /所属部门：智能媒体研发中心/);
assert.match(moka.snapshotText, /负责生态活动和投稿话题运营/);

const mokaKey = "2ef8d361a48ff274";
const mokaIv = "de7c21ed8d6f50fe";
const mokaPlaintext = { success: true, data: { title: "生态运营实习生" } };
const mokaCryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(mokaKey), { name: "AES-CBC" }, false, ["encrypt"]);
const mokaCiphertext = await crypto.subtle.encrypt(
  { name: "AES-CBC", iv: new TextEncoder().encode(mokaIv) },
  mokaCryptoKey,
  new TextEncoder().encode(JSON.stringify(mokaPlaintext)),
);
const mokaDecrypted = await decryptMokaPayload({
  data: Buffer.from(mokaCiphertext).toString("base64"),
  necromancer: mokaKey,
}, mokaIv);
assert.deepEqual(mokaDecrypted, mokaPlaintext);

console.log("job-import parser tests passed");
