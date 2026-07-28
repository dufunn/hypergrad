import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const boundary = JSON.parse(await readFile(new URL("../assets/china-boundary.json", import.meta.url), "utf8"));
const provinces = JSON.parse(await readFile(new URL("../assets/china-provinces.json", import.meta.url), "utf8"));

assert.equal(boundary.type, "FeatureCollection");
assert.equal(boundary.features.length, 1);
assert.equal(boundary.features[0].properties.name, "中华人民共和国");
assert.equal(boundary.features[0].properties.level, "country");
assert.ok(boundary.features[0].geometry);

assert.equal(provinces.type, "FeatureCollection");
assert.equal(provinces.features.length, 34);
const names = new Set(provinces.features.map((feature) => feature.properties?.name));
for (const expected of ["北京市", "上海市", "广东省", "四川省", "香港特别行政区", "澳门特别行政区", "台湾省"]) {
  assert.ok(names.has(expected), `Missing province: ${expected}`);
}
for (const feature of provinces.features) {
  assert.ok(feature.geometry, `Missing geometry: ${feature.properties?.name}`);
  assert.equal(feature.properties?.centroid?.length, 2, `Missing centroid: ${feature.properties?.name}`);
}

function outerRings(geometry) {
  if (geometry?.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function pointKey(point) {
  return JSON.stringify(point);
}

function edgeKey(left, right) {
  const leftKey = pointKey(left);
  const rightKey = pointKey(right);
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`;
}

function edgeCounts(features) {
  const counts = new Map();
  features.forEach((feature) => {
    outerRings(feature.geometry).forEach((ring) => {
      ring.slice(0, -1).forEach((left, index) => {
        const key = edgeKey(left, ring[index + 1]);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
  });
  return counts;
}

const provinceEdges = edgeCounts(provinces.features);
const provinceExterior = new Set([...provinceEdges].filter(([, count]) => count === 1).map(([key]) => key));
const countryEdges = new Set(edgeCounts(boundary.features).keys());
assert.equal(countryEdges.size, provinceExterior.size, "Country outline must contain every province exterior edge");
for (const edge of provinceExterior) assert.ok(countryEdges.has(edge), `Country outline diverges at ${edge}`);

console.log("boundary data tests passed");
