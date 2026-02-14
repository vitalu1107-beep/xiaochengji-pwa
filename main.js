/* Small Wins - main.js (stable, mood-as-field)
 * ✅ Tabs navigation
 * ✅ Add wins to localStorage
 * ✅ Home/Today/Wall/Settings
 * ✅ Random review modal
 * ✅ Quick tags (#xxx) + wall search + chips
 * ✅ Mood is stored as item.mood (NOT as #tag), rendered as "mood-pill"
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

  function ensureTags(item) {
    if (!item) return item;
    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      item.tags = extractTagsFromText(item.text);
    }
    return item;
  }

  // ---------- Utils ----------
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
      return crypto?.randomUUID
        ? crypto.randomUUID()
        : "id_" + Math.random().toString(16).slice(2);
    } catch {
      return "id_" + Math.random().toString(16).slice(2);
    }
  }
  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
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

  // Mood meta for list badge
  function moodMeta(mood) {
    const map = {
      平静: { icon: "🌙", cls: "calm" },
      愉悦: { icon: "✨", cls: "happy" },
      释然: { icon: "🌱", cls: "relaxed" },
      慵懒: { icon: "☁️", cls: "lazy" },
    };
    return map[mood] || { icon: "💭", cls: "neutral" };
  }

  // ---------- Load / Save ----------
  /** @returns {{id:string,text:string,ts:number,done?:boolean,tags?:string[],mood?:string}[]} */
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
          const mood = String(x.mood || "").trim(); // ✅ mood field
          const tags =
            Array.isArray(x.tags) && x.tags.length
              ? x.tags
              : extractTagsFromText(text);
          return { id, text, ts, done, tags, mood };
        })
        .filter((x) => x.text.length > 0);
    } catch (e) {
      console.warn("loadItems failed:", e);
      return [];
    }
  }

  /** @param {any[]} items */
  function saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("saveItems failed:", e);
    }
  }

  let items = loadItems().map(ensureTags);

  // ---------- DOM ----------
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    home: $("page-home"),
    today: $("page-today"),
    wall: $("page-wall"),
    settings: $("page-settings"),
    random: $("page-random"), // optional
  };

  const inputEl = $("achievementInput");
  const addBtn = $("addBtn");
  const quickTagsEl = $("quickTags"); // optional: if you have it

  const statTodayEl = $("statToday"); // optional
  const statAllEl = $("statAll");
  const recentListEl = $("recentList");
  const recentEmptyEl = $("recentEmpty");

  const goTodayBtn = $("goTodayBtn");
  const goWallBtn = $("goWallBtn");
  const goRecordBtn = $("goRecordBtn"); // optional

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
  const yesterdayListEl = $("yesterdayList");
  const yesterdayEmptyEl = $("yesterdayEmpty");
  const clearTodayBtn = $("clearTodayBtn");

  // wall (history grouped) - optional
  const historyWrapEl = $("historyWrap");
  const historyEmptyEl = $("historyEmpty");

  // wall (search + chips)
  const wallSearchEl = $("wallSearch") || document.querySelector("#page-wall input");
  const wallListEl = $("wallList");
  const wallEmptyEl = $("wallEmpty");
  const wallChipsEl = $("wallChips") || document.querySelector("#page-wall .chips");
  const wallClearBtnEl =
    $("clearWall") || $("searchClearBtn") || document.querySelector("#page-wall .input-box button.ghost");

  // mood
  const moodBtns = Array.from(document.querySelectorAll(".mood-row .mood"));
  let selectedMood = "";

  // ---------- Core actions ----------
  function addItem(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    // ✅ IMPORTANT: mood is stored as field, NOT as "#mood" in text/tags
    items.unshift({
      id: cryptoRandomId(),
      text: t,
      ts: Date.now(),
      done: false,
      tags: extractTagsFromText(t),
      mood: selectedMood || "",
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

  // ---------- Rendering ----------
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

      // checkbox
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

      // ✅ mood badge (pill) - shown like your "left style", NOT a #tag
      const mood = String(it.mood || "").trim();
      if (mood) {
        const meta = moodMeta(mood);
        const badge = document.createElement("span");
        badge.className = `mood-pill ${meta.cls}`;
        badge.innerHTML = `<span class="mood-ico">${meta.icon}</span><span class="mood-txt">${escapeHtml(mood)}</span>`;
        left.appendChild(badge);
      }

      // text
      const text = document.createElement("div");
      text.className = "item-text" + (it.done ? " done" : "");
      text.innerHTML = escapeHtml(it.text);
      left.appendChild(text);

      // right
      const right = document.createElement("div");
      right.className = "item-right";

      const time = document.createElement("div");
      time.className = "item-time";
      time.textContent = formatTime(it.ts);
      right.appendChild(time);

      if (!options.hideDelete) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-danger";
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

  function renderStats() {
    const today = new Date();
    const todayCount = items.filter((x) => isSameDay(new Date(x.ts), today)).length;
    setText(statTodayEl, todayCount);
    setText(statAllEl, items.length);
  }

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
    renderList(recentListEl, recentEmptyEl, recent, {
      hideDelete: true,
      hideCheckbox: true,
    });
  }

  function renderTodayPage() {
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 3600 * 1000);
    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));
    const yestItems = items.filter((x) => isSameDay(new Date(x.ts), yest));

    renderList(todayListEl, todayEmptyEl, todayItems);
    renderList(yesterdayListEl, yesterdayEmptyEl, yestItems, { hideDelete: false });
  }

  function renderWallPageGrouped() {
    if (!historyWrapEl) return;

    historyWrapEl.innerHTML = "";

    if (!items.length) {
      if (historyEmptyEl) show(historyEmptyEl);
      return;
    }
    if (historyEmptyEl) hide(historyEmptyEl);

    const groups = new Map();
    for (const it of items) {
      const d = new Date(it.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    }

    const keys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));
    for (const key of keys) {
      const section = document.createElement("section");
      section.className = "history-section";

      const h = document.createElement("div");
      h.className = "history-title";
      h.textContent = key;

      const list = document.createElement("div");
      list.className = "history-list";

      section.appendChild(h);
      section.appendChild(list);
      historyWrapEl.appendChild(section);

      renderList(list, null, groups.get(key));
    }
  }

  // ---------- Quick tags ----------
  function getTopTags(limit = 8) {
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

  // ✅ Insert tag without "##"
  function insertTagToInput(tag) {
    if (!inputEl) return;
    const rawTag = String(tag || "").replace(/^#/, "").trim();
    if (!rawTag) return;

    const cur = String(inputEl.value || "");
    const toAdd = `#${rawTag}`;

    // If already included, do nothing
    if (cur.includes(toAdd)) return;

    // If user already typed trailing '#', avoid double '#'
    // e.g. current "... #" + click tag -> "... #生活 "
    const curTrimEnd = cur.replace(/\s+$/, "");
    const endsWithHash = /#$/.test(curTrimEnd);

    let next = cur;

    if (endsWithHash) {
      // remove trailing '#', keep a single '#'
      next = curTrimEnd.slice(0, -1);
      // ensure single space before #
      if (next.length && !/\s$/.test(next)) next += " ";
      next += `#${rawTag} `;
    } else {
      const sep = cur.trim().length === 0 ? "" : " ";
      next = cur + sep + `#${rawTag} `;
    }

    inputEl.value = next;
    inputEl.focus();
  }

  function renderQuickTags() {
    if (!quickTagsEl) return;

    const tags = getTopTags(8);
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
      btn.dataset.chip = tag; // store raw
      btn.textContent = `#${tag}`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertTagToInput(tag);
      });
      quickTagsEl.appendChild(btn);
    }
  }

  // ---------- Wall search + chips ----------
  function renderWallSearch() {
    if (!wallListEl) return;

    let list = loadItems().map(ensureTags);
    const qRaw = String(wallSearchEl?.value || "").trim();
    const q = qRaw.replace(/^#/, "");

    if (qRaw) {
      list = list.filter((it) => {
        const text = String(it?.text || "");
        const tags = Array.isArray(it?.tags) ? it.tags : [];
        // ✅ also allow searching mood by plain text (optional)
        const mood = String(it?.mood || "");
        return (
          text.includes(qRaw) ||
          text.includes("#" + q) ||
          tags.includes(q) ||
          tags.some((t) => String(t).includes(q)) ||
          mood.includes(qRaw) ||
          mood.includes(q)
        );
      });
    }

    list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    renderList(wallListEl, wallEmptyEl, list);
  }

  function renderWallChips() {
    if (!wallChipsEl) return;

    // If your HTML already has chips, you can keep them and just bind click.
    // But if you want auto chips by history tags, uncomment the next 3 lines.
    // wallChipsEl.innerHTML = "";
    // const tags = getTopTags(10);
    // tags.forEach(tag => { ... });

    // For safety, we won't overwrite existing chips unless you want.
  }

  function renderSettingsPage() {
    const exportBtn = $("exportBtn");
    const exportText = $("exportText");
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

    // ✅ compatible with both ids: resetAllBtn (your HTML) / clearAllBtn (older)
    const clearAllBtn = $("resetAllBtn") || $("clearAllBtn");
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        if (!confirm("确定清空全部记录吗？此操作不可恢复。")) return;
        items = [];
        saveItems(items);
        renderAll();
      };
    }
  }

  function renderAll() {
    renderStats();
    renderHomeHeader();
    renderHomeRecent();
    renderTodayPage();
    renderWallPageGrouped();
    renderWallSearch();
    renderWallChips();
    renderSettingsPage();
    renderQuickTags();
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
    const moodLine = mood ? ` · ${escapeHtml(mood)}` : "";

    modalContent.innerHTML = `
      <div style="font-size:18px; line-height:1.5; margin-bottom:8px;">
        ${escapeHtml(it.text)}
      </div>
      <div style="opacity:.7; font-size:12px;">
        ${formatTime(it.ts)}${moodLine}
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
      try {
        renderWallSearch();
      } catch (e) {
        console.warn("showPage(wall) failed:", e);
      }
    }
  }

  function bindTabs() {
    tabs.forEach((t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();
        // randomBtn is modal, not a page
        if (t.id === "randomBtn" || t.getAttribute("data-page") === "random") return;

        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    });
  }

  // ---------- Input / Mood / Buttons ----------
  function setMood(m) {
    selectedMood = String(m || "").trim();
    moodBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === selectedMood);
    });
  }

  function bindInputAndButtons() {
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

        // ✅ optional: reset mood after submit
        setMood("");
        renderAll();
        inputEl?.focus?.();
      });
    }

    // mood buttons
    moodBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mood || "";
        setMood(selectedMood === m ? "" : m);
      });
    });

    // enter submit
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addBtn?.click?.();
        }
      });

      // quick tags: show when focusing or typing '#'
      inputEl.addEventListener("focus", () => {
        renderQuickTags();
        if (quickTagsEl) show(quickTagsEl);
      });

      inputEl.addEventListener("input", () => {
        if ((inputEl.value || "").includes("#")) {
          renderQuickTags();
          if (quickTagsEl) show(quickTagsEl);
        }
      });
    }

    // quick jump
    if (goTodayBtn) goTodayBtn.addEventListener("click", () => showPage("today"));
    if (goWallBtn) goWallBtn.addEventListener("click", () => showPage("wall"));
    if (goRecordBtn) goRecordBtn.addEventListener("click", () => showPage("today"));

    // random modal
    if (randomBtn) {
      randomBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showRandomOne();
      });
    }

    // modal events
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

    // click outside closes quickTags
    document.addEventListener("click", () => {
      if (!quickTagsEl) return;
      hide(quickTagsEl);
    });
    if (quickTagsEl) {
      quickTagsEl.addEventListener("click", (e) => e.stopPropagation());
    }

    // wall search bindings (once)
    if (wallSearchEl && wallSearchEl.dataset.bound !== "1") {
      wallSearchEl.dataset.bound = "1";
      wallSearchEl.addEventListener("input", () => renderWallSearch());
    }

    // wall clear button (your HTML uses id="clearWall")
    if (wallClearBtnEl && wallClearBtnEl.dataset.bound !== "1") {
      wallClearBtnEl.dataset.bound = "1";
      wallClearBtnEl.addEventListener("click", () => {
        if (wallSearchEl) wallSearchEl.value = "";
        renderWallSearch();
      });
    }

    // wall chips click
    if (wallChipsEl && wallChipsEl.dataset.bound !== "1") {
      wallChipsEl.dataset.bound = "1";
      wallChipsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button.chip");
        if (!btn) return;
        const tagRaw = String(btn.dataset.chip || btn.textContent || "").trim();
        const tag = tagRaw.replace(/^#/, ""); // normalize
        if (!wallSearchEl) return;

        const next = `#${tag}`;
        wallSearchEl.value = wallSearchEl.value.trim() === next ? "" : next;
        renderWallSearch();
      });
    }
  }

  // ---------- Boot ----------
  function boot() {
    bindTabs();
    bindInputAndButtons();

    showPage("home");
    renderAll();

    // debug helpers
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
      addItem,
      setMood, // for debugging mood UI
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
