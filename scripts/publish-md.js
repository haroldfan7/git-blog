const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`
Usage:
  node scripts/publish-md.js          Import Markdown drafts
  node scripts/publish-md.js --push   Import, commit, and push

Markdown frontmatter:
  ---
  title: My article
  date: 2026-06-13
  section: writing
  slug: my-article
  tags: [AI, 法律]
  summary: One sentence summary.
  ---
`);
  process.exit(0);
}

const config = loadConfig();
const dryRun = args.has("--dry-run");
const shouldPush = args.has("--push");

main();

function main() {
  const draftsDir = resolveMaybeAbsolute(config.draftsDir);
  if (!fs.existsSync(draftsDir)) {
    console.log(`Draft folder does not exist: ${draftsDir}`);
    console.log("Create it, put .md files inside, then run npm run publish.");
    return;
  }

  const markdownFiles = fs
    .readdirSync(draftsDir)
    .filter((file) => file.toLowerCase().endsWith(".md"))
    .map((file) => path.join(draftsDir, file));

  if (markdownFiles.length === 0) {
    console.log(`No .md files found in: ${draftsDir}`);
    return;
  }

  const siteContentPath = path.join(root, config.siteContentPath || "data/site-content.js");
  const siteContent = readSiteContent(siteContentPath);
  const results = markdownFiles.map((filePath) => importMarkdown(filePath, siteContent));

  if (!dryRun) {
    fs.writeFileSync(siteContentPath, serializeSiteContent(siteContent), "utf8");
  }

  for (const result of results) {
    console.log(`${dryRun ? "Would publish" : "Published"}: ${result.title} -> ${result.section}`);
  }

  if (!dryRun && shouldPush) {
    commitAndPush(results);
  }
}

function loadConfig() {
  const explicit = getArgValue("--config");
  const localConfig = explicit
    ? path.resolve(root, explicit)
    : path.join(root, "publish.config.json");
  const exampleConfig = path.join(root, "publish.config.example.json");
  const configPath = fs.existsSync(localConfig) ? localConfig : exampleConfig;
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function getArgValue(name) {
  const allArgs = process.argv.slice(2);
  const index = allArgs.indexOf(name);
  return index >= 0 ? allArgs[index + 1] : null;
}

function resolveMaybeAbsolute(value) {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function readSiteContent(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: filePath });
  return sandbox.window.siteContent || {};
}

function importMarkdown(filePath, siteContent) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(raw);
  const fileBaseName = path.basename(filePath, ".md");
  const date = parsed.meta.date || today();
  const title = parsed.meta.title || extractTitle(parsed.body) || fileBaseName;
  const slug = parsed.meta.slug || slugify(title) || `post-${date}-${shortHash(title)}`;
  const section = normalizeSection(parsed.meta.section || config.defaultSection || "writing");
  const tags = normalizeTags(parsed.meta.tags);
  const summary = parsed.meta.summary || summarize(parsed.body);
  const readingTime = parsed.meta.readingTime || estimateReadingTime(parsed.body);
  const category = parsed.meta.category || categoryForSection(section);
  const assetDir = path.join(root, config.assetOutputDir || "assets/articles", slug);
  const html = markdownToHtml(parsed.body, {
    sourceFile: filePath,
    slug,
    assetDir,
  });

  const article = {
    slug,
    date,
    category,
    title,
    summary,
    readingTime,
    featured: parseBoolean(parsed.meta.featured, false),
    tags,
    content: html,
  };

  upsertBySlug(siteContent.articles, article);

  if (section === "share") {
    siteContent.share = siteContent.share || [];
    upsertBySlug(siteContent.share, {
      date,
      kind: parsed.meta.kind || "Share",
      title,
      summary,
      slug,
    });
  }

  if (section === "legal-ai") {
    siteContent.legalAi = siteContent.legalAi || [];
    upsertByTitle(siteContent.legalAi, {
      type: parsed.meta.type || "Tool",
      status: parsed.meta.status || "Draft",
      title,
      summary,
      slug,
      tags,
    });
  }

  return { title, slug, section };
}

function parseFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return { meta: {}, body: text };

  const end = text.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: text };

  const frontmatter = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  return { meta: parseMeta(frontmatter), body };
}

function parseMeta(frontmatter) {
  const meta = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    value = value.replace(/^["']|["']$/g, "");
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    meta[key] = value;
  }
  return meta;
}

function markdownToHtml(markdown, context) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let blockquote = [];
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  const flushBlockquote = () => {
    if (blockquote.length === 0) return;
    blocks.push(`<blockquote><p>${inline(blockquote.join(" "))}</p></blockquote>`);
    blockquote = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        flushAll();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    const imageOnly = line.trim().match(/^!\[\[([^\]]+)\]\]$/);
    const markdownImageOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageOnly || markdownImageOnly) {
      flushAll();
      blocks.push(renderImage(imageOnly, markdownImageOnly, context));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = Math.min(Math.max(heading[1].length + 1, 2), 4);
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      flushBlockquote();
      const type = unordered ? "ul" : "ol";
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push(unordered ? unordered[1] : ordered[1]);
      continue;
    }

    paragraph.push(line);
  }

  if (inCode) {
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushAll();

  return `\n${blocks.map((block) => `        ${block}`).join("\n")}\n      `;
}

