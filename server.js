const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

async function generateYTTutorialsFallback({
  goal,
  experienceLevel,
  timeframe,
  hoursPerWeek,
  learningStyle,
  focusAreas,
}) {
  if (!nvidiaClient) return "";

  const focusAreasText = Array.isArray(focusAreas)
    ? focusAreas.join(", ")
    : focusAreas || "none";

  const fallbackPrompt = `
Generate only one markdown section with this exact heading:
## YT Tutorials

User profile:
- Goal: ${goal}
- Experience: ${experienceLevel || "not specified"}
- Timeframe: ${timeframe}
- Hours per week: ${hoursPerWeek || "not specified"}
- Learning style: ${learningStyle || "not specified"}
- Focus areas: ${focusAreasText}

Requirements:
- Suggest 5-8 YouTube tutorials relevant to this user.
- Prefer recent content (2024-2026) when possible.
- For each item include:
  - Video title
  - Channel name
  - Year (or Unknown)
  - One-line reason this helps now
- Output only markdown for this section. No extra intro or outro.
`;

  try {
    const completion = await nvidiaClient.chat.completions.create({
      model: nvidiaModel,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You create concise, practical tutorial recommendations in clean markdown.",
        },
        {
          role: "user",
          content: fallbackPrompt,
        },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
  } catch (err) {
    console.error("Fallback YT tutorial section generation failed:", err);
    return "";
  }
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
Create a detailed, practical learning roadmap for this user.

User profile:
- Main goal: ${goal}
- Current experience level: ${experienceLevel || "not specified"}
- Time available: ${timeframe}
- Hours per week: ${hoursPerWeek || "not specified"}
- Preferred learning style: ${learningStyle || "not specified"}
- Focus areas / technologies: ${
      Array.isArray(focusAreas) ? focusAreas.join(", ") : focusAreas || "none"
    }

Requirements for the roadmap:
- Break the roadmap into clear phases (for example: Foundation, Core Skills, Projects, Advanced/Specialization).
- Use explicit phase headings in numeric order, like: "## Phase 1: ...", "## Phase 2: ...", etc.
- Keep all numbered phases together in ascending order and do not place any numbered phase after YT Tutorials.
- For each phase, use this exact order and keep it consistent:
  1) Duration (in weeks)
  2) Objectives
  3) Concrete tasks/activities
  4) Suggested project ideas
  5) Recommended resources (courses, docs, books, tools)
- Important: Keep all links/resource suggestions only inside "Recommended resources", and place this subsection at the end of each phase.
- In each "Recommended resources" subsection, include 4-8 relevant links tied directly to topics covered in that phase's objectives/tasks.
- Prefer high-quality primary sources (official docs, well-known courses, reputable books/tools pages) and include markdown links.
- Strict rule: Do not include any URL/link in Objectives, Concrete tasks/activities, Suggested project ideas, tips, progress, or next-step sections.
- Adapt intensity and depth based on hours per week and experience level.
- Add one extra final phase titled exactly: YT Tutorials.
- In the YT Tutorials phase, suggest 5-8 recent YouTube tutorials relevant to the user's goal and focus areas.
- Prefer tutorials from 2024-2026 when possible. For each tutorial, include:
  - Video title
  - Channel name
  - Year (or "Unknown" if not sure)
  - Why it is useful in this roadmap
- At the end, add a short section with:
  - Tips for staying consistent
  - How to measure progress
  - A recommended next step once this roadmap is completed.

Format the response in clean Markdown with headings, bullet points, and numbered steps where helpful.
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
    let roadmap =
      typeof content === "string" && content.trim()
        ? content.trim()
        : "Sorry, I couldn't generate a roadmap. Please try again.";

    if (!/yt\s*tutorials/i.test(roadmap)) {
      const ytSection = await generateYTTutorialsFallback({
        goal,
        experienceLevel,
        timeframe,
        hoursPerWeek,
        learningStyle,
        focusAreas,
      });

      if (ytSection) {
        roadmap = `${roadmap}\n\n${ytSection}`;
      }
    }

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
