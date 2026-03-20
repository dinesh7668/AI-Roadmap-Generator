/* ═══════════════════════════════════════════════════════════════
   NexusPath — Authentication & History Module
   ═══════════════════════════════════════════════════════════════ */

let currentUser = null;

// ── DOM References ────────────────────────────────────────────────
const authBtn = document.getElementById("authBtn");
const authBtnText = document.getElementById("authBtnText");
const authBtnAvatar = document.getElementById("authBtnAvatar");
const authBtnIcon = document.getElementById("authBtnIcon");
const userDropdown = document.getElementById("userDropdown");
const dropdownName = document.getElementById("dropdownName");
const dropdownEmail = document.getElementById("dropdownEmail");
const dropdownAvatar = document.getElementById("dropdownAvatar");
const signOutBtn = document.getElementById("signOutBtn");
const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("historyPanel");
const historyOverlay = document.getElementById("historyOverlay");
const historyClose = document.getElementById("historyClose");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const historyLoading = document.getElementById("historyLoading");
const authPromptOverlay = document.getElementById("authPromptOverlay");
const authPromptClose = document.getElementById("authPromptClose");
const authPromptGoogleBtn = document.getElementById("authPromptGoogleBtn");

// ═══════════════════════════════════════════════════════════════
// AUTH STATE LISTENER
// ═══════════════════════════════════════════════════════════════
auth.onAuthStateChanged((user) => {
  currentUser = user;
  updateAuthUI(user);
  if (user) {
    loadHistory();
  }
});

