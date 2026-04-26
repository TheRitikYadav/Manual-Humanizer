const fullText = document.getElementById("fullText");
const startBtn = document.getElementById("startBtn");
const resumeBtn = document.getElementById("resumeBtn");
const inputMeta = document.getElementById("inputMeta");

const workspace = document.getElementById("workspace");
const sentenceList = document.getElementById("sentenceList");
const editedCount = document.getElementById("editedCount");
const progressBar = document.getElementById("progressBar");

const sentenceEditor = document.getElementById("sentenceEditor");
const originalText = document.getElementById("originalText");
const sentenceMeta = document.getElementById("sentenceMeta");
const wordChips = document.getElementById("wordChips");
const prevBtn = document.getElementById("prevBtn");
const saveNextBtn = document.getElementById("saveNextBtn");
const resetSentenceBtn = document.getElementById("resetSentenceBtn");
const progressText = document.getElementById("progressText");
const paragraphText = document.getElementById("paragraphText");

const outputSection = document.getElementById("outputSection");
const buildOutputBtn = document.getElementById("buildOutputBtn");
const finalOutput = document.getElementById("finalOutput");
const outputMeta = document.getElementById("outputMeta");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

const themeToggle = document.getElementById("themeToggle");
const clearCacheBtn = document.getElementById("clearCacheBtn");

const popover = document.getElementById("synonymPopover");
const popoverWord = document.getElementById("popoverWord");
const popoverBody = document.getElementById("popoverBody");
const popoverClose = document.getElementById("popoverClose");

const toast = document.getElementById("toast");

const CACHE_KEY = "manual-humanizer-cache-v2";
const THEME_KEY = "manual-humanizer-theme";

let sentenceItems = [];
let currentIndex = 0;
let activeChipIndex = -1;
const synonymCache = new Map();

/* ---------------- utilities ---------------- */

function countWords(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function updateMetaFor(el, text) {
  if (!el) return;
  el.textContent = `${countWords(text)} words • ${(text || "").length} chars`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 1800);
}

/* ---------------- parsing ---------------- */

function splitSentences(paragraph) {
  const cleaned = paragraph.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g);
  if (!matches) return [cleaned];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function parseIntoSentenceItems(input) {
  const paragraphs = input
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const items = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    splitSentences(paragraph).forEach((sentence) => {
      items.push({
        paragraphIndex,
        original: sentence,
        text: sentence,
      });
    });
  });
  return items;
}

/* ---------------- rendering ---------------- */

function renderSentenceList() {
  sentenceList.innerHTML = "";
  sentenceItems.forEach((item, idx) => {
    const li = document.createElement("li");
    li.dataset.index = String(idx);
    if (idx === currentIndex) li.classList.add("active");
    if (item.text.trim() !== item.original.trim()) li.classList.add("edited");

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = `${idx + 1}.`;

    const preview = document.createElement("span");
    preview.className = "preview";
    preview.textContent = item.text || "(empty)";

    li.appendChild(num);
    li.appendChild(preview);
    li.addEventListener("click", () => jumpTo(idx));
    sentenceList.appendChild(li);
  });

  const editedNum = sentenceItems.filter(
    (it) => it.text.trim() !== it.original.trim()
  ).length;
  editedCount.textContent = `${editedNum} / ${sentenceItems.length} edited`;
  const pct = sentenceItems.length
    ? (editedNum / sentenceItems.length) * 100
    : 0;
  progressBar.style.width = `${pct}%`;
}

function renderWordChips(text) {
  wordChips.innerHTML = "";
  activeChipIndex = -1;
  if (!text) return;

  const tokens = text.match(/[A-Za-z']+|[^A-Za-z']+/g) || [];
  let wordCounter = 0;
  tokens.forEach((tok) => {
    const isWord = /[A-Za-z']/.test(tok);
    const chip = document.createElement("span");
    chip.className = "word-chip" + (isWord ? "" : " is-punct");
    chip.textContent = tok;
    if (isWord) {
      const myIndex = wordCounter;
      chip.dataset.wordIndex = String(myIndex);
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        activeChipIndex = myIndex;
        openSynonymPopover(tok.toLowerCase(), chip);
      });
      wordCounter += 1;
    }
    wordChips.appendChild(chip);
  });
}

