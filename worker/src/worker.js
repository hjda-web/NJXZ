import citiesData from "../data/cities.json";
import catalogData from "../data/product-catalog.json";
import weatherRulesData from "../data/weather-rules.json";
import supplyIndexData from "../data/supply-index.json";
import arimaModelData from "../data/arima-model.json";
import arimaHistoryData from "../data/arima-history.json";
import arimaCategoryMuData from "../data/arima-category-mu.json";

const ORIGIN = "https://hjda-web.github.io";
const PFSC_KEY = "7s9K$pG2xQ8zR5mB7vA3sD9fH2jW40cV";
const VARIETY_TREE_URL = "https://pfsc.agri.cn/price_portal/sys-user-relation/getVarietiesTree";
const MARKET_CHART_URL = "https://pfsc.agri.cn/price_portal/index/getMarketReportPriceChart";
const XINFADI_URL = "http://www.xinfadi.com.cn/getPriceData.html";
const CHENGDU_URL = "http://price.cnveg.com/";

const cities = citiesData;
const catalog = catalogData.categories || [];
const weatherRules = new Map();
const supplyRecords = new Map();
const categoryMeans = new Map();

for (const group of weatherRulesData || []) {
  for (const product of group.Products || []) {
    weatherRules.set(product, {
      Category: group.Category,
      OptimalMin: Number(group.OptimalMin),
      OptimalMax: Number(group.OptimalMax),
      Tolerance: Number(group.Tolerance),
      RainStress: Number(group.RainStress),
      HumidityMin: Number(group.HumidityMin),
      HumidityMax: Number(group.HumidityMax),
      TempWeight: Number(group.TempWeight),
      RainWeight: Number(group.RainWeight),
      HumidityWeight: Number(group.HumidityWeight)
    });
  }
}

for (const record of supplyIndexData || []) {
  supplyRecords.set(record.Product, record);
}

for (const row of arimaCategoryMuData.categories || []) {
  categoryMeans.set(row.category, Number(row.mean));
}

const productCatalog = buildCatalog(catalog);
const memoryCache = new Map();

const defaultRule = {
  Category: "通用农产品",
  OptimalMin: 12,
  OptimalMax: 28,
  Tolerance: 10,
  RainStress: 40,
  HumidityMin: 40,
  HumidityMax: 85,
  TempWeight: 55,
  RainWeight: 25,
  HumidityWeight: 20
};

const arima = buildArimaService(
  arimaModelData,
  arimaHistoryData,
  categoryMeans
);

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return cors(
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Max-Age": "86400"
          }
        })
      );
    }

    try {
      const url = new URL(request.url);
      const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      const method = request.method.toUpperCase();
      const query = url.searchParams;

      if (path === "api/health") {
        return json(200, { ok: true, service: "nzx-worker" });
      }

      if (path === "api/cities") {
        return json(200, cities);
      }

      if (path === "api/catalog") {
        return json(200, { success: true, catalog: catalogData });
      }

      if (path === "api/session") {
        const user = await currentUser(request, env);
        if (!user) {
          return json(401, { success: false, message: "not_logged_in" });
        }
        return json(200, await publicUser(user, env));
      }

      if (path === "api/profile" && method === "GET") {
        const user = await currentUser(request, env);
        if (!user) {
          return json(401, { success: false, message: "not_logged_in" });
        }
        return json(200, await publicUser(user, env));
      }

      if (path === "api/profile" && method === "POST") {
        return handleProfile(request, env);
      }

      if (path === "api/login" && method === "POST") {
        return handleLogin(request, env);
      }

      if (path === "api/logout" && method === "POST") {
        const token = cookie(request, "sid");
        if (token) {
          await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
        }
        return json(200, { success: true }, {
          "Set-Cookie": clearCookie()
        });
      }

      if (path === "api/groups" && method === "GET") {
        return handleGroupList(request, env);
      }
      if (path === "api/groups" && method === "POST") {
        return handleGroupCreate(request, env);
      }
      if (path === "api/groups/delete" && method === "POST") {
        return handleGroupDelete(request, env);
      }
      if (path === "api/groups/members/add" && method === "POST") {
        return handleGroupAddMember(request, env);
      }
      if (path === "api/groups/members/remove" && method === "POST") {
        return handleGroupRemoveMember(request, env);
      }
      if (path === "api/groups/admin" && method === "POST") {
        return handleGroupSetAdmin(request, env);
      }
      if (path === "api/groups/leave" && method === "POST") {
        return handleGroupLeave(request, env);
      }
      if (path === "api/groups/recommendations" && method === "POST") {
        return handleGroupRecommendations(request, env);
      }
      if (path === "api/my-group" && method === "GET") {
        return handleMyGroup(request, env);
      }
      if (path === "api/group-recommend-products" && method === "GET") {
        return handleGroupRecommendProducts(request, env, query);
      }
      if (path === "api/weather") {
        return handleWeather(request, query);
      }
      if (path === "api/prices") {
        return handlePrices(query);
      }
      if (path === "api/forecast") {
        return handleForecast(query);
      }
      if (path === "api/risks") {
        return handleRisks(query);
      }

      return json(404, { success: false, message: "not_found" });
    } catch (error) {
      return json(500, {
        success: false,
        message: "server_error",
        detail: String(error && error.message ? error.message : error)
      });
    }
  }
};

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", ORIGIN);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(status, body, extraHeaders) {
  return cors(new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      extraHeaders || {}
    )
  }));
}

function clearCookie() {
  return "sid=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None";
}

function cookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";");
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index < 0) {
      continue;
    }
    const key = part.slice(0, index).trim();
    if (key === name) {
      return part.slice(index + 1).trim();
    }
  }
  return "";
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function maskPhone(phone) {
  if (String(phone).length !== 11) {
    return String(phone || "");
  }
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function chinaToday() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function bool(value) {
  return value === true || value === 1 || value === "1";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function levelForScore(score) {
  return score >= 85 ? "优" : score >= 70 ? "良" : score >= 55 ? "一般" : "较差";
}

function median(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function lowerQuartile(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.floor((sorted.length - 1) / 4))];
}

function coefficientOfVariation(values, fallback) {
  if (values.length < 2) {
    return fallback;
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 0) {
    return fallback;
  }
  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
  return clamp(Math.sqrt(variance) / average, 0.01, 0.6);
}

function seededNoise(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const fraction = Math.sin(hash * 12.9898) * 43758.5453;
  return (fraction - Math.floor(fraction)) * 2 - 1;
}

function marketMatchesCity(market, city) {
  if (!market || !city) {
    return false;
  }
  if (market.toLowerCase().indexOf(city.toLowerCase()) >= 0) {
    return true;
  }
  let normalized = city;
  if (normalized.endsWith("省")) {
    normalized = normalized.slice(0, -1);
  } else if (normalized.endsWith("自治区")) {
    normalized = normalized.slice(0, -3);
  } else if (normalized.endsWith("市")) {
    normalized = normalized.slice(0, -1);
  }
  return !!normalized && market.toLowerCase().indexOf(normalized.toLowerCase()) >= 0;
}

function buildCatalog(categories) {
  const products = new Map();
  const subcategoryProducts = new Map();
  const orderedProducts = [];

  for (const category of categories || []) {
    for (const subcategory of category.children || []) {
      if (!subcategoryProducts.has(subcategory.name)) {
        subcategoryProducts.set(subcategory.name, []);
      }
      const group = subcategoryProducts.get(subcategory.name);
      for (const productName of subcategory.products || []) {
        products.set(productName, {
          name: productName,
          category: category.name,
          subcategory: subcategory.name
        });
        if (!group.includes(productName)) {
          group.push(productName);
        }
        if (!orderedProducts.includes(productName)) {
          orderedProducts.push(productName);
        }
      }
    }
  }

  return { products, subcategoryProducts, orderedProducts };
}

function catalogFind(product) {
  return productCatalog.products.get(product || "") || null;
}

function fallbackProducts(product, maxCount) {
  const item = catalogFind(product);
  if (!item) {
    return [];
  }
  return (productCatalog.subcategoryProducts.get(item.subcategory) || [])
    .filter((name) => name.toLowerCase() !== product.toLowerCase())
    .slice(0, maxCount || 4);
}

function getRule(product) {
  const rule = weatherRules.get(product);
  if (rule) {
    return rule;
  }
  const item = catalogFind(product);
  if (item) {
    return categoryRule(item.subcategory);
  }
  return Object.assign({}, defaultRule);
}

function categoryRule(subcategory) {
  const rules = {
    "叶菜类": [12, 24, 10, 35, 55, 85, 50, 25, 25],
    "根茎类": [14, 26, 10, 45, 50, 85, 50, 25, 25],
    "瓜茄类": [18, 30, 9, 35, 45, 80, 50, 25, 25],
    "鲜豆类": [18, 30, 9, 35, 45, 80, 50, 25, 25],
    "芽苗类": [15, 25, 9, 40, 55, 90, 55, 20, 25],
    "葱蒜类": [15, 27, 10, 35, 45, 80, 55, 20, 25],
    "食用菌类": [10, 24, 8, 45, 65, 95, 60, 10, 30],
    "藻类": [15, 30, 9, 50, 60, 95, 55, 15, 30],
    "水果类": [15, 30, 10, 28, 45, 85, 50, 30, 20],
    "粮油类": [15, 30, 10, 50, 40, 80, 55, 25, 20],
    "干豆类": [15, 30, 10, 50, 40, 80, 55, 25, 20],
    "肉类": [5, 25, 10, 50, 30, 85, 60, 15, 25],
    "蛋奶类": [5, 25, 10, 50, 30, 85, 60, 15, 25],
    "鱼类": [15, 30, 8, 55, 50, 90, 60, 10, 30],
    "虾蟹贝类": [15, 30, 8, 55, 50, 90, 60, 10, 30]
  };
  const values = rules[subcategory];
  if (!values) {
    return Object.assign({}, defaultRule);
  }
  return {
    Category: subcategory,
    OptimalMin: values[0],
    OptimalMax: values[1],
    Tolerance: values[2],
    RainStress: values[3],
    HumidityMin: values[4],
    HumidityMax: values[5],
    TempWeight: values[6],
    RainWeight: values[7],
    HumidityWeight: values[8]
  };
}

function buildArimaService(model, history, means) {
  const training = (history || []).slice(0, 29);
  const levels = training.map((point) => Math.log(Math.max(Number(point.price), 0.01)));
  const stationary = [];
  for (let i = 1; i < levels.length; i++) {
    stationary.push(levels[i] - levels[i - 1]);
  }
  const ar = (model.ar || []).map(Number);
  const ma = (model.ma || []).map(Number);
  const baseMean = Number(model.mean);
  const sigma = Number(model.sigma);
  const innovations = computeInnovations(stationary, ar, ma, baseMean);

  return {
    name: `ARIMA(${model.p},${model.d},${model.q})`,
    source: model.source || "",
    sigma,
    baseMean,
    stationary,
    innovations,
    ar,
    ma,
    means,
    forecast(currentPrice, days, category) {
      const mean = this.means.get(category || "") ?? this.baseMean;
      const stationary = this.stationary.slice();
      const innovations = this.innovations.slice();
      const result = [];
      const start = chinaToday();
      let cumulativeReturn = 0;
      for (let step = 1; step <= days; step++) {
        const t = stationary.length;
        let predicted = mean;
        for (let j = 0; j < this.ar.length && t - j - 1 >= 0; j++) {
          predicted += this.ar[j] * (stationary[t - j - 1] - mean);
        }
        for (let j = 0; j < this.ma.length && t - j - 1 >= 0; j++) {
          if (t - j - 1 < innovations.length) {
            predicted += this.ma[j] * innovations[t - j - 1];
          }
        }
        stationary.push(predicted);
        innovations.push(0);
        cumulativeReturn += predicted;
        const price = Math.max(0.01, currentPrice * Math.exp(cumulativeReturn));
        const interval = price * this.sigma * Math.sqrt(step) * 1.28;
        const date = addDays(start, step);
        result.push({
          date,
          price: round(price, 2),
          lower: round(Math.max(0.01, price - interval), 2),
          upper: round(price + interval, 2),
          weatherScore: 0,
          supplyIndex: 50
        });
      }
      return result;
    }
  };
}

function computeInnovations(stationary, ar, ma, mean) {
  const innovations = [];
  for (let t = 0; t < stationary.length; t++) {
    let predicted = 0;
    for (let j = 0; j < ar.length && t - j - 1 >= 0; j++) {
      predicted += ar[j] * (stationary[t - j - 1] - mean);
    }
    let innovation = stationary[t] - mean - predicted;
    for (let j = 0; j < ma.length && t - j - 1 >= 0; j++) {
      innovation -= ma[j] * innovations[t - j - 1];
    }
    innovations.push(innovation);
  }
  return innovations;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

async function externalFetchWithCache(key, url, maxAgeMs, refresh, method) {
  method = method || "GET";
  const cached = memoryCache.get(key);
  if (cached && !refresh && Date.now() - cached.fetchedAt < maxAgeMs) {
    return { text: cached.json, fetchedAt: cached.fetchedAt };
  }

  let text = "";
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://pfsc.agri.cn/",
        "Content-Type": method === "POST" ? "application/json" : "text/plain"
      },
      body: method === "POST" ? "" : undefined
    });
    if (response.ok) {
      text = await response.text();
    }
  } catch (error) {
    text = "";
  }

  if (text) {
    const entry = { fetchedAt: Date.now(), json: text };
    memoryCache.set(key, entry);
    return { text, fetchedAt: entry.fetchedAt };
  }

  return cached ? { text: cached.json, fetchedAt: cached.fetchedAt } : { text: "", fetchedAt: null };
}