// ═══════════════════════════════════════════════════════════════
// GOOGLE SIGN-IN
// ═══════════════════════════════════════════════════════════════
async function signInWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;

    // Save/update user profile in Firestore
    await db.collection("users").doc(user.uid).set({
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    closeAuthPrompt();
    showToast("Welcome, " + user.displayName + "!", "success");
  } catch (error) {
    console.error("Sign-in error:", error);
    if (error.code !== "auth/popup-closed-by-user") {
      showToast("Sign-in failed. Please try again.", "error");
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SIGN OUT
// ═══════════════════════════════════════════════════════════════
async function signOut() {
  try {
    await auth.signOut();
    closeDropdown();
    showToast("Signed out successfully", "success");
  } catch (error) {
    console.error("Sign-out error:", error);
    showToast("Failed to sign out", "error");
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE UI BASED ON AUTH STATE
// ═══════════════════════════════════════════════════════════════
function updateAuthUI(user) {
  if (user) {
    // Show user avatar & name
    authBtnText.textContent = user.displayName?.split(" ")[0] || "Account";
    authBtnIcon.style.display = "none";
    if (user.photoURL) {
      authBtnAvatar.src = user.photoURL;
      authBtnAvatar.style.display = "block";
    } else {
      authBtnAvatar.style.display = "none";
      authBtnIcon.style.display = "flex";
      authBtnIcon.textContent = (user.displayName || "U")[0].toUpperCase();
    }
    authBtn.classList.add("authenticated");
    historyBtn.classList.remove("hidden");

    // Update dropdown info
    dropdownName.textContent = user.displayName || "User";
    dropdownEmail.textContent = user.email || "";
    if (user.photoURL) {
      dropdownAvatar.src = user.photoURL;
      dropdownAvatar.style.display = "block";
    }
  } else {
    authBtnText.textContent = "Sign In";
    authBtnAvatar.style.display = "none";
    authBtnIcon.style.display = "flex";
    authBtnIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    authBtn.classList.remove("authenticated");
    historyBtn.classList.add("hidden");
    closeDropdown();
  }
}

// ═══════════════════════════════════════════════════════════════
// DROPDOWN TOGGLE
// ═══════════════════════════════════════════════════════════════
let dropdownOpen = false;

function toggleDropdown() {
  if (!currentUser) {
    openAuthPrompt();
    return;
  }
  dropdownOpen = !dropdownOpen;
  userDropdown.classList.toggle("open", dropdownOpen);
}

function closeDropdown() {
  dropdownOpen = false;
  userDropdown.classList.remove("open");
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!authBtn.contains(e.target) && !userDropdown.contains(e.target)) {
    closeDropdown();
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTH PROMPT MODAL
// ═══════════════════════════════════════════════════════════════
function openAuthPrompt() {
  authPromptOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeAuthPrompt() {
  authPromptOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════════
// SAVE ROADMAP TO HISTORY
// ═══════════════════════════════════════════════════════════════
async function saveRoadmapToHistory(goal, experienceLevel, timeframe, hoursPerWeek, learningStyle, focusAreas, roadmapMarkdown) {
  if (!currentUser) return;

  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("roadmaps").add({
        goal,
        experienceLevel,
        timeframe,
        hoursPerWeek,
        learningStyle,
        focusAreas,
        roadmapMarkdown,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("Failed to save roadmap:", error);
  }
}

// ═══════════════════════════════════════════════════════════════
// LOAD HISTORY
// ═══════════════════════════════════════════════════════════════
async function loadHistory() {
  if (!currentUser) return;

  historyLoading.classList.remove("hidden");
  historyEmpty.classList.add("hidden");
  historyList.innerHTML = "";

  try {
    const snapshot = await db.collection("users").doc(currentUser.uid)
      .collection("roadmaps")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    historyLoading.classList.add("hidden");

    if (snapshot.empty) {
      historyEmpty.classList.remove("hidden");
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const card = createHistoryCard(doc.id, data);
      historyList.appendChild(card);
    });
  } catch (error) {
    console.error("Failed to load history:", error);
    historyLoading.classList.add("hidden");
    historyEmpty.classList.remove("hidden");
    historyEmpty.querySelector("p").textContent = "Failed to load history. Please try again.";
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATE HISTORY CARD
// ═══════════════════════════════════════════════════════════════
function createHistoryCard(docId, data) {
  const card = document.createElement("div");
  card.className = "history-card";
  card.dataset.docId = docId;

  const date = data.createdAt?.toDate
    ? data.createdAt.toDate().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "Just now";

  const levelColors = {
    beginner: "#34d399",
    junior: "#60a5fa",
    intermediate: "#a78bfa",
    senior: "#f59e0b",
    other: "#fb7185"
  };

  const levelColor = levelColors[data.experienceLevel] || "#818cf8";

  card.innerHTML = `
    <div class="history-card-header">
      <div class="history-card-goal">${escapeHtml(data.goal || "Untitled Roadmap")}</div>
      <button class="history-card-delete" title="Delete" onclick="deleteHistoryItem(event, '${docId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
    <div class="history-card-meta">
      <span class="history-card-badge" style="--badge-color: ${levelColor}">${escapeHtml(data.experienceLevel || "N/A")}</span>
      <span class="history-card-badge">${escapeHtml(data.timeframe || "N/A")}</span>
      <span class="history-card-badge">${data.hoursPerWeek || "?"}h/week</span>
    </div>
    <div class="history-card-date">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${date}
    </div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.closest(".history-card-delete")) return;
    loadRoadmapFromHistory(data);
  });

  return card;
}

// ═══════════════════════════════════════════════════════════════
// LOAD ROADMAP FROM HISTORY
// ═══════════════════════════════════════════════════════════════
function loadRoadmapFromHistory(data) {
  // Fill form fields
  document.getElementById("goal").value = data.goal || "";
  document.getElementById("experienceLevel").value = data.experienceLevel || "beginner";
  document.getElementById("timeframe").value = data.timeframe || "";

  if (data.hoursPerWeek) {
    const range = document.getElementById("hoursPerWeek");
    range.value = data.hoursPerWeek;
    document.getElementById("hoursPerWeekValue").textContent = data.hoursPerWeek + " hours/week";
  }

  if (data.learningStyle) {
    document.getElementById("learningStyle").value = data.learningStyle;
    document.querySelectorAll(".style-chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.value === data.learningStyle);
    });
  }

  if (data.focusAreas) {
    document.getElementById("focusAreas").value = Array.isArray(data.focusAreas) ? data.focusAreas.join(", ") : data.focusAreas;
  }

  // Render the roadmap
  if (data.roadmapMarkdown) {
    lastRoadmapMarkdown = data.roadmapMarkdown;
    const html = renderRoadmapCards(data.roadmapMarkdown);
    roadmapContent.innerHTML = html || '<p class="empty-state-text">Empty roadmap.</p>';
    setStatus("success", "Loaded from history — expand phases below to explore.");
    copyBtn.classList.remove("hidden");

    // Auto-open first phase
    const firstCard = roadmapContent.querySelector(".phase-card");
    if (firstCard) {
      firstCard.classList.add("open");
      const btn = firstCard.querySelector(".phase-header");
      if (btn) btn.setAttribute("aria-expanded", "true");
    }
  }

  closeHistoryPanel();
  showToast("Roadmap loaded from history", "success");
}

// ═══════════════════════════════════════════════════════════════
// DELETE HISTORY ITEM
// ═══════════════════════════════════════════════════════════════
window.deleteHistoryItem = async function(event, docId) {
  event.stopPropagation();
  if (!currentUser) return;

  const card = event.target.closest(".history-card");
  if (card) {
    card.style.transform = "translateX(100%)";
    card.style.opacity = "0";
  }

  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("roadmaps").doc(docId).delete();

    setTimeout(() => {
      if (card) card.remove();
      // Check if empty
      if (historyList.children.length === 0) {
        historyEmpty.classList.remove("hidden");
      }
    }, 300);

    showToast("Roadmap deleted", "success");
  } catch (error) {
    console.error("Failed to delete:", error);
    if (card) {
      card.style.transform = "";
      card.style.opacity = "";
    }
    showToast("Failed to delete roadmap", "error");
  }
};

// ═══════════════════════════════════════════════════════════════
// HISTORY PANEL TOGGLE
// ═══════════════════════════════════════════════════════════════
function openHistoryPanel() {
  if (!currentUser) {
    openAuthPrompt();
    return;
  }
  loadHistory();
  historyPanel.classList.add("open");
  historyOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeHistoryPanel() {
  historyPanel.classList.remove("open");
  historyOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast-show");
  });

  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
authBtn.addEventListener("click", toggleDropdown);
signOutBtn.addEventListener("click", signOut);
historyBtn.addEventListener("click", openHistoryPanel);
historyOverlay.addEventListener("click", closeHistoryPanel);
historyClose.addEventListener("click", closeHistoryPanel);
authPromptClose.addEventListener("click", closeAuthPrompt);
authPromptGoogleBtn.addEventListener("click", signInWithGoogle);
authPromptOverlay.addEventListener("click", (e) => {
  if (e.target === authPromptOverlay) closeAuthPrompt();
});

// ESC to close panels
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeHistoryPanel();
    closeAuthPrompt();
    closeDropdown();
  }
});
