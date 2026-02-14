/* Small Wins - main.js (full replace)
 * Fixes:
 * 1) Mood is saved with each record and shown in lists + random modal
 * 2) Tag suggestion click will NOT create "##tag" (replace current #word near cursor)
 * Notes:
 * - Works with your current HTML ids:
 *   - clearWall (not searchClearBtn)
 *   - resetAllBtn (not clearAllBtn)
 * - quickTags container: if missing in HTML, it will be auto-created under the input box
 */
(() => {
  "use strict";

  // ---------- Storage ----------
  const STORAGE_KEY = "smallwins_items_v1";

  // ---------- Tag helpers ----------
  const TAG_RE = /#([\u4e00-\u9fa5A-Za-z0-9_]+)/g;
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

  // ---------- Utils ----------
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");
  const setText = (el, text) => el && (el.textContent = String(text ?? ""));
  const escapeHtml = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

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

  // ---------- Load / Save ----------
  /**
   * item shape:
   * { id, text, ts, done, tags, mood }
   */
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
          const done = !!x.done;
          const tags = Array.isArray(x.tags) && x.tags.length ? x.tags : extractTagsFromText(text);
          const mood = typeof x.mood === "string" ? x.mood : "";
          return { id, text, ts, done, tags, mood };
        })
        .filter((x) => x.text.length > 0);
    } catch (e) {
      console.warn("loadItems failed:", e);
      return [];
    }
  }

  function saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("saveItems failed:", e);
    }
  }

  let items = loadItems();

  // ---------- DOM ----------
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    home: $("page-home"),
    today: $("page-today"),
    wall: $("page-wall"),
    settings: $("page-settings"),
    random: $("page-random"), // optional
  };

  // Home
  const statAllEl = $("statAll");
  const recentListEl = $("recentList");
  const recentEmptyEl = $("recentEmpty");
  const goTodayBtn = $("goTodayBtn");
  const goWallBtn = $("goWallBtn");

  // Today
  const inputEl = $("achievementInput");
  const addBtn = $("addBtn");
  const todayListEl = $("todayList");
  const todayEmptyEl = $("todayEmpty");
  const clearTodayBtn = $("clearTodayBtn");
  const yesterdayListEl = $("yesterdayList");
  const yesterdayEmptyEl = $("yesterdayEmpty");

  // Mood
  const moodBtns = Array.from(document.querySelectorAll(".mood-row .mood"));
  let selectedMood = "";

  // Quick tags (auto-create if missing)
  let quickTagsEl = $("quickTags");

  // Wall
  const wallSearchEl = $("wallSearch") || document.querySelector("#page-wall input");
  const wallListEl = $("wallList");
  const wallEmptyEl = $("wallEmpty");
  const wallChipsEl = $("wallChips") || document.querySelector("#page-wall .chips");
  const wallClearBtnEl = $("clearWall"); // <-- your HTML uses clearWall

  // Settings
  const exportBtn = $("exportBtn");
  const exportText = $("exportText"); // optional
  const resetAllBtn = $("resetAllBtn"); // <-- your HTML uses resetAllBtn

  // Modal
  const randomBtn = $("randomBtn");
  const modalEl = $("modal");
  const modalMask = $("modalMask");
  const modalContent = $("modalContent");
  const modalAgainBtn = $("modalAgainBtn");
  const modalCloseBtn = $("modalCloseBtn");

  // ---------- Ensure quickTags container ----------
  function ensureQuickTagsContainer() {
    if (quickTagsEl) return quickTagsEl;
    if (!inputEl) return null;

    // find the card that contains input
    const card = inputEl.closest(".card");
    if (!card) return null;

    // create
    const div = document.createElement("div");
    div.id = "quickTags";
    div.className = "chips hidden";
    card.appendChild(div);

    quickTagsEl = div;
    return quickTagsEl;
  }

  // ---------- Core actions ----------
  function addItem(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    const tags = extractTagsFromText(t);
    const mood = String(selectedMood || "").trim();

    items.unshift({
      id: cryptoRandomId(),
      text: t,
      ts: Date.now(),
      done: false,
      tags,
      mood,
    });

    saveItems(items);
    return true;
  }

  function toggleDone(id) {
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    items[idx].done = !items[idx].done;
    saveItems(items);
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

  // ---------- Render list ----------
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

      if (!options.hideCheckbox) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!it.done;
        checkbox.addEventListener("change", () => {
          toggleDone(it.id);
          renderAll();
        });
        left.appendChild(checkbox);
      }

      // text + mood badge
      const textWrap = document.createElement("div");
      textWrap.className = "item-text" + (it.done ? " done" : "");

      const safeText = escapeHtml(it.text);

      // mood badge (if exists)
      const mood = String(it.mood || "").trim();
      if (mood) {
        // mood badge appended at end (you can style .mood-badge in CSS)
        textWrap.innerHTML = `${safeText} <span class="mood-badge">#${escapeHtml(mood)}</span>`;
      } else {
        textWrap.innerHTML = safeText;
      }

      left.appendChild(textWrap);

      const right = document.createElement("div");
      right.className = "item-right";

      const time = document.createElement("div");
      time.className = "item-time";
      time.textContent = formatTime(it.ts);
      right.appendChild(time);

      if (!options.hideDelete) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "ghost danger";
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

  // ---------- Home renders ----------
  function renderHomeHeader() {
    const dateEl = $("homeDate");
    const greetingEl = $("homeGreeting");
    const quoteEl = $("homeQuote");
    const streakEl = $("statStreak");

    const now = new Date();

    if (dateEl) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      dateEl.textContent = `${y}年${m}月${d}日`;
    }

    if (greetingEl) {
      const h = now.getHours();
      const hi = h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
      greetingEl.textContent = `${hi}，晨星`;
    }

    if (quoteEl) {
      const quotes = [
        "“哪怕只是把碗洗了，也是对生活的一次温柔重塑。”",
        "“把注意力放回当下这一小步，你就赢了。”",
        "“你不需要很厉害才开始，你需要开始才会变厉害。”",
        "“今天能完成一点点，就值得被认真对待。”",
      ];
      const idx = Math.floor(now.getTime() / (1000 * 60 * 60 * 24)) % quotes.length;
      quoteEl.textContent = quotes[idx];
    }

    if (streakEl) {
      const days = new Set(items.map((it) => new Date(it.ts).toDateString()));
      let streak = 0;
      for (let i = 0; ; i++) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000).toDateString();
        if (days.has(d)) streak++;
        else break;
      }
      streakEl.textContent = String(streak);
    }
  }

  function renderHomeRecent() {
    if (!recentListEl) return;
    const recent = items.slice(0, 5);
    renderList(recentListEl, recentEmptyEl, recent, { hideDelete: true, hideCheckbox: true });
  }

  function renderHomeStats() {
    if (statAllEl) setText(statAllEl, items.length);
  }

  // ---------- Today renders ----------
  function renderTodayPage() {
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 3600 * 1000);
    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));
    const yestItems = items.filter((x) => isSameDay(new Date(x.ts), yest));

    renderList(todayListEl, todayEmptyEl, todayItems);
    renderList(yesterdayListEl, yesterdayEmptyEl, yestItems, { hideDelete: false, hideCheckbox: false });
  }

  // ---------- Wall renders (search + chips) ----------
  function getTopTags(limit = 10) {
    const counter = new Map();
    for (const it of items) {
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

  function renderWallChips() {
    // if you already have static chips in HTML, we don't have to overwrite.
    // But to keep it consistent with your dynamic tags, we rebuild only if wallChipsEl exists AND empty.
    if (!wallChipsEl) return;

    // If HTML already has buttons, just keep them.
    const hasExisting = wallChipsEl.querySelector("button");
    if (hasExisting) return;

    const tags = getTopTags(8);
    wallChipsEl.innerHTML = "";
    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.chip = tag; // store raw tag (no #)
      btn.textContent = `#${tag}`;
      wallChipsEl.appendChild(btn);
    });
  }

  function renderWallSearch() {
    if (!wallListEl) return;

    // always search from latest saved list
    let list = loadItems();

    const qRaw = String(wallSearchEl?.value || "").trim();
    const q = qRaw.replace(/^#/, "");

    if (qRaw) {
      list = list.filter((it) => {
        const text = String(it?.text || "");
        const tags = Array.isArray(it?.tags) ? it.tags : extractTagsFromText(text);
        const mood = String(it?.mood || "");
        return (
          text.includes(qRaw) ||
          text.includes("#" + q) ||
          tags.includes(q) ||
          tags.some((t) => String(t).includes(q)) ||
          mood.includes(q) // allow mood search too
        );
      });
    }

    list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    renderList(wallListEl, wallEmptyEl, list, { hideCheckbox: false, hideDelete: false });
  }

  // ---------- Mood ----------
  function setMood(m) {
    selectedMood = String(m || "");
    moodBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === selectedMood);
    });
  }

  // ---------- Tag suggestion logic ----------
  function getCursorInfo(el) {
    const value = String(el.value || "");
    const pos = typeof el.selectionStart === "number" ? el.selectionStart : value.length;

    // find start of current token (split by whitespace)
    let start = pos;
    while (start > 0 && !/\s/.test(value[start - 1])) start--;

    // find end of token
    let end = pos;
    while (end < value.length && !/\s/.test(value[end])) end++;

    const token = value.slice(start, end);
    return { value, pos, start, end, token };
  }

  function replaceRange(el, start, end, text) {
    const value = String(el.value || "");
    el.value = value.slice(0, start) + text + value.slice(end);

    const newPos = start + text.length;
    try {
      el.setSelectionRange(newPos, newPos);
    } catch {}
  }

  // Insert tag by REPLACING current "#xxx" token near cursor.
  // This prevents "##生活".
  function applyTagSuggestion(tag) {
    if (!inputEl) return;

    const t = String(tag || "").replace(/^#/, "").trim();
    if (!t) return;

    const { start, end, token } = getCursorInfo(inputEl);

    // if current token starts with '#', replace it
    if (token.startsWith("#")) {
      replaceRange(inputEl, start, end, `#${t} `);
    } else {
      // otherwise append with a space
      const v = String(inputEl.value || "");
      const sep = v.trim().length === 0 || v.endsWith(" ") ? "" : " ";
      inputEl.value = v + sep + `#${t} `;
      try {
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
      } catch {}
    }

    inputEl.focus();
  }

  function shouldShowQuickTags() {
    if (!inputEl) return false;
    const { token } = getCursorInfo(inputEl);
    // show when user is typing a hashtag token (# or #生)
    return token.startsWith("#");
  }

  function renderQuickTags() {
    const el = ensureQuickTagsContainer();
    if (!el) return;

    if (!shouldShowQuickTags()) {
      hide(el);
      return;
    }

    const tags = getTopTags(8);
    el.innerHTML = "";

    if (!tags.length) {
      hide(el);
      return;
    }

    show(el);

    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.chip = tag; // raw
      btn.textContent = `#${tag}`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyTagSuggestion(tag); // ✅ no ## issue
        // after inserting, hide suggestions
        hide(el);
      });
      el.appendChild(btn);
    });
  }

  // ---------- Modal ----------
  function openModal() {
    if (!modalEl) return;
    modalEl.classList.remove("hidden");
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add("hidden");
  }
  function showRandomOne() {
    if (!modalContent) return;

    if (!items || items.length === 0) {
      modalContent.textContent = "还没有记录，先去首页记一条吧～";
      openModal();
      return;
    }

    const it = items[Math.floor(Math.random() * items.length)];
    const mood = String(it.mood || "").trim();

    modalContent.innerHTML = `
      <div style="font-size:18px; line-height:1.5; margin-bottom:8px;">
        ${escapeHtml(it.text)}
        ${mood ? ` <span class="mood-badge">#${escapeHtml(mood)}</span>` : ""}
      </div>
      <div style="opacity:.7; font-size:12px;">
        ${formatTime(it.ts)}
      </div>
    `;
    openModal();
  }

  // ---------- Navigation ----------
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
        // Random is modal
        if (t.id === "randomBtn") return;

        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    });
  }

  // ---------- Bindings ----------
  function bindInputAndButtons() {
    // mood
    moodBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = String(btn.dataset.mood || "");
        setMood(selectedMood === m ? "" : m);
      });
    });

    // add
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const v = String(inputEl?.value || "").trim();
        if (!v) {
          alert("先写点内容～");
          inputEl?.focus?.();
          return;
        }

        const ok = addItem(v);
        if (ok && inputEl) inputEl.value = "";

        // reset mood after submit (optional but usually desired)
        setMood("");

        renderAll();
        inputEl?.focus?.();
      });
    }

    // enter submit
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addBtn?.click?.();
        }
      });

      // show suggestions when user types '#'
      inputEl.addEventListener("focus", () => renderQuickTags());
      inputEl.addEventListener("input", () => renderQuickTags());
      inputEl.addEventListener("click", () => renderQuickTags());
    }

    // click outside closes quickTags
    document.addEventListener("click", (e) => {
      const el = ensureQuickTagsContainer();
      if (!el) return;
      // if click is outside input + quickTags
      if (e.target !== inputEl && !el.contains(e.target)) hide(el);
    });

    // quick jump
    if (goTodayBtn) goTodayBtn.addEventListener("click", () => showPage("today"));
    if (goWallBtn) goWallBtn.addEventListener("click", () => showPage("wall"));

    // random modal
    if (randomBtn) {
      randomBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showRandomOne();
      });
    }
    if (modalMask) modalMask.addEventListener("click", closeModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalAgainBtn) modalAgainBtn.addEventListener("click", showRandomOne);

    // clear today
    if (clearTodayBtn) {
      clearTodayBtn.addEventListener("click", () => {
        if (!confirm("确定清空今天的记录吗？")) return;
        clearToday();
        renderAll();
      });
    }

    // wall bindings (once)
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

        // chip may store raw tag or "#tag"
        const raw = String(btn.dataset.chip || btn.textContent || "").trim();
        const tag = raw.replace(/^#/, "");
        if (!wallSearchEl) return;

        const next = wallSearchEl.value.trim() === `#${tag}` || wallSearchEl.value.trim() === tag ? "" : `#${tag}`;
        wallSearchEl.value = next;
        renderWallSearch();
      });
    }

    // settings
    if (exportBtn) {
      exportBtn.onclick = () => {
        const data = JSON.stringify(items, null, 2);
        if (exportText) {
          exportText.value = data;
          exportText.focus();
          exportText.select();
        } else {
          navigator.clipboard?.writeText?.(data).catch(() => {});
          alert("已复制到剪贴板（如果浏览器允许）。");
        }
      };
    }

    if (resetAllBtn) {
      resetAllBtn.onclick = () => {
        if (!confirm("确定清空全部数据吗？此操作不可恢复。")) return;
        items = [];
        saveItems(items);
        renderAll();
      };
    }
  }

  // ---------- Render All ----------
  function renderAll() {
    // reload latest (in case other operations touched storage)
    items = loadItems();

    renderHomeHeader();
    renderHomeStats();
    renderHomeRecent();

    renderTodayPage();

    // wall
    renderWallSearch();
    renderWallChips();

    // quick tags should only show when typing hashtag
    renderQuickTags();
  }

  // ---------- Boot ----------
  function boot() {
    ensureQuickTagsContainer();

    bindTabs();
    bindInputAndButtons();

    showPage("home");
    renderAll();

    // debug helper
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
