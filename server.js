const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// NVIDIA API config (OpenAI-compatible endpoint)
const nvidiaApiKey =
  process.env.NVIDIA_API_KEY ||
  process.env.NVAPI_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.OPENAI_API_KEY;

const nvidiaModel =
  process.env.NVIDIA_MODEL ||
  process.env.NVIDIA_CHAT_MODEL ||
  process.env.GEMINI_MODEL ||
  "meta/llama3-8b-instruct";

const nvidiaBaseUrl =
  process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

const nvidiaClient = nvidiaApiKey
  ? new OpenAI({
      apiKey: nvidiaApiKey,
      baseURL: nvidiaBaseUrl,
    })
  : null;

if (!nvidiaApiKey) {
  console.warn(
    "Warning: NVIDIA_API_KEY is not set. The /api/generate-roadmap endpoint will not work until you set it in a .env file."
  );
}

app.post("/api/generate-roadmap", async (req, res) => {
  try {
    if (!nvidiaClient) {
      return res.status(500).json({
        error:
          "NVIDIA_API_KEY is not configured on the server. Please set it in the .env file.",
      });
    }

    const {
      goal,
      experienceLevel,
      timeframe,
      hoursPerWeek,
      learningStyle,
      focusAreas,
    } = req.body || {};

    if (!goal || !timeframe) {
      return res
        .status(400)
        .json({ error: "Please provide at least a goal and timeframe." });
    }

    const prompt = `
You are an expert AI mentor and curriculum designer.
Create a highly structured, practical learning roadmap for this user.

User profile:
- Main goal: ${goal}
- Current experience level: ${experienceLevel || "not specified"}
- Time available: ${timeframe}
- Hours per week: ${hoursPerWeek || "not specified"}
- Preferred learning style: ${learningStyle || "not specified"}
- Focus areas / technologies: ${
      Array.isArray(focusAreas) ? focusAreas.join(", ") : focusAreas || "none"
    }

VERY IMPORTANT — FORMATTING RULES (follow exactly):

1. Start with a single top-level heading:
# Your Custom Learning Roadmap

2. Each phase MUST be a level-2 heading that starts with "Phase" and a number, followed by a colon and the phase name. Example:
## Phase 1: Foundation & Setup
## Phase 2: Core Skills
## Phase 3: Building Projects
## Phase 4: Advanced Topics

3. Immediately below each phase heading, include a duration line wrapped in single asterisks:
*Duration: 4 weeks*

4. Optionally include a one-line objective in bold:
**Primary Objective:** Learn the fundamentals.

5. Inside each phase, use level-3 headings (###) for sub-sections:
### Core Concepts to Master
### Practical Tasks & Projects
### Recommended Resources

6. Use bullet points (- ) for list items inside each sub-section.

7. At the end, include one final section:
## Final Assessment & Next Steps
- How to measure success
- Recommended next topics

Generate 3-5 phases depending on the timeframe. Be specific, practical, and detailed. Use Markdown formatting exactly as described above.
`;

    const completion = await nvidiaClient.chat.completions.create({
      model: nvidiaModel,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an expert AI mentor who creates clear, structured, highly practical learning roadmaps.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content;
    const roadmap =
      typeof content === "string" && content.trim()
        ? content.trim()
        : "Sorry, I couldn't generate a roadmap. Please try again.";

    res.json({ roadmap });
  } catch (error) {
    console.error("Error generating roadmap:", error);

    const statusCode = Number(error?.status) || 500;
    const errorMessage =
      error?.error?.message ||
      error?.message ||
      "Failed to generate roadmap via NVIDIA API.";

    res.status(statusCode).json({
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? String(errorMessage)
          : undefined,
    });
  }
});

// Fallback to index.html for SPA routing (if needed)
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`AI Roadmap Generator running on http://localhost:${PORT}`);
  console.log(`Using NVIDIA model: ${nvidiaModel}`);
});