function updateEditor() {
  if (!sentenceItems.length) {
    sentenceEditor.value = "";
    originalText.textContent = "";
    progressText.textContent = "Sentence 0 of 0";
    paragraphText.textContent = "Paragraph 0";
    updateMetaFor(sentenceMeta, "");
    renderWordChips("");
    return;
  }
  const item = sentenceItems[currentIndex];
  sentenceEditor.value = item.text;
  originalText.textContent = item.original;
  progressText.textContent = `Sentence ${currentIndex + 1} of ${sentenceItems.length}`;
  paragraphText.textContent = `Paragraph ${item.paragraphIndex + 1}`;
  updateMetaFor(sentenceMeta, item.text);
  renderWordChips(item.text);
  renderSentenceList();
}

/* ---------------- editing flow ---------------- */

function saveCurrentSentence({ rerenderChips = false } = {}) {
  if (!sentenceItems.length) return;
  sentenceItems[currentIndex].text = sentenceEditor.value;
  updateMetaFor(sentenceMeta, sentenceEditor.value);
  if (rerenderChips) renderWordChips(sentenceEditor.value);
  renderSentenceList();
  saveToCache();
}

function moveToSentence(offset) {
  if (!sentenceItems.length) return;
  saveCurrentSentence();
  let next = currentIndex + offset;
  if (next < 0) next = 0;
  if (next >= sentenceItems.length) next = sentenceItems.length - 1;
  currentIndex = next;
  updateEditor();
  buildFinalOutput();
  saveToCache();
}

function jumpTo(index) {
  if (index < 0 || index >= sentenceItems.length) return;
  saveCurrentSentence();
  currentIndex = index;
  updateEditor();
  saveToCache();
}

function resetCurrentSentence() {
  if (!sentenceItems.length) return;
  sentenceItems[currentIndex].text = sentenceItems[currentIndex].original;
  updateEditor();
  buildFinalOutput();
  saveToCache();
  showToast("Sentence reset to original");
}

/* ---------------- output ---------------- */

function buildFinalOutput() {
  saveCurrentSentence();
  const grouped = [];
  sentenceItems.forEach((item) => {
    if (!grouped[item.paragraphIndex]) grouped[item.paragraphIndex] = [];
    grouped[item.paragraphIndex].push(item.text.trim());
  });
  const text = grouped
    .map((arr) => arr.filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .join("\n\n");
  finalOutput.value = text;
  updateMetaFor(outputMeta, text);
  saveToCache();
}

/* ---------------- dictionary popover ---------------- */

async function fetchSynonyms(word) {
  if (synonymCache.has(word)) return synonymCache.get(word);
  const endpoints = [
    `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20`,
    `https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=20`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data.map((d) => d.word).filter(Boolean)
        : [];
      if (list.length) {
        synonymCache.set(word, list);
        return list;
      }
    } catch (_e) {
      /* try next */
    }
  }
  synonymCache.set(word, []);
  return [];
}

