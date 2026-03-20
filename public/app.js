/* ═══════════════════════════════════════════════════════════════
   NexusPath — AI Roadmap Generator  ·  Application Logic
   ═══════════════════════════════════════════════════════════════ */

// ── DOM References ──────────────────────────────────────────────
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
const outputStatusDot = document.querySelector("#outputStatusDot .status-dot");
const outputStatusText = document.getElementById("outputStatusText");
const styleChips = document.querySelectorAll(".style-chip");
const learningStyleInput = document.getElementById("learningStyle");

let lastRoadmapMarkdown = "";

// ═══════════════════════════════════════════════════════════════
// ANIMATED BACKGROUND (Floating particles + mesh connections)
// ═══════════════════════════════════════════════════════════════
(function initBackground() {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let particles = [];
  const PARTICLE_COUNT = 50;
  const CONNECTION_DIST = 140;
  let animId;
  let mouseX = -1000, mouseY = -1000;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      // Mouse repulsion
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.5;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      p.x += p.vx;
      p.y += p.vy;

      // Damping
      p.vx *= 0.995;
      p.vy *= 0.995;

      // Wrap
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
      gradient.addColorStop(0, `rgba(167, 139, 250, ${p.opacity})`);
      gradient.addColorStop(1, `rgba(167, 139, 250, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = `rgba(129, 140, 248, ${p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => {
    resize();
  });

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  resize();
  createParticles();
  draw();
})();

// ═══════════════════════════════════════════════════════════════
// STYLE CHIPS
// ═══════════════════════════════════════════════════════════════
styleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    styleChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    learningStyleInput.value = chip.dataset.value;
  });
});

// ═══════════════════════════════════════════════════════════════
// INLINE MARKDOWN FORMATTER
// ═══════════════════════════════════════════════════════════════
function inlineMd(text) {
  if (!text) return "";
  let s = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`(.+?)`/g, '<code class="cyber-code">$1</code>');
  return s;
}