async function decryptAes(encrypted) {
  try {
    if (!encrypted || encrypted.length < 17) {
      return "";
    }
    const encoder = new TextEncoder();
    const iv = encoder.encode(encrypted.slice(0, 16));
    const keyBytes = encoder.encode(PFSC_KEY);
    const cipher = base64ToBytes(encrypted.slice(16));
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, cipher);
    return new TextDecoder("utf-8").decode(plain);
  } catch (error) {
    return "";
  }
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

let varietyRowsPromise;

async function getVarietyRows() {
  if (!varietyRowsPromise) {
    varietyRowsPromise = loadVarietyRows();
  }
  return await varietyRowsPromise;
}

async function loadVarietyRows() {
  const result = await externalFetchWithCache(
    "pfsc|variety-tree",
    VARIETY_TREE_URL,
    24 * 60 * 60 * 1000,
    false
  );
  if (!result.text) {
    return [];
  }
  try {
    const rows = [];
    collectVarieties(JSON.parse(result.text), rows);
    return rows;
  } catch (error) {
    return [];
  }
}

function collectVarieties(node, rows) {
  if (!node) {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectVarieties(item, rows);
    }
    return;
  }
  if (typeof node !== "object") {
    return;
  }
  if (Array.isArray(node.attributelist)) {
    for (const row of node.attributelist) {
      if (row && row.varietyName && row.id) {
        rows.push({ name: String(row.varietyName), id: String(row.id) });
      }
    }
  }
  for (const value of Object.values(node)) {
    collectVarieties(value, rows);
  }
}

async function findVarietyIds(product) {
  const rows = [];
  const aliases = {
    "番茄": "西红柿",
    "西红柿": "西红柿",
    "洋葱": "葱头",
    "姜": "生姜",
    "草鱼": "活草鱼",
    "鲫鱼": "活鲫鱼",
    "鲤鱼": "活鲤鱼",
    "虾": "对虾",
    "蟹": "海水蟹",
    "燕麦片": "燕麦",
    "桃": "桃子",
    "红椒": "红辣椒"
  };
  const lookup = aliases[product.trim()] || product.trim();
  const allRows = await getVarietyRows();
  const exact = allRows
    .filter((row) => row.name.toLowerCase() === lookup.toLowerCase())
    .map((row) => row.id);
  const starts = allRows
    .filter((row) => row.name.toLowerCase().startsWith(`${lookup.toLowerCase()}(`))
    .sort((a, b) => a.name.length - b.name.length)
    .map((row) => row.id);
  const seen = new Set();
  for (const id of exact.concat(starts)) {
    if (!seen.has(id)) {
      seen.add(id);
      rows.push(id);
    }
  }
  return rows;
}

