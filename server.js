import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const MODERATION_RULES = `
You are a content moderator for an AI image generation tool used in classrooms.
Evaluate if the user's prompt is appropriate for 12 year old children.

REJECT prompts that:
- Are inappropriate for 12 year old children
- Reference real people (celebrities, teachers, classmates, etc.)
- Attempt to generate fake photos or deepfakes
- Are too vague or too short to generate meaningful art

ALLOW prompts that:
- Request creative, artistic, educational, or fun imagery
- Describe fictional characters, landscapes, animals, objects

Respond with ONLY valid JSON in this exact format:
{"allowed": true} or {"allowed": false, "reason": "brief explanation"}
`.trim();

const CONTEXT_PROMPT = `
You help create image generation prompts. The user has been having a conversation about images they want to create.

Given the conversation history and the user's new request, create a single, detailed prompt for image generation that incorporates relevant context from previous requests.

If the new request is completely unrelated to the history, just return the new request as-is.
If the new request references something from before (like "make it blue" or "add a hat"), combine it with the relevant context.

Return ONLY the enhanced prompt text, nothing else.
`.trim();

async function enhancePromptWithContext(prompt, history) {
  if (!history || history.length === 0) {
    return prompt;
  }

  console.log("[context] Enhancing prompt with conversation history...");

  try {
    const start = Date.now();
    const historyText = history.map((h, i) => `${i + 1}. ${h}`).join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CONTEXT_PROMPT },
        { role: "user", content: `Previous prompts:\n${historyText}\n\nNew request: ${prompt}` }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const enhanced = response.choices[0]?.message?.content?.trim() || prompt;
    console.log(`[context] Enhanced prompt: "${enhanced}" (${Date.now() - start}ms)`);
    return enhanced;
  } catch (err) {
    console.error("[context] Enhancement failed:", err.message);
    return prompt;
  }
}

async function validatePrompt(prompt) {
  console.log("[moderation] Validating prompt...");

  if (!prompt || prompt.trim().length < 5) {
    console.log("[moderation] Rejected: prompt too short");
    return { allowed: false, reason: "Prompt is too short." };
  }
  if (prompt.length > 400) {
    console.log("[moderation] Rejected: prompt too long");
    return { allowed: false, reason: "Prompt is too long (max 400 chars)." };
  }

  try {
    const start = Date.now();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MODERATION_RULES },
        { role: "user", content: prompt }
      ],
      max_tokens: 100,
      temperature: 0
    });

    const content = response.choices[0]?.message?.content || "";
    const result = JSON.parse(content);
    console.log(`[moderation] Result: ${result.allowed ? "allowed" : "rejected"} (${Date.now() - start}ms)`);
    if (!result.allowed) {
      console.log(`[moderation] Reason: ${result.reason}`);
    }
    return result;
  } catch (err) {
    console.error("[moderation] Check failed:", err.message);
    return { allowed: true };
  }
}

app.post("/api/generate", async (req, res) => {
  const requestStart = Date.now();
  const { prompt, history = [], size = "1024x1024", model = "gpt-image-1-mini" } = req.body;

  console.log("\n[generate] === New request ===");
  console.log(`[generate] Prompt: "${prompt}"`);
  console.log(`[generate] History: ${history.length} previous prompts`);
  console.log(`[generate] Model: ${model}, Size: ${size}`);

  try {
    const enhancedPrompt = await enhancePromptWithContext(prompt, history);

    const validation = await validatePrompt(enhancedPrompt);
    if (!validation.allowed) {
      console.log(`[generate] Request rejected by moderation`);
      return res.status(400).json({ error: validation.reason });
    }

    console.log("[generate] Starting image generation...");
    const genStart = Date.now();
    const result = await client.images.generate({ model, prompt: enhancedPrompt, size });
    console.log(`[generate] Image generated (${Date.now() - genStart}ms)`);

    const img = result.data?.[0];
    if (!img) {
      console.log("[generate] Error: No image in response");
      return res.status(500).json({ error: "No image returned." });
    }

    if (img.b64_json) {
      console.log(`[generate] Success: returning base64 image (total: ${Date.now() - requestStart}ms)`);
      return res.json({ b64: img.b64_json });
    }
    if (img.url) {
      console.log(`[generate] Success: returning image URL (total: ${Date.now() - requestStart}ms)`);
      return res.json({ url: img.url });
    }

    console.log("[generate] Error: Unsupported response format");
    return res.status(500).json({ error: "Unsupported image response format." });
  } catch (err) {
    console.error(`[generate] Error: ${err.message}`);
    res.status(500).json({ error: "Server error generating image." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AI Image Lab running on http://localhost:${port}`);
});
