const form = document.getElementById("roadmap-form");
const generateBtn = document.getElementById("generateBtn");
const btnSpinner = document.getElementById("btnSpinner");
const btnIcon = document.getElementById("btnIcon");
const roadmapContent = document.getElementById("roadmapContent");
const roadmapSkeleton = document.getElementById("roadmapSkeleton");
const statusMessage = document.getElementById("statusMessage");
const copyBtn = document.getElementById("copyBtn");
const hoursRange = document.getElementById("hoursPerWeek");
const hoursValue = document.getElementById("hoursPerWeekValue");
const authMessage = document.getElementById("authMessage");
const loginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");

let isAuthenticated = false;
let authConfigured = true;
let currentUser = null;

let lastRoadmapMarkdown = "";
let renderJobId = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setGenerateAvailability() {
  const disabled = !authConfigured;
  generateBtn.disabled = disabled;
  generateBtn.classList.toggle("opacity-70", disabled);
  generateBtn.classList.toggle("cursor-not-allowed", disabled);
}

function updateAuthUI() {
  if (!authMessage || !loginBtn || !logoutBtn) {
    return;
  }

  if (!authConfigured) {
    authMessage.textContent = "Google sign-in is not configured on the server.";
    authMessage.className = "text-xs text-rose-300 mb-3";
    loginBtn.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    isAuthenticated = false;
    setGenerateAvailability();
    return;
  }

  if (isAuthenticated) {
    const identity = currentUser?.email || currentUser?.displayName || "Signed in";
    authMessage.textContent = `Signed in as ${identity}`;
    authMessage.className = "text-xs text-emerald-300 mb-3";
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    authMessage.textContent = "Sign in with Google to generate a roadmap.";
    authMessage.className = "text-xs text-amber-300 mb-3";
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }

  setGenerateAvailability();
}

async function checkAuthSession() {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Unable to verify session.");
    }

    const data = await response.json();
    authConfigured = data.configured !== false;
    isAuthenticated = Boolean(data.authenticated);
    currentUser = data.user || null;
  } catch (_error) {
    authConfigured = false;
    isAuthenticated = false;
    currentUser = null;
  } finally {
    updateAuthUI();
  }
}