async function fetchMarketPrices(varietyId, product, city, limit, refresh) {
  const key = `pfsc|chart|${varietyId}`;
  const url = `${MARKET_CHART_URL}?marketIDs=&provinceCodes=&varietyID=${encodeURIComponent(varietyId)}`;
  const result = await externalFetchWithCache(key, url, 60 * 60 * 1000, refresh, "POST");
  if (!result.text) {
    return [];
  }
  let encryptedData = result.text;
  try {
    const envelope = JSON.parse(result.text);
    if (envelope && envelope.data) {
      encryptedData = String(envelope.data);
    }
  } catch (error) {
    encryptedData = result.text;
  }

  const plain = await decryptAes(encryptedData);
  if (!plain) {
    return [];
  }
  let root;
  try {
    root = JSON.parse(plain);
  } catch (error) {
    return [];
  }
  if (!root || !root.x || !root.y) {
    return [];
  }
  const markets = Array.isArray(root.x) ? root.x.map(String) : [];
  const prices = Array.isArray(root.y) ? root.y.map(Number) : [];
  const date = root.date ? String(root.date) : "";
  const items = [];
  const count = Math.min(markets.length, prices.length);
  for (let i = 0; i < count; i++) {
    const market = markets[i];
    if (city && !marketMatchesCity(market, city)) {
      continue;
    }
    items.push({
      name: product,
      avgPrice: round(prices[i], 2).toString(),
      lowPrice: "",
      highPrice: "",
      unit: "元/公斤",
      place: market,
      specInfo: "",
      sourceMarket: market,
      pubDate: date
    });
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

async function getPrices(product, city, limit, refresh) {
  const items = [];
  if (product && product.trim()) {
    for (const varietyId of await findVarietyIds(product)) {
      const fetched = await fetchMarketPrices(varietyId, product, city, Math.max(1, limit - items.length), refresh);
      items.push(...fetched);
      if (items.length >= limit) {
        break;
      }
    }
    return items.slice(0, limit);
  }

  const defaults = ["大白菜", "土豆", "猪肉", "鸡蛋", "苹果"];
  for (const defaultProduct of defaults) {
    for (const id of await findVarietyIds(defaultProduct)) {
      const fetched = await fetchMarketPrices(id, defaultProduct, city, Math.max(1, limit - items.length), refresh);
      items.push(...fetched);
      if (items.length >= Math.max(2, Math.floor(limit / 5))) {
        break;
      }
    }
    if (items.length >= limit) {
      break;
    }
  }
  return items.slice(0, limit);
}

async function getPricesWithFallback(product, city, limit, refresh) {
  const directNational = await getPrices(product, "", Math.max(limit, 500), refresh);
  if (directNational.length > 0) {
    const directLocal = city ? directNational.filter((row) => marketMatchesCity(row.sourceMarket, city)) : directNational;
    const rows = directLocal.length ? directLocal : directNational;
    return rows.slice(0, limit).map((row) => Object.assign({}, row, {
      name: product,
      dataMode: directLocal.length ? "direct" : "national",
      fallbackCategory: "",
      referenceProduct: "",
      specInfo: directLocal.length ? row.specInfo : "所选城市暂无报价，显示全国市场"
    }));
  }

  const item = catalogFind(product);
  if (!item) {
    return [];
  }

  const result = [];
  for (const referenceProduct of fallbackProducts(product)) {
    const referenceNational = await getPrices(referenceProduct, "", 500, refresh);
    if (!referenceNational.length) {
      continue;
    }
    const referenceLocal = city
      ? referenceNational.filter((row) => marketMatchesCity(row.sourceMarket, city))
      : referenceNational;
    const rows = referenceLocal.length ? referenceLocal : referenceNational;
    for (const row of rows) {
      result.push(Object.assign({}, row, {
        name: product,
        dataMode: "category",
        fallbackCategory: item.subcategory,
        referenceProduct,
        specInfo: `同分类参考：${referenceProduct} · ${referenceLocal.length ? "同分类本地市场" : "全国市场回退"}`
      }));
      if (result.length >= limit) {
        return result;
      }
    }
  }
  return result;
}

async function getWeather(city, refresh) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${round(city.latitude, 4)}&longitude=${round(city.longitude, 4)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,relative_humidity_2m_mean&timezone=Asia%2FShanghai&forecast_days=7`;
  const result = await externalFetchWithCache(`weather|${city.code}`, url, 60 * 60 * 1000, refresh);
  if (!result.text) {
    return null;
  }
  try {
    return { data: JSON.parse(result.text), fetchedAt: result.fetchedAt };
  } catch (error) {
    return null;
  }
}

async function buildForecast(product, cityName, days, refresh) {
  const city = cities.find((item) => item.name === cityName);
  if (!city) {
    return null;
  }

  const weatherResult = await getWeather(city, refresh);
  if (!weatherResult) {
    return null;
  }

  const rule = getRule(product);
  const allPrices = await getPricesWithFallback(product, "", 500, refresh);
  const localPrices = allPrices.filter((row) => marketMatchesCity(row.sourceMarket, city.name));
  const nationalValues = parsePrices(allPrices);
  const localValues = parsePrices(localPrices);

  let currentPrice;
  let anchorMarket;
  let anchorMode;
  if (localValues.length > 0) {
    currentPrice = localValues[0];
    anchorMarket = localPrices[0].sourceMarket;
    anchorMode = "local";
  } else if (nationalValues.length > 0) {
    currentPrice = median(nationalValues);
    const firstPrice = allPrices[0];
    anchorMode = firstPrice.dataMode === "category" ? "category_fallback" : "national_fallback";
    anchorMarket = firstPrice.dataMode === "category" ? "同分类全国市场中位价" : "全国批发市场中位价";
  } else {
    return null;
  }

  const unit = allPrices.length ? allPrices[0].unit || "元/公斤" : "元/公斤";
  const supply = buildSupply(product, localValues, nationalValues);
  const suitability = buildSuitability(rule, weatherResult.data, city.name, Math.min(days, 7));
  const crossVolatility = coefficientOfVariation(nationalValues, 0.08);
  const catalogProduct = catalogFind(product);
  const forecast = arima.forecast(currentPrice, days, catalogProduct ? catalogProduct.category : "");
  const predictedChange = forecast.length
    ? (Number(forecast[Math.min(days, forecast.length) - 1].price) - currentPrice) / currentPrice * 100
    : 0;
  const risk = buildRisk(product, city.name, predictedChange, crossVolatility, supply, suitability, days);

  return {
    success: true,
    product,
    city: city.name,
    days,
    fetchedAtUtc: nowIso(),
    model: arima.name,
    price: {
      current: round(currentPrice, 2),
      unit,
      market: anchorMarket,
      mode: anchorMode,
      pubDate: allPrices.length ? allPrices[0].pubDate : "",
      source: `PFSC实时价格锚点 + ${arima.source}`,
      fallbackCategory: allPrices.length ? allPrices[0].fallbackCategory : "",
      referenceProduct: allPrices.length ? allPrices[0].referenceProduct : "",
      sampleCount: nationalValues.length,
      citySampleCount: localValues.length
    },
    weather: suitability,
    supply,
    volatility: round(crossVolatility * 100, 1),
    forecast,
    predictedChange: round(predictedChange, 1),
    risk
  };
}

async function buildRiskList(cityName, limit, refresh) {
  const products = [
    "猪肉", "鸡蛋", "土豆", "大白菜", "黄瓜", "番茄", "菠菜", "香菇",
    "牛肉", "羊肉", "胡萝卜", "苹果", "油菜", "苦瓜", "杏鲍菇",
    "哈密瓜", "带鱼", "绿豆"
  ];
  const result = [];
  for (const product of products) {
    try {
      const forecast = await buildForecast(product, cityName, 7, refresh);
      if (!forecast || !forecast.risk || !forecast.price || !forecast.supply) {
        continue;
      }
      result.push({
        id: `RSK-${product}-${cityName}`,
        product,
        market: forecast.price.market,
        score: Number(forecast.risk.score),
        level: forecast.risk.level,
        reason: forecast.risk.summary,
        reasons: forecast.risk.reasons,
        supplyIndex: Number(forecast.supply.index),
        predictedChange: Number(forecast.predictedChange),
        updatedAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ")
      });
      if (result.length >= limit) {
        break;
      }
    } catch (error) {
      // Continue to the next product if one forecast is temporarily unavailable.
    }
  }
  return result.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function buildRecommendationCandidates(cityName, limit) {
  const city = cities.find((item) => item.name === cityName);
  if (!city) {
    return [];
  }
  const weatherResult = await getWeather(city, false);
  if (!weatherResult) {
    return [];
  }

  const rows = [];
  for (const productName of productCatalog.orderedProducts) {
    const item = catalogFind(productName);
    const rule = getRule(productName);
    const suitability = buildSuitability(rule, weatherResult.data, city.name, 7);
    rows.push({
      product: productName,
      category: item ? item.category : "",
      subcategory: item ? item.subcategory : "",
      score: Number(suitability.score),
      level: suitability.level,
      reason: suitability.reason
    });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}

function buildSupply(product, localPrices, nationalPrices) {
  const nationalMedian = nationalPrices.length ? median(nationalPrices) : 0;
  const localBenchmark = localPrices.length ? lowerQuartile(localPrices) : nationalMedian;
  const ratio = nationalMedian > 0 ? localBenchmark / nationalMedian - 1 : 0;
  const pricePressure = clamp(0.5 - ratio * 2.5, 0, 1);
  let yieldPressure = pricePressure;
  let yieldChange = null;
  let yieldSource = "";
  let yieldMetric = "";
  let yieldYear = "";
  const record = supplyRecords.get(product);
  if (record) {
    yieldChange = Number(record.Change);
    yieldPressure = clamp(0.5 + yieldChange * 0.08, 0, 1);
    yieldSource = record.Source || "";
    yieldMetric = record.Metric || "";
    yieldYear = record.Year || "";
  }
  const combined = record ? clamp(pricePressure * 0.7 + yieldPressure * 0.3, 0, 1) : pricePressure;
  const index = Math.round(10 + combined * 85);
  const level = index >= 75 ? "宽松" : index >= 60 ? "较宽松" : index >= 40 ? "均衡" : "偏紧";
  const summary = `本地价格与全国中位价相比${ratio <= -0.03 ? "偏低" : ratio >= 0.03 ? "偏高" : "接近"}，短期供给压力为${level}`;
  return {
    index,
    level,
    summary,
    localBenchmark: round(localBenchmark, 2),
    nationalMedian: round(nationalMedian, 2),
    priceGap: round(ratio * 100, 1),
    pricePressure: round(pricePressure * 100, 1),
    yieldChange,
    yieldPressure: yieldChange === null ? null : round(yieldPressure * 100, 1),
    yieldYear,
    yieldMetric,
    yieldSource,
    yieldDataAvailable: yieldChange !== null,
    source: `实时批发价相对水平${yieldChange !== null ? " + 国家统计局年度产量" : ""}`
  };
}

function buildSuitability(rule, weather, city, days) {
  const current = weather.current || {};
  const currentTemp = Number(current.temperature_2m) || 0;
  const currentHumidity = Number(current.relative_humidity_2m) || 0;
  const currentRain = Number(current.precipitation) || 0;
  const currentScore = scoreDay(rule, currentTemp, currentHumidity, currentRain);

  const daily = weather.daily || {};
  const times = daily.time || [];
  const maxTemps = daily.temperature_2m_max || [];
  const minTemps = daily.temperature_2m_min || [];
  const rains = daily.precipitation_sum || [];
  const humidities = daily.relative_humidity_2m_mean || [];
  const rows = [];
  let scoreSum = 0;
  const used = Math.min(days, times.length);

  for (let i = 0; i < used; i++) {
    const maxTemp = Number(maxTemps[i]) || 0;
    const minTemp = Number(minTemps[i]) || 0;
    const midTemp = (maxTemp + minTemp) / 2;
    let humidity = Number(humidities[i]) || 0;
    if (humidity <= 0) {
      humidity = currentHumidity;
    }
    const rain = Number(rains[i]) || 0;
    const dayScore = scoreDay(rule, midTemp, humidity, rain);
    scoreSum += dayScore.score;
    rows.push({
      date: times[i] ? String(times[i]) : "",
      tempMin: round(minTemp, 1),
      tempMax: round(maxTemp, 1),
      temperature: round(midTemp, 1),
      precipitation: round(rain, 1),
      humidity: Math.round(humidity),
      score: dayScore.score,
      level: dayScore.level,
      reason: dayScore.reason
    });
  }

  const forecastAverage = used > 0 ? scoreSum / used : currentScore.score;
  const overall = Math.round(currentScore.score * 0.35 + forecastAverage * 0.65);
  const worst = rows.slice().sort((a, b) => a.score - b.score)[0];
  let reason = currentScore.reason;
  if (worst) {
    reason += `；未来${used}日最差为${worst.date}（${worst.score}分，${worst.reason}）`;
  }

  return {
    category: rule.Category,
    optimalRange: `${rule.OptimalMin}~${rule.OptimalMax}°C`,
    score: overall,
    level: levelForScore(overall),
    summary: `结合${city}当前天气和未来${used}日预报，${rule.Category}生长适宜度为${overall}分`,
    reason,
    current: currentScore,
    forecast: rows
  };
}

function scoreDay(rule, temperature, humidity, rain) {
  let tempPenalty = 0;
  if (temperature < rule.OptimalMin) {
    tempPenalty = Math.min(1, (rule.OptimalMin - temperature) / Math.max(rule.Tolerance, 1));
  } else if (temperature > rule.OptimalMax) {
    tempPenalty = Math.min(1, (temperature - rule.OptimalMax) / Math.max(rule.Tolerance, 1));
  }

  let humidityPenalty = 0;
  if (humidity < rule.HumidityMin) {
    humidityPenalty = Math.min(1, (rule.HumidityMin - humidity) / 30);
  } else if (humidity > rule.HumidityMax) {
    humidityPenalty = Math.min(1, (humidity - rule.HumidityMax) / 30);
  }

  const rainPenalty = Math.min(1, rain / Math.max(rule.RainStress, 1));
  const totalWeight = rule.TempWeight + rule.RainWeight + rule.HumidityWeight;
  const rawScore = 100 - ((tempPenalty * rule.TempWeight + rainPenalty * rule.RainWeight + humidityPenalty * rule.HumidityWeight) / Math.max(totalWeight, 1)) * 100;
  const score = Math.round(clamp(rawScore, 0, 100));

  const reasons = [];
  if (tempPenalty >= 0.45) {
    reasons.push(temperature > rule.OptimalMax ? "高温超过适宜范围" : "低温低于适宜范围");
  }
  if (rainPenalty >= 0.35) {
    reasons.push("降水偏多");
  }
  if (humidityPenalty >= 0.45) {
    reasons.push(humidity > rule.HumidityMax ? "湿度过高" : "湿度过低");
  }
  if (!reasons.length) {
    reasons.push("温湿度总体适宜");
  }

  return {
    score,
    level: levelForScore(score),
    reason: reasons.join("、")
  };
}

function buildRisk(product, city, predictedChange, volatility, supply, suitability, days) {
  const supplyIndex = supply ? Number(supply.index) : 50;
  const weatherScore = suitability ? Number(suitability.score) : 80;
  const downside = Math.max(0, -predictedChange);
  const priceScore = Math.max(5, clamp(downside / 12 * 42, 0, 42));
  const supplyScore = supplyIndex / 100 * 48;
  const weatherScoreRisk = (100 - weatherScore) / 100 * 20;
  const volatilityScore = clamp((volatility - 0.05) / 0.3, 0, 1) * 7;
  const score = Math.round(Math.min(95, priceScore + supplyScore + weatherScoreRisk + volatilityScore));
  const level = score >= 65 ? "high" : score >= 40 ? "medium" : "low";
  const reasons = [];

  if (predictedChange <= -3) {
    reasons.push(`未来${days}日预测价较当前下降${Math.abs(predictedChange).toFixed(1)}%`);
  } else if (predictedChange > 2) {
    reasons.push(`未来${days}日预测价较当前上涨${predictedChange.toFixed(1)}%`);
  } else {
    reasons.push(`未来${days}日预测价整体接近平稳`);
  }

  if (supply) {
    reasons.push(`供给压力指数${supplyIndex}（${supply.level}）`);
    if (supply.priceGap !== undefined && supply.priceGap !== null) {
      const gap = Number(supply.priceGap);
      reasons.push(`本地价格较全国中位价${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%`);
    }
    if (supply.yieldChange !== undefined && supply.yieldChange !== null) {
      const change = Number(supply.yieldChange);
      reasons.push(`年度产量同比${change >= 0 ? "+" : ""}${change.toFixed(1)}%`);
    }
  }

  if (weatherScore < 70) {
    reasons.push(`天气适宜度${weatherScore}分，存在${suitability.reason}`);
  } else {
    reasons.push(`天气适宜度${weatherScore}分`);
  }
  if (volatilityScore > 2) {
    reasons.push(`跨市场价差波动率${round(volatility * 100, 1)}%`);
  }

  const levelText = level === "high" ? "高风险" : level === "medium" ? "中风险" : "低风险";
  return {
    score,
    level,
    levelText,
    summary: `${reasons.join("；")}。综合判断为${levelText}。`,
    reasons,
    predictedChange: round(predictedChange, 1),
    priceScore: round(priceScore, 1),
    supplyScore: round(supplyScore, 1),
    weatherScore: round(weatherScoreRisk, 1),
    volatilityScore: round(volatilityScore, 1)
  };
}

function parsePrices(rows) {
  const values = [];
  for (const row of rows || []) {
    const value = Number(row.avgPrice);
    if (Number.isFinite(value) && value > 0) {
      values.push(value);
    }
  }
  return values;
}

function parseChengduPrices(html, keyword, limit) {
  const items = [];
  const rowPattern = /<tr height="30">([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[1];
    if (row.indexOf("成都") < 0) {
      continue;
    }
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellPattern.exec(row)) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, " ").replace(/￥/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      cells.push(text);
      if (cells.length >= 6) {
        break;
      }
    }
    if (cells.length < 6 || cells[1].indexOf("成都") < 0) {
      continue;
    }
    if (keyword && cells[0].toLowerCase().indexOf(keyword.toLowerCase()) < 0) {
      continue;
    }
    items.push({
      name: cells[0],
      avgPrice: cells[4],
      lowPrice: cells[2],
      highPrice: cells[3],
      unit: "元/斤",
      place: cells[1],
      specInfo: "",
      sourceMarket: cells[1],
      pubDate: cells[5]
    });
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

function parseXinfadiPrices(text, keyword, limit) {
  try {
    const root = JSON.parse(text);
    const rawList = root.list || [];
    const items = [];
    for (const row of rawList) {
      const name = String(row.prodName || "");
      const spec = String(row.specInfo || "");
      if (keyword && name.toLowerCase().indexOf(keyword.toLowerCase()) < 0 && spec.toLowerCase().indexOf(keyword.toLowerCase()) < 0) {
        continue;
      }
      items.push({
        name,
        avgPrice: String(row.avgPrice || ""),
        lowPrice: String(row.lowPrice || ""),
        highPrice: String(row.highPrice || ""),
        unit: String(row.unitInfo || ""),
        place: String(row.place || ""),
        specInfo: spec,
        sourceMarket: "北京新发地"
      });
      if (items.length >= limit) {
        break;
      }
    }
    return items;
  } catch (error) {
    return [];
  }
}

async function handleLogin(request, env) {
  const data = await readJsonBody(request);
  const phone = String(data.phone || "").replace(/[+\-\s]/g, "");
  const password = String(data.password || "");
  const city = String(data.city || "");
  const identity = String(data.identity || "").trim();

  if (!/^[0-9]{11}$/.test(phone)) {
    return json(400, { success: false, message: "invalid_phone" });
  }

  const existing = await findUser(env, phone);
  if (!existing) {
    if (!/^[0-9]{6}$/.test(password)) {
      return json(422, { success: false, message: "invalid_registration_password" });
    }
    if (!cities.some((item) => item.name === city)) {
      return json(400, { success: false, message: "invalid_city" });
    }
    if (!validIdentity(identity)) {
      return json(422, { success: false, message: "identity_required" });
    }
  } else if (existing.role !== "admin" && !existing.identity && !validIdentity(identity)) {
    return json(422, { success: false, message: "identity_required" });
  }

  const user = await authenticateUser(env, phone, password, identity);
  if (!user) {
    return json(401, { success: false, message: "invalid_password" });
  }

  if (city && cities.some((item) => item.name === city)) {
    await updateProfile(env, user.phone, "", city, null);
  }

  const session = await createSession(env, user.phone);
  return json(200, { success: true, user: await publicUser(user, env) }, {
    "Set-Cookie": `sid=${session.token}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=None`
  });
}

function validIdentity(identity) {
  return ["individual", "consumer", "village_head", "cooperative_leader"].includes(identity);
}

async function handleProfile(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const nickname = String(data.nickname || "").trim();
  const city = String(data.city || "").trim();
  const largeFont = data.largeFont === undefined ? null : Boolean(data.largeFont);

  if (nickname && (nickname.length < 2 || nickname.length > 20)) {
    return json(400, { success: false, message: "invalid_nickname" });
  }
  if (city && !cities.some((item) => item.name === city)) {
    return json(400, { success: false, message: "invalid_city" });
  }

  await updateProfile(env, user.phone, nickname, city, largeFont);
  const updated = await findUser(env, user.phone);
  return json(200, { success: true, user: await publicUser(updated, env) });
}

async function handleGroupList(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const isManager = ["village_head", "cooperative_leader"].includes(user.identity) || (await isGroupAdmin(env, user.phone));
  const managed = isManager ? await managedGroups(env, user.phone) : [];
  const myGroupData = await myGroup(env, user.phone);
  return json(200, {
    success: true,
    user: await publicUser(user, env),
    managedGroups: await Promise.all(managed.map((group) => groupView(group, env))),
    myGroup: myGroupData ? await groupView(myGroupData, env) : null
  });
}

async function handleGroupCreate(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  if (!["village_head", "cooperative_leader"].includes(user.identity) && !(await isGroupAdmin(env, user.phone))) {
    return json(403, { success: false, message: "forbidden" });
  }
  const data = await readJsonBody(request);
  const name = String(data.name || "").trim();
  if (name.length < 2 || name.length > 30) {
    return json(400, { success: false, message: "invalid_group_name" });
  }
  const group = {
    id: crypto.randomUUID().replace(/-/g, ""),
    name,
    leaderPhone: user.phone,
    createdAt: nowIso(),
    members: []
  };
  await saveGroup(env, group);
  return json(200, { success: true, group: await groupView(group, env) });
}

async function handleGroupDelete(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const groupId = String(data.groupId || "");
  const group = await findGroup(env, groupId);
  if (!group || !canManageGroup(group, user.phone)) {
    return json(403, { success: false, message: "forbidden" });
  }
  await env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(groupId).run();
  return json(200, { success: true });
}

async function handleGroupAddMember(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const groupId = String(data.groupId || "");
  const phone = String(data.phone || "").trim();
  const target = await findUser(env, phone);
  if (!target) {
    return json(404, { success: false, message: "account_not_found" });
  }
  if (target.role === "admin" || target.identity !== "individual") {
    return json(400, { success: false, message: "member_must_be_individual" });
  }
  if (await myGroup(env, phone)) {
    return json(409, { success: false, message: "member_already_in_group" });
  }
  const group = await findGroup(env, groupId);
  if (!group || !canManageGroup(group, user.phone)) {
    return json(403, { success: false, message: "forbidden" });
  }
  group.members.push({
    phone,
    role: "member",
    joinedAt: nowIso(),
    recommendations: [],
    recommendedBy: "",
    updatedAt: nowIso()
  });
  await saveGroup(env, group);
  return json(200, { success: true, group: await groupView(group, env) });
}

async function handleGroupRemoveMember(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const groupId = String(data.groupId || "");
  const phone = String(data.phone || "").trim();
  const group = await findGroup(env, groupId);
  if (!group || !canManageGroup(group, user.phone)) {
    return json(403, { success: false, message: "forbidden" });
  }
  group.members = group.members.filter((member) => member.phone !== phone);
  await saveGroup(env, group);
  return json(200, { success: true, group: await groupView(group, env) });
}

async function handleGroupSetAdmin(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const groupId = String(data.groupId || "");
  const phone = String(data.phone || "").trim();
  const group = await findGroup(env, groupId);
  if (!group || !canManageGroup(group, user.phone)) {
    return json(403, { success: false, message: "forbidden" });
  }
  const member = group.members.find((item) => item.phone === phone);
  if (!member) {
    return json(403, { success: false, message: "forbidden" });
  }
  member.role = member.role === "admin" ? "member" : "admin";
  await saveGroup(env, group);
  return json(200, { success: true, group: await groupView(group, env) });
}

async function handleGroupLeave(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const groupId = String(data.groupId || "");
  const group = await findGroup(env, groupId);
  if (!group || !group.members.some((member) => member.phone === user.phone)) {
    return json(404, { success: false, message: "group_membership_not_found" });
  }
  group.members = group.members.filter((member) => member.phone !== user.phone);
  await saveGroup(env, group);
  return json(200, { success: true });
}

async function handleGroupRecommendations(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const data = await readJsonBody(request);
  const groupId = String(data.groupId || "");
  const phone = String(data.phone || "").trim();
  const products = Array.isArray(data.products) ? data.products.map(String).filter(Boolean) : [];
  const group = await findGroup(env, groupId);
  if (!group || !canManageGroup(group, user.phone)) {
    return json(403, { success: false, message: "forbidden" });
  }
  const member = group.members.find((item) => item.phone === phone);
  if (!member) {
    return json(403, { success: false, message: "forbidden" });
  }
  member.recommendations = [...new Set(products.map((item) => item.trim()).filter(Boolean))].slice(0, 30);
  member.recommendedBy = user.phone;
  member.updatedAt = nowIso();
  await saveGroup(env, group);
  return json(200, { success: true, group: await groupView(group, env) });
}

async function handleMyGroup(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const group = await myGroup(env, user.phone);
  if (!group) {
    return json(200, { success: true, myGroup: null, member: null });
  }
  const member = group.members.find((item) => item.phone === user.phone);
  return json(200, {
    success: true,
    myGroup: await groupView(group, env),
    member: member ? await memberView(member, env) : null
  });
}

async function handleGroupRecommendProducts(request, env, query) {
  const user = await currentUser(request, env);
  if (!user) {
    return json(401, { success: false, message: "not_logged_in" });
  }
  const city = (query.get("city") || "").trim();
  if (!cities.some((item) => item.name === city)) {
    return json(400, { success: false, message: "invalid_city" });
  }
  const items = await buildRecommendationCandidates(city, 12);
  return json(200, { success: true, city, items });
}

async function handleWeather(request, query) {
  const cityName = (query.get("city") || "").trim();
  const refresh = query.get("refresh") === "1";
  const city = cities.find((item) => item.name === cityName);
  if (!city) {
    return json(400, { success: false, message: "invalid_city" });
  }
  const result = await getWeather(city, refresh);
  if (!result) {
    return json(503, { success: false, message: "weather_unavailable", city: cityName });
  }
  return json(200, {
    success: true,
    city: city.name,
    latitude: city.latitude,
    longitude: city.longitude,
    fetchedAtUtc: result.fetchedAt ? new Date(result.fetchedAt).toISOString() : null,
    data: result.data
  });
}

async function handlePrices(query) {
  const keyword = (query.get("keyword") || "").trim();
  const city = (query.get("city") || "").trim();
  let limit = 50;
  const parsedLimit = Number(query.get("limit"));
  if (Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) {
    limit = parsedLimit;
  }
  const refresh = query.get("refresh") === "1";

  const pfscItems = keyword
    ? await getPricesWithFallback(keyword, city, limit, refresh)
    : await getPrices(keyword, city, limit, refresh);
  if (pfscItems.length > 0) {
    const firstItem = pfscItems[0];
    const source = firstItem.dataMode === "category"
      ? "全国同类市场价格（回退）"
      : firstItem.dataMode === "national"
        ? "全国市场（所选城市暂无报价）"
        : "全国农产品批发市场价格信息系统";
    return json(200, {
      success: true,
      source,
      fetchedAtUtc: nowIso(),
      city,
      keyword,
      fallback: firstItem.dataMode !== "direct",
      fallbackCategory: firstItem.fallbackCategory || "",
      referenceProduct: firstItem.referenceProduct || "",
      items: pfscItems
    });
  }

  if (city === "成都市") {
    const result = await externalFetchWithCache("prices|chengdu", CHENGDU_URL, 60 * 60 * 1000, refresh);
    if (!result.text) {
      return json(503, { success: false, message: "price_unavailable", city });
    }
    return json(200, {
      success: true,
      source: "成都本地批发市场",
      fetchedAtUtc: result.fetchedAt ? new Date(result.fetchedAt).toISOString() : null,
      city,
      keyword,
      items: parseChengduPrices(result.text, keyword, limit)
    });
  }

  const result = await externalFetchWithCache("prices|xinfadi", `${XINFADI_URL}?limit=100&current=1`, 60 * 60 * 1000, refresh);
  if (!result.text) {
    return json(503, { success: false, message: "price_unavailable" });
  }
  const items = parseXinfadiPrices(result.text, keyword, limit);
  if (!items.length) {
    return json(503, { success: false, message: "price_format_error" });
  }
  return json(200, {
    success: true,
    source: "北京新发地",
    fetchedAtUtc: result.fetchedAt ? new Date(result.fetchedAt).toISOString() : null,
    keyword,
    city,
    items
  });
}

async function handleForecast(query) {
  const product = (query.get("product") || "").trim();
  const city = (query.get("city") || "").trim();
  let days = 7;
  const parsedDays = Number(query.get("days"));
  if (Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 180) {
    days = parsedDays;
  }
  const refresh = query.get("refresh") === "1";
  if (!product) {
    return json(400, { success: false, message: "invalid_product" });
  }
  if (!cities.some((item) => item.name === city)) {
    return json(400, { success: false, message: "invalid_city" });
  }
  const result = await buildForecast(product, city, days, refresh);
  if (!result) {
    return json(503, { success: false, message: "forecast_unavailable", product, city });
  }
  return json(200, result);
}

async function handleRisks(query) {
  const city = (query.get("city") || "").trim();
  let limit = 12;
  const parsedLimit = Number(query.get("limit"));
  if (Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit <= 30) {
    limit = parsedLimit;
  }
  const refresh = query.get("refresh") === "1";
  if (!cities.some((item) => item.name === city)) {
    return json(400, { success: false, message: "invalid_city" });
  }
  const items = await buildRiskList(city, limit, refresh);
  return json(200, {
    success: true,
    city,
    source: "实时价格 + 天气适宜度 + 供给压力",
    fetchedAtUtc: nowIso(),
    items
  });
}

async function findUser(env, phone) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
  if (!row) {
    return null;
  }
  return rowToUser(row);
}

async function saveUser(env, user) {
  await env.DB.prepare(`
    INSERT INTO users (phone, hash, salt, role, identity, large_font, nickname, city, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      hash = excluded.hash,
      salt = excluded.salt,
      role = excluded.role,
      identity = excluded.identity,
      large_font = excluded.large_font,
      nickname = excluded.nickname,
      city = excluded.city,
      created_at = excluded.created_at,
      last_login_at = excluded.last_login_at
  `).bind(
    user.phone,
    user.hash,
    user.salt,
    user.role,
    user.identity || "",
    user.largeFont ? 1 : 0,
    user.nickname || "",
    user.city || "",
    user.createdAt,
    user.lastLoginAt
  ).run();
}

function rowToUser(row) {
  return {
    phone: row.phone,
    hash: row.hash,
    salt: row.salt,
    role: row.role,
    identity: row.identity || "",
    largeFont: bool(row.large_font),
    nickname: row.nickname || "",
    city: row.city || "",
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

async function findSession(env, token) {
  if (!token) {
    return null;
  }
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE token = ?").bind(token).first();
  if (!row) {
    return null;
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return row;
}

async function createSession(env, phone) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, phone, expires_at) VALUES (?, ?, ?)")
    .bind(token, phone, expiresAt)
    .run();
  return { token, phone, expiresAt };
}

async function deleteSession(env, token) {
  if (!token) {
    return;
  }
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

async function updateProfile(env, phone, nickname, city, largeFont) {
  const user = await findUser(env, phone);
  if (!user) {
    return;
  }
  if (user.role !== "admin" && nickname) {
    user.nickname = nickname.trim();
  }
  if (city) {
    user.city = city.trim();
  }
  if (largeFont !== null && user.identity === "individual") {
    user.largeFont = largeFont;
  }
  await saveUser(env, user);
}

async function authenticateUser(env, phone, password, identity) {
  let user = await findUser(env, phone);
  if (!user) {
    if (!/^[0-9]{6}$/.test(password)) {
      return null;
    }
    const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
    user = {
      phone,
      salt,
      hash: await hashPassword(password, salt),
      role: "guest",
      identity,
      largeFont: identity === "individual",
      nickname: `用户${phone.slice(7)}`,
      city: "",
      createdAt: nowIso(),
      lastLoginAt: nowIso()
    };
    await saveUser(env, user);
    return user;
  }

  const expected = await hashPassword(password, user.salt);
  if (expected !== user.hash) {
    return null;
  }
  if (user.role !== "admin" && !user.identity) {
    user.identity = identity;
    user.largeFont = identity === "individual";
  } else if (user.role !== "admin" && !user.identity && !user.largeFont && identity === "individual") {
    user.largeFont = true;
  }
  user.lastLoginAt = nowIso();
  await saveUser(env, user);
  return user;
}

async function hashPassword(password, saltBase64) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-1",
      salt: base64ToBytes(saltBase64),
      iterations: 10000
    },
    passwordKey,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function currentUser(request, env) {
  const token = cookie(request, "sid");
  const session = await findSession(env, token);
  if (!session) {
    return null;
  }
  return findUser(env, session.phone);
}

async function publicUser(user, env) {
  return {
    phone: user.phone,
    maskedPhone: maskPhone(user.phone),
    nickname: user.nickname,
    city: user.city,
    role: user.role,
    identity: user.identity,
    largeFont: user.largeFont,
    groupAdmin: await isGroupAdmin(env, user.phone),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

async function allGroups(env) {
  const rows = await env.DB.prepare("SELECT * FROM groups ORDER BY created_at ASC").all();
  return (rows.results || []).map((row) => {
    let members = [];
    try {
      members = row.members_json ? JSON.parse(row.members_json) : [];
    } catch (error) {
      members = [];
    }
    return {
      id: row.id,
      name: row.name,
      leaderPhone: row.leader_phone,
      createdAt: row.created_at,
      members
    };
  });
}

async function findGroup(env, id) {
  const row = await env.DB.prepare("SELECT * FROM groups WHERE id = ?").bind(id).first();
  if (!row) {
    return null;
  }
  let members = [];
  try {
    members = row.members_json ? JSON.parse(row.members_json) : [];
  } catch (error) {
    members = [];
  }
  return {
    id: row.id,
    name: row.name,
    leaderPhone: row.leader_phone,
    createdAt: row.created_at,
    members
  };
}

async function saveGroup(env, group) {
  await env.DB.prepare(`
    INSERT INTO groups (id, name, leader_phone, created_at, members_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      leader_phone = excluded.leader_phone,
      created_at = excluded.created_at,
      members_json = excluded.members_json
  `).bind(
    group.id,
    group.name,
    group.leaderPhone,
    group.createdAt,
    JSON.stringify(group.members || [])
  ).run();
}

async function myGroup(env, phone) {
  const groups = await allGroups(env);
  return groups.find((group) => group.members.some((member) => member.phone === phone)) || null;
}

async function managedGroups(env, phone) {
  const groups = await allGroups(env);
  return groups.filter((group) =>
    group.leaderPhone === phone ||
    group.members.some((member) => member.phone === phone && member.role === "admin")
  );
}

async function isGroupAdmin(env, phone) {
  const groups = await allGroups(env);
  return groups.some((group) => group.members.some((member) => member.phone === phone && member.role === "admin"));
}

function canManageGroup(group, phone) {
  return group.leaderPhone === phone ||
    group.members.some((member) => member.phone === phone && member.role === "admin");
}

async function groupView(group, env) {
  return {
    id: group.id,
    name: group.name,
    leaderPhone: group.leaderPhone,
    createdAt: group.createdAt,
    members: await Promise.all((group.members || []).map((member) => memberView(member, env)))
  };
}

async function memberView(member, env) {
  const user = await findUser(env, member.phone);
  return {
    phone: member.phone,
    maskedPhone: user ? maskPhone(user.phone) : maskPhone(member.phone),
    nickname: user ? user.nickname : `用户${maskPhone(member.phone)}`,
    city: user ? user.city : "",
    identity: user ? user.identity : "individual",
    role: member.role,
    recommendations: member.recommendations || [],
    recommendedBy: member.recommendedBy || "",
    joinedAt: member.joinedAt,
    updatedAt: member.updatedAt
  };
}
