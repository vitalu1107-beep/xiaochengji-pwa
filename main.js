/* Small Wins · Apple-like runtime with local media, wall views, and review deck. */
(() => {
  const LS_KEY = "smallwins_records_v1";
  const LS_NICK = "smallwins_nickname_v1";
  const LS_ENERGY = "smallwins_energy_v1";
  const DEFAULT_ENERGY = "把一件小事，做得刚刚好。";
  const MEDIA = (typeof globalThis !== "undefined" && globalThis.SmallWinsMedia) || {
    MAX_IMAGES_PER_RECORD: 3,
    extractTags(text) {
      const seen = new Set();
      return [...String(text || "").matchAll(/[#＃]([^\s#＃]+)/g)]
        .map((m) => m[1].replace(/[，。！？,.!?;；:：]+$/g, ""))
        .filter((tag) => tag && !seen.has(tag) && seen.add(tag));
    },
    normalizeRecord(record) {
      const value = record && typeof record === "object" ? record : {};
      return { ...value, tags: Array.isArray(value.tags) ? [...new Set(value.tags)] : this.extractTags(value.text), mediaIds: Array.isArray(value.mediaIds) ? value.mediaIds : [] };
    },
    validateImageMeta(file) { return Boolean(file && /^image\/(jpeg|png|webp)$/i.test(file.type || "") && Number.isFinite(file.size) && file.size <= 8 * 1024 * 1024); },
    createReviewDeck(ids) {
      let order = [...ids], index = -1;
      const shuffle = () => { for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } index = -1; };
      shuffle();
      return { next() { if (!order.length) return null; if (index + 1 >= order.length) shuffle(); return order[++index]; }, previous() { if (index > 0) index -= 1; return order[index] || null; }, current() { return order[index] || null; }, position() { return Math.max(0, index + 1); }, size() { return order.length; }, reset: shuffle };
    },
    createIndexedDbMediaStore() { return { async put() { throw new Error("media store unavailable"); }, async get() { return null; }, async getMeta() { return null; }, async deleteMany() {}, async clear() {}, async estimate() { return { usage: 0, quota: 0 }; } }; },
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const pad2 = (n) => String(n).padStart(2, "0");
  const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const formatDateCN = (date) => `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日`;
  const greetingByHour = (hour) => hour < 6 ? "凌晨好" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  let lastNickname = "夏央";
  let composing = false;
  let records = [];
  let selectedMood = null;
  let editingRecordId = null;
  let pendingImages = [];
  let wallView = "time";
  let activeWallTag = "";
  let reviewDeck = MEDIA.createReviewDeck([]);
  let reviewSignature = "";
  let currentRandomId = null;
  let completedReviewCycle = false;
  let reviewExitTimer = null;
  let reviewPendingDirection = null;

  const MOODS = { calm: { label: "平静" }, happy: { label: "愉悦" }, relaxed: { label: "释然" }, lazy: { label: "慵懒" } };

  const homeDateEl = $("#home-date"); const homeGreetingEl = $("#home-greeting"); const homeQuoteEl = $("#home-quote"); const statStreakEl = $("#stat-streak"); const statStreakSubEl = $("#stat-streak-sub"); const statHappyEl = $("#stat-happy"); const statHappySubEl = $("#stat-happy-sub"); const recentListEl = $("#recent-list"); const recentEmptyEl = $("#recent-empty");
  const inputTextEl = $("#input-text"); const tagSuggestEl = $("#tag-suggest"); const composeToolsBtn = $("#btn-compose-tools"); const composeMenuEl = $("#compose-menu"); const addTagBtn = $("#btn-add-tag"); const moodGroupEl = $("#mood-group"); const saveBtnEl = $("#btn-save"); const cancelEditBtn = $("#btn-cancel-edit"); const imageInputEl = $("#image-input"); const addImageBtn = $("#btn-add-image"); const imagePreviewEl = $("#image-preview"); const todayListEl = $("#today-list"); const todayEmptyEl = $("#today-empty"); const clearTodayBtn = $("#btn-clear-today");
  const wallSearchEl = $("#wall-search"); const wallListEl = $("#wall-list"); const wallEmptyEl = $("#wall-empty"); const wallClearBtn = $("#btn-wall-clear"); const wallClearInputBtn = $("#btn-wall-clear-input"); const wallTagFiltersEl = $("#wall-tag-filters");
  const randomCardEl = $("#random-card"); const randomTextEl = $("#random-text"); const randomTimeEl = $("#random-time"); const randomMoodEl = $("#random-mood"); const randomMediaEl = $("#random-media"); const randomPositionEl = $("#random-position"); const randomPrevBtn = $("#btn-random-prev"); const randomNextBtn = $("#btn-random-next"); const randomReshuffleBtn = $("#btn-random-reshuffle");
  const installBtn = $("#btn-install"); const installTip = $("#install-tip"); const nicknameInput = $("#nickname-input"); const nicknamePreview = $("#nickname-preview"); const saveNickBtn = $("#btn-save-nickname"); const energyInput = $("#energy-input"); const energyPreview = $("#energy-preview"); const saveEnergyBtn = $("#btn-save-energy"); const exportBtn = $("#btn-export"); const backupBtn = $("#btn-backup"); const clearAllBtn = $("#btn-clear-all"); const storageUsageEl = $("#storage-usage");
  const modalEl = $("#modal"); const modalTitleEl = $("#modal-title"); const modalBodyEl = $("#modal-body"); const modalMediaEl = $("#modal-media"); const modalEditBtn = $("#modal-edit");
  const mediaStore = MEDIA.createIndexedDbMediaStore(typeof indexedDB !== "undefined" ? indexedDB : null);

  const mascotElements = {
    home: $("#mascot-home"),
    record: $("#mascot-record"),
    wall: $("#mascot-wall"),
    review: $("#mascot-review"),
    settings: $("#mascot-settings"),
  };
  const mascotTimers = new Map();
  const mascotLastTrigger = new Map();
  const MASCOT_COOLDOWN_MS = 1200;
  const MASCOT_STATE_MS = 420;
  const MASCOT_STATES = ["enter", "peek", "listen", "point", "celebrate", "swipe-left", "swipe-right", "empty"];
  const mascotPageByView = { "page-home": "home", "page-today": "record", "page-wall": "wall", "page-random": "review", "page-settings": "settings" };
  let mascotInteractionsBound = false;
  let activeMascotPage = null;

  function resetMascot(page) {
    const element = mascotElements[page];
    if (!element) return;
    const timer = mascotTimers.get(page);
    if (timer) clearTimeout(timer);
    mascotTimers.delete(page);
    MASCOT_STATES.forEach((state) => element.classList.remove(`mascot-state-${state}`));
    element.removeAttribute("data-mascot-state");
  }

  function triggerMascot(page, state = "enter") {
    const element = mascotElements[page];
    if (!element || !MASCOT_STATES.includes(state)) return false;
    const now = Date.now();
    const last = mascotLastTrigger.get(page) || 0;
    if (now - last < MASCOT_COOLDOWN_MS) return false;
    const timer = mascotTimers.get(page);
    if (timer) clearTimeout(timer);
    MASCOT_STATES.forEach((name) => element.classList.remove(`mascot-state-${name}`));
    element.classList.add(`mascot-state-${state}`);
    element.dataset.mascotState = state;
    mascotLastTrigger.set(page, now);
    mascotTimers.set(page, setTimeout(() => {
      resetMascot(page);
    }, MASCOT_STATE_MS));
    return true;
  }

  function bindMascotInteractions() {
    if (mascotInteractionsBound) return;
    mascotInteractionsBound = true;
    inputTextEl?.addEventListener("focus", () => triggerMascot("record", "peek"));
    inputTextEl?.addEventListener("input", () => { if (!composing && inputTextEl.value.trim()) triggerMascot("record", "listen"); });
    composeToolsBtn?.addEventListener("click", () => triggerMascot("record", "point"));
    $$("#wall-view-toggle [data-view]").forEach((button) => button.addEventListener("click", () => triggerMascot("wall", "peek")));
  }

  function toast(message) {
    let element = $("#__toast");
    if (!element) { element = document.createElement("div"); element.id = "__toast"; element.style.position = "fixed"; element.style.left = "50%"; element.style.bottom = "22px"; element.style.transform = "translateX(-50%)"; element.style.background = "rgba(20,20,20,.92)"; element.style.color = "#fff"; element.style.padding = "10px 14px"; element.style.borderRadius = "999px"; element.style.fontSize = "14px"; element.style.zIndex = "99999"; element.style.maxWidth = "80vw"; element.style.textAlign = "center"; element.style.display = "none"; document.body.appendChild(element); }
    element.textContent = message; element.style.display = "block"; clearTimeout(element.__timer); element.__timer = setTimeout(() => { element.style.display = "none"; }, 1600);
  }

  function loadRecords() {
    try { const raw = localStorage.getItem(LS_KEY); const list = raw ? JSON.parse(raw) : []; if (!Array.isArray(list) || list.some((record) => !record || typeof record.id !== "string" || typeof record.text !== "string" || typeof record.dateKey !== "string" || typeof record.timeText !== "string" || !Number.isFinite(record.ts))) return null; return list.map((record) => MEDIA.normalizeRecord(record)); }
    catch { return null; }
  }
  function refreshRecords() { const latest = loadRecords(); if (!latest) return false; records = latest; ensureReviewDeck(); return true; }
  function changeRecords(update) { const latest = loadRecords(); if (!latest) { toast("暂时无法读取本地记录，原数据未改动。请检查浏览器存储。"); return false; } const next = update(latest).map((record) => MEDIA.normalizeRecord(record)); try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { toast("保存失败，本地存储可能已满或被禁用。请保留输入后重试。"); return false; } records = next; ensureReviewDeck(); return true; }
  function getNickname() { try { return localStorage.getItem(LS_NICK) || "夏央"; } catch { return lastNickname; } }
  function setNickname(value) { try { localStorage.setItem(LS_NICK, value); } catch { toast("昵称保存失败，请检查浏览器本地存储。"); return false; } lastNickname = value; return true; }
  function getEnergy() { try { return localStorage.getItem(LS_ENERGY) || DEFAULT_ENERGY; } catch { return DEFAULT_ENERGY; } }
  function setEnergy(value) { const next = String(value || "").trim().slice(0, 80); if (!next) { toast("今日能量不能为空"); return false; } try { localStorage.setItem(LS_ENERGY, next); } catch { toast("今日能量保存失败，请检查浏览器本地存储。"); return false; } return true; }
  function calcStreak(list) { const dates = new Set(list.map((record) => record.dateKey)); const today = new Date(); let day = new Date(today.getFullYear(), today.getMonth(), today.getDate()); let streak = 0; while (dates.has(toDateKey(day))) { streak += 1; day.setDate(day.getDate() - 1); } return streak; }
  function cleanupMedia(ids) { if (ids?.length) void mediaStore.deleteMany(ids).catch(() => {}); }

  function makeMediaItem(blob, name = "图片") { const wrapper = document.createElement("div"); wrapper.className = "media-item"; const image = document.createElement("img"); image.alt = name; image.loading = "lazy"; if (blob) { if (typeof URL !== "undefined" && URL.createObjectURL) image.src = URL.createObjectURL(blob); else if (typeof blob === "string") image.src = blob; } wrapper.appendChild(image); return wrapper; }
  async function hydrateMedia(container, record) { if (!container || !record?.mediaIds?.length) return; container.innerHTML = ""; for (const id of record.mediaIds.slice(0, MEDIA.MAX_IMAGES_PER_RECORD || 3)) { try { const blob = await mediaStore.get(id); if (blob) container.appendChild(makeMediaItem(blob)); } catch {} } }
  function renderPendingImages() { if (!imagePreviewEl) return; imagePreviewEl.innerHTML = ""; pendingImages.forEach((item, index) => { const wrapper = document.createElement("div"); wrapper.className = "image-preview-item"; const image = document.createElement("img"); image.alt = item.name || "待上传图片"; if (!item.url && item.blob && typeof URL !== "undefined" && URL.createObjectURL) item.url = URL.createObjectURL(item.blob); if (item.url) image.src = item.url; wrapper.appendChild(image); const remove = document.createElement("button"); remove.type = "button"; remove.className = "image-remove"; remove.textContent = "×"; remove.setAttribute("aria-label", "移除图片"); remove.addEventListener("click", () => { if (item.url?.startsWith?.("blob:") && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(item.url); pendingImages.splice(index, 1); renderPendingImages(); }); wrapper.appendChild(remove); imagePreviewEl.appendChild(wrapper); }); }
  function resetComposer() { pendingImages.forEach((item) => { if (item.url?.startsWith?.("blob:") && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(item.url); }); editingRecordId = null; pendingImages = []; selectedMood = null; if (inputTextEl) inputTextEl.value = ""; if (saveBtnEl) saveBtnEl.textContent = "封存这一刻"; if (cancelEditBtn) cancelEditBtn.style.display = "none"; setComposeMenu(false); $$("#mood-group .mood-btn").forEach((button) => button.classList.remove("active")); renderPendingImages(); }
  async function beginEdit(record) { if (!record) return; editingRecordId = record.id; selectedMood = record.mood || null; pendingImages = []; if (inputTextEl) inputTextEl.value = record.text || ""; $$("#mood-group .mood-btn").forEach((button) => button.classList.toggle("active", button.dataset.mood === selectedMood)); for (const id of record.mediaIds || []) { const blob = await mediaStore.get(id).catch(() => null); if (blob) pendingImages.push({ id, blob, existing: true, name: "已添加图片" }); } if (saveBtnEl) saveBtnEl.textContent = "保存修改"; if (cancelEditBtn) cancelEditBtn.style.display = ""; renderPendingImages(); showPage("page-today"); closeModal(); }
  function openModal(record) { if (!modalEl || !record) return; if (modalTitleEl) modalTitleEl.textContent = record.timeText || "记录详情"; if (modalBodyEl) modalBodyEl.textContent = record.text || ""; if (modalMediaEl) { modalMediaEl.innerHTML = ""; void hydrateMedia(modalMediaEl, record); } if (modalEditBtn) modalEditBtn.onclick = () => beginEdit(record); modalEl.style.display = ""; modalEl.setAttribute("aria-hidden", "false"); }
  function closeModal() { if (modalEl) { modalEl.style.display = "none"; modalEl.setAttribute("aria-hidden", "true"); } }
  function appendRecordMedia(row, record, className = "record-media") { if (!record.mediaIds?.length) return; const media = document.createElement("div"); media.className = className; row.appendChild(media); void hydrateMedia(media, record); }

  function bindLongPressDelete(element, record) {
    if (!element || !record) return; let timer = null; let moved = false;
    const start = () => { moved = false; clearTimeout(timer); timer = setTimeout(() => { timer = null; if (!confirm("长按删除：确定删除这条记录吗？")) return; if (!changeRecords((latest) => latest.filter((item) => item.id !== record.id))) return; cleanupMedia(record.mediaIds); renderHome(); renderToday(); renderWall(); renderRandom(); toast("已删除"); }, 520); };
    const cancel = () => { clearTimeout(timer); timer = null; };
    element.addEventListener("pointerdown", start, { passive: true }); element.addEventListener("pointerup", cancel, { passive: true }); element.addEventListener("pointercancel", cancel, { passive: true }); element.addEventListener("pointermove", () => { moved = true; cancel(); }, { passive: true }); element.addEventListener("touchstart", start, { passive: true }); element.addEventListener("touchend", cancel, { passive: true }); element.addEventListener("touchcancel", cancel, { passive: true }); element.addEventListener("touchmove", () => { moved = true; cancel(); }, { passive: true }); element.addEventListener("click", () => { if (!moved) openModal(record); });
  }
  function createRecordRow(record, variant = "list") {
    const row = document.createElement("div");
    row.className = `item ${variant === "wall" ? "wall-item" : variant === "home" ? "home-item" : ""}`;
    row.dataset.recordId = record.id;
    const left = document.createElement("div");
    left.className = "item-left";
    const copy = document.createElement("div");
    copy.className = "item-copy";
    const text = document.createElement("div");
    text.className = "item-text";
    text.textContent = record.text;
    copy.appendChild(text);
    const meta = document.createElement("div");
    meta.className = "item-meta";
    const tags = (record.tags || MEDIA.extractTags(record.text)).slice(0, 1);
    if (tags[0]) { const tag = document.createElement("span"); tag.textContent = `#${tags[0]}`; meta.appendChild(tag); }
    const mood = MOODS[record.mood];
    if (mood) { const moodEl = document.createElement("span"); moodEl.textContent = mood.label; meta.appendChild(moodEl); }
    if (variant !== "wall") { const date = document.createElement("span"); date.textContent = record.dateKey === toDateKey(new Date()) ? "今天" : record.dateKey; meta.appendChild(date); }
    if (meta.childElementCount) copy.appendChild(meta);
    left.appendChild(copy);

    if (variant === "wall") {
      if (record.mediaIds?.length) appendRecordMedia(row, record, "wall-thumb");
      row.appendChild(left);
    } else {
      if (record.mediaIds?.length) appendRecordMedia(row, record, "item-thumb");
      row.appendChild(left);
    }
    const chevron = document.createElement("img");
    chevron.className = "item-chevron";
    chevron.src = "./assets/icons/chevron-right.svg";
    chevron.alt = "";
    chevron.setAttribute("aria-hidden", "true");
    row.appendChild(chevron);
    bindLongPressDelete(row, record);
    return row;
  }

  function renderHome() { const now = new Date(); const nickname = getNickname(); if (homeDateEl) homeDateEl.textContent = formatDateCN(now); const greeting = `${greetingByHour(now.getHours())}，${nickname}`; if (homeGreetingEl) homeGreetingEl.textContent = greeting; if (homeQuoteEl) homeQuoteEl.textContent = getEnergy(); if (nicknamePreview) nicknamePreview.textContent = greeting; if (energyPreview) energyPreview.textContent = getEnergy(); const streak = calcStreak(records); if (statStreakEl) statStreakEl.textContent = String(streak); if (statStreakSubEl) statStreakSubEl.textContent = `已坚持 ${streak} 天`; if (statHappyEl) statHappyEl.textContent = String(records.length); if (statHappySubEl) statHappySubEl.textContent = `记录 ${records.length} 个瞬间`; if (!recentListEl) return; recentListEl.querySelectorAll(".item").forEach((node) => node.remove()); const latest = [...records].sort((a, b) => b.ts - a.ts).slice(0, 2); if (recentEmptyEl) recentEmptyEl.style.display = latest.length ? "none" : ""; latest.forEach((record) => recentListEl.appendChild(createRecordRow(record, "home"))); }
  function renderToday() { if (!todayListEl) return; todayListEl.innerHTML = ""; const key = toDateKey(new Date()); const today = records.filter((record) => record.dateKey === key).sort((a, b) => b.ts - a.ts); if (todayEmptyEl) todayEmptyEl.style.display = today.length ? "none" : ""; today.forEach((record) => todayListEl.appendChild(createRecordRow(record, "today"))); }

  async function prepareImage(source) { if (!source || typeof createImageBitmap !== "function") return source; try { const bitmap = await createImageBitmap(source); const max = 1600; const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height)); if (scale === 1) { bitmap.close?.(); return source; } const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.(); return await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .86)); } catch { return source; } }
  function buildRecord(text, existing) { const now = new Date(); const dateKey = toDateKey(now); return { ...(existing || {}), id: existing?.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`, text, mood: selectedMood || null, dateKey: existing?.dateKey || dateKey, ts: existing?.ts || now.getTime(), timeText: existing?.timeText || `${dateKey} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`, tags: MEDIA.extractTags(text), mediaIds: pendingImages.filter((item) => item.id).map((item) => item.id) }; }
  function finishSave() { resetComposer(); hideTagSuggest(); renderToday(); renderHome(); renderWall(); renderRandom(); refreshStorageUsage(); triggerMascot("record", "celebrate"); toast("已封存 ✨"); }
  async function saveWithImages(record, previousIds, newItems) { const written = []; try { for (const item of newItems) { const blob = await prepareImage(item.file || item.blob); const id = await mediaStore.put(blob, { name: item.name || "图片", type: blob?.type || item.file?.type || "image/jpeg", size: blob?.size || item.file?.size || 0 }); written.push(id); record.mediaIds.push(id); } if (!changeRecords((latest) => latest.map((item) => item.id === record.id ? record : item).concat(latest.some((item) => item.id === record.id) ? [] : [record]))) { cleanupMedia(written); return; } cleanupMedia(previousIds.filter((id) => !record.mediaIds.includes(id))); finishSave(); } catch { cleanupMedia(written); toast("图片保存失败，草稿仍保留，请重试。"); } }
  function saveRecord() { const text = (inputTextEl?.value || "").trim(); if (!text) return toast("先写一句再封存～"); const existing = editingRecordId ? records.find((record) => record.id === editingRecordId) : null; const record = buildRecord(text, existing); const previousIds = existing?.mediaIds || []; const newItems = pendingImages.filter((item) => !item.id); if (newItems.length) { void saveWithImages(record, previousIds, newItems); return; } if (!changeRecords((latest) => latest.map((item) => item.id === record.id ? record : item).concat(latest.some((item) => item.id === record.id) ? [] : [record]))) return; cleanupMedia(previousIds.filter((id) => !record.mediaIds.includes(id))); finishSave(); }
  function clearToday() { const key = toDateKey(new Date()); const removed = records.filter((record) => record.dateKey === key); if (!removed.length) return toast("今天没有可清空的记录"); if (!confirm("确定清空今天的记录吗？")) return; if (!changeRecords((latest) => latest.filter((record) => record.dateKey !== key))) return; cleanupMedia(removed.flatMap((record) => record.mediaIds || [])); renderToday(); renderHome(); renderWall(); renderRandom(); toast("今天已清空"); }

  function getAllTags() { const map = new Map(); records.forEach((record) => (record.tags || MEDIA.extractTags(record.text)).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1))); return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag); }
  function renderTagFilters() { if (!wallTagFiltersEl) return; wallTagFiltersEl.innerHTML = ""; const all = getAllTags(); if (!all.length) { wallTagFiltersEl.style.display = "none"; return; } wallTagFiltersEl.style.display = wallView === "tag" ? "flex" : "none"; const add = (label, value) => { const button = document.createElement("button"); button.type = "button"; button.className = `tag-filter ${activeWallTag === value ? "active" : ""}`; button.textContent = label; button.addEventListener("click", () => { activeWallTag = value; renderWall(); }); wallTagFiltersEl.appendChild(button); }; add("全部", ""); all.forEach((tag) => add(`#${tag}`, tag)); }
  function renderWall() {
    if (!wallListEl) return;
    const query = (wallSearchEl?.value || "").trim().toLowerCase();
    let list = [...records].sort((a, b) => b.ts - a.ts);
    if (query) list = list.filter((record) => `${record.text} ${(record.tags || []).join(" ")}`.toLowerCase().includes(query.replace(/^#/, "")));
    if (wallView === "tag" && activeWallTag) list = list.filter((record) => (record.tags || []).includes(activeWallTag));
    wallListEl.innerHTML = "";
    if (wallEmptyEl) wallEmptyEl.style.display = list.length ? "none" : "";
    if (!list.length && query) triggerMascot("wall", "empty");
    list.forEach((record) => wallListEl.appendChild(createRecordRow(record, "wall")));
    renderTagFilters();
  }
  function clearWallAll() { if (!refreshRecords()) return toast("暂时无法读取本地记录，原数据未改动。请检查浏览器存储。"); if (!records.length) return toast("没有数据可清空"); if (!confirm("确定清空全部记录吗？")) return; const ids = records.flatMap((record) => record.mediaIds || []); if (!changeRecords(() => [])) return; cleanupMedia(ids); renderHome(); renderToday(); renderWall(); renderRandom(); toast("已清空"); }

  function ensureReviewDeck() { const signature = records.map((record) => record.id).sort().join("|"); if (signature !== reviewSignature) { reviewSignature = signature; reviewDeck = MEDIA.createReviewDeck(records.map((record) => record.id)); currentRandomId = null; completedReviewCycle = false; } }
  function resetReviewMotion() { if (reviewExitTimer) { clearTimeout(reviewExitTimer); reviewExitTimer = null; } reviewPendingDirection = null; if (!randomCardEl) return; randomCardEl.classList.remove("is-dragging", "is-exiting-left", "is-exiting-right"); randomCardEl.style.setProperty("--swipe-x", "0px"); randomCardEl.style.setProperty("--swipe-rotate", "0deg"); randomCardEl.style.setProperty("--swipe-scale", "1"); randomCardEl.style.setProperty("--swipe-opacity", "1"); randomCardEl.style.setProperty("--swipe-progress", "0"); }
  function animateRandomStep(direction) { triggerMascot("review", direction > 0 ? "swipe-left" : "swipe-right"); resetReviewMotion(); stepRandom(direction); }
  function showRandomRecord(record) { if (!record) { if (randomTextEl) randomTextEl.textContent = "—"; if (randomTimeEl) randomTimeEl.textContent = "还没有记录"; if (randomMoodEl) randomMoodEl.textContent = ""; if (randomPositionEl) randomPositionEl.textContent = "0 / 0"; if (randomMediaEl) randomMediaEl.innerHTML = ""; return; } const mood = MOODS[record.mood]; if (randomTextEl) randomTextEl.textContent = record.text; if (randomMoodEl) randomMoodEl.textContent = `${(record.tags || []).slice(0, 1).map((tag) => `#${tag}`).join(" · ")}${mood ? `${(record.tags || []).length ? " · " : ""}${mood.label}` : ""}`; if (randomTimeEl) randomTimeEl.textContent = record.timeText; if (randomPositionEl) randomPositionEl.textContent = `${reviewDeck.position()} / ${reviewDeck.size()}`; if (randomMediaEl) { randomMediaEl.innerHTML = ""; void hydrateMedia(randomMediaEl, record); } }
  function stepRandom(direction) { ensureReviewDeck(); if (!records.length) return showRandomRecord(null); let id; if (direction < 0) id = reviewDeck.previous() || reviewDeck.current() || reviewDeck.next(); else { if (reviewDeck.position() === reviewDeck.size()) completedReviewCycle = true; id = reviewDeck.next(); } currentRandomId = id; showRandomRecord(records.find((record) => record.id === id)); if (randomReshuffleBtn) randomReshuffleBtn.style.display = completedReviewCycle ? "" : "none"; }
  function renderRandom() { ensureReviewDeck(); if (!currentRandomId || !records.some((record) => record.id === currentRandomId)) stepRandom(1); else showRandomRecord(records.find((record) => record.id === currentRandomId)); }

  function renderSettings() { const nickname = getNickname(); lastNickname = nickname; if (nicknameInput && nicknameInput.value !== nickname) nicknameInput.value = nickname; if (energyInput && energyInput.value !== getEnergy()) energyInput.value = getEnergy(); if (nicknamePreview) nicknamePreview.textContent = `${greetingByHour(new Date().getHours())}，${nickname}`; if (energyPreview) energyPreview.textContent = getEnergy(); refreshStorageUsage(); }
  async function refreshStorageUsage() { if (!storageUsageEl) return; try { const estimate = await mediaStore.estimate(); storageUsageEl.textContent = `图片占用空间：${estimate.usage ? `${(estimate.usage / 1024 / 1024).toFixed(1)} MB` : "0 MB"}`; } catch { storageUsageEl.textContent = "图片占用空间：暂不可用"; } }
  function exportText() { if (!refreshRecords()) return toast("暂时无法读取本地记录，原数据未改动。"); if (!records.length) return toast("还没有可导出的记录"); const text = [...records].sort((a, b) => a.ts - b.ts).map((record) => `${record.timeText}  ${MOODS[record.mood] ? `${MOODS[record.mood].label} ` : ""}${record.text}`).join("\n"); const fallback = () => prompt("复制下面内容：", text); if (!navigator.clipboard?.writeText) return fallback(); Promise.resolve(navigator.clipboard.writeText(text)).then(() => toast("已复制到剪贴板")).catch(fallback); }
  const blobToDataUrl = (blob) => new Promise((resolve, reject) => { if (typeof FileReader === "undefined") return resolve(null); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  async function exportBackup() { if (!refreshRecords()) return toast("暂时无法读取本地记录，原数据未改动。"); const media = {}; for (const record of records) for (const id of record.mediaIds || []) { const blob = await mediaStore.get(id).catch(() => null); if (blob) media[id] = { type: blob.type, dataUrl: await blobToDataUrl(blob) }; } const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records, media }, null, 2); if (typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return prompt("复制下面的完整备份 JSON：", json); const url = URL.createObjectURL(new Blob([json], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `small-wins-backup-${toDateKey(new Date())}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("完整备份已下载"); }
  function clearAll() { if (!refreshRecords()) return toast("暂时无法读取本地记录，原数据未改动。"); if (!records.length) return toast("没有数据可清空"); if (!confirm("确定清空全部数据吗？此操作不可撤销。")) return; const ids = records.flatMap((record) => record.mediaIds || []); if (!changeRecords(() => [])) return; cleanupMedia(ids); renderHome(); renderToday(); renderWall(); renderRandom(); toast("已清空全部数据"); }

  function hideTagSuggest() { if (tagSuggestEl) { tagSuggestEl.style.display = "none"; tagSuggestEl.innerHTML = ""; } }
  function setComposeMenu(open) { if (!composeMenuEl || !composeToolsBtn) return; composeMenuEl.hidden = !open; composeToolsBtn.setAttribute("aria-expanded", open ? "true" : "false"); }
  function insertTagToken() { if (!inputTextEl) return; const value = inputTextEl.value || ""; const start = inputTextEl.selectionStart ?? value.length; const end = inputTextEl.selectionEnd ?? start; const before = value.slice(0, start); const needsSpace = before && !/\s$/.test(before) ? " " : ""; const next = `${before}${needsSpace}#${value.slice(end)}`; const cursor = before.length + needsSpace.length + 1; inputTextEl.value = next; inputTextEl.focus(); inputTextEl.setSelectionRange(cursor, cursor); inputTextEl.dispatchEvent(new Event("input", {bubbles: true})); }
  function setupTagSuggest() { if (!inputTextEl) return; inputTextEl.addEventListener("compositionstart", () => { composing = true; }); inputTextEl.addEventListener("compositionend", () => { composing = false; }); inputTextEl.addEventListener("input", () => { if (!tagSuggestEl) return; const value = inputTextEl.value || ""; const cursor = inputTextEl.selectionStart ?? value.length; const match = value.slice(0, cursor).match(/[#＃]([^\s#＃]*)$/); if (!match) return hideTagSuggest(); const keyword = match[1] || ""; const tags = getAllTags().filter((tag) => !keyword || tag.startsWith(keyword)); if (!tags.length) return hideTagSuggest(); tagSuggestEl.innerHTML = ""; tags.slice(0, 12).forEach((tag) => { const button = document.createElement("button"); button.type = "button"; button.className = "tag-suggest-item"; button.textContent = `#${tag}`; button.addEventListener("click", () => { const left = value.slice(0, cursor).replace(/[#＃][^\s#＃]*$/, `#${tag} `); inputTextEl.value = left + value.slice(cursor); inputTextEl.focus(); inputTextEl.setSelectionRange(left.length, left.length); hideTagSuggest(); }); tagSuggestEl.appendChild(button); }); tagSuggestEl.style.display = "flex"; }); inputTextEl.addEventListener("keydown", (event) => { if (event.isComposing || composing || event.keyCode === 229) return; if (event.key === "Escape") { hideTagSuggest(); setComposeMenu(false); } if (event.key === "Enter" && !event.shiftKey) return; }); document.addEventListener("click", (event) => { if (event.target !== inputTextEl && !(tagSuggestEl && tagSuggestEl.contains(event.target))) hideTagSuggest(); if (!(composeMenuEl && composeMenuEl.contains(event.target)) && event.target !== composeToolsBtn) setComposeMenu(false); }); }

  function showPage(id) { refreshRecords(); const nextMascotPage = mascotPageByView[id]; if (activeMascotPage && activeMascotPage !== nextMascotPage) { resetMascot(activeMascotPage); mascotLastTrigger.delete(activeMascotPage); } ["page-home", "page-today", "page-wall", "page-random", "page-settings"].map((pageId) => document.getElementById(pageId)).filter(Boolean).forEach((page) => { page.style.display = page.id === id ? "" : "none"; }); $$(".topnav button, .tabbar-btn").forEach((button) => button.classList.toggle("active", button.dataset.target === id)); hideTagSuggest(); setComposeMenu(false); if (id !== "page-random") resetReviewMotion(); if (id === "page-home") renderHome(); if (id === "page-today") renderToday(); if (id === "page-wall") renderWall(); if (id === "page-random") renderRandom(); if (id === "page-settings") renderSettings(); if (nextMascotPage) { activeMascotPage = nextMascotPage; triggerMascot(nextMascotPage, "enter"); } }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event; if (installTip) installTip.textContent = "✅ 可安装：点击上方按钮即可添加到桌面。"; });
  installBtn?.addEventListener("click", async () => { if (!deferredPrompt) return toast("请用浏览器“分享”→“添加到主屏幕”"); deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; deferredPrompt = null; toast(choice.outcome === "accepted" ? "已发起安装" : "已取消安装"); });
  $$(".topnav button, .tabbar-btn").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.target)));
  $$('[data-target]').forEach((element) => { if (!element.closest(".topnav") && !element.closest(".tabbar")) element.addEventListener("click", () => showPage(element.dataset.target)); });
  $$("#mood-group .mood-btn").forEach((button) => button.addEventListener("click", () => { selectedMood = button.dataset.mood || null; $$("#mood-group .mood-btn").forEach((item) => item.classList.toggle("active", item === button)); }));
  saveBtnEl?.addEventListener("click", saveRecord); cancelEditBtn?.addEventListener("click", resetComposer); clearTodayBtn?.addEventListener("click", clearToday);
  composeToolsBtn?.addEventListener("click", () => setComposeMenu(composeMenuEl?.hidden));
  addImageBtn?.addEventListener("click", () => { setComposeMenu(false); imageInputEl?.click(); });
  addTagBtn?.addEventListener("click", () => { setComposeMenu(false); insertTagToken(); });
  imageInputEl?.addEventListener("change", () => { const files = Array.from(imageInputEl.files || []); const available = (MEDIA.MAX_IMAGES_PER_RECORD || 3) - pendingImages.length; const accepted = files.slice(0, available).filter((file) => MEDIA.validateImageMeta(file)); if (accepted.length < Math.min(files.length, available)) toast("仅支持 8MB 内的 JPG、PNG 或 WebP 图片"); accepted.forEach((file) => pendingImages.push({ file, name: file.name, url: typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : "" })); imageInputEl.value = ""; renderPendingImages(); });
  wallSearchEl?.addEventListener("input", () => { renderWall(); if ((wallSearchEl.value || "").trim() && wallListEl?.childElementCount) triggerMascot("wall", "listen"); }); wallClearInputBtn?.addEventListener("click", () => { wallSearchEl.value = ""; renderWall(); toast("已清空搜索"); }); wallClearBtn?.addEventListener("click", clearWallAll);
  $$("#wall-view-toggle [data-view]").forEach((button) => button.addEventListener("click", () => { wallView = button.dataset.view; $$("#wall-view-toggle [data-view]").forEach((item) => item.classList.toggle("active", item === button)); renderWall(); }));
  randomPrevBtn?.addEventListener("click", () => animateRandomStep(-1)); randomNextBtn?.addEventListener("click", () => animateRandomStep(1)); randomReshuffleBtn?.addEventListener("click", () => { resetReviewMotion(); reviewDeck.reset(); currentRandomId = null; completedReviewCycle = false; renderRandom(); });
  document.addEventListener("keydown", (event) => { if (document.getElementById("page-random")?.style.display !== "none" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); animateRandomStep(event.key === "ArrowLeft" ? -1 : 1); } if (event.key === "Escape") closeModal(); });
  if (randomCardEl) { let startX = null; let pointerActive = false; const width = () => randomCardEl.getBoundingClientRect?.().width || 320; const setDrag = (x) => { const progress = Math.min(1, Math.abs(x) / Math.max(width() * .85, 1)); const rotate = Math.max(-10, Math.min(10, (x / width()) * 8)); const scale = 1 - progress * .04; const opacity = 1 - progress * .16; randomCardEl.style.setProperty("--swipe-x", `${x}px`); randomCardEl.style.setProperty("--swipe-rotate", `${rotate}deg`); randomCardEl.style.setProperty("--swipe-scale", scale.toFixed(3)); randomCardEl.style.setProperty("--swipe-opacity", opacity.toFixed(3)); randomCardEl.style.setProperty("--swipe-progress", progress.toFixed(3)); randomCardEl.classList.add("is-dragging"); }; const completeExit = () => { if (reviewPendingDirection == null) return; const direction = reviewPendingDirection; resetReviewMotion(); stepRandom(direction); }; const finishSwipe = (endX) => { if (startX == null || !Number.isFinite(endX)) return; const delta = endX - startX; startX = null; randomCardEl.classList.remove("is-dragging"); if (Math.abs(delta) <= 52) { randomCardEl.style.setProperty("--swipe-x", "0px"); randomCardEl.style.setProperty("--swipe-rotate", "0deg"); randomCardEl.style.setProperty("--swipe-scale", "1"); randomCardEl.style.setProperty("--swipe-opacity", "1"); randomCardEl.style.setProperty("--swipe-progress", "0"); return; } reviewPendingDirection = delta < 0 ? 1 : -1; triggerMascot("review", reviewPendingDirection > 0 ? "swipe-left" : "swipe-right"); randomCardEl.classList.add(reviewPendingDirection > 0 ? "is-exiting-left" : "is-exiting-right"); reviewExitTimer = setTimeout(completeExit, 520); }; randomCardEl.addEventListener("pointerdown", (event) => { if (reviewPendingDirection != null) return; pointerActive = true; startX = event.clientX; randomCardEl.setPointerCapture?.(event.pointerId); }); randomCardEl.addEventListener("pointermove", (event) => { if (pointerActive && startX != null) setDrag(event.clientX - startX); }); randomCardEl.addEventListener("pointerup", (event) => { if (!pointerActive) return; pointerActive = false; finishSwipe(event.clientX); }); randomCardEl.addEventListener("pointercancel", () => { pointerActive = false; startX = null; resetReviewMotion(); }); randomCardEl.addEventListener("touchstart", (event) => { if (pointerActive || reviewPendingDirection != null) return; startX = event.changedTouches?.[0]?.clientX ?? null; }, { passive: true }); randomCardEl.addEventListener("touchmove", (event) => { if (!pointerActive && startX != null) setDrag((event.changedTouches?.[0]?.clientX ?? startX) - startX); }, { passive: true }); randomCardEl.addEventListener("touchend", (event) => { if (pointerActive) return; finishSwipe(event.changedTouches?.[0]?.clientX ?? startX); }, { passive: true }); randomCardEl.addEventListener("touchcancel", () => { if (!pointerActive) { startX = null; resetReviewMotion(); } }, { passive: true }); randomCardEl.addEventListener("transitionend", (event) => { if (event.propertyName === "transform") completeExit(); }); }
  saveNickBtn?.addEventListener("click", () => { const value = (nicknameInput?.value || "").trim(); if (!value) return toast("昵称不能为空"); if (setNickname(value)) { renderHome(); renderSettings(); triggerMascot("settings", "celebrate"); toast("昵称已保存"); } });
  saveEnergyBtn?.addEventListener("click", () => { const value = (energyInput?.value || "").trim(); if (setEnergy(value)) { renderHome(); renderSettings(); triggerMascot("settings", "celebrate"); toast("今日能量已保存"); } });
  exportBtn?.addEventListener("click", exportText); backupBtn?.addEventListener("click", exportBackup); clearAllBtn?.addEventListener("click", clearAll);
  modalEl?.addEventListener("click", (event) => { if (event.target?.getAttribute?.("data-close") === "1") closeModal(); });

  function refreshFromOtherPage(event) { if (event?.key && event.key !== LS_KEY && event.key !== LS_NICK && event.key !== LS_ENERGY) return; if (refreshRecords()) { renderToday(); renderWall(); renderRandom(); renderHome(); } const nickname = getNickname(); if (nicknameInput && nicknameInput.value === lastNickname) nicknameInput.value = nickname; if (energyInput && energyInput.value === getEnergy()) energyInput.value = getEnergy(); lastNickname = nickname; if (energyPreview) energyPreview.textContent = getEnergy(); }
  window.addEventListener("pageshow", refreshFromOtherPage); window.addEventListener("storage", refreshFromOtherPage); window.addEventListener("focus", refreshFromOtherPage); document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshFromOtherPage(); });
  setupTagSuggest();
  bindMascotInteractions();
  const initial = loadRecords(); records = initial || []; ensureReviewDeck(); renderHome(); renderToday(); renderWall(); renderRandom(); renderSettings(); activeMascotPage = "home"; triggerMascot("home", "enter"); if (!initial) toast("暂时无法读取本地记录，原数据未改动。");
})();
