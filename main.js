/* Small Wins - main.js (PWA friendly, GitHub Pages friendly)
 * ✅ Tabs navigation
 * ✅ Add wins to localStorage
 * ✅ Home/Today/Wall/Settings
 * ✅ Random review modal
 * ✅ Tags: #xxx + quick tags (no double ##)
 * ✅ Mood select + render as pill (not #tag)
 * ✅ No checkbox (clean list) + single delete + clear today
 * ✅ Profile name (prompt once) + editable in Settings
 */
(() => {
  "use strict";

  // =========================
  // Storage Keys
  // =========================
  const STORAGE_KEY = "smallwins_items_v2";     // records
  const PROFILE_KEY = "smallwins_profile_v1";   // { name: "xxx" }

  // =========================
  // Helpers
  // =========================
  const TAG_RE = /#([\u4e00-\u9fa5A-Za-z0-9_]+)/g;

  function $(id) {
    return document.getElementById(id);
  }
  function show(el) {
    if (el) el.classList.remove("hidden");
  }
  function hide(el) {
    if (el) el.classList.add("hidden");
  }
  function setText(el, text) {
    if (el) el.textContent = String(text ?? "");
  }
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function cryptoRandomId() {
    try {
      return crypto?.randomUUID ? crypto.randomUUID() : "id_" + Math.random().toString(16).slice(2);
    } catch {
      return "id_" + Math.random().toString(16).slice(2);
    }
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  function formatTime(ts) {
    const d = new Date(Number(ts) || Date.now());
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${mi}`;
  }
  function nowDateCN() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}年${m}月${dd}日`;
  }
  function getGreetingPrefix() {
    const h = new Date().getHours();
    return h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  }

  // =========================
  // Profile
  // =========================
  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveProfile(p) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p || {}));
    } catch {}
  }
  function ensureProfileName() {
    const p = loadProfile();
    if (p && p.name && String(p.name).trim()) return p;

    // prompt once (only when missing)
    const n = prompt("给自己取个昵称吧（用于问候语）", "夏央");
    const name = (n || "").trim() || "你";
    const next = { ...(p || {}), name };
    saveProfile(next);
    return next;
  }

  // =========================
  // Tags
  // =========================
  function extractTagsFromText(text) {
    const s = String(text || "");
    const tags = [];
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(s)) !== null) {
      const t = String(m[1] || "").trim();
      if (t && !tags.includes(t)) tags.push(t);
    }
    return tags;
  }

  // when user clicks a tag suggestion, avoid "##生活"
  function insertTagToInput(tag) {
    if (!inputEl) return;
    const rawTag = String(tag || "").trim().replace(/^#/, "");
    if (!rawTag) return;

    const cur = inputEl.value || "";
    const want = `#${rawTag}`;

    // If already has #tag, do nothing
    if (cur.includes(want)) return;

    // If cursor ended with "#", replace that trailing "#" with "#tag "
    // Otherwise append with a space.
    const trimmed = cur.replace(/\s+$/, "");
    if (/#$/.test(trimmed)) {
      inputEl.value = trimmed.slice(0, -1) + want + " ";
    } else {
      const sep = trimmed.length ? " " : "";
      inputEl.value = trimmed + sep + want + " ";
    }
    inputEl.focus();
  }

  function getTopTags(itemsArr, limit = 8) {
    const counter = new Map();
    for (const it of itemsArr) {
      const tags = Array.isArray(it.tags) && it.tags.length ? it.tags : extractTagsFromText(it.text);
      for (const t of tags) {
        const key = String(t).trim();
        if (!key) continue;
        counter.set(key, (counter.get(key) || 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }

  // =========================
  // Mood
  // =========================
  const MOOD_META = {
    平静: { icon: "🌙", cls: "calm" },
    愉悦: { icon: "✨", cls: "happy" },
    释然: { icon: "🌱", cls: "relaxed" },
    慵懒: { icon: "☁️", cls: "lazy" },
  };
  function moodToMeta(mood) {
    const key = String(mood || "").trim();
    return MOOD_META[key] || { icon: "🙂", cls: "neutral" };
  }

  // =========================
  // Load / Save Items
  // item: {id, text, ts, mood?, tags?}
  // =========================
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x) => x && typeof x === "object")
        .map((x) => {
          const id = String(x.id || cryptoRandomId());
          const text = String(x.text || "").trim();
          const ts = Number(x.ts || Date.now());
          const mood = String(x.mood || "").trim();
          const tags = Array.isArray(x.tags) && x.tags.length ? x.tags : extractTagsFromText(text);
          return { id, text, ts, mood, tags };
        })
        .filter((x) => x.text.length > 0);
    } catch (e) {
      console.warn("loadItems failed:", e);
      return [];
    }
  }

  function saveItems(itemsArr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsArr));
    } catch (e) {
      console.warn("saveItems failed:", e);
    }
  }

  let items = loadItems();

  // =========================
  // DOM refs (match your HTML)
  // =========================
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    home: $("page-home"),
    today: $("page-today"),
    wall: $("page-wall"),
    settings: $("page-settings"),
  };

  const inputEl = $("achievementInput");
  const addBtn = $("addBtn");
  const quickTagsEl = $("quickTags"); // if exists, will render suggestions; if not, safe

  const statAllEl = $("statAll");
  const recentListEl = $("recentList");
  const recentEmptyEl = $("recentEmpty");

  const goTodayBtn = $("goTodayBtn");
  const goWallBtn = $("goWallBtn");
  const randomBtn = $("randomBtn");

  // modal
  const modalEl = $("modal");
  const modalMask = $("modalMask");
  const modalContent = $("modalContent");
  const modalAgainBtn = $("modalAgainBtn");
  const modalCloseBtn = $("modalCloseBtn");

  // today
  const todayListEl = $("todayList");
  const todayEmptyEl = $("todayEmpty");
  const clearTodayBtn = $("clearTodayBtn");

  // wall
  const wallSearchEl = $("wallSearch") || document.querySelector("#page-wall input");
  const wallListEl = $("wallList");
  const wallEmptyEl = $("wallEmpty");
  const wallChipsEl = $("wallChips") || document.querySelector("#page-wall .chips");
  const wallClearBtnEl = $("clearWall") || document.querySelector("#page-wall button.ghost");

  // mood buttons
  const moodBtns = Array.from(document.querySelectorAll(".mood-row .mood"));
  let selectedMood = "";

  // settings elements (optional)
  const exportBtn = $("exportBtn");
  const resetAllBtn = $("resetAllBtn");
  // optional name UI (if exists in settings)
  const nameInputEl = $("nameInput");
  const saveNameBtn = $("saveNameBtn");
  const editNameBtn = $("editNameBtn"); // optional

  // =========================
  // Core actions
  // =========================
  function addItem(text, mood) {
    const t = String(text || "").trim();
    if (!t) return false;

    items.unshift({
      id: cryptoRandomId(),
      text: t,
      ts: Date.now(),
      mood: String(mood || "").trim(),
      tags: extractTagsFromText(t),
    });
    saveItems(items);
    return true;
  }

  function deleteItem(id) {
    items = items.filter((x) => x.id !== id);
    saveItems(items);
  }

  function clearToday() {
    const today0 = dayStart(new Date());
    items = items.filter((x) => x.ts < today0);
    saveItems(items);
  }

  // =========================
  // Rendering: list item block (no checkbox)
  // =========================
  function makeMoodPill(mood) {
    const m = String(mood || "").trim();
    if (!m) return null;

    const meta = moodToMeta(m);
    const pill = document.createElement("span");
    pill.className = `mood-pill ${meta.cls}`;
    pill.innerHTML = `<span class="mood-ico">${escapeHtml(meta.icon)}</span><span class="mood-txt">${escapeHtml(m)}</span>`;
    return pill;
  }

  function renderList(containerEl, emptyEl, listItems, options = {}) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    if (!listItems.length) {
      if (emptyEl) show(emptyEl);
      return;
    }
    if (emptyEl) hide(emptyEl);

    for (const it of listItems) {
      const row = document.createElement("div");
      row.className = "item";

      const left = document.createElement("div");
      left.className = "item-left";

      // Mood pill (left)
      const moodPill = makeMoodPill(it.mood);
      if (moodPill) left.appendChild(moodPill);

      // text
      const text = document.createElement("div");
      text.className = "item-text";
      text.innerHTML = escapeHtml(it.text);
      left.appendChild(text);

      const right = document.createElement("div");
      right.className = "item-right";

      const time = document.createElement("div");
      time.className = "item-time";
      time.textContent = formatTime(it.ts);
      right.appendChild(time);

      if (!options.hideDelete) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "danger ghost";
        del.textContent = "删除";
        del.addEventListener("click", () => {
          if (!confirm("确定删除这条记录吗？")) return;
          deleteItem(it.id);
          renderAll();
        });
        right.appendChild(del);
      }

      row.appendChild(left);
      row.appendChild(right);
      containerEl.appendChild(row);
    }
  }

  function renderHomeHeader() {
    const dateEl = $("homeDate");
    const greetingEl = $("homeGreeting");
    const quoteEl = $("homeQuote");
    const streakEl = $("statStreak");

    if (dateEl) dateEl.textContent = nowDateCN();

    if (greetingEl) {
      const p = loadProfile();
      const name = (p.name || "你").trim() || "你";
      greetingEl.textContent = `${getGreetingPrefix()}，${name}`;
    }

    if (quoteEl) {
      const quotes = [
        "“哪怕只是把碗洗了，也是对生活的一次温柔重塑。”",
        "“把注意力放回当下这一小步，你就赢了。”",
        "“你不需要很厉害才开始，你需要开始才会变厉害。”",
        "“今天能完成一点点，就值得被认真对待。”",
      ];
      const idx = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % quotes.length;
      quoteEl.textContent = quotes[idx];
    }

    if (streakEl) {
      const today = new Date();
      const days = new Set(items.map((it) => new Date(it.ts).toDateString()));
      let streak = 0;
      for (let i = 0; ; i++) {
        const d = new Date(today.getTime() - i * 24 * 3600 * 1000).toDateString();
        if (days.has(d)) streak++;
        else break;
      }
      streakEl.textContent = String(streak);
    }
  }

  function renderHomeRecent() {
    if (!recentListEl) return;
    const recent = items.slice(0, 5);
    renderList(recentListEl, recentEmptyEl, recent, { hideDelete: true });
  }

  function renderTodayPage() {
    const now = new Date();
    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));
    renderList(todayListEl, todayEmptyEl, todayItems);
  }

  function renderWallSearch() {
    if (!wallListEl) return;
    let list = loadItems(); // refresh from storage
    const qRaw = String(wallSearchEl?.value || "").trim();

    const q = qRaw.replace(/^#/, "");
    if (qRaw) {
      list = list.filter((it) => {
        const text = String(it.text || "");
        const tags = Array.isArray(it.tags) ? it.tags : extractTagsFromText(text);
        const hitText = text.includes(qRaw);
        const hitTag = q ? (text.includes("#" + q) || tags.includes(q) || tags.some((t) => String(t).includes(q))) : false;
        const hitMood = String(it.mood || "").includes(qRaw) || (q && String(it.mood || "").includes(q));
        return hitText || hitTag || hitMood;
      });
    }

    list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    renderList(wallListEl, wallEmptyEl, list);
  }

  function renderWallChips() {
    if (!wallChipsEl) return;
    wallChipsEl.innerHTML = "";
    const tags = getTopTags(items, 10);

    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.chip = `#${tag}`;
      btn.textContent = `#${tag}`;
      wallChipsEl.appendChild(btn);
    });
  }

  function renderQuickTags() {
    if (!quickTagsEl) return;

    const tags = getTopTags(items, 8);
    quickTagsEl.innerHTML = "";

    if (!tags.length) {
      hide(quickTagsEl);
      return;
    }

    show(quickTagsEl);

    for (const tag of tags) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.chip = `#${tag}`;
      btn.textContent = `#${tag}`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertTagToInput(tag);
      });
      quickTagsEl.appendChild(btn);
    }
  }

  function renderStats() {
    setText(statAllEl, items.length);
  }

  function renderSettingsPage() {
    // Export
    if (exportBtn && exportBtn.dataset.bound !== "1") {
      exportBtn.dataset.bound = "1";
      exportBtn.addEventListener("click", async () => {
        const data = JSON.stringify(items, null, 2);
        try {
          await navigator.clipboard.writeText(data);
          alert("已复制到剪贴板 ✅");
        } catch {
          alert("复制失败：可能浏览器限制。你可以打开控制台复制。");
          console.log(data);
        }
      });
    }

    // Reset all
    if (resetAllBtn && resetAllBtn.dataset.bound !== "1") {
      resetAllBtn.dataset.bound = "1";
      resetAllBtn.addEventListener("click", () => {
        if (!confirm("确定清空全部数据吗？此操作不可恢复。")) return;
        items = [];
        saveItems(items);
        renderAll();
      });
    }

    // Optional: name edit UI in settings (if you later add it)
    // HTML suggestion (optional):
    // <div class="input-box">
    //   <input id="nameInput" placeholder="你的昵称" />
    //   <button id="saveNameBtn" class="ghost" type="button">保存昵称</button>
    // </div>
    if (nameInputEl) {
      const p = loadProfile();
      if (!nameInputEl.dataset.inited) {
        nameInputEl.dataset.inited = "1";
        nameInputEl.value = String(p.name || "");
      }
    }
    if (saveNameBtn && saveNameBtn.dataset.bound !== "1") {
      saveNameBtn.dataset.bound = "1";
      saveNameBtn.addEventListener("click", () => {
        const n = String(nameInputEl?.value || "").trim() || "你";
        const p = loadProfile();
        saveProfile({ ...p, name: n });
        alert("昵称已保存 ✅");
        renderHomeHeader();
      });
    }

    // Optional: edit button anywhere (if exists)
    if (editNameBtn && editNameBtn.dataset.bound !== "1") {
      editNameBtn.dataset.bound = "1";
      editNameBtn.addEventListener("click", () => {
        const p = loadProfile();
        const n = prompt("修改昵称", p.name || "夏央");
        if (n == null) return;
        saveProfile({ ...p, name: n.trim() || "你" });
        renderHomeHeader();
      });
    }
  }

  function renderAll() {
    renderStats();
    renderHomeHeader();
    renderHomeRecent();
    renderTodayPage();
    renderWallSearch();
    renderWallChips();
    renderSettingsPage();
    renderQuickTags();
  }

  // =========================
  // Modal
  // =========================
  function openModal() {
    if (modalEl) modalEl.classList.remove("hidden");
  }
  function closeModal() {
    if (modalEl) modalEl.classList.add("hidden");
  }
  function showRandomOne() {
    if (!modalContent) return;

    if (!items.length) {
      modalContent.textContent = "还没有记录，先去记录微光写一条吧～";
      openModal();
      return;
    }
    const it = items[Math.floor(Math.random() * items.length)];
    const moodMeta = moodToMeta(it.mood);
    const moodLine = it.mood
      ? `<div style="margin-bottom:8px; font-size:14px; opacity:.9;">${escapeHtml(moodMeta.icon)} ${escapeHtml(it.mood)}</div>`
      : "";

    modalContent.innerHTML = `
      ${moodLine}
      <div style="font-size:18px; line-height:1.55; margin-bottom:8px;">
        ${escapeHtml(it.text)}
      </div>
      <div style="opacity:.7; font-size:12px;">
        ${formatTime(it.ts)}
      </div>
    `;
    openModal();
  }

  // =========================
  // Navigation
  // =========================
  function setActiveTab(pageKey) {
    for (const t of tabs) {
      const k = t.getAttribute("data-page") || t.dataset.page;
      if (k === pageKey) t.classList.add("active");
      else t.classList.remove("active");
    }
  }

  function showPage(pageKey) {
    Object.values(pages).forEach(hide);
    show(pages[pageKey]);
    setActiveTab(pageKey);

    if (pageKey === "wall") {
      renderWallSearch();
      renderWallChips();
    }
  }

  function bindTabs() {
    tabs.forEach((t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();

        // random modal (not a page)
        if (t.id === "randomBtn") return;

        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    });
  }

  // =========================
  // Mood
  // =========================
  function setMood(m) {
    selectedMood = String(m || "");
    moodBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === selectedMood);
    });
  }

  // =========================
  // Bind UI
  // =========================
  function bindInputAndButtons() {
    // Add record
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const v = String(inputEl?.value || "").trim();
        if (!v) {
          alert("先写点内容～");
          inputEl?.focus?.();
          return;
        }

        const ok = addItem(v, selectedMood);
        if (ok && inputEl) inputEl.value = "";

        // reset mood after submit (optional)
        setMood("");

        renderAll();
        inputEl?.focus?.();
      });
    }

    // Enter submit (textarea: Enter = submit, Shift+Enter = newline)
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addBtn?.click?.();
        }
      });

      inputEl.addEventListener("focus", () => {
        renderQuickTags();
        if (quickTagsEl) show(quickTagsEl);
      });

      inputEl.addEventListener("input", () => {
        // only show suggestions when user is typing tags
        if ((inputEl.value || "").includes("#")) {
          renderQuickTags();
          if (quickTagsEl) show(quickTagsEl);
        }
      });
    }

    // Mood clicks
    moodBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const m = btn.dataset.mood || "";
        setMood(selectedMood === m ? "" : m);
      });
    });

    // Quick jump buttons on home
    if (goTodayBtn) goTodayBtn.addEventListener("click", () => showPage("today"));
    if (goWallBtn) goWallBtn.addEventListener("click", () => showPage("wall"));

    // Random modal
    if (randomBtn) {
      randomBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showRandomOne();
      });
    }

    // Modal events
    if (modalMask) modalMask.addEventListener("click", closeModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalAgainBtn) modalAgainBtn.addEventListener("click", showRandomOne);

    // Clear today
    if (clearTodayBtn) {
      clearTodayBtn.addEventListener("click", () => {
        if (!confirm("确定清空今天的记录吗？")) return;
        clearToday();
        renderAll();
      });
    }

    // Click outside closes quickTags
    document.addEventListener("click", () => {
      if (!quickTagsEl) return;
      hide(quickTagsEl);
    });
    if (quickTagsEl) {
      quickTagsEl.addEventListener("click", (e) => e.stopPropagation());
    }

    // Wall search
    if (wallSearchEl && wallSearchEl.dataset.bound !== "1") {
      wallSearchEl.dataset.bound = "1";
      wallSearchEl.addEventListener("input", () => renderWallSearch());
    }
    if (wallClearBtnEl && wallClearBtnEl.dataset.bound !== "1") {
      wallClearBtnEl.dataset.bound = "1";
      wallClearBtnEl.addEventListener("click", () => {
        if (wallSearchEl) wallSearchEl.value = "";
        renderWallSearch();
      });
    }
    if (wallChipsEl && wallChipsEl.dataset.bound !== "1") {
      wallChipsEl.dataset.bound = "1";
      wallChipsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button.chip");
        if (!btn) return;
        const tag = String(btn.dataset.chip || btn.textContent || "").trim();
        if (!wallSearchEl) return;
        wallSearchEl.value = wallSearchEl.value.trim() === tag ? "" : tag;
        renderWallSearch();
      });
    }
  }

  // =========================
  // Boot
  // =========================
  function boot() {
    // Ensure profile name exists (prompt once)
    ensureProfileName();

    bindTabs();
    bindInputAndButtons();

    showPage("home");
    renderAll();

    // debug
    window.__smallwins = {
      loadItems,
      saveItems,
      get items() {
        return items;
      },
      set items(v) {
        items = Array.isArray(v) ? v : items;
        saveItems(items);
        renderAll();
      },
      loadProfile,
      saveProfile,
      renderAll,
      showPage,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