// Simple Markdown -> HTML renderer for headings, bullets, and emphasis
function renderMarkdown(md) {
  if (!md) return "";

  let html = md;

  // Escape basic HTML first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings
  html = html.replace(/^###### (.*$)/gim, "<h6>$1</h6>");
  html = html.replace(/^##### (.*$)/gim, "<h5>$1</h5>");
  html = html.replace(/^#### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold & italics
  html = html.replace(/\*\*\*(.+?)\*\*\*/gim, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/gim, "<em>$1</em>");

  // Bullet lists
  html = html.replace(/^\s*[-*] (.*$)/gim, "<li>$1</li>");

  // Numbered lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, "<li>$1</li>");

  // Wrap consecutive <li> in <ul> / <ol>
  html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");

  // Paragraphs
  html = html.replace(/^\s*(?!<h\d|<ul>|<li>|<\/li>|<\/ul>)(.+)$/gim, "<p>$1</p>");

  return html;
}

function toTitleCase(text) {
  return String(text || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/([A-Za-z])-([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function stripLinksFromMarkdown(md) {
  if (!md) return "";

  let sanitized = String(md);

  // [label](url) -> label
  sanitized = sanitized.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1");
  // <https://...> -> ""
  sanitized = sanitized.replace(/<https?:\/\/[^>]+>/gi, "");
  // bare https://... -> ""
  sanitized = sanitized.replace(/https?:\/\/[^\s)]+/gi, "");

  return sanitized
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripLinksExceptRecommendedResources(md) {
  if (!md) return "";

  const lines = String(md).split(/\r?\n/);
  const output = [];
  let inRecommendedResources = false;

  for (const line of lines) {
    const normalized = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .replace(/\*\*/g, "")
      .trim()
      .toLowerCase();

    if (/^recommended\s*resources\b/.test(normalized)) {
      inRecommendedResources = true;
      output.push(line);
      continue;
    }

    if (
      /^(duration|objectives|concrete tasks\/activities|concrete tasks|suggested project ideas|phase\s+\d+|yt tutorials|tips for staying consistent|how to measure progress|recommended next step)\b/.test(
        normalized
      )
    ) {
      inRecommendedResources = false;
    }

    output.push(inRecommendedResources ? line : stripLinksFromMarkdown(line));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeSectionMarkdown(title, md) {
  if (/recommended\s*resources/i.test(String(title || ""))) {
    return md;
  }
  return stripLinksExceptRecommendedResources(md);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeHeadingCandidate(line) {
  return String(line || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function getSubsectionTitle(line) {
  const normalized = normalizeHeadingCandidate(line)
    .replace(/[:\-]+$/, "")
    .toLowerCase();

  const patterns = [
    { rx: /^duration(\s*\(.*\))?$/, title: "Duration" },
    { rx: /^objectives?$/, title: "Objectives" },
    { rx: /^concrete tasks\/activities$/, title: "Concrete Tasks/Activities" },
    { rx: /^concrete tasks$/, title: "Concrete Tasks/Activities" },
    { rx: /^tasks\/activities$/, title: "Concrete Tasks/Activities" },
    { rx: /^suggested project ideas?$/, title: "Suggested Project Ideas" },
    { rx: /^recommended resources?$/, title: "Recommended Resources" },
    { rx: /^resources?$/, title: "Recommended Resources" },
    { rx: /^tips for staying consistent$/, title: "Tips For Staying Consistent" },
    { rx: /^how to measure progress$/, title: "How To Measure Progress" },
    { rx: /^recommended next step$/, title: "Recommended Next Step" },
  ];

  const match = patterns.find((p) => p.rx.test(normalized));
  return match ? match.title : null;
}

function splitPhaseContentIntoSubsections(contentLines) {
  const preface = [];
  const subsections = [];
  let current = null;

  for (const line of contentLines) {
    const title = getSubsectionTitle(line);
    if (title) {
      if (current) {
        subsections.push(current);
      }
      current = { title, lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else {
      preface.push(line);
    }
  }

  if (current) {
    subsections.push(current);
  }

  return { preface, subsections };
}

function buildCollapsibleRoadmap(md) {
  if (!md) return "";

  const lines = md.split(/\r?\n/);
  const introLines = [];
  const sections = [];
  let currentSection = null;

  const parseSectionMeta = (line) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    const rawText = headingMatch ? headingMatch[2] : line;
    const normalized = String(rawText || "")
      .replace(/^\s*[-*+]\s*/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .replace(/\*\*/g, "")
      .trim();

    const phaseMatch = normalized.match(/^phase\s+(\d+)\s*:/i);
    if (phaseMatch) {
      return {
        type: "phase",
        phaseNumber: Number(phaseMatch[1]),
        title: toTitleCase(normalized),
      };
    }

    if (/^yt\s*tutorials\b/i.test(normalized)) {
      return {
        type: "yt",
        phaseNumber: Number.MAX_SAFE_INTEGER,
        title: "YT Tutorials",
      };
    }

    return null;
  };

  for (const line of lines) {
    const meta = parseSectionMeta(line);

    if (meta) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { ...meta, content: [] };
      continue;
    }

    if (currentSection) {
      currentSection.content.push(line);
    } else {
      introLines.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  if (!sections.length) {
    return renderMarkdown(md);
  }

  const phaseSections = sections
    .filter((s) => s.type === "phase")
    .sort((a, b) => a.phaseNumber - b.phaseNumber);
  const ytSections = sections.filter((s) => s.type === "yt");
  const otherSections = sections.filter((s) => s.type !== "phase" && s.type !== "yt");
  const introHtml = renderMarkdown(introLines.join("\n").trim());

  const phaseBlocksHtml = phaseSections
    .map((section, phaseIndex) => {
      const { preface, subsections } = splitPhaseContentIntoSubsections(section.content);
      const phaseTitleHtml = `<h3 class="roadmap-phase-title">${escapeHtml(section.title)}</h3>`;

      const prefaceMd = preface.join("\n").trim();
      const prefaceHtml = prefaceMd
        ? `<div class="roadmap-phase-preface">${renderMarkdown(
            sanitizeSectionMarkdown("Phase Intro", prefaceMd)
          )}</div>`
        : "";

      const fallbackSubsections =
        subsections.length > 0
          ? subsections
          : [{ title: "Details", lines: section.content }];

      const subsectionCards = fallbackSubsections
        .map((sub, subIndex) => {
          const rawContentMd = sub.lines.join("\n").trim();
          const contentMd = sanitizeSectionMarkdown(sub.title, rawContentMd);
          const contentHtml = renderMarkdown(contentMd || "_No details available._");
          const openAttr = phaseIndex === 0 && subIndex === 0 ? " open" : "";

          return `
            <details class="roadmap-card"${openAttr}>
              <summary class="roadmap-card-summary">
                <span class="roadmap-card-title">${escapeHtml(sub.title)}</span>
                <span class="roadmap-card-icon" aria-hidden="true"></span>
              </summary>
              <div class="roadmap-card-body">${contentHtml}</div>
            </details>
          `;
        })
        .join("");

      return `<section class="roadmap-phase-block">${phaseTitleHtml}${prefaceHtml}${subsectionCards}</section>`;
    })
    .join("");

  const buildStandaloneCard = (section, openByDefault = false) => {
    const rawContentMd = section.content.join("\n").trim();
    const contentMd = sanitizeSectionMarkdown(section.title, rawContentMd);
    const contentHtml = renderMarkdown(contentMd || "_No details available._");
    const openAttr = openByDefault ? " open" : "";

    return `
      <details class="roadmap-card"${openAttr}>
        <summary class="roadmap-card-summary">
          <span class="roadmap-card-title">${escapeHtml(section.title)}</span>
          <span class="roadmap-card-icon" aria-hidden="true"></span>
        </summary>
        <div class="roadmap-card-body">${contentHtml}</div>
      </details>
    `;
  };

  const otherCardsHtml = otherSections
    .map((section, idx) => buildStandaloneCard(section, phaseSections.length === 0 && idx === 0))
    .join("");

  const ytCardsHtml = ytSections
    .map((section, idx) =>
      buildStandaloneCard(
        section,
        phaseSections.length === 0 && otherSections.length === 0 && idx === 0
      )
    )
    .join("");

  return `${introHtml}${phaseBlocksHtml}${otherCardsHtml}${ytCardsHtml}`;
}

function setLoading(isLoading) {
  if (isLoading) {
    renderJobId += 1;
    generateBtn.disabled = true;
    generateBtn.classList.add("opacity-70", "cursor-not-allowed");
    btnSpinner.classList.remove("hidden");
    btnIcon.classList.add("hidden");
    roadmapSkeleton.classList.remove("hidden");
    roadmapContent.classList.add("opacity-0", "pointer-events-none");
    copyBtn.classList.add("hidden");
    lastRoadmapMarkdown = "";
    statusMessage.textContent =
      "Generating a tailored roadmap with NVIDIA Llama 3 8B...";
  } else {
    setGenerateAvailability();
    generateBtn.classList.remove("opacity-70", "cursor-not-allowed");
    btnSpinner.classList.add("hidden");
    btnIcon.classList.remove("hidden");
    roadmapSkeleton.classList.add("hidden");
    roadmapContent.classList.remove("opacity-0", "pointer-events-none");
  }
}

async function renderRoadmapLineByLine(roadmap, jobId) {
  const lines = String(roadmap || "").split(/\r?\n/);

  if (!lines.length) {
    roadmapContent.innerHTML = "<p>Empty roadmap.</p>";
    return false;
  }

  let streamed = "";
  roadmapContent.innerHTML = "";
  for (let i = 0; i < lines.length; i += 1) {
    if (jobId !== renderJobId) {
      return false;
    }

    streamed += (i === 0 ? "" : "\n") + lines[i];
    roadmapContent.innerHTML = buildCollapsibleRoadmap(streamed);
    roadmapContent.scrollTop = roadmapContent.scrollHeight;

    const line = lines[i].trim();
    const waitMs = line ? 22 : 12;
    await delay(waitMs);
  }

  if (jobId !== renderJobId) {
    return false;
  }

  roadmapContent.innerHTML = buildCollapsibleRoadmap(roadmap) || "<p>Empty roadmap.</p>";
  return true;
}

hoursRange.addEventListener("input", () => {
  hoursValue.textContent = hoursRange.value;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authConfigured) {
    statusMessage.textContent =
      "Google auth is not configured on the server. Please set it in .env.";
    statusMessage.className = "text-xs text-rose-300 mb-2";
    return;
  }

  if (!isAuthenticated) {
    statusMessage.textContent = "Redirecting to Google sign-in...";
    statusMessage.className = "text-xs text-amber-300 mb-2";
    window.location.href = "/auth/google";
    return;
  }

  const goal = document.getElementById("goal").value.trim();
  const experienceLevel = document.getElementById("experienceLevel").value;
  const timeframe = document.getElementById("timeframe").value;
  const hoursPerWeek = Number(hoursRange.value);
  const learningStyle = document.getElementById("learningStyle").value;
  const focusAreasRaw = document.getElementById("focusAreas").value.trim();

  if (!goal || !timeframe) {
    statusMessage.textContent =
      "Please provide at least your main goal and timeframe.";
    statusMessage.className = "text-xs text-rose-300 mb-2";
    return;
  }

  const focusAreas = focusAreasRaw
    ? focusAreasRaw.split(",").map((x) => x.trim())
    : [];

  setLoading(true);
  const jobId = renderJobId;
  statusMessage.className = "text-xs text-slate-300 mb-2";

  try {
    const response = await fetch("/api/generate-roadmap", {
      credentials: "same-origin",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal,
        experienceLevel,
        timeframe,
        hoursPerWeek,
        learningStyle,
        focusAreas,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        isAuthenticated = false;
        currentUser = null;
        updateAuthUI();
      }
      throw new Error(data.error || "Failed to generate roadmap.");
    }

    const roadmap = data.roadmap || "";
    lastRoadmapMarkdown = roadmap;

    // Start the "AI writing" view immediately after we receive data.
    roadmapSkeleton.classList.add("hidden");
    roadmapContent.classList.remove("opacity-0", "pointer-events-none");
    statusMessage.textContent = "Writing your roadmap...";
    statusMessage.className = "text-xs text-sky-300 mb-2";

    roadmapContent.classList.remove("animate-[fadeInUp_0.5s_ease-out]");
    // Trigger reflow for animation restart
    // eslint-disable-next-line no-unused-expressions
    roadmapContent.offsetHeight;
    roadmapContent.classList.add("animate-[fadeInUp_0.5s_ease-out]");

    const completed = await renderRoadmapLineByLine(roadmap, jobId);
    if (!completed) {
      return;
    }

    if (jobId !== renderJobId) {
      return;
    }

    statusMessage.textContent =
      "Roadmap generated. You can tweak the inputs and regenerate.";
    statusMessage.className = "text-xs text-emerald-300 mb-2";

    if (lastRoadmapMarkdown && jobId === renderJobId) {
      copyBtn.classList.remove("hidden");
    }
  } catch (error) {
    console.error(error);
    if (jobId !== renderJobId) {
      return;
    }
    lastRoadmapMarkdown = "";
    copyBtn.classList.add("hidden");
    statusMessage.textContent =
      error.message ||
      "Something went wrong while generating the roadmap. Please try again.";
    statusMessage.className = "text-xs text-rose-300 mb-2";
  } finally {
    if (jobId === renderJobId) {
      setLoading(false);
    }
  }
});

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!lastRoadmapMarkdown) return;

    try {
      await navigator.clipboard.writeText(lastRoadmapMarkdown);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1600);
    } catch {
      statusMessage.textContent =
        "Unable to access clipboard. You can still select and copy manually.";
      statusMessage.className = "text-xs text-amber-300 mb-2";
    }
  });
}

const authResult = new URLSearchParams(window.location.search).get("auth");
if (authResult === "failed") {
  statusMessage.textContent = "Google sign-in failed. Please try again.";
  statusMessage.className = "text-xs text-rose-300 mb-2";
}
if (authResult === "disabled") {
  statusMessage.textContent =
    "Google sign-in is disabled because server credentials are missing.";
  statusMessage.className = "text-xs text-rose-300 mb-2";
}

checkAuthSession();



