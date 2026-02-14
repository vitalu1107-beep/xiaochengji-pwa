/* main.js — Small Wins PWA (stable, GitHub Pages friendly)
 * ✅ Tabs navigation
 * ✅ LocalStorage items
 * ✅ Mood select (stored as mood + shown as pill, NOT #tag)
 * ✅ Tags: quick suggestion after typing # ; click inserts ONLY ONE # (no ##)
 * ✅ Today list: no checkbox, keep delete + clear today
 * ✅ Random review modal
 *
 * Requires HTML ids/classes you already have:
 * - pages: #page-home #page-today #page-wall #page-settings
 * - tabs: .tab[data-page], #randomBtn
 * - input: #achievementInput, #addBtn
 * - mood: .mood-row .mood (data-mood, text includes emoji)
 * - today list: #todayList #todayEmpty #clearTodayBtn
 * - home: #homeDate #homeGreeting #homeQuote #statStreak #statAll #recentList #recentEmpty #goTodayBtn #goWallBtn
 * - wall: #wallSearch #wallList #wallEmpty #wallChips #clearWall
 * - modal: #modal #modalMask #modalContent #modalAgainBtn #modalCloseBtn
 * - toast: #toast (optional)
 *
 * Optional: quick tags container #quickTags (if not present, it won’t break)
 */