function renderImage(obsidianMatch, markdownImageMatch, context) {
  const imageRef = obsidianMatch ? obsidianMatch[1] : markdownImageMatch[2];
  const [rawName, rawCaption] = imageRef.split("|").map((part) => part.trim());
  const alt = markdownImageMatch ? markdownImageMatch[1] : rawCaption || rawName;
  const source = findAttachment(rawName, context.sourceFile);

  if (!source) {
    return `<p>${escapeHtml(`Missing image: ${rawName}`)}</p>`;
  }

  const outputDir = context.assetDir;
  fs.mkdirSync(outputDir, { recursive: true });
  const safeName = safeAssetName(path.basename(rawName));
  const outputPath = path.join(outputDir, safeName);
  if (!dryRun) fs.copyFileSync(source, outputPath);

  const relative = toPosix(path.relative(root, outputPath));
  const caption = rawCaption ? `<figcaption>${escapeHtml(rawCaption)}</figcaption>` : "";
  return `<figure><img src="${escapeHtml(relative)}" alt="${escapeHtml(alt)}" loading="lazy" />${caption}</figure>`;
}

function findAttachment(fileName, sourceFile) {
  const candidates = [
    path.resolve(path.dirname(sourceFile), fileName),
    ...attachmentDirs().map((dir) => path.resolve(dir, fileName)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function attachmentDirs() {
  return (config.attachmentDirs || []).map(resolveMaybeAbsolute);
}

function inline(value) {
  const code = [];
  let text = value
    .replace(/`([^`]+)`/g, (_, inner) => {
      code.push(`<code>${escapeHtml(inner)}</code>`);
      return `\u0000CODE${code.length - 1}\u0000`;
    })
    .replace(/!\[\[([^\]]+)\]\]/g, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1");

  text = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return text.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)]);
}

function upsertBySlug(items = [], item) {
  const index = items.findIndex((existing) => existing.slug === item.slug);
  if (index >= 0) {
    items[index] = { ...items[index], ...item };
  } else {
    items.unshift(item);
  }
}

function upsertByTitle(items = [], item) {
  const index = items.findIndex((existing) => existing.title === item.title || existing.name === item.title);
  if (index >= 0) {
    items[index] = { ...items[index], ...item };
  } else {
    items.unshift(item);
  }
}

function normalizeSection(value) {
  const section = String(value || "").toLowerCase().trim();
  if (["share", "life"].includes(section)) return "share";
  if (["legal-ai", "legal ai", "tool", "tools", "script", "scripts"].includes(section)) return "legal-ai";
  return "writing";
}

function categoryForSection(section) {
  if (section === "share") return "Share";
  if (section === "legal-ai") return "Legal AI";
  return "Writing & Law";
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["true", "yes", "1"].includes(String(value).toLowerCase());
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function summarize(markdown) {
  const text = markdown
    .replace(/---[\s\S]*?---/, "")
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[#>*_`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 90) || "新发布的文章。";
}

function estimateReadingTime(markdown) {
  const words = markdown.replace(/<[^>]*>/g, "").replace(/\s+/g, "").length;
  const minutes = Math.max(1, Math.ceil(words / 500));
  return `约 ${minutes} 分钟`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function shortHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function safeAssetName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  return `${slugify(base) || shortHash(fileName)}${ext || ".jpg"}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function serializeSiteContent(value) {
  return `window.siteContent = ${serialize(value, 0)};\n`;
}

function serialize(value, depth) {
  const indent = "  ".repeat(depth);
  const next = "  ".repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((item) => typeof item === "string")) {
      return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    }
    return `[\n${value.map((item) => `${next}${serialize(item, depth + 1)}`).join(",\n")}\n${indent}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return `{\n${entries
      .map(([key, item]) => `${next}${key}: ${serialize(item, depth + 1)}`)
      .join(",\n")}\n${indent}}`;
  }

  if (typeof value === "string") {
    if (value.includes("\n")) {
      return `\`${value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
    }
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function commitAndPush(results) {
  const titles = results.map((result) => result.title).join(", ");
  const message = `Publish ${titles.slice(0, 60)}`;
  execFileSync("git", ["add", config.siteContentPath || "data/site-content.js", config.assetOutputDir || "assets/articles"], {
    cwd: root,
    stdio: "inherit",
  });

  const status = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
  if (!status) {
    console.log("No changes to commit.");
    return;
  }

  execFileSync("git", ["commit", "-m", message], { cwd: root, stdio: "inherit" });
  execFileSync("git", ["push"], { cwd: root, stdio: "inherit" });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
