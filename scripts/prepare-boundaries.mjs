import { readFile, writeFile } from "node:fs/promises";

const [adm0Path, adm1Path] = process.argv.slice(2);

if (!adm0Path || !adm1Path) {
  console.error("Usage: node scripts/prepare-boundaries.mjs <ADM0.geojson> <ADM1.geojson>");
  process.exit(1);
}

const provinceNames = new Map(Object.entries({
  "Anhui Province": "安徽省",
  "Beijing Municipality": "北京市",
  "Chongqing Municipality": "重庆市",
  "Fujian Province": "福建省",
  "Gansu Province": "甘肃省",
  "Guangxi Zhuang Autonomous Region": "广西壮族自治区",
  "Guangzhou Province": "广东省",
  "Guizhou Province": "贵州省",
  "Hainan Province": "海南省",
  "Hebei Province": "河北省",
  "Heilongjiang Province": "黑龙江省",
  "Henan Province": "河南省",
  "Hong Kong Special Administrative Region": "香港特别行政区",
  "Hubei Province": "湖北省",
  "Hunan Province": "湖南省",
  "Inner Mongolia Autonomous Region": "内蒙古自治区",
  "Jiangsu Province": "江苏省",
  "Jiangxi Province": "江西省",
  "Jilin Province": "吉林省",
  "Liaoning Province": "辽宁省",
  "Macau Special Administrative Region": "澳门特别行政区",
  "Ningxia Ningxia Hui Autonomous Region": "宁夏回族自治区",
  "Qinghai Province": "青海省",
  "Shaanxi Province": "陕西省",
  "Shandong Province": "山东省",
  "Shanghai Municipality": "上海市",
  "Shanxi Province": "山西省",
  "Sichuan Province": "四川省",
  "Taiwan Province": "台湾省",
  "Tianjin Municipality": "天津市",
  "Tibet Autonomous Region": "西藏自治区",
  "Xinjiang Uyghur Autonomous Region": "新疆维吾尔自治区",
  "Yunnan Province": "云南省",
  "Zhejiang Province": "浙江省"
}));

function outerRings(geometry) {
  if (geometry?.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function ringArea(ring) {
  return ring.reduce((area, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function ringCentroid(ring) {
  const area = ringArea(ring);
  if (!area) {
    const sum = ring.reduce(([x, y], point) => [x + point[0], y + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  const weighted = ring.reduce(([x, y], point, index) => {
    const next = ring[(index + 1) % ring.length];
    const cross = point[0] * next[1] - next[0] * point[1];
    return [x + (point[0] + next[0]) * cross, y + (point[1] + next[1]) * cross];
  }, [0, 0]);
  return [weighted[0] / (6 * area), weighted[1] / (6 * area)];
}

function geometryCentroid(geometry) {
  const ring = outerRings(geometry).sort((left, right) => Math.abs(ringArea(right)) - Math.abs(ringArea(left)))[0];
  return ring ? ringCentroid(ring).map((value) => Number(value.toFixed(6))) : null;
}

function coordinateKey(point) {
  return JSON.stringify(point);
}

function edgeKey(left, right) {
  const leftKey = coordinateKey(left);
  const rightKey = coordinateKey(right);
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`;
}

function deriveCountryGeometry(features) {
  const edges = new Map();
  const points = new Map();

  features.forEach((feature) => {
    outerRings(feature.geometry).forEach((sourceRing) => {
      if (sourceRing.length < 3) return;
      const ring = coordinateKey(sourceRing[0]) === coordinateKey(sourceRing[sourceRing.length - 1])
        ? sourceRing
        : [...sourceRing, sourceRing[0]];
      ring.slice(0, -1).forEach((left, index) => {
        const right = ring[index + 1];
        const key = edgeKey(left, right);
        const existing = edges.get(key);
        if (existing) existing.count += 1;
        else edges.set(key, { left, right, count: 1 });
        points.set(coordinateKey(left), left);
        points.set(coordinateKey(right), right);
      });
    });
  });

  const adjacency = new Map();
  const connect = (left, right) => {
    const neighbors = adjacency.get(left) || [];
    neighbors.push(right);
    adjacency.set(left, neighbors);
  };
  edges.forEach(({ left, right, count }) => {
    if (count !== 1) return;
    const leftKey = coordinateKey(left);
    const rightKey = coordinateKey(right);
    connect(leftKey, rightKey);
    connect(rightKey, leftKey);
  });

  adjacency.forEach((neighbors, point) => {
    if (neighbors.length !== 2) throw new Error(`Province exterior is not a closed topology at ${point}`);
  });

  const visited = new Set();
  const rings = [];
  adjacency.forEach((_, start) => {
    if (visited.has(start)) return;
    const ring = [];
    let previous = null;
    let current = start;
    do {
      visited.add(current);
      ring.push(points.get(current));
      const neighbors = adjacency.get(current);
      const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];
      previous = current;
      current = next;
      if (ring.length > adjacency.size + 1) throw new Error("Province exterior traversal did not close");
    } while (current !== start);
    ring.push(points.get(start));
    if (ringArea(ring) < 0) ring.reverse();
    rings.push(ring);
  });

  rings.sort((left, right) => Math.abs(ringArea(right)) - Math.abs(ringArea(left)));
  return rings.length === 1
    ? { type: "Polygon", coordinates: [rings[0]] }
    : { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) };
}

function normalizeFeature(feature, name, level) {
  const centroid = geometryCentroid(feature.geometry);
  return {
    type: "Feature",
    properties: {
      name,
      centroid,
      center: centroid,
      level,
      source: "geoBoundaries gbOpen CHN 2019"
    },
    geometry: feature.geometry
  };
}

const adm0 = JSON.parse(await readFile(adm0Path, "utf8"));
const adm1 = JSON.parse(await readFile(adm1Path, "utf8"));
if (!adm0.features?.length || !adm1.features?.length) {
  throw new Error("Boundary sources must contain country and province features");
}
const provinces = {
  type: "FeatureCollection",
  features: adm1.features.map((feature) => {
    const sourceName = feature.properties?.shapeName || feature.properties?.name;
    const name = provinceNames.get(sourceName) || sourceName;
    if (!name) throw new Error(`Missing Chinese province name for: ${sourceName}`);
    return normalizeFeature(feature, name, "province");
  })
};
const countryGeometry = deriveCountryGeometry(provinces.features);
const boundary = {
  type: "FeatureCollection",
  features: [normalizeFeature({ geometry: countryGeometry }, "中华人民共和国", "country")]
};

const boundaryJson = JSON.stringify(boundary);
const provinceJson = JSON.stringify(provinces);
await Promise.all([
  writeFile("assets/china-boundary.json", `${boundaryJson}\n`),
  writeFile("assets/china-provinces.json", `${provinceJson}\n`),
  writeFile("assets/china-boundary-data.js", `window.CHINA_BOUNDARY_DATA=${boundaryJson};\n`),
  writeFile("assets/china-provinces-data.js", `window.CHINA_PROVINCE_DATA=${provinceJson};\n`)
]);

console.log(`Prepared ${boundary.features.length} country feature and ${provinces.features.length} province features.`);