// ═══════════════════════════════════════════════════════════════
// BLOCK MARKDOWN  — converts lines into HTML with proper list grouping
// ═══════════════════════════════════════════════════════════════
function blockMd(lines) {
  let html = "";
  let inList = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { html += "</ul>"; inList = false; }
      continue;
    }

    // h3 sub-headings
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3 class="phase-subheading">${inlineMd(h3[1])}</h3>`;
      continue;
    }

    // h4 headings
    const h4 = line.match(/^####\s+(.*)/);
    if (h4) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h4 class="phase-h4">${inlineMd(h4[1])}</h4>`;
      continue;
    }

    // Bullet or numbered list items
    const bullet = line.match(/^[-*]\s+(.*)/);
    const numbered = line.match(/^\d+\.\s+(.*)/);
    if (bullet || numbered) {
      if (!inList) { html += '<ul class="phase-list">'; inList = true; }
      const content = bullet ? bullet[1] : numbered[1];
      html += `<li>${inlineMd(content)}</li>`;
      continue;
    }

    // Regular paragraph
    if (inList) { html += "</ul>"; inList = false; }
    html += `<p class="phase-paragraph">${inlineMd(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

// ═══════════════════════════════════════════════════════════════
// ROADMAP PARSER
// ═══════════════════════════════════════════════════════════════
function parseRoadmap(md) {
  const lines = md.split("\n");
  let title = "";
  const phases = [];
  const extras = [];
  let current = null;
  let currentType = null;

  for (const raw of lines) {
    const line = raw;

    // Top-level title (# heading)
    const h1 = line.match(/^#\s+(.+)/);
    if (h1 && !title) {
      title = h1[1].replace(/[#]/g, "").trim();
      continue;
    }

    // Phase heading (## Phase N: Title)
    const phaseMatch = line.match(/^##\s+(Phase\s*\d+)\s*[:\-–]\s*(.*)/i);
    if (phaseMatch) {
      if (current) {
        (currentType === "phase" ? phases : extras).push(current);
      }
      current = {
        phaseNumber: phaseMatch[1].trim(),
        heading: phaseMatch[2].trim(),
        duration: "",
        lines: [],
      };
      currentType = "phase";
      continue;
    }

    // Other ## headings (Final Assessment, etc.)
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) {
      if (current) {
        (currentType === "phase" ? phases : extras).push(current);
      }
      current = {
        phaseNumber: "",
        heading: h2[1].trim(),
        duration: "",
        lines: [],
      };
      currentType = "extra";
      continue;
    }

    // Duration line
    if (current) {
      const durMatch = line.match(/^\*?\s*Duration\s*[:\-–]\s*(.+?)\s*\*?$/i);
      if (durMatch && !current.duration) {
        current.duration = durMatch[1].replace(/\*/g, "").trim();
        continue;
      }
      current.lines.push(line);
    }
  }
  if (current) {
    (currentType === "phase" ? phases : extras).push(current);
  }

  return { title, phases, extras };
}

// ═══════════════════════════════════════════════════════════════
// PHASE CARD COLOR PALETTES
// ═══════════════════════════════════════════════════════════════
const phaseColors = [
  { border: "#818cf8", glow: "rgba(129,140,248,0.12)", accent: "#818cf8", bg: "rgba(129,140,248,0.04)" },
  { border: "#a78bfa", glow: "rgba(167,139,250,0.12)", accent: "#a78bfa", bg: "rgba(167,139,250,0.04)" },
  { border: "#34d399", glow: "rgba(52,211,153,0.12)",  accent: "#34d399", bg: "rgba(52,211,153,0.04)" },
  { border: "#fb7185", glow: "rgba(251,113,133,0.12)", accent: "#fb7185", bg: "rgba(251,113,133,0.04)" },
  { border: "#fbbf24", glow: "rgba(251,191,36,0.12)",  accent: "#fbbf24", bg: "rgba(251,191,36,0.04)" },
  { border: "#22d3ee", glow: "rgba(34,211,238,0.12)",  accent: "#22d3ee", bg: "rgba(34,211,238,0.04)" },
];

// ═══════════════════════════════════════════════════════════════
// RENDER ROADMAP CARDS
// ═══════════════════════════════════════════════════════════════
function renderRoadmapCards(md) {
  const { title, phases, extras } = parseRoadmap(md);
  let html = "";

  // Title
  if (title) {
    html += `<div class="roadmap-title">${inlineMd(title)}</div>`;
  }

  // Phase cards
  phases.forEach((phase, i) => {
    const color = phaseColors[i % phaseColors.length];
    const bodyHtml = blockMd(phase.lines);
    const phaseNum = phase.phaseNumber || `Phase ${i + 1}`;
    const durationBadge = phase.duration
      ? `<span class="phase-duration" style="background:${color.bg};color:${color.accent};border-color:${color.accent}">${phase.duration}</span>`
      : "";

    html += `
    <div class="phase-card" style="--card-accent:${color.accent};--card-glow:${color.glow};--card-border:${color.border};--card-bg:${color.bg};" data-phase-index="${i}">
      <button class="phase-header" onclick="togglePhase(this)" aria-expanded="false">
        <div class="phase-header-left">
          <span class="phase-number">${phaseNum}</span>
          <span class="phase-heading">${inlineMd(phase.heading)}</span>
        </div>
        <div class="phase-header-right">
          ${durationBadge}
          <span class="phase-chevron">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
        </div>
      </button>
      <div class="phase-body">
        <div class="phase-body-inner">
          ${bodyHtml}
        </div>
      </div>
    </div>`;
  });

  // Extra sections (Final Assessment, etc.)
  extras.forEach((section, i) => {
    const color = phaseColors[(phases.length + i) % phaseColors.length];
    const bodyHtml = blockMd(section.lines);

    html += `
    <div class="phase-card extra-card" style="--card-accent:${color.accent};--card-glow:${color.glow};--card-border:${color.border};--card-bg:${color.bg};">
      <button class="phase-header" onclick="togglePhase(this)" aria-expanded="false">
        <div class="phase-header-left">
          <span class="phase-number extra-badge">✦</span>
          <span class="phase-heading">${inlineMd(section.heading)}</span>
        </div>
        <div class="phase-header-right">
          <span class="phase-chevron">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
        </div>
      </button>
      <div class="phase-body">
        <div class="phase-body-inner">
          ${bodyHtml}
        </div>
      </div>
    </div>`;
  });

  return html;
}

// ═══════════════════════════════════════════════════════════════
// TOGGLE PHASE CARD
// ═══════════════════════════════════════════════════════════════
window.togglePhase = function (btn) {
  const card = btn.closest(".phase-card");
  const isOpen = card.classList.contains("open");
  if (isOpen) {
    card.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  } else {
    card.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }
};

// ═══════════════════════════════════════════════════════════════
// UI STATE HELPERS
// ═══════════════════════════════════════════════════════════════
function setStatus(type, text) {
  statusMessage.classList.remove("hidden", "loading", "success", "error");
  statusMessage.textContent = text;
  statusMessage.classList.add(type);

  // Update dot
  outputStatusDot.className = "status-dot " + type;

  // Update status text
  const labels = { loading: "Generating...", success: "Complete", error: "Error" };
  outputStatusText.textContent = labels[type] || "Awaiting input";
}

function setLoading(isLoading) {
  if (isLoading) {
    generateBtn.disabled = true;
    btnSpinner.classList.remove("hidden");
    btnIcon.style.display = "none";
    roadmapSkeleton.classList.remove("hidden");
    setStatus("loading", "Generating your personalized learning roadmap...");
  } else {
    generateBtn.disabled = false;
    btnSpinner.classList.add("hidden");
    btnIcon.style.display = "";
    roadmapSkeleton.classList.add("hidden");
  }
}

// ═══════════════════════════════════════════════════════════════
// RANGE INPUT
// ═══════════════════════════════════════════════════════════════
hoursRange.addEventListener("input", () => {
  hoursValue.textContent = `${hoursRange.value} hours/week`;
});

// ═══════════════════════════════════════════════════════════════
// FORM SUBMIT
// ═══════════════════════════════════════════════════════════════
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const goal = document.getElementById("goal").value.trim();
  const experienceLevel = document.getElementById("experienceLevel").value;
  const timeframe = document.getElementById("timeframe").value;
  const hoursPerWeek = Number(hoursRange.value);
  const learningStyle = learningStyleInput.value;
  const focusAreasRaw = document.getElementById("focusAreas").value.trim();

  if (!goal || !timeframe) {
    setStatus("error", "Please provide at least your learning goal and timeframe.");
    return;
  }

  const focusAreas = focusAreasRaw ? focusAreasRaw.split(",").map((x) => x.trim()) : [];

  setLoading(true);

  try {
    const response = await fetch("/api/generate-roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, experienceLevel, timeframe, hoursPerWeek, learningStyle, focusAreas }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate roadmap.");
    }

    const roadmap = data.roadmap || "";
    lastRoadmapMarkdown = roadmap;

    // Render
    const html = renderRoadmapCards(roadmap);
    roadmapContent.innerHTML = html || '<p class="empty-state-text">Empty response received.</p>';

    setStatus("success", "Roadmap generated successfully — expand phases below to explore.");

    if (lastRoadmapMarkdown) {
      copyBtn.classList.remove("hidden");
    }

    // Auto-open first phase
    const firstCard = roadmapContent.querySelector(".phase-card");
    if (firstCard) {
      firstCard.classList.add("open");
      const btn = firstCard.querySelector(".phase-header");
      if (btn) btn.setAttribute("aria-expanded", "true");
    }

    // Save to history if user is signed in
    if (typeof saveRoadmapToHistory === "function") {
      saveRoadmapToHistory(goal, experienceLevel, timeframe, hoursPerWeek, learningStyle, focusAreas, roadmap);
    }
  } catch (error) {
    console.error(error);
    setStatus("error", error.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
});

// ═══════════════════════════════════════════════════════════════
// COPY TO CLIPBOARD
// ═══════════════════════════════════════════════════════════════
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!lastRoadmapMarkdown) return;
    try {
      await navigator.clipboard.writeText(lastRoadmapMarkdown);
      const label = copyBtn.querySelector("span");
      if (label) {
        const original = label.textContent;
        label.textContent = "Copied!";
        setTimeout(() => { label.textContent = original; }, 2000);
      }
    } catch {
      setStatus("error", "Unable to access clipboard. Please copy manually.");
    }
  });
}
