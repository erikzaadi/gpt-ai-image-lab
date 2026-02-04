import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

function basicGuardrails(prompt) {
  const p = (prompt || "").toLowerCase();
  const banned = [
    "blood", "gore", "knife", "gun", "shoot", "suicide", "self harm",
    "nude", "sex", "porn",
    "hitler", "nazi",
    "make it look like", "photo of my teacher", "real person"
  ];
  if (!prompt || prompt.trim().length < 5) {
    return "Prompt is too short.";
  }
  if (prompt.length > 400) {
    return "Prompt is too long (max 400 chars).";
  }
  for (const w of banned) {
    if (p.includes(w)) {
      return `Please avoid: "${w}" (classroom safety rule).`;
    }
  }
  return null;
}

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", model = "gpt-image-1-mini" } = req.body;
    const guardrailError = basicGuardrails(prompt);
    if (guardrailError) {
      return res.status(400).json({ error: guardrailError });
    }

    const result = await client.images.generate({ model, prompt, size });
    const img = result.data?.[0];
    if (!img) {
      return res.status(500).json({ error: "No image returned." });
    }

    if (img.b64_json) {
      return res.json({ b64: img.b64_json });
    }
    if (img.url) {
      return res.json({ url: img.url });
    }

    return res.status(500).json({ error: "Unsupported image response format." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error generating image." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AI Image Lab running on http://localhost:${port}`);
});