(() => {
  "use strict";

  // -----------------------------
  // Storage
  // -----------------------------
  const STORAGE_KEY = "smallwins_items_v2";

  // -----------------------------
  // Helpers
  // -----------------------------
  const TAG_RE = /#([\u4e00-\u9fa5A-Za-z0-9_]+)/g;

  function extractTags(text) {
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

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

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

  function cryptoId() {
    try {
      return crypto?.randomUUID ? crypto.randomUUID() : "id_" + Math.random().toString(16).slice(2);
    } catch {
      return "id_" + Math.random().toString(16).slice(2);
    }
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function dayStartMs(d) {
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

  function parseMoodLabel(btnEl) {
    // Button text like: "🌙 平静"
    const raw = String(btnEl?.textContent || "").trim();
    const m = String(btnEl?.dataset?.mood || "").trim();
    // icon = first grapheme-ish
    const icon = raw ? raw.split(/\s+/)[0] : "";
    const label = m || raw.replace(icon, "").trim() || raw;
    return { icon, label };
  }

  // -----------------------------
  // Load / Save
  // -----------------------------
  /** @returns {{id:string,text:string,ts:number,tags:string[],mood?:{key:string,icon?:string,label?:string}}[]} */
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];

      return arr
        .filter((x) => x && typeof x === "object")
        .map((x) => {
          const id = String(x.id || cryptoId());
          const text = String(x.text || "").trim();
          const ts = Number(x.ts || Date.now());
          const tags = Array.isArray(x.tags) && x.tags.length ? x.tags : extractTags(text);

          let mood = undefined;
          if (x.mood && typeof x.mood === "object") {
            const key = String(x.mood.key || "").trim();
            if (key) {
              mood = {
                key,
                icon: String(x.mood.icon || "").trim(),
                label: String(x.mood.label || "").trim(),
              };
            }
          }
          return { id, text, ts, tags, mood };
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

  // -----------------------------
  // DOM
  // -----------------------------
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    home: $("page-home"),
    today: $("page-today"),
    wall: $("page-wall"),
    settings: $("page-settings"),
  };

  // home
  const recentListEl = $("recentList");
  const recentEmptyEl = $("recentEmpty");
  const goTodayBtn = $("goTodayBtn");
  const goWallBtn = $("goWallBtn");
  const statAllEl = $("statAll");
  const streakEl = $("statStreak");

  // today
  const inputEl = $("achievementInput");
  const addBtn = $("addBtn");
  const todayListEl = $("todayList");
  const todayEmptyEl = $("todayEmpty");
  const clearTodayBtn = $("clearTodayBtn");
  const toastEl = $("toast");

  // mood
  const moodBtns = Array.from(document.querySelectorAll(".mood-row .mood"));
  let selectedMoodKey = ""; // stores dataset.mood
  let selectedMoodIcon = "";
  let selectedMoodLabel = "";

  // quick tags (optional)
  const quickTagsEl = $("quickTags"); // if not present, fine

  // wall
  const wallSearchEl = $("wallSearch");
  const wallListEl = $("wallList");
  const wallEmptyEl = $("wallEmpty");
  const wallChipsEl = $("wallChips");
  const clearWallBtn = $("clearWall");

  // modal
  const randomBtn = $("randomBtn");
  const modalEl = $("modal");
  const modalMask = $("modalMask");
  const modalContent = $("modalContent");
  const modalAgainBtn = $("modalAgainBtn");
  const modalCloseBtn = $("modalCloseBtn");

  // -----------------------------
  // Navigation
  // -----------------------------
  function setActiveTab(pageKey) {
    tabs.forEach((t) => {
      const k = t.getAttribute("data-page") || t.dataset.page;
      t.classList.toggle("active", k === pageKey);
    });
  }

  function showPage(pageKey) {
    Object.values(pages).forEach(hide);
    show(pages[pageKey]);
    setActiveTab(pageKey);

    if (pageKey === "wall") {
      renderWallChips();
      renderWallSearch();
    }
  }

  function bindTabs() {
    tabs.forEach((t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();

        // random is modal
        if (t.id === "randomBtn") return;

        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    });
  }

  // -----------------------------
  // Mood
  // -----------------------------
  function setMoodByKey(key) {
    selectedMoodKey = String(key || "").trim();

    if (!selectedMoodKey) {
      selectedMoodIcon = "";
      selectedMoodLabel = "";
      moodBtns.forEach((b) => b.classList.remove("active"));
      return;
    }

    const btn = moodBtns.find((b) => (b.dataset.mood || "") === selectedMoodKey);
    const meta = parseMoodLabel(btn);

    selectedMoodIcon = meta.icon;
    selectedMoodLabel = meta.label;

    moodBtns.forEach((b) => b.classList.toggle("active", (b.dataset.mood || "") === selectedMoodKey));
  }

  function bindMood() {
    moodBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const k = String(btn.dataset.mood || "").trim();
        if (!k) return;

        // toggle off if same
        if (selectedMoodKey === k) setMoodByKey("");
        else setMoodByKey(k);
      });
    });
  }

  // -----------------------------
  // Add / Delete / Clear today
  // -----------------------------
  function addItem(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    const record = {
      id: cryptoId(),
      text: t,
      ts: Date.now(),
      tags: extractTags(t),
      mood: selectedMoodKey
        ? { key: selectedMoodKey, icon: selectedMoodIcon, label: selectedMoodLabel }
        : undefined,
    };

    items.unshift(record);
    saveItems(items);
    return true;
  }

  function deleteItem(id) {
    items = items.filter((x) => x.id !== id);
    saveItems(items);
  }

  function clearToday() {
    const today0 = dayStartMs(new Date());
    items = items.filter((x) => x.ts < today0);
    saveItems(items);
  }

  function toast(msg = "已记录 ✅") {
    if (!toastEl) return;
    toastEl.textContent = msg;
    show(toastEl);
    setTimeout(() => hide(toastEl), 900);
  }

  // -----------------------------
  // Render pieces
  // -----------------------------
  function renderHomeHeader() {
    const dateEl = $("homeDate");
    const greetingEl = $("homeGreeting");
    const quoteEl = $("homeQuote");

    const now = new Date();

    if (dateEl) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      dateEl.textContent = `${y}年${m}月${d}日`;
    }

    if (greetingEl) {
      // Default name if you later want to personalize: store in localStorage "smallwins_user_name"
      const storedName = String(localStorage.getItem("smallwins_user_name") || "").trim();
      const name = storedName || "晨星";

      const h = now.getHours();
      const hi = h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
      greetingEl.textContent = `${hi}，${name}`;
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

    if (statAllEl) setText(statAllEl, items.length);
  }

  function renderRecent() {
    if (!recentListEl) return;

    recentListEl.innerHTML = "";
    const recent = items.slice(0, 5);

    if (!recent.length) {
      show(recentEmptyEl);
      return;
    }
    hide(recentEmptyEl);

    for (const it of recent) {
      const li = document.createElement("li");
      li.className = "item";

      const text = document.createElement("div");
      text.className = "item-text";
      text.innerHTML = renderInlineText(it);

      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = formatTime(it.ts);

      const left = document.createElement("div");
      left.appendChild(text);
      left.appendChild(meta);

      li.appendChild(left);
      recentListEl.appendChild(li);
    }
  }

  function renderInlineText(it) {
    // mood pill + text (keep #tags inside text)
    const moodHtml = it.mood?.key
      ? `<span class="mood-pill ${moodClass(it.mood.key)}"><span class="mood-ico">${escapeHtml(
          it.mood.icon || ""
        )}</span><span class="mood-txt">${escapeHtml(it.mood.label || it.mood.key)}</span></span>`
      : "";

    return `${moodHtml}${escapeHtml(it.text)}`;
  }

  function moodClass(key) {
    // map your 4 moods to classes in your CSS block
    // calm/happy/relaxed/lazy/neutral
    const k = String(key || "");
    if (k.includes("平静")) return "calm";
    if (k.includes("愉悦")) return "happy";
    if (k.includes("释然")) return "relaxed";
    if (k.includes("慵懒")) return "lazy";
    return "neutral";
  }

  function renderTodayList() {
    if (!todayListEl) return;
    todayListEl.innerHTML = "";

    const now = new Date();
    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));

    if (!todayItems.length) {
      show(todayEmptyEl);
      return;
    }
    hide(todayEmptyEl);

    for (const it of todayItems) {
      const li = document.createElement("li");
      li.className = "item";

      const left = document.createElement("div");
      left.className = "item-text";
      left.innerHTML = renderInlineText(it);

      const right = document.createElement("div");
      right.style.textAlign = "right";

      const time = document.createElement("div");
      time.className = "item-meta";
      time.textContent = formatTime(it.ts);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger ghost";
      del.textContent = "删除";
      del.addEventListener("click", () => {
        if (!confirm("确定删除这条记录吗？")) return;
        deleteItem(it.id);
        renderAll();
      });

      right.appendChild(time);
      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);

      todayListEl.appendChild(li);
    }
  }

  // -----------------------------
  // Quick tags (click inserts correctly)
  // -----------------------------
  function getTopTags(limit = 8) {
    const counter = new Map();
    items.forEach((it) => {
      (it.tags || extractTags(it.text)).forEach((t) => {
        const key = String(t).trim();
        if (!key) return;
        counter.set(key, (counter.get(key) || 0) + 1);
      });
    });
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }

  function insertTagIntoInput(tag) {
    if (!inputEl) return;

    const t = String(tag || "").replace(/^#/, "").trim();
    if (!t) return;

    const v = String(inputEl.value || "");
    const cursor = inputEl.selectionStart ?? v.length;

    // find nearest '#' before cursor for "suggest"
    const hashPos = v.lastIndexOf("#", cursor - 1);

    // If we are in "#xxx" typing mode, replace that token with "#tag"
    if (hashPos >= 0) {
      // token ends at cursor or next whitespace
      const before = v.slice(0, hashPos);
      const afterFromHash = v.slice(hashPos); // starts with #
      const match = afterFromHash.match(/^#[^\s]*/); // "#生活"
      const token = match ? match[0] : "#";
      const after = v.slice(hashPos + token.length);

      const sepAfter = after.startsWith(" ") ? "" : " ";
      const next = `${before}#${t}${sepAfter}${after}`.replace(/\s+/g, " ");
      inputEl.value = next;

      // set cursor after inserted tag + space
      const newPos = (before + `#${t} `).length;
      inputEl.setSelectionRange(newPos, newPos);
      inputEl.focus();
      return;
    }

    // otherwise append with spacing, ensure no "##"
    const sep = v.trim().length ? " " : "";
    inputEl.value = `${v}${sep}#${t} `;
    inputEl.focus();
  }

  function renderQuickTags() {
    if (!quickTagsEl) return;

    const v = String(inputEl?.value || "");
    // only show when user is typing '#'
    if (!v.includes("#")) {
      hide(quickTagsEl);
      quickTagsEl.innerHTML = "";
      return;
    }

    const tags = getTopTags(8);
    quickTagsEl.innerHTML = "";

    if (!tags.length) {
      hide(quickTagsEl);
      return;
    }

    show(quickTagsEl);
    tags.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = `#${t}`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertTagIntoInput(t);
      });
      quickTagsEl.appendChild(btn);
    });
  }

  // -----------------------------
  // Wall search + chips
  // -----------------------------
  function renderWallChips() {
    if (!wallChipsEl) return;
    wallChipsEl.innerHTML = "";

    const tags = getTopTags(10);
    tags.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.chip = `#${t}`;
      btn.textContent = `#${t}`;
      wallChipsEl.appendChild(btn);
    });
  }

  function renderWallSearch() {
    if (!wallListEl) return;

    const qRaw = String(wallSearchEl?.value || "").trim();
    const q = qRaw.replace(/^#/, "");

    let list = [...items];

    if (qRaw) {
      list = list.filter((it) => {
        const text = String(it.text || "");
        const tags = it.tags || extractTags(text);
        const mood = it.mood?.key || it.mood?.label || "";

        return (
          text.includes(qRaw) ||
          text.includes("#" + q) ||
          tags.includes(q) ||
          tags.some((x) => String(x).includes(q)) ||
          String(mood).includes(q) // allow search mood by word
        );
      });
    }

    list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));

    wallListEl.innerHTML = "";
    if (!list.length) {
      show(wallEmptyEl);
      return;
    }
    hide(wallEmptyEl);

    list.forEach((it) => {
      const li = document.createElement("li");
      li.className = "item";

      const left = document.createElement("div");
      left.className = "item-text";
      left.innerHTML = renderInlineText(it);

      const right = document.createElement("div");
      right.style.textAlign = "right";

      const time = document.createElement("div");
      time.className = "item-meta";
      time.textContent = formatTime(it.ts);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger ghost";
      del.textContent = "删除";
      del.addEventListener("click", () => {
        if (!confirm("确定删除这条记录吗？")) return;
        deleteItem(it.id);
        renderAll();
      });

      right.appendChild(time);
      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);

      wallListEl.appendChild(li);
    });
  }

  function bindWall() {
    if (wallSearchEl && wallSearchEl.dataset.bound !== "1") {
      wallSearchEl.dataset.bound = "1";
      wallSearchEl.addEventListener("input", renderWallSearch);
    }

    if (clearWallBtn && clearWallBtn.dataset.bound !== "1") {
      clearWallBtn.dataset.bound = "1";
      clearWallBtn.addEventListener("click", () => {
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

  // -----------------------------
  // Modal
  // -----------------------------
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

    if (!items.length) {
      modalContent.textContent = "还没有记录，先去记录一条吧～";
      openModal();
      return;
    }

    const it = items[Math.floor(Math.random() * items.length)];
    modalContent.innerHTML = `
      <div style="font-size:18px; line-height:1.5; margin-bottom:8px;">
        ${renderInlineText(it)}
      </div>
      <div style="opacity:.7; font-size:12px;">
        ${escapeHtml(formatTime(it.ts))}
      </div>
    `;
    openModal();
  }

  // -----------------------------
  // Bind inputs/buttons
  // -----------------------------
  function bindInput() {
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const v = String(inputEl?.value || "").trim();
        if (!v) {
          alert("先写点内容～");
          inputEl?.focus?.();
          return;
        }

        const ok = addItem(v);
        if (ok) {
          if (inputEl) inputEl.value = "";
          // reset mood after posting (common habit)
          setMoodByKey("");
          toast("已记录 ✅");
          renderAll();
          inputEl?.focus?.();
        }
      });
    }

    if (inputEl) {
      // Enter to submit (Shift+Enter newline)
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addBtn?.click?.();
        }
      });

      // quick tags show logic
      inputEl.addEventListener("input", () => renderQuickTags());
      inputEl.addEventListener("focus", () => renderQuickTags());
    }

    if (goTodayBtn) goTodayBtn.addEventListener("click", () => showPage("today"));
    if (goWallBtn) goWallBtn.addEventListener("click", () => showPage("wall"));

    if (clearTodayBtn) {
      clearTodayBtn.addEventListener("click", () => {
        if (!confirm("确定清空今天的记录吗？")) return;
        clearToday();
        renderAll();
      });
    }

    // click outside closes quickTags
    document.addEventListener("click", () => {
      if (!quickTagsEl) return;
      hide(quickTagsEl);
    });
    if (quickTagsEl) quickTagsEl.addEventListener("click", (e) => e.stopPropagation());

    // modal
    if (randomBtn) randomBtn.addEventListener("click", (e) => (e.preventDefault(), showRandomOne()));
    if (modalMask) modalMask.addEventListener("click", closeModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalAgainBtn) modalAgainBtn.addEventListener("click", showRandomOne);
  }

  // -----------------------------
  // Render all
  // -----------------------------
  function renderAll() {
    renderHomeHeader();
    renderRecent();
    renderTodayList();
    renderWallChips();
    renderWallSearch();
    renderQuickTags();
  }

  // -----------------------------
  // Boot
  // -----------------------------
  function boot() {
    bindTabs();
    bindMood();
    bindInput();
    bindWall();

    showPage("home");
    renderAll();

    // debug
    window.__smallwins = {
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
      setMoodByKey,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
