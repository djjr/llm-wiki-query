require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;
const WIKI_ORIGIN = process.env.WIKI_ORIGIN;

app.use(cors({
  origin: [WIKI_ORIGIN, "http://localhost:8000", "http://127.0.0.1:8000"],
  methods: ["POST"],
  allowedHeaders: ["Content-Type", "X-Wiki-Key"]
}));

app.use(express.json());

app.post("/query", (req, res) => {
  const key = req.headers["x-wiki-key"];
  if (!key || key !== WIKI_PASSWORD) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { query = "", context = "" } = req.body;

  if (query === "ping") {
    return res.json({ answer: "ok" });
  }

  // Phase 2a: echo — replace with Anthropic call in Phase 2b
  const preview = context ? context.slice(0, 120).trim() + "…" : "(no context)";
  res.json({
    answer: `**[railway echo]** You asked:\n\n> ${query}\n\nContext received (first 120 chars):\n\`\`\`\n${preview}\n\`\`\`\n\nAnthropic call coming in Phase 2b.`
  });
});

app.listen(PORT, () => {
  console.log(`llm-wiki-query running on port ${PORT}`);
});
