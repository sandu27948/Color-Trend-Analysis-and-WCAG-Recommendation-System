const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const cheerio = require("cheerio");

let playwrightChromium = null;
try {
  ({ chromium: playwrightChromium } = require("playwright"));
} catch (error) {
  playwrightChromium = null;
}

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   🔑 SUPABASE CONFIG
========================= */
const supabaseUrl = "https://ieqbnxjzswpfvayyncpw.supabase.co";
const supabaseKey = "sb_publishable_Naq9Jd0Ecs6dNIFpNG_1cw__MpUwtso";

const supabase = createClient(supabaseUrl, supabaseKey);
const localDataFile = path.join(__dirname, "uploaded-data.json");
const fallbackDataFile = path.join(__dirname, "dataset.json");
const usersDataFile = path.join(__dirname, "users.json");
const authSecret = process.env.AUTH_SECRET || "color-trend-system-auth-secret";
const revokedTokens = new Set();

function readLocalDataset() {
  if (!fs.existsSync(localDataFile)) return null;
  try {
    const raw = fs.readFileSync(localDataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function readFallbackDataset() {
  if (!fs.existsSync(fallbackDataFile)) return [];
  try {
    const raw = fs.readFileSync(fallbackDataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLocalDataset(dataset) {
  fs.writeFileSync(localDataFile, JSON.stringify(dataset, null, 2), "utf8");
}

function readUsers() {
  if (!fs.existsSync(usersDataFile)) return [];
  try {
    const raw = fs.readFileSync(usersDataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersDataFile, JSON.stringify(users, null, 2), "utf8");
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, hashedValue) {
  if (!hashedValue || typeof hashedValue !== "string") return false;
  const [salt, storedHash] = hashedValue.split(":");
  if (!salt || !storedHash) return false;
  const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");

  const stored = Buffer.from(storedHash, "hex");
  const computed = Buffer.from(computedHash, "hex");
  if (stored.length !== computed.length) return false;
  return crypto.timingSafeEqual(stored, computed);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const normalized = remainder === 0 ? padded : `${padded}${"=".repeat(4 - remainder)}`;
  return Buffer.from(normalized, "base64").toString("utf8");
}

function createAuthToken(user) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
    })
  );
  const signature = crypto
    .createHmac("sha256", authSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string") return null;
  if (revokedTokens.has(token)) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", authSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expected) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (!decoded?.sub || !decoded?.exp) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch (error) {
    return null;
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const users = readUsers();
  const user = users.find((entry) => String(entry.id) === String(decoded.sub));
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.auth = {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  };

  return next();
}

function extractDatasetFromBody(body) {
  return Array.isArray(body)
    ? body
    : body?.dataset || body?.data || null;
}

function getCurrentDataset() {
  return readLocalDataset() || fallbackData;
}

function mergeRowsById(existingRows, incomingRows) {
  const nextRows = [...existingRows];

  incomingRows.forEach((incomingRow) => {
    if (!incomingRow || typeof incomingRow !== "object") {
      return;
    }

    const incomingId = incomingRow.id;
    if (incomingId === undefined || incomingId === null) {
      nextRows.push(incomingRow);
      return;
    }

    const rowIndex = nextRows.findIndex((row) => String(row?.id) === String(incomingId));
    if (rowIndex < 0) {
      nextRows.push(incomingRow);
      return;
    }

    nextRows[rowIndex] = {
      ...nextRows[rowIndex],
      ...incomingRow,
      id: nextRows[rowIndex].id
    };
  });

  return nextRows;
}

const fallbackData = readFallbackDataset();

/* =========================
   🔐 AUTH API
========================= */
app.post(["/auth/signup", "/auth/signup/"], (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (name.length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Provide a valid email address." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const users = readUsers();
  if (users.some((entry) => entry.email === email)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now
  };

  users.push(user);
  writeUsers(users);

  const token = createAuthToken(user);
  return res.status(201).json({
    message: "Account created successfully.",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
});

app.post(["/auth/login", "/auth/login/"], (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const users = readUsers();
  const user = users.find((entry) => entry.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = createAuthToken(user);
  return res.json({
    message: "Login successful.",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
});

app.get(["/auth/profile", "/auth/profile/"], requireAuth, (req, res) => {
  return res.json({ user: req.auth.user });
});

app.put(["/auth/profile", "/auth/profile/"], requireAuth, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters." });
  }

  const users = readUsers();
  const index = users.findIndex((entry) => String(entry.id) === String(req.auth.user.id));
  if (index < 0) {
    return res.status(404).json({ error: "User not found." });
  }

  users[index] = {
    ...users[index],
    name,
    updatedAt: new Date().toISOString()
  };
  writeUsers(users);

  return res.json({
    message: "Profile updated successfully.",
    user: {
      id: users[index].id,
      name: users[index].name,
      email: users[index].email,
      createdAt: users[index].createdAt,
      updatedAt: users[index].updatedAt
    }
  });
});

app.post(["/auth/logout", "/auth/logout/"], requireAuth, (req, res) => {
  revokedTokens.add(req.auth.token);
  return res.json({ message: "Logout successful." });
});

/* =========================
   📥 UPLOAD DATA (OPTIONAL)
========================= */
app.post(["/upload", "/upload/", "/upload "], async (req, res) => {
  const dataset = extractDatasetFromBody(req.body) || [];

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return res.status(400).json({ error: "Expected a non-empty array of rows" });
  }

  const existingData = readLocalDataset() || [];
  const nextData = [...existingData, ...dataset];

  try {
    await supabase.from("colors").insert(dataset);
  } catch (error) {
    // Ignore Supabase failures and keep the data locally.
  }

  writeLocalDataset(nextData);
  res.json({
    message: "Data uploaded successfully",
    uploadedCount: dataset.length,
    count: nextData.length
  });
});

/* =========================
   ♻️ UPDATE DATA
========================= */
app.put(["/update", "/update/"], async (req, res) => {
  const incomingDataset = extractDatasetFromBody(req.body);
  const shouldReplaceAll = req.body?.replaceAll === true;

  if (Array.isArray(incomingDataset)) {
    if (incomingDataset.length === 0) {
      return res.status(400).json({ error: "Expected a non-empty array of rows" });
    }

    const sourceData = getCurrentDataset();
    const nextData = shouldReplaceAll
      ? incomingDataset
      : mergeRowsById(sourceData, incomingDataset);

    try {
      await supabase.from("colors").delete().neq("id", -1);
      await supabase.from("colors").insert(nextData);
    } catch (error) {
      // Keep local update as the source of truth if Supabase write fails.
    }

    writeLocalDataset(nextData);
    return res.json({
      message: shouldReplaceAll ? "Data replaced successfully" : "Data updated successfully",
      updatedCount: incomingDataset.length,
      count: nextData.length,
      mode: shouldReplaceAll ? "replace" : "merge"
    });
  }

  const incomingRow = req.body;
  const hasBody = incomingRow && typeof incomingRow === "object";
  if (!hasBody) {
    return res.status(400).json({ error: "Expected either a dataset array or a row object" });
  }

  const incomingId = incomingRow.id;
  if (incomingId === undefined || incomingId === null) {
    return res.status(400).json({ error: "Missing id for row update" });
  }

  const sourceData = getCurrentDataset();
  const rowIndex = sourceData.findIndex((row) => String(row?.id) === String(incomingId));
  const nextData = [...sourceData];
  let updatedRow;

  if (rowIndex < 0) {
    updatedRow = incomingRow;
    nextData.push(updatedRow);
  } else {
    updatedRow = {
      ...sourceData[rowIndex],
      ...incomingRow,
      id: sourceData[rowIndex].id
    };
    nextData[rowIndex] = updatedRow;
  }

  try {
    if (rowIndex < 0) {
      await supabase.from("colors").insert([updatedRow]);
    } else {
      await supabase.from("colors").update(updatedRow).eq("id", incomingId);
    }
  } catch (error) {
    // Ignore Supabase failures and persist local data.
  }

  writeLocalDataset(nextData);
  return res.json({
    message: rowIndex < 0 ? "Row created successfully" : "Row updated successfully",
    data: updatedRow,
    count: nextData.length
  });
});

/* =========================
   🗑️ DELETE DATA
========================= */
app.delete(["/delete", "/delete/", "/delete/all", "/delete/all/"], async (req, res) => {
  try {
    await supabase.from("colors").delete().neq("id", -1);
  } catch (error) {
    // Ignore Supabase failures and keep local deletion.
  }

  writeLocalDataset([]);
  return res.json({ message: "All rows deleted successfully", count: 0 });
});

app.delete(["/delete/:id", "/delete/:id/"], async (req, res) => {
  const incomingId = req.params.id;
  if (incomingId === undefined || incomingId === null || incomingId === "") {
    return res.status(400).json({ error: "Missing id for delete" });
  }

  const sourceData = readLocalDataset() || fallbackData;
  const rowIndex = sourceData.findIndex((row) => String(row?.id) === String(incomingId));

  if (rowIndex < 0) {
    return res.status(404).json({ error: "Row not found" });
  }

  const deletedRow = sourceData[rowIndex];
  const nextData = sourceData.filter((_, index) => index !== rowIndex);

  try {
    await supabase.from("colors").delete().eq("id", incomingId);
  } catch (error) {
    // Ignore Supabase failures and keep local deletion.
  }

  writeLocalDataset(nextData);
  return res.json({ message: "Row deleted successfully", data: deletedRow, count: nextData.length });
});

/* =========================
   📊 GET DATA
========================= */
app.get("/data", async (req, res) => {
  const localData = readLocalDataset();
  if (localData) {
    return res.json(localData);
  }

  try {
    const { data, error } = await supabase
      .from("colors")
      .select("*");

    if (error) throw error;
    res.json(data && data.length ? data : fallbackData);
  } catch (error) {
    res.json(fallbackData);
  }
});

/* =========================
   🎨 COLOR HELPERS
========================= */
function normalizeHex(value) {
  if (!value || typeof value !== "string") return null;
  let hex = value.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
    hex = hex.split("").map((char) => char + char).join("");
  }
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  return null;
}

function getField(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
      return item[key];
    }
  }
  return null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  const value = normalized.slice(1);
  const parsed = parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value) => clamp(value).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorDistance(pointA, pointB) {
  return Math.sqrt(
    Math.pow(pointA.r - pointB.r, 2) +
    Math.pow(pointA.g - pointB.g, 2) +
    Math.pow(pointA.b - pointB.b, 2)
  );
}

function initializeCentroids(points, k) {
  const centroids = [];
  const firstPoint = points[0];
  centroids.push({ ...firstPoint });

  while (centroids.length < k) {
    let farthestIndex = 0;
    let farthestDistance = -1;

    points.forEach((point, index) => {
      const minDistance = Math.min(...centroids.map((centroid) => colorDistance(point, centroid)));
      if (minDistance > farthestDistance) {
        farthestDistance = minDistance;
        farthestIndex = index;
      }
    });

    centroids.push({ ...points[farthestIndex] });
  }

  return centroids;
}

function kMeansCluster(colors, requestedK = 3) {
  const validColors = Array.from(
    new Set((colors || []).map((color) => normalizeHex(color)).filter(Boolean))
  );

  if (validColors.length === 0) {
    return { clusters: [], totalPoints: 0, iterations: 0, k: 0 };
  }

  const points = validColors
    .map((color) => {
      const rgb = hexToRgb(color);
      return rgb ? { color, ...rgb } : null;
    })
    .filter(Boolean);

  if (points.length === 0) {
    return { clusters: [], totalPoints: 0, iterations: 0, k: 0 };
  }

  const k = Math.max(1, Math.min(points.length, parseInt(requestedK, 10) || 3));
  let centroids = initializeCentroids(points, k);
  let assignments = new Array(points.length).fill(-1);
  let iterations = 0;

  for (let step = 0; step < 10; step += 1) {
    let changed = false;

    assignments = points.map((point, index) => {
      let nearestCluster = 0;
      let nearestDistance = Infinity;

      centroids.forEach((centroid, clusterIndex) => {
        const distance = colorDistance(point, centroid);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestCluster = clusterIndex;
        }
      });

      if (assignments[index] !== nearestCluster) {
        changed = true;
      }
      return nearestCluster;
    });

    centroids = centroids.map((centroid, clusterIndex) => {
      const members = points.filter((_, index) => assignments[index] === clusterIndex);
      if (members.length === 0) {
        return centroid;
      }

      const average = members.reduce(
        (acc, member) => ({
          r: acc.r + member.r,
          g: acc.g + member.g,
          b: acc.b + member.b
        }),
        { r: 0, g: 0, b: 0 }
      );

      const size = members.length;
      return {
        r: average.r / size,
        g: average.g / size,
        b: average.b / size,
        color: rgbToHex({
          r: average.r / size,
          g: average.g / size,
          b: average.b / size
        })
      };
    });

    iterations = step + 1;

    if (!changed) {
      break;
    }
  }

  const clusters = centroids.map((centroid, clusterIndex) => {
    const members = points
      .filter((_, index) => assignments[index] === clusterIndex)
      .map((point) => ({ color: point.color, rgb: { r: point.r, g: point.g, b: point.b } }));

    return {
      id: clusterIndex,
      centroid: centroid.color || rgbToHex(centroid),
      members,
      size: members.length
    };
  });

  return {
    clusters,
    totalPoints: points.length,
    iterations,
    k
  };
}

function extractClusterableColors(sourceData) {
  return (sourceData || [])
    .map((item) => {
      const rawColor = getField(item, [
        "primary",
        "Primary",
        "primary_color",
        "Primary Color",
        "Primary Color (HEX)",
        "color",
        "primaryColor"
      ]);
      return normalizeHex(rawColor);
    })
    .filter(Boolean);
}

function getLuminance(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error("Invalid HEX color");
  let c = normalized.substring(1);
  let rgb = parseInt(c, 16);

  let r = (rgb >> 16) & 255;
  let g = (rgb >> 8) & 255;
  let b = rgb & 255;

  [r, g, b] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928
      ? v / 12.92
      : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrast(hex1, hex2) {
  const L1 = getLuminance(hex1);
  const L2 = getLuminance(hex2);
  const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  return parseFloat(contrast.toFixed(2));
}

function normalizeWCAGLevel(value) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "AA";
  return normalized === "AAA" ? "AAA" : "AA";
}

function normalizeTextSize(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "normal";
  if (["large", "lg"].includes(normalized)) return "large";
  return "normal";
}

function getWCAGThreshold(level = "AA", textSize = "normal") {
  const normalizedLevel = normalizeWCAGLevel(level);
  const normalizedSize = normalizeTextSize(textSize);

  if (normalizedLevel === "AAA") {
    return normalizedSize === "large" ? 4.5 : 7.0;
  }

  return normalizedSize === "large" ? 3.0 : 4.5;
}

function evaluateWCAGContrast(contrast, level = "AA", textSize = "normal") {
  const threshold = getWCAGThreshold(level, textSize);
  return {
    pass: contrast >= threshold,
    threshold,
    level: normalizeWCAGLevel(level),
    textSize: normalizeTextSize(textSize)
  };
}

function getAuditRecommendation(background) {
  const normalizedBackground = normalizeHex(background);
  if (!normalizedBackground) return null;

  const candidates = ["#FFFFFF", "#000000"];
  const suggestedText = candidates.reduce((best, candidate) => (
    getContrast(normalizedBackground, candidate) > getContrast(normalizedBackground, best)
      ? candidate
      : best
  ));
  const contrast = getContrast(normalizedBackground, suggestedText);

  return {
    suggestedText,
    contrast,
    status: evaluateWCAGContrast(contrast, "AA", "normal").pass ? "Pass (WCAG AA)" : "Fail",
    action: `Replace the text color with ${suggestedText} on ${normalizedBackground}.`
  };
}

function parseRgbColor(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;

  const channels = match[1].split(",").map((chunk) => chunk.trim());
  if (channels.length < 3) return null;

  const r = parseFloat(channels[0]);
  const g = parseFloat(channels[1]);
  const b = parseFloat(channels[2]);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;

  if (channels.length >= 4) {
    const alpha = parseFloat(channels[3]);
    if (!Number.isNaN(alpha) && alpha === 0) {
      return null;
    }
  }

  return rgbToHex({ r, g, b });
}

function parseColorToHex(value) {
  if (!value || typeof value !== "string") return null;
  const normalized = normalizeHex(value);
  if (normalized) return normalized;

  const rgbHex = parseRgbColor(value);
  if (rgbHex) return rgbHex;

  return null;
}

function parseInlineStyle(styleText) {
  if (!styleText || typeof styleText !== "string") return {};
  const declarations = styleText.split(";");
  const parsed = {};

  declarations.forEach((declaration) => {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex < 0) return;
    const rawProperty = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = declaration.slice(separatorIndex + 1).trim();
    if (!rawProperty || !rawValue) return;
    parsed[rawProperty] = rawValue;
  });

  return parsed;
}

function normalizeUrlInput(value) {
  if (!value || typeof value !== "string") return null;
  let candidate = value.trim();
  if (!candidate) return null;

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function extractStyleColorPairs(html) {
  const $ = cheerio.load(html || "");
  const pairMap = new Map();

  const recordPair = (backgroundHex, textHex, source) => {
    const background = parseColorToHex(backgroundHex);
    const text = parseColorToHex(textHex);
    if (!background || !text) return;

    const key = `${background}|${text}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        background,
        text,
        source
      });
    }
  };

  const bodyStyle = parseInlineStyle($("body").attr("style"));
  const htmlStyle = parseInlineStyle($("html").attr("style"));

  const rootBackground = bodyStyle["background-color"] || bodyStyle.background || htmlStyle["background-color"] || htmlStyle.background;
  const rootText = bodyStyle.color || htmlStyle.color || "#000000";
  if (rootBackground && rootText) {
    recordPair(rootBackground, rootText, "body");
  }

  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) {
    const bg = parseColorToHex(themeColor);
    if (bg) {
      const whiteContrast = getContrast(bg, "#FFFFFF");
      const blackContrast = getContrast(bg, "#000000");
      const bestText = whiteContrast > blackContrast ? "#FFFFFF" : "#000000";
      recordPair(bg, bestText, "meta-theme-color");
    }
  }

  $("[style]").each((index, element) => {
    if (index > 400) {
      return false;
    }

    const styleObject = parseInlineStyle($(element).attr("style"));
    const text = styleObject.color;
    const background = styleObject["background-color"] || styleObject.background;
    if (!text || !background) return;

    recordPair(background, text, "inline-style");
    return undefined;
  });

  return Array.from(pairMap.values());
}

function extractThemeVariablePairsFromCssText(cssText) {
  if (!cssText || typeof cssText !== "string") return [];

  const variableMap = {};
  const regex = /(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g;
  let match = regex.exec(cssText);

  while (match) {
    const variableName = match[1].trim();
    const variableValue = match[2].trim();
    const hex = parseColorToHex(variableValue);
    if (hex) {
      variableMap[variableName] = hex;
    }
    match = regex.exec(cssText);
  }

  const pairs = [];
  const pairSpecs = [
    ["--wd-main-bgcolor", "--wd-text-color"],
    ["--wd-main-bgcolor", "--wd-title-color"],
    ["--wd-main-bgcolor", "--wd-link-color"],
    ["--btn-accented-bgcolor", "--btn-accented-color"],
    ["--btn-default-bgcolor", "--btn-default-color"],
    ["--notices-success-bg", "--notices-success-color"],
    ["--notices-warning-bg", "--notices-warning-color"]
  ];

  pairSpecs.forEach(([backgroundVar, textVar]) => {
    const background = variableMap[backgroundVar];
    const text = variableMap[textVar];
    if (!background || !text) return;

    pairs.push({
      source: "css-variable",
      background,
      text,
      selector: `:root ${backgroundVar} + ${textVar}`,
      sampleText: "theme variable pair",
      occurrences: 1
    });
  });

  return pairs;
}

function extractThemeVariablePairsFromHtml(html) {
  if (!html || typeof html !== "string") return [];
  const $ = cheerio.load(html);
  let cssText = "";

  $("style").each((_, styleNode) => {
    cssText += `\n${$(styleNode).html() || ""}`;
  });

  return extractThemeVariablePairsFromCssText(cssText);
}

async function fetchExternalStylesCssText(baseUrl, html) {
  if (!html || typeof html !== "string") return "";

  const $ = cheerio.load(html);
  const hrefs = [];

  $('link[rel="stylesheet"]').each((_, node) => {
    const href = $(node).attr("href");
    if (href) hrefs.push(href);
  });

  const uniqueHrefs = Array.from(new Set(hrefs)).slice(0, 8);
  let combinedCssText = "";

  for (const href of uniqueHrefs) {
    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, baseUrl).toString();
    } catch (error) {
      continue;
    }

    const cssResult = await fetchWebsiteHtml(absoluteUrl);
    if (!cssResult.ok || !cssResult.html) {
      continue;
    }

    combinedCssText += `\n${cssResult.html}`;
    if (combinedCssText.length > 900000) {
      break;
    }
  }

  return combinedCssText;
}

function mergeColorPairs(primaryPairs, extraPairs) {
  const map = new Map();

  [...(primaryPairs || []), ...(extraPairs || [])].forEach((pair) => {
    const bg = parseColorToHex(pair?.background);
    const text = parseColorToHex(pair?.text);
    if (!bg || !text) return;

    const key = `${bg}|${text}`;
    if (!map.has(key)) {
      map.set(key, {
        ...pair,
        background: bg,
        text,
        occurrences: pair?.occurrences || 1,
        states: Array.isArray(pair?.states)
          ? pair.states.filter(Boolean)
          : (pair?.state ? [pair.state] : [])
      });
      return;
    }

    const existing = map.get(key);
    existing.occurrences += pair?.occurrences || 1;
    const nextStates = Array.isArray(pair?.states)
      ? pair.states
      : (pair?.state ? [pair.state] : []);
    nextStates.forEach((state) => {
      if (state && !existing.states.includes(state)) {
        existing.states.push(state);
      }
    });
    if (existing.source === "computed-style") {
      return;
    }
    if (pair?.source === "computed-style") {
      map.set(key, {
        ...pair,
        background: bg,
        text,
        occurrences: existing.occurrences,
        states: existing.states
      });
    }
  });

  return Array.from(map.values());
}

async function fetchWebsiteHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": "ColorTrendAuditBot/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, status: response.status, html: "" };
    }

    const html = await response.text();
    return { ok: true, status: response.status, html };
  } catch (error) {
    return { ok: false, status: 0, html: "", error };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractRenderedColorPairs(url, options = {}) {
  const deepScan = options.deepScan === true;
  const interactionScan = options.interactionScan === true;
  if (!playwrightChromium) {
    return {
      pairs: [],
      mode: "static",
      warning: "Rendered audit engine not installed. Falling back to static style parsing."
    };
  }

  const browser = await playwrightChromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(500);
    if (deepScan) {
      await page.evaluate(async () => {
        const maxScrollSteps = 18;
        for (let step = 0; step < maxScrollSteps; step += 1) {
          window.scrollBy(0, Math.max(window.innerHeight * 0.8, 500));
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        window.scrollTo(0, 0);
      });
    }

    const renderedPairs = await page.evaluate((input) => {
      const maxNodes = input?.deepScan ? 9000 : 5000;
      const toHex = (value) => {
        if (!value || typeof value !== "string") return null;

        const hexMatch = value.trim().match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
        if (hexMatch) {
          const raw = hexMatch[1];
          const full = raw.length === 3
            ? raw.split("").map((char) => char + char).join("")
            : raw;
          return `#${full.toUpperCase()}`;
        }

        const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
        if (!rgbMatch) return null;
        const channels = rgbMatch[1].split(",").map((chunk) => chunk.trim());
        if (channels.length < 3) return null;

        const r = Number.parseFloat(channels[0]);
        const g = Number.parseFloat(channels[1]);
        const b = Number.parseFloat(channels[2]);
        if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;

        if (channels.length >= 4) {
          const alpha = Number.parseFloat(channels[3]);
          if (!Number.isNaN(alpha) && alpha === 0) return null;
        }

        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        const component = (v) => clamp(v).toString(16).padStart(2, "0").toUpperCase();
        return `#${component(r)}${component(g)}${component(b)}`;
      };

      const contrastRatio = (hexA, hexB) => {
        const toRgb = (hex) => {
          const value = hex.slice(1);
          const parsed = Number.parseInt(value, 16);
          return {
            r: (parsed >> 16) & 255,
            g: (parsed >> 8) & 255,
            b: parsed & 255
          };
        };

        const luminance = ({ r, g, b }) => {
          const channels = [r, g, b].map((v) => {
            const c = v / 255;
            return c <= 0.03928
              ? c / 12.92
              : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };

        const L1 = luminance(toRgb(hexA));
        const L2 = luminance(toRgb(hexB));
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      };

      const isTransparent = (value) => {
        if (!value) return true;
        const raw = value.toLowerCase().trim();
        if (raw === "transparent") return true;
        const rgbaMatch = raw.match(/rgba\(([^)]+)\)/i);
        if (!rgbaMatch) return false;
        const channels = rgbaMatch[1].split(",").map((chunk) => chunk.trim());
        if (channels.length < 4) return false;
        const alpha = Number.parseFloat(channels[3]);
        return !Number.isNaN(alpha) && alpha === 0;
      };

      const bodyBackground = getComputedStyle(document.body).backgroundColor || "rgb(255, 255, 255)";

      const resolveBackground = (element) => {
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const bg = getComputedStyle(current).backgroundColor;
          if (!isTransparent(bg)) return bg;
          current = current.parentElement;
        }
        return bodyBackground;
      };

      const elementSelector = (element) => {
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : "";
        const classes = (element.className || "")
          .toString()
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((name) => `.${name}`)
          .join("");
        return `${tag}${id}${classes}`;
      };
      const pairMap = new Map();

      const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let scannedTextNodes = 0;
      while (scannedTextNodes < maxNodes) {
        const textNode = textWalker.nextNode();
        if (!textNode) break;
        scannedTextNodes += 1;

        const textValue = (textNode.textContent || "").trim().replace(/\s+/g, " ");
        if (textValue.length < 2) continue;

        const element = textNode.parentElement;
        if (!element) continue;

        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;

        const fgHex = toHex(style.color);
        const bgHex = toHex(resolveBackground(element));
        if (!fgHex || !bgHex) continue;

        const key = `${bgHex}|${fgHex}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            source: "computed-style",
            background: bgHex,
            text: fgHex,
            selector: elementSelector(element),
            sampleText: textValue.slice(0, 120),
            occurrences: 0
          });
        }

        pairMap.get(key).occurrences += 1;
      }

      const rootStyle = getComputedStyle(document.documentElement);
      const variableValue = (name) => rootStyle.getPropertyValue(name)?.trim() || "";

      const addVariablePair = (backgroundVar, textVar) => {
        const bgHex = toHex(variableValue(backgroundVar));
        const textHex = toHex(variableValue(textVar));
        if (!bgHex || !textHex) return;

        const key = `${bgHex}|${textHex}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            source: "css-variable",
            background: bgHex,
            text: textHex,
            selector: `:root ${backgroundVar} + ${textVar}`,
            sampleText: "theme variable pair",
            occurrences: 1
          });
        }
      };

      addVariablePair("--wd-main-bgcolor", "--wd-text-color");
      addVariablePair("--wd-main-bgcolor", "--wd-title-color");
      addVariablePair("--wd-main-bgcolor", "--wd-link-color");
      addVariablePair("--btn-accented-bgcolor", "--btn-accented-color");
      addVariablePair("--btn-default-bgcolor", "--btn-default-color");
      addVariablePair("--notices-success-bg", "--notices-success-color");
      addVariablePair("--notices-warning-bg", "--notices-warning-color");

      const pairs = Array.from(pairMap.values());
      pairs.sort((a, b) => {
        const ratioA = contrastRatio(a.background, a.text);
        const ratioB = contrastRatio(b.background, b.text);
        const failA = ratioA < 4.5 ? 1 : 0;
        const failB = ratioB < 4.5 ? 1 : 0;

        if (failA !== failB) return failB - failA;
        if (Math.abs(ratioA - ratioB) > 0.001) return ratioA - ratioB;
        return b.occurrences - a.occurrences;
      });

      return pairs.slice(0, 220);
    }, { deepScan });

    let interactionPairs = [];
    if (interactionScan) {
      const collectElementPair = async (handle, state) => {
        return handle.evaluate((element, stateTag) => {
          if (!element) return null;

          const toHex = (value) => {
            if (!value || typeof value !== "string") return null;
            const hexMatch = value.trim().match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
            if (hexMatch) {
              const raw = hexMatch[1];
              const full = raw.length === 3
                ? raw.split("").map((char) => char + char).join("")
                : raw;
              return `#${full.toUpperCase()}`;
            }

            const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
            if (!rgbMatch) return null;
            const channels = rgbMatch[1].split(",").map((chunk) => chunk.trim());
            if (channels.length < 3) return null;

            const r = Number.parseFloat(channels[0]);
            const g = Number.parseFloat(channels[1]);
            const b = Number.parseFloat(channels[2]);
            if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;

            const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
            const component = (v) => clamp(v).toString(16).padStart(2, "0").toUpperCase();
            return `#${component(r)}${component(g)}${component(b)}`;
          };

          const isTransparent = (value) => {
            if (!value) return true;
            const raw = value.toLowerCase().trim();
            if (raw === "transparent") return true;
            const rgbaMatch = raw.match(/rgba\(([^)]+)\)/i);
            if (!rgbaMatch) return false;
            const channels = rgbaMatch[1].split(",").map((chunk) => chunk.trim());
            if (channels.length < 4) return false;
            const alpha = Number.parseFloat(channels[3]);
            return !Number.isNaN(alpha) && alpha === 0;
          };

          const resolveBackground = (target) => {
            let current = target;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
              const bg = getComputedStyle(current).backgroundColor;
              if (!isTransparent(bg)) return bg;
              current = current.parentElement;
            }
            return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
          };

          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") return null;

          const fg = toHex(style.color);
          const bg = toHex(resolveBackground(element));
          if (!fg || !bg) return null;

          const className = (element.className || "")
            .toString()
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((name) => `.${name}`)
            .join("");
          const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${className}`;

          return {
            source: "computed-style",
            state: stateTag,
            background: bg,
            text: fg,
            selector,
            sampleText: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
            occurrences: 1
          };
        }, state);
      };

      const hoverHandles = await page.locator("a, button, [role='button'], .btn, .button").elementHandles();
      for (const handle of hoverHandles.slice(0, 30)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await handle.hover({ timeout: 1200 });
          // eslint-disable-next-line no-await-in-loop
          const pair = await collectElementPair(handle, "hover");
          if (pair) interactionPairs.push(pair);
        } catch (error) {
          // Ignore individual hover failures.
        }
      }

      const clickHandles = await page.locator("button, [role='button'], summary, [aria-expanded]").elementHandles();
      for (const handle of clickHandles.slice(0, 14)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await handle.click({ timeout: 1200 });
          // eslint-disable-next-line no-await-in-loop
          await page.waitForTimeout(80);
          // eslint-disable-next-line no-await-in-loop
          const pair = await collectElementPair(handle, "click");
          if (pair) interactionPairs.push(pair);
        } catch (error) {
          // Ignore non-clickable controls.
        }
      }
    }

    const mergedPairs = mergeColorPairs(renderedPairs, interactionPairs);

    return {
      pairs: mergedPairs,
      mode: interactionScan ? "rendered+interaction" : "rendered"
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function auditSingleWebsite(url, options = {}) {
  try {
    let colorPairs = [];
    let auditMode = "static";
    let warning = null;

    try {
      const renderedResult = await extractRenderedColorPairs(url, options);
      colorPairs = renderedResult.pairs || [];
      auditMode = renderedResult.mode || "rendered";
      warning = renderedResult.warning || null;
    } catch (renderError) {
      warning = `Rendered audit failed: ${renderError?.message || "unknown error"}. Falling back to static parsing.`;
    }

    const htmlResult = await fetchWebsiteHtml(url);
    if (!htmlResult.ok && !colorPairs.length) {
      return {
        url,
        fetched: false,
        error: `Unable to fetch page (HTTP ${htmlResult.status || "request failed"})`,
        overallStatus: "error"
      };
    }

    const stylePairs = htmlResult.ok ? extractStyleColorPairs(htmlResult.html) : [];
    let variablePairs = htmlResult.ok ? extractThemeVariablePairsFromHtml(htmlResult.html) : [];

    if (htmlResult.ok) {
      const externalCss = await fetchExternalStylesCssText(url, htmlResult.html);
      if (externalCss) {
        variablePairs = mergeColorPairs(variablePairs, extractThemeVariablePairsFromCssText(externalCss));
      }
    }

    colorPairs = mergeColorPairs(colorPairs, [...stylePairs, ...variablePairs]);

    if (!colorPairs.length) {
      auditMode = "static";
    }

    if (!colorPairs.length) {
      return {
        url,
        fetched: true,
        overallStatus: "unknown",
        auditMode,
        pairCount: 0,
        passAA: 0,
        failAA: 0,
        warning,
        feedback: [
          "No detectable text/background color pairs found.",
          "This page may require rendered CSS inspection with readable text nodes."
        ],
        samples: []
      };
    }

    const samples = colorPairs.slice(0, 120).map((pair) => {
      const wcag = getWCAGResult(pair.background, pair.text);
      const states = Array.isArray(pair.states)
        ? pair.states
        : (pair.state ? [pair.state] : []);
      return {
        source: pair.source,
        background: pair.background,
        text: pair.text,
        contrast: wcag.contrast,
        wcagAA: wcag.status === "pass" ? "Pass" : "Fail",
        recommendation: wcag.status === "pass" ? null : getAuditRecommendation(pair.background),
        scope: pair.source === "computed-style" ? "rendered" : "informational",
        states,
        selector: pair.selector || null,
        sampleText: pair.sampleText || null,
        occurrences: pair.occurrences || 1
      };
    });

    const renderedSamples = samples.filter((sample) => sample.scope === "rendered");
    const scoreSamples = renderedSamples.length ? renderedSamples : samples;
    const passAA = scoreSamples.filter((sample) => sample.wcagAA === "Pass").length;
    const failAA = scoreSamples.filter((sample) => sample.wcagAA === "Fail").length;

    const feedback = [];
    if (failAA > 0) {
      feedback.push(`${failAA} of ${samples.length} sampled pairs fail WCAG AA.`);
      feedback.push("Increase contrast to at least 4.5:1 for normal text.");
    } else {
      feedback.push("All sampled pairs pass WCAG AA.");
    }

    if (samples.some((sample) => sample.contrast >= 4.5 && sample.contrast < 7)) {
      feedback.push("Improve AA-passing pairs toward 7:1 where possible to target AAA readability.");
    }

    return {
      url,
      fetched: true,
      auditMode,
      overallStatus: failAA > 0 ? "needs-improvement" : "pass",
      pairCount: colorPairs.length,
      sampledPairCount: samples.length,
      passAA,
      failAA,
      warning,
      feedback,
      samples
    };
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Request timed out while fetching website"
      : (error?.message || "Unexpected error while auditing website");

    return {
      url,
      fetched: false,
      error: message,
      overallStatus: "error"
    };
  }
}

/* =========================
   📈 ANALYSIS
========================= */
function getWCAGResult(bg, text, options = {}) {
  const level = options?.level || "AA";
  const textSize = options?.textSize || "normal";

  if (!bg || !text) return { contrast: null, status: "invalid" };
  try {
    const contrast = getContrast(bg, text);
    const wcag = evaluateWCAGContrast(contrast, level, textSize);

    return {
      contrast,
      status: wcag.pass ? "pass" : "fail",
      threshold: wcag.threshold,
      level: wcag.level,
      textSize: wcag.textSize
    };
  } catch (err) {
    return { contrast: null, status: "invalid" };
  }
}

function normalizePlatform(value) {
  if (!value || typeof value !== "string") return "Unknown";
  return value.trim() || "Unknown";
}

/* =========================
   🌐 WEBSITE WCAG AUDIT
========================= */
app.post(["/audit/url", "/audit/url/"], async (req, res) => {
  const incomingUrls = Array.isArray(req.body?.urls)
    ? req.body.urls
    : req.body?.url
      ? [req.body.url]
      : [];

  const suppliedUrls = incomingUrls
    .filter((value) => typeof value === "string" && value.trim());

  if (suppliedUrls.length !== 1) {
    return res.status(400).json({
      error: "Provide exactly one website URL in body.url"
    });
  }

  const url = normalizeUrlInput(suppliedUrls[0]);

  if (!url) {
    return res.status(400).json({
      error: "Provide one valid website URL in body.url"
    });
  }

  const requestedSampleLimit = parseInt(req.body?.maxSamples, 10);
  const sampleLimit = Number.isFinite(requestedSampleLimit)
    ? Math.max(10, Math.min(120, requestedSampleLimit))
    : 60;
  const deepScan = req.body?.deepScan === true;
  const interactionScan = req.body?.interactionScan === true;
  const results = [];

  const auditResult = await auditSingleWebsite(url, { deepScan, interactionScan });
  if (Array.isArray(auditResult.samples)) {
    auditResult.samples = auditResult.samples.slice(0, sampleLimit);
    auditResult.sampledPairCount = auditResult.samples.length;
    const renderedSamples = auditResult.samples.filter((sample) => sample.scope === "rendered");
    const scoreSamples = renderedSamples.length ? renderedSamples : auditResult.samples;
    auditResult.passAA = scoreSamples.filter((sample) => sample.wcagAA === "Pass").length;
    auditResult.failAA = scoreSamples.filter((sample) => sample.wcagAA === "Fail").length;
    if (auditResult.overallStatus !== "error" && auditResult.overallStatus !== "unknown") {
      auditResult.overallStatus = auditResult.failAA > 0 ? "needs-improvement" : "pass";
    }
  }
  results.push(auditResult);

  const summary = {
    total: results.length,
    pass: results.filter((item) => item.overallStatus === "pass").length,
    needsImprovement: results.filter((item) => item.overallStatus === "needs-improvement").length,
    unknown: results.filter((item) => item.overallStatus === "unknown").length,
    errors: results.filter((item) => item.overallStatus === "error").length
  };

  return res.json({
    message: "Website audit completed",
    summary,
    results
  });
});

app.get("/analysis", async (req, res) => {
  const wcagOptions = {
    level: normalizeWCAGLevel(req.query?.level),
    textSize: normalizeTextSize(req.query?.textSize)
  };

  try {
    const { data, error } = await supabase.from("colors").select("*");

    if (error) throw error;

    const sourceData = data && data.length ? data : (readLocalDataset() || fallbackData);
    const frequency = {};
    const yearWise = {};
    const accessibility = { total: 0, passAA: 0, failAA: 0, invalid: 0 };
    const accessibilityByYear = {};
    const platformAnalysis = {};

    sourceData.forEach(d => {
      const rawColor = getField(d, [
        "primary",
        "Primary",
        "primary_color",
        "Primary Color",
        "Primary Color (HEX)",
        "color",
        "primaryColor"
      ]);
      const color = normalizeHex(rawColor);
      const year = getField(d, ["Year", "year", "year_published", "release_year"]) || "Unknown";
      const platform = normalizePlatform(getField(d, ["Platform", "platform", "platform_name", "Platform Name"]));
      const background = normalizeHex(getField(d, ["background", "Background", "bg", "background_color", "Background Color"]));
      const text = normalizeHex(getField(d, ["text_color", "Text Color", "text", "textColor"]));

      if (color) {
        frequency[color] = (frequency[color] || 0) + 1;
        if (!yearWise[year]) yearWise[year] = {};
        yearWise[year][color] = (yearWise[year][color] || 0) + 1;
      }

      if (!platformAnalysis[platform]) {
        platformAnalysis[platform] = {
          total: 0,
          passAA: 0,
          failAA: 0,
          invalid: 0,
          colors: {}
        };
      }

      platformAnalysis[platform].total += 1;
      if (color) {
        platformAnalysis[platform].colors[color] = (platformAnalysis[platform].colors[color] || 0) + 1;
      }

      const result = getWCAGResult(background, text, wcagOptions);
      if (result.status === "pass") {
        accessibility.passAA += 1;
        platformAnalysis[platform].passAA += 1;
      } else if (result.status === "fail") {
        accessibility.failAA += 1;
        platformAnalysis[platform].failAA += 1;
      } else {
        accessibility.invalid += 1;
        platformAnalysis[platform].invalid += 1;
      }

      accessibility.total += 1;

      if (!accessibilityByYear[year]) {
        accessibilityByYear[year] = { total: 0, passAA: 0, failAA: 0, invalid: 0 };
      }
      accessibilityByYear[year].total += 1;
      if (result.status === "pass") {
        accessibilityByYear[year].passAA += 1;
      } else if (result.status === "fail") {
        accessibilityByYear[year].failAA += 1;
      } else {
        accessibilityByYear[year].invalid += 1;
      }
    });

    res.json({
      frequency,
      yearWise,
      accessibility,
      accessibilityByYear,
      platformAnalysis,
      wcagCriteria: {
        level: wcagOptions.level,
        textSize: wcagOptions.textSize,
        threshold: getWCAGThreshold(wcagOptions.level, wcagOptions.textSize)
      }
    });
  } catch (error) {
    const sourceData = readLocalDataset() || fallbackData;
    const frequency = {};
    const yearWise = {};
    const accessibility = { total: 0, passAA: 0, failAA: 0, invalid: 0 };
    const accessibilityByYear = {};
    const platformAnalysis = {};

    sourceData.forEach(d => {
      const rawColor = getField(d, [
        "primary",
        "Primary",
        "primary_color",
        "Primary Color",
        "Primary Color (HEX)",
        "color",
        "primaryColor"
      ]);
      const color = normalizeHex(rawColor);
      const year = getField(d, ["Year", "year", "year_published", "release_year"]) || "Unknown";
      const platform = normalizePlatform(getField(d, ["Platform", "platform", "platform_name", "Platform Name"]));
      const background = normalizeHex(getField(d, ["background", "Background", "bg", "background_color", "Background Color"]));
      const text = normalizeHex(getField(d, ["text_color", "Text Color", "text", "textColor"]));

      if (color) {
        frequency[color] = (frequency[color] || 0) + 1;
        if (!yearWise[year]) yearWise[year] = {};
        yearWise[year][color] = (yearWise[year][color] || 0) + 1;
      }

      if (!platformAnalysis[platform]) {
        platformAnalysis[platform] = {
          total: 0,
          passAA: 0,
          failAA: 0,
          invalid: 0,
          colors: {}
        };
      }

      platformAnalysis[platform].total += 1;
      if (color) {
        platformAnalysis[platform].colors[color] = (platformAnalysis[platform].colors[color] || 0) + 1;
      }

      const result = getWCAGResult(background, text, wcagOptions);
      if (result.status === "pass") {
        accessibility.passAA += 1;
        platformAnalysis[platform].passAA += 1;
      } else if (result.status === "fail") {
        accessibility.failAA += 1;
        platformAnalysis[platform].failAA += 1;
      } else {
        accessibility.invalid += 1;
        platformAnalysis[platform].invalid += 1;
      }

      accessibility.total += 1;

      if (!accessibilityByYear[year]) {
        accessibilityByYear[year] = { total: 0, passAA: 0, failAA: 0, invalid: 0 };
      }
      accessibilityByYear[year].total += 1;
      if (result.status === "pass") {
        accessibilityByYear[year].passAA += 1;
      } else if (result.status === "fail") {
        accessibilityByYear[year].failAA += 1;
      } else {
        accessibilityByYear[year].invalid += 1;
      }
    });

    res.json({
      frequency,
      yearWise,
      accessibility,
      accessibilityByYear,
      platformAnalysis,
      wcagCriteria: {
        level: wcagOptions.level,
        textSize: wcagOptions.textSize,
        threshold: getWCAGThreshold(wcagOptions.level, wcagOptions.textSize)
      }
    });
  }
});

/* =========================
   🧠 K-MEANS CLUSTERING
========================= */
app.get(["/kmeans", "/clusters"], async (req, res) => {
  try {
    const { data, error } = await supabase.from("colors").select("*");

    if (error) throw error;

    const sourceData = data && data.length ? data : (readLocalDataset() || fallbackData);
    const requestedK = parseInt(req.query.k || req.query.clusters || "3", 10);
    const result = kMeansCluster(extractClusterableColors(sourceData), requestedK);

    res.json({
      ...result,
      sourceCount: sourceData.length,
      requestedK
    });
  } catch (error) {
    const sourceData = readLocalDataset() || fallbackData;
    const requestedK = parseInt(req.query.k || req.query.clusters || "3", 10);
    const result = kMeansCluster(extractClusterableColors(sourceData), requestedK);

    res.json({
      ...result,
      sourceCount: sourceData.length,
      requestedK
    });
  }
});

/* =========================
   🎯 RECOMMENDATION (HEX FIX)
========================= */
app.get("/recommend/:color", (req, res) => {
  const requested = decodeURIComponent(req.params.color);
  const bg = normalizeHex(requested);
  const level = normalizeWCAGLevel(req.query?.level);
  const textSize = normalizeTextSize(req.query?.textSize);

  if (!bg) {
    return res.status(400).json({ error: "Invalid HEX format. Use #RRGGBB or RRGGBB" });
  }

  const whiteContrast = getContrast(bg, "#FFFFFF");
  const blackContrast = getContrast(bg, "#000000");

  const suggestedText = whiteContrast > blackContrast ? "#FFFFFF" : "#000000";
  const contrast = Math.max(whiteContrast, blackContrast);
  const wcag = evaluateWCAGContrast(contrast, level, textSize);

  res.json({
    input: bg,
    suggestedText,
    contrast: contrast.toFixed(2) + ":1",
    status: wcag.pass ? `Pass (WCAG ${wcag.level})` : "Fail",
    level: wcag.level,
    textSize: wcag.textSize,
    threshold: wcag.threshold
  });
});



/* =========================
   🚀 START SERVER
========================= */
if (require.main === module) {
  app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
  });
}

module.exports = {
  app,
  kMeansCluster
};
