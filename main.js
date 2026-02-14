/* Small Wins - main.js (stable + mood badge + no checkbox)
 * - Tabs navigation
 * - Add wins to localStorage
 * - Home/Today/Wall/Settings
 * - Random review modal
 * - Quick tags (#xxx) + wall search + chips
 * - Mood selection saved as item.mood and rendered as a badge (not #mood)
 * - Remove checkbox UI (since you already have delete + clear today)
 */
(() => {
  "use strict";

  // ---------- Storage ----------
  const STORAGE_KEY = "smallwins_items_v1";

  // ---------- Mood config ----------
  const MOOD_ICON = {
    平静: "🌙",
    愉悦: "✨",
    释然: "🌱",
    慵懒: "☁️",
  };

  function moodToIcon(mood) {
    return MOOD_ICON[mood] || "🙂";
  }

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
  /**
   * item schema:
   * { id, text, ts, done?, tags?, mood? }
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
          const mood = String(x.mood || "").trim(); // NEW: mood field
          const tags = Array.isArray(x.tags) && x.tags.length ? x.tags : extractTagsFromText(text);
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

  let items = loadItems().map(ensureTags);

  // ---------- DOM ----------
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    home: $("page-home"),
    today: $("page-today"),
    wall: $("page-wall"),
    settings: $("page-settings"),
    random: $("page-random"),
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
  const goRecordBtn = $("goRecordBtn");

  const randomBtn = $("randomBtn");

  // modal
  const modalEl = $("modal");
  const modalMask = $("modalMask");
  const modalContent = $("modalContent");
  const modalAgainBtn = $("modalAgainBtn");
  const modalCloseBtn = $("modalCloseBtn");

  // today list
  const todayListEl = $("todayList");
  const todayEmptyEl = $("todayEmpty");
  const clearTodayBtn = $("clearTodayBtn");

  // compat placeholders (may exist hidden)
  const yesterdayListEl = $("yesterdayList");
  const yesterdayEmptyEl = $("yesterdayEmpty");
  const historyWrapEl = $("historyWrap");
  const historyEmptyEl = $("historyEmpty");

  // wall (search + chips)
  const wallSearchEl = $("wallSearch") || document.querySelector("#page-wall input");
  const wallListEl = $("wallList");
  const wallEmptyEl = $("wallEmpty");
  const wallChipsEl = $("wallChips") || document.querySelector("#page-wall .chips");
  // 你的HTML里清空按钮 id 是 clearWall（不是 searchClearBtn）
  const wallClearBtnEl = $("clearWall") || $("searchClearBtn") || document.querySelector("#page-wall .input-box .ghost");

  // mood
  const moodBtns = Array.from(document.querySelectorAll(".mood-row .mood"));
  let selectedMood = "";

  // ---------- Core actions ----------
  function addItem(text, mood) {
    const t = String(text || "").trim();
    if (!t) return false;

    const m = String(mood || "").trim();

    items.unshift({
      id: cryptoRandomId(),
      text: t,
      ts: Date.now(),
      done: false,
      tags: extractTagsFromText(t),
      mood: m, // store mood separately
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

  // ---------- Rendering ----------
  function renderMoodBadge(it) {
  const mood = String(it?.mood || "").trim();
  if (!mood) return "";

  const icon = moodToIcon(mood);

  return `
    <span class="mood-pill">
      <span class="mood-ico">${escapeHtml(icon)}</span>
      <span class="mood-txt">${escapeHtml(mood)}</span>
    </span>
  `;
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

      const text = document.createElement("div");
      text.className = "item-text" + (it.done ? " done" : "");

      // ✅ mood badge + text
      const moodHtml = options.hideMood ? "" : renderMoodBadge(it);
      text.innerHTML = `${moodHtml}${escapeHtml(it.text)}`;

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
        del.className = "ghost danger"; // 复用你现有样式
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
    // 兼容：如果首页没放 statToday 也不报错
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
    renderList(recentListEl, recentEmptyEl, recent, { hideDelete: true });
  }

  function renderTodayPage() {
    const now = new Date();
    const todayItems = items.filter((x) => isSameDay(new Date(x.ts), now));
    renderList(todayListEl, todayEmptyEl, todayItems);

    // 兼容占位（不渲染也不报错）
    if (yesterdayListEl) yesterdayListEl.innerHTML = "";
    if (yesterdayEmptyEl) hide(yesterdayEmptyEl);
    if (historyWrapEl) historyWrapEl.innerHTML = "";
    if (historyEmptyEl) hide(historyEmptyEl);
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

  // ✅ 解决 “##生活” 的核心：插入 tag 时智能处理末尾的 #
  function insertTagToInput(tag) {
    if (!inputEl) return;

    const t = String(tag || "").replace(/^#/, ""); // 保证 tag 不带#
    const cur = String(inputEl.value || "");

    // 如果用户刚输入了 '#' 或 '# '，替换掉这部分再补标签
    // 例如 cur = "#" 或 "# " 或 "今天... #"
    let next = cur;

    // 把末尾的 "#"+可选空格去掉
    next = next.replace(/#\s*$/, "").trimEnd();

    const toAdd = `#${t}`;

    // 已经有了就不加
    if (next.includes(toAdd)) {
      inputEl.value = next;
      inputEl.focus();
      return;
    }

    const sep = next.trim().length === 0 ? "" : " ";
    inputEl.value = next + sep + toAdd + " ";
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
      btn.textContent = `#${tag}`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertTagToInput(tag);
      });
      quickTagsEl.appendChild(btn);
    }
  }

  // wall search: also matches mood
  function renderWallSearch() {
    if (!wallListEl) return;

    let list = loadItems().map(ensureTags);
    const qRaw = String(wallSearchEl?.value || "").trim();
    const q = qRaw.replace(/^#/, "");

    if (qRaw) {
      list = list.filter((it) => {
        const text = String(it?.text || "");
        const tags = Array.isArray(it?.tags) ? it.tags : [];
        const mood = String(it?.mood || "");
        return (
          text.includes(qRaw) ||
          text.includes("#" + q) ||
          tags.includes(q) ||
          tags.some((t) => String(t).includes(q)) ||
          mood.includes(q) ||
          mood.includes(qRaw)
        );
      });
    }

    list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    renderList(wallListEl, wallEmptyEl, list);
  }

  function renderWallChips() {
    if (!wallChipsEl) return;

    // 如果你的 HTML 里本来就写死了一堆 chip（运动/阅读…），
    // 这里就不强行覆盖；只在空的时候生成
    if (wallChipsEl.children && wallChipsEl.children.length > 0) return;

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

    // 你的 HTML 里是 resetAllBtn，不是 clearAllBtn
    const resetAllBtn = $("resetAllBtn") || $("clearAllBtn");
    if (resetAllBtn) {
      resetAllBtn.onclick = () => {
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
    const moodHtml = renderMoodBadge(it);

    modalContent.innerHTML = `
      <div style="font-size:18px; line-height:1.5; margin-bottom:8px;">
        ${moodHtml}${escapeHtml(it.text)}
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
        if (t.id === "randomBtn") return;
        const pageKey = t.getAttribute("data-page") || t.dataset.page;
        if (!pageKey) return;
        showPage(pageKey);
      });
    });
  }

  // ---------- Mood ----------
  function setMood(m) {
    selectedMood = String(m || "");
    moodBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === selectedMood);
    });
  }

  // ---------- Bindings ----------
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

        const ok = addItem(v, selectedMood);
        if (ok && inputEl) inputEl.value = "";

        // ✅ 记录后清空心情选中（你也可以注释掉这两行，让它保留上次心情）
        setMood("");
        selectedMood = "";

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

      // quick tags show logic:
      // - focus show once
      // - when contains '#', show suggestions
      inputEl.addEventListener("focus", () => {
        renderQuickTags();
        if (quickTagsEl) show(quickTagsEl);
      });

      inputEl.addEventListener("input", () => {
        const v = String(inputEl.value || "");
        if (v.includes("#")) {
          renderQuickTags();
          if (quickTagsEl) show(quickTagsEl);
        } else {
          if (quickTagsEl) hide(quickTagsEl);
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
        const raw = String(btn.dataset.chip || btn.textContent || "").trim();
        if (!wallSearchEl) return;
        wallSearchEl.value = wallSearchEl.value.trim() === raw ? "" : raw;
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
      setMood,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
