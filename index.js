require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD?.trim();
const WIKI_ORIGIN = process.env.WIKI_ORIGIN?.trim();
const WIKI_EXPORT_URL = (process.env.WIKI_EXPORT_URL || "https://raw.githubusercontent.com/djjr/AIgovWiki/main/wiki/wiki-export.md").trim();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors({
  origin: [WIKI_ORIGIN, "http://localhost:8000", "http://localhost:8007", "http://127.0.0.1:8000", "http://127.0.0.1:8007"],
  methods: ["POST"],
  allowedHeaders: ["Content-Type", "X-Wiki-Key"]
}));

app.use(express.json());

// ── Wiki export cache ──────────────────────────────────────────────────────
// Fetched from GitHub on startup and refreshed every 30 minutes.
// The export contains all definitions, findings, and queries — no sources.
// Sent as a cached system prompt block so repeated queries pay ~10% token cost.
let wikiExport = "";

async function refreshWikiExport() {
  try {
    const res = await fetch(WIKI_EXPORT_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    wikiExport = await res.text();
    console.log(`Wiki export refreshed: ${Math.round(wikiExport.length / 1024)}KB`);
  } catch (err) {
    console.error("Failed to refresh wiki export:", err.message);
  }
}

refreshWikiExport();
setInterval(refreshWikiExport, 30 * 60 * 1000);

// ── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_BASE = `You are a query assistant for the AI Governance Wiki — a comprehensive resource for academic programs in AI safety, regulation, and governance.

The wiki content below contains all definitions, findings, and saved queries from the wiki. Use it as your primary source. When the wiki covers a question, prioritize its content and cite specific page titles. When it doesn't fully cover something, say so and supplement from general knowledge — but distinguish clearly between the two.

Audience: professors from varied disciplines (philosophy, law, economics, social science) engaged with AI governance but not necessarily trained in computer science. Be precise and dense. Do not over-explain or hedge. Precision and density are virtues. Assume growing familiarity with AI and ML; make connections to other fields where germane.

Keep answers to 2–4 paragraphs unless the question warrants more. Cite wiki page titles when drawing on specific pages.`;

// ── Routes ─────────────────────────────────────────────────────────────────
app.post("/query", async (req, res) => {
  const key = req.headers["x-wiki-key"];
  if (!key || key !== WIKI_PASSWORD) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { query = "", context = "" } = req.body;

  if (query === "ping") {
    return res.json({ answer: "ok" });
  }

  try {
    const systemText = wikiExport
      ? `${SYSTEM_BASE}\n\n## Wiki Content\n\n${wikiExport}`
      : SYSTEM_BASE;

    const userMessage = context
      ? `Current page context:\n${context}\n\nQuestion: ${query}`
      : `Question: ${query}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }]
    });

    res.json({ answer: response.content[0].text });
  } catch (err) {
    console.error("Anthropic error:", err.message);
    res.status(500).json({ error: "query failed" });
  }
});

app.listen(PORT, () => {
  console.log(`llm-wiki-query running on port ${PORT}`);
});