function positionPopover(anchor) {
  const rect = anchor.getBoundingClientRect();
  const pop = popover;
  pop.classList.remove("hidden");
  const popWidth = pop.offsetWidth || 260;
  const popHeight = pop.offsetHeight || 200;

  let top = rect.bottom + 8;
  let left = rect.left;

  if (left + popWidth > window.innerWidth - 8) {
    left = window.innerWidth - popWidth - 8;
  }
  if (left < 8) left = 8;
  if (top + popHeight > window.innerHeight - 8) {
    top = rect.top - popHeight - 8;
  }
  if (top < 8) top = 8;

  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

async function openSynonymPopover(word, anchor) {
  popoverWord.textContent = word;
  popoverBody.innerHTML =
    '<div class="popover-status">Loading synonyms…</div>';
  positionPopover(anchor);

  const list = await fetchSynonyms(word);
  if (!list.length) {
    popoverBody.innerHTML =
      '<div class="popover-status">No synonyms found.</div>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "synonym-grid";
  list.slice(0, 20).forEach((syn) => {
    const pill = document.createElement("span");
    pill.className = "synonym-pill";
    pill.textContent = syn;
    pill.addEventListener("click", () => {
      replaceWordAt(activeChipIndex, syn);
      popover.classList.add("hidden");
    });
    grid.appendChild(pill);
  });
  popoverBody.innerHTML = "";
  popoverBody.appendChild(grid);
}

function replaceWordAt(wordIndex, replacement) {
  if (wordIndex < 0) return;
  const current = sentenceEditor.value;
  let count = -1;
  const updated = current.replace(/[A-Za-z']+/g, (match) => {
    count += 1;
    if (count !== wordIndex) return match;
    if (match[0] === match[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
  sentenceEditor.value = updated;
  saveCurrentSentence({ rerenderChips: true });
  buildFinalOutput();
  showToast(`Replaced with "${replacement}"`);
}

/* ---------------- cache ---------------- */

function saveToCache() {
  const payload = {
    fullText: fullText.value,
    sentenceItems,
    currentIndex,
    finalOutput: finalOutput.value,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (_e) {
    /* ignore quota */
  }
}

function loadFromCache() {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return;
  try {
    const cached = JSON.parse(raw);
    fullText.value = cached.fullText || "";
    finalOutput.value = cached.finalOutput || "";
    updateMetaFor(inputMeta, fullText.value);
    updateMetaFor(outputMeta, finalOutput.value);

    if (Array.isArray(cached.sentenceItems) && cached.sentenceItems.length) {
      sentenceItems = cached.sentenceItems.map((it) => ({
        paragraphIndex: it.paragraphIndex || 0,
        original: it.original || it.text || "",
        text: it.text || "",
      }));
      currentIndex = Number.isInteger(cached.currentIndex)
        ? cached.currentIndex
        : 0;
      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= sentenceItems.length)
        currentIndex = sentenceItems.length - 1;
      workspace.classList.remove("hidden");
      outputSection.classList.remove("hidden");
      updateEditor();
    }
  } catch (_e) {
    localStorage.removeItem(CACHE_KEY);
  }
}

function clearCache() {
  if (!confirm("Clear saved progress and start fresh?")) return;
  localStorage.removeItem(CACHE_KEY);
  sentenceItems = [];
  currentIndex = 0;
  fullText.value = "";
  finalOutput.value = "";
  workspace.classList.add("hidden");
  outputSection.classList.add("hidden");
  updateMetaFor(inputMeta, "");
  updateMetaFor(outputMeta, "");
  showToast("Cache cleared");
}

/* ---------------- theme ---------------- */

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "Light";
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggle.textContent = "Dark";
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/* ---------------- events ---------------- */

startBtn.addEventListener("click", () => {
  const source = fullText.value.trim();
  if (!source) {
    showToast("Please paste your writing first.");
    return;
  }
  const parsed = parseIntoSentenceItems(source);
  if (!parsed.length) {
    showToast("Could not detect sentences.");
    return;
  }
  sentenceItems = parsed;
  currentIndex = 0;
  workspace.classList.remove("hidden");
  outputSection.classList.remove("hidden");
  updateEditor();
  buildFinalOutput();
  saveToCache();
  sentenceEditor.focus();
});

prevBtn.addEventListener("click", () => moveToSentence(-1));
saveNextBtn.addEventListener("click", () => moveToSentence(1));
resetSentenceBtn.addEventListener("click", resetCurrentSentence);
buildOutputBtn.addEventListener("click", buildFinalOutput);

fullText.addEventListener("input", () => {
  updateMetaFor(inputMeta, fullText.value);
  saveToCache();
});

sentenceEditor.addEventListener("input", () => {
  saveCurrentSentence();
});

sentenceEditor.addEventListener("blur", () => {
  saveCurrentSentence({ rerenderChips: true });
  buildFinalOutput();
});

copyBtn.addEventListener("click", async () => {
  buildFinalOutput();
  const text = finalOutput.value;
  if (!text) {
    showToast("Nothing to copy yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  } catch (_e) {
    showToast("Copy failed — select & copy manually.");
  }
});

downloadBtn.addEventListener("click", () => {
  buildFinalOutput();
  const text = finalOutput.value;
  if (!text) {
    showToast("Nothing to download yet.");
    return;
  }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "humanized.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

themeToggle.addEventListener("click", toggleTheme);
clearCacheBtn.addEventListener("click", clearCache);

popoverClose.addEventListener("click", () => popover.classList.add("hidden"));
document.addEventListener("click", (e) => {
  if (popover.classList.contains("hidden")) return;
  if (popover.contains(e.target)) return;
  if (e.target.classList && e.target.classList.contains("word-chip")) return;
  popover.classList.add("hidden");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    popover.classList.add("hidden");
    return;
  }
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === "ArrowRight") {
    e.preventDefault();
    moveToSentence(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    moveToSentence(-1);
  } else if (e.key.toLowerCase() === "r") {
    e.preventDefault();
    resetCurrentSentence();
  }
});

/* ---------------- init ---------------- */

(function init() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);
  loadFromCache();
  updateMetaFor(inputMeta, fullText.value);
  updateMetaFor(outputMeta, finalOutput.value);
})();
