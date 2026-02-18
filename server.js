const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${PORT}`;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl =
  process.env.GOOGLE_CALLBACK_URL || `${appOrigin}/auth/google/callback`;

const sessionSecret = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === "production";
const isGoogleAuthConfigured = Boolean(googleClientId && googleClientSecret);

app.use(
  cors({
    origin: appOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: sessionSecret || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

if (!sessionSecret) {
  console.warn(
    "Warning: SESSION_SECRET is not set. Set a strong SESSION_SECRET in .env for secure sessions."
  );
}

if (isGoogleAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
      },
      (_accessToken, _refreshToken, profile, done) => {
        const user = {
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value || null,
          photo: profile.photos?.[0]?.value || null,
        };
        done(null, user);
      }
    )
  );
} else {
  console.warn(
    "Warning: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing. Google sign-in is disabled until configured in .env."
  );
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

function ensureAuthenticated(req, res, next) {
  if (!isGoogleAuthConfigured) {
    return res.status(503).json({
      error:
        "Google auth is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
    });
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    error: "Please sign in with Google to use this feature.",
  });
}

// Serve static frontend
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth status
app.get("/api/auth/session", (req, res) => {
  const authenticated = Boolean(req.isAuthenticated && req.isAuthenticated());

  res.json({
    configured: isGoogleAuthConfigured,
    authenticated,
    user: authenticated
      ? {
          displayName: req.user?.displayName || null,
          email: req.user?.email || null,
          photo: req.user?.photo || null,
        }
      : null,
  });
});

// Google auth routes
app.get("/auth/google", (req, res, next) => {
  if (!isGoogleAuthConfigured) {
    return res.redirect("/?auth=disabled");
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

app.get(
  "/auth/google/callback",
  (req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.redirect("/?auth=disabled");
    }

    return passport.authenticate("google", {
      failureRedirect: "/?auth=failed",
      session: true,
    })(req, res, next);
  },
  (_req, res) => {
    res.redirect("/");
  }
);

app.get("/auth/logout", (req, res, next) => {
  req.logout((logoutErr) => {
    if (logoutErr) {
      return next(logoutErr);
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
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

app.post("/api/generate-roadmap", ensureAuthenticated, async (req, res) => {
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
  console.log(`AI Roadmap Generator running on ${appOrigin}`);
  console.log(`Google callback URL: ${googleCallbackUrl}`);
  console.log(`Using NVIDIA model: ${nvidiaModel}`);
});
