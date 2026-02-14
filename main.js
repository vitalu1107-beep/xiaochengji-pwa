/* Small Wins - main.js (clean stable)
 * - Tabs navigation
 * - Add wins to localStorage
 * - Home/Today/Wall/Settings
 * - Random review modal
 * - Quick tags (#xxx) + wall search + chips
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
  /** @returns {{id:string,text:string,ts:number,done?:boolean,tags?:string[]}[]} */
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
          return { id, text, ts, done, tags };
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
    // 兼容：如果你还有 random/settings 之外页面，不存在也不崩
    random: $("page-random"),
  };

  const inputEl = $("achievementInput");
  const addBtn = $("addBtn");
  const quickTagsEl = $("quickTags");

  const statTodayEl = $("statToday");
  const statAllEl = $("statAll");
  const recentListEl = $("recentList");
  const recentEmptyEl = $("recentEmpty");

  const goTodayBtn = $("goTodayBtn");
  const goWallBtn = $("goWallBtn");
  const goRecordBtn = $("goRecordBtn"); // 你说“复用 today”，这里直接跳 today

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

  // wall (history grouped)
  const historyWrapEl = $("historyWrap");
  const historyEmptyEl = $("historyEmpty");

  // wall (search + chips)
  const wallSearchEl = $("wallSearch") || document.querySelector("#page-wall input");
  const wallListEl = $("wallList");
  const wallEmptyEl = $("wallEmpty");
  const wallChipsEl = $("wallChips") || document.querySelector("#page-wall .chips");
  const wallClearBtnEl = $("searchClearBtn") || document.querySelector("#page-wall button.ghost");

  // mood
  const moodBtns = Array.from(document.querySelectorAll(".mood-row .mood"));
  let selectedMood = "";

  // ---------- Core actions ----------
  function addItem(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    items.unshift({
      id: cryptoRandomId(),
      text: t,
      ts: Date.now(),
      done: false,
      tags: extractTagsFromText(t),
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

      let checkbox = null;
      if (!options.hideCheckbox) {
        checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!it.done;
        checkbox.addEventListener("change", () => {
          toggleDone(it.id);
          renderAll();
        });
        left.appendChild(checkbox);
      }

      const text = document.createElement("div");
      text.className = "item-text" + (it.done ? " done" : "");
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
    renderList(recentListEl, recentEmptyEl, recent, { hideDelete: true, hideCheckbox: true });
  }

  function renderTodayPage() {
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 3600 * 1000);
    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));
    const yestItems = items.filter((x) => isSameDay(new Date(x.ts), yest));
    renderList(todayListEl, todayEmptyEl, todayItems);
    renderList(yesterdayListEl, yesterdayEmptyEl, yestItems);
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
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
        2,
        "0"
      )}`;
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

  function insertTagToInput(tag) {
    if (!inputEl) return;
    const cur = inputEl.value || "";
    const toAdd = `#${tag}`;
    if (cur.includes(toAdd)) return;
    const sep = cur.trim().length === 0 ? "" : " ";
    inputEl.value = cur + sep + toAdd + " ";
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

  function renderWallSearch() {
    if (!wallListEl) return;

    let list = loadItems().map(ensureTags);
    const qRaw = String(wallSearchEl?.value || "").trim();
    const q = qRaw.replace(/^#/, "");

    if (qRaw) {
      list = list.filter((it) => {
        const text = String(it?.text || "");
        const tags = Array.isArray(it?.tags) ? it.tags : [];
        return (
          text.includes(qRaw) ||
          text.includes("#" + q) ||
          tags.includes(q) ||
          tags.some((t) => String(t).includes(q))
        );
      });
    }

    list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    renderList(wallListEl, wallEmptyEl, list);
  }

  function renderWallChips() {
    if (!wallChipsEl) return;
    wallChipsEl.innerHTML = "";
    const tags = getTopTags(10);
    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.chip = `#${tag}`;
      btn.textContent = `#${tag}`;
      wallChipsEl.appendChild(btn);
    });
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

    const clearAllBtn = $("clearAllBtn");
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
    modalContent.innerHTML = `
      <div style="font-size:18px; line-height:1.5; margin-bottom:8px;">
        ${escapeHtml(it.text)}
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

    // 切到 wall 时：刷新一次搜索/ chips（避免旧数据）
    if (pageKey === "wall") {
      try {
        renderWallSearch();
        renderWallChips();
      } catch (e) {
        console.warn("showPage(wall) failed:", e);
      }
    }
  }

  function bindTabs() {
    tabs.forEach((t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();
        // randomBtn 是单独弹窗，不走页面
        if (t.id === "randomBtn" || t.getAttribute("data-page") === "random") return;

        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    });
  }

  // ---------- Input / Mood / Buttons ----------
  function setMood(m) {
    selectedMood = String(m || "");
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
        renderAll();
        inputEl?.focus?.();
      });
    }

    // mood
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

      // quick tags hint
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
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
