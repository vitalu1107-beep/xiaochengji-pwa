/* Small Wins — forest UI. Storage keys and record shape stay compatible with v1. */
(() => {
  'use strict';
  const LS_KEY = 'smallwins_records_v1';
  const LS_NICK = 'smallwins_nickname_v1';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const pad2 = number => String(number).padStart(2, '0');
  const toDateKey = date => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const MOODS = { calm: '平静', happy: '愉悦', relaxed: '释然', lazy: '慵懒' };
  const pages = ['page-home', 'page-today', 'page-wall', 'page-random', 'page-settings'].map(id => document.getElementById(id)).filter(Boolean);
  const tabs = $$('.topnav button, .tabbar-btn');
  const inputText = $('#input-text');
  const tagSuggest = $('#tag-suggest');
  const modal = $('#modal');
  let records = [];
  let selectedMood = null;
  let currentRandomId = null;
  let modalRecordId = null;
  let previousFocus = null;
  let lastNickname = '夏央';
  let composing = false;

  function toast(message) {
    let element = $('#__toast');
    if (!element) {
      element = document.createElement('div');
      element.id = '__toast';
      element.className = 'toast';
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.style.display = 'block';
    clearTimeout(element.__timer);
    element.__timer = setTimeout(() => { element.style.display = 'none'; }, 2600);
  }

  // A failed read is never treated as an empty database for a subsequent write.
  function readRecords() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const value = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(value) || value.some(record => !record || typeof record.id !== 'string' || typeof record.text !== 'string' || typeof record.dateKey !== 'string' || typeof record.timeText !== 'string' || !Number.isFinite(record.ts))) {
        throw new Error('Invalid records');
      }
      return { ok: true, records: value };
    } catch {
      return { ok: false };
    }
  }
  function refreshRecords() {
    const result = readRecords();
    if (result.ok) records = result.records;
    return result.ok;
  }
  function changeRecords(update) {
    // Reload just before each mutation so another page's newly saved items survive.
    const latest = readRecords();
    if (!latest.ok) {
      toast('暂时无法读取本地记录，原数据未改动。请检查浏览器存储。');
      return false;
    }
    const next = update(latest.records);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      toast('保存失败，本地存储可能已满或被禁用。请保留输入后重试。');
      return false;
    }
    records = next;
    return true;
  }
  function getNickname() {
    try { return localStorage.getItem(LS_NICK) || '夏央'; } catch { return lastNickname; }
  }
  function greeting() {
    const hour = new Date().getHours();
    const salutation = hour < 6 ? '凌晨好' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    return `${salutation}，${getNickname()}`;
  }
  function setText(selector, text) {
    const element = $(selector);
    if (element) element.textContent = text;
  }
  function sorted(list) { return [...list].sort((a, b) => b.ts - a.ts); }

  function closeModal() {
    if (!modal || modal.getAttribute('aria-hidden') !== 'false') return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modalRecordId = null;
    if (previousFocus?.isConnected) previousFocus.focus();
    else tabs.find(tab => tab.classList.contains('active'))?.focus();
    previousFocus = null;
  }
  function openModal(record) {
    if (!modal) return;
    previousFocus = document.activeElement;
    modalRecordId = record.id;
    setText('#modal-title', record.timeText);
    setText('#modal-body', record.text);
    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'false');
    $('#modal-close')?.focus();
  }
  modal?.addEventListener('click', event => {
    if (event.target?.getAttribute('data-close') === '1') closeModal();
  });
  $('#modal-close')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', event => {
    if (!modal || modal.getAttribute('aria-hidden') !== 'false') return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key === 'Tab') {
      const focusable = [$('#modal-close'), $('#modal-delete'), $('#modal-dismiss')].filter(element => element && !element.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }
  });
  function deleteRecord(id) {
    if (!confirm('确定删除这条记录吗？此操作不可撤销。')) return false;
    if (!changeRecords(latest => latest.filter(record => record.id !== id))) return false;
    renderAll();
    toast('已删除这条记录');
    return true;
  }
  $('#modal-delete')?.addEventListener('click', () => {
    if (modalRecordId && deleteRecord(modalRecordId)) closeModal();
  });

  function bindRecordActions(element, record) {
    let timer = null;
    let suppressClick = false;
    let startX = 0;
    let startY = 0;
    function cancel() { clearTimeout(timer); timer = null; }
    function start(event) {
      if (event.button != null && event.button !== 0) return;
      cancel();
      suppressClick = false;
      const point = event.touches?.[0] || event;
      startX = point.clientX || 0;
      startY = point.clientY || 0;
      timer = setTimeout(() => {
        timer = null;
        suppressClick = true;
        deleteRecord(record.id);
      }, 520);
    }
    function move(event) {
      const point = event.touches?.[0] || event;
      if (Math.abs((point.clientX || 0) - startX) > 8 || Math.abs((point.clientY || 0) - startY) > 8) {
        suppressClick = true;
        cancel();
      }
    }
    // Pointer events cover current Safari/Chrome without double touch timers.
    if (window.PointerEvent) {
      element.addEventListener('pointerdown', start, { passive: true });
      element.addEventListener('pointerup', cancel, { passive: true });
      element.addEventListener('pointercancel', () => { suppressClick = true; cancel(); }, { passive: true });
      element.addEventListener('pointermove', move, { passive: true });
    } else {
      element.addEventListener('touchstart', start, { passive: true });
      element.addEventListener('touchend', cancel, { passive: true });
      element.addEventListener('touchcancel', () => { suppressClick = true; cancel(); }, { passive: true });
      element.addEventListener('touchmove', move, { passive: true });
    }
    element.addEventListener('contextmenu', event => event.preventDefault());
    element.addEventListener('click', event => {
      cancel();
      if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
      openModal(record);
    });
  }
  function recordButton(record, showTime = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'item';
    const left = document.createElement('span');
    left.className = 'item-left';
    const body = document.createElement('span');
    body.className = 'item-text';
    body.textContent = record.text;
    left.appendChild(body);
    const metaText = [showTime ? record.timeText.slice(-5) : '', MOODS[record.mood] || ''].filter(Boolean).join(' · ');
    if (metaText) {
      const meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.textContent = metaText;
      left.appendChild(meta);
    }
    const arrow = document.createElement('img');
    arrow.className = 'item-chevron';
    arrow.src = './assets/icons/chevron-right.svg';
    arrow.alt = '';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(left, arrow);
    bindRecordActions(button, record);
    return button;
  }
  function renderList(listSelector, emptySelector, list, showTime = false) {
    const container = $(listSelector);
    if (!container) return;
    // The home empty state can be nested inside its list in older markup.
    container.querySelectorAll('.item').forEach(element => element.remove());
    const empty = $(emptySelector);
    if (empty) empty.style.display = list.length ? 'none' : '';
    list.forEach(record => container.appendChild(recordButton(record, showTime)));
  }
  function renderHome() {
    const now = new Date();
    setText('#home-date', `${now.getFullYear()}年${pad2(now.getMonth() + 1)}月${pad2(now.getDate())}日`);
    setText('#home-greeting', greeting());
    setText('#nickname-preview', greeting());
    const keys = new Set(records.map(record => record.dateKey));
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let streak = 0;
    while (keys.has(toDateKey(day))) { streak++; day.setDate(day.getDate() - 1); }
    setText('#stat-streak', String(streak));
    setText('#stat-streak-sub', `已坚持 ${streak} 天`);
    setText('#stat-happy', String(records.length));
    setText('#stat-happy-sub', `记录 ${records.length} 个瞬间`);
    renderList('#recent-list', '#recent-empty', sorted(records).slice(0, 2));
  }
  function renderToday() {
    renderList('#today-list', '#today-empty', sorted(records.filter(record => record.dateKey === toDateKey(new Date()))), true);
  }
  function renderWall() {
    const query = ($('#wall-search')?.value || '').trim().toLowerCase();
    const list = sorted(records).filter(record => record.text.toLowerCase().includes(query));
    setText('#wall-empty', query ? '没有找到相符的记录，换个词试试。' : '还没有记录，慢慢收集生活里的小成就。');
    renderList('#wall-list', '#wall-empty', list);
  }
  function renderRandom() {
    let record = records.find(record => record.id === currentRandomId);
    if (!record && records.length) {
      record = records[Math.floor(Math.random() * records.length)];
      currentRandomId = record.id;
    }
    if (!record) currentRandomId = null;
    setText('#random-text', record ? record.text : '—');
    setText('#random-time', record ? record.timeText : '还没有记录，留下一件小事后再来看看。');
    setText('#random-mood', record ? MOODS[record.mood] || '' : '');
    const moodElement = $('#random-mood');
    if (moodElement) {
      moodElement.style.display = record && MOODS[record.mood] ? '' : 'none';
      if (record && MOODS[record.mood]) {
        const icon = document.createElement('img');
        icon.className = 'icon'; icon.src = './assets/icons/smiley.svg'; icon.alt = '';
        const label = document.createElement('span'); label.textContent = MOODS[record.mood];
        moodElement.replaceChildren(icon, label);
      }
    }
  }
  function renderSettings() {
    lastNickname = getNickname();
    if ($('#nickname-input')) $('#nickname-input').value = lastNickname;
    setText('#nickname-preview', greeting());
  }
  function renderAll() { renderHome(); renderToday(); renderWall(); renderRandom(); }
  function showPage(id) {
    if (!pages.some(page => page.id === id)) return;
    refreshRecords();
    pages.forEach(page => { page.style.display = page.id === id ? '' : 'none'; });
    tabs.forEach(tab => {
      const active = tab.dataset.target === id;
      tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    hideTagSuggest();
    renderAll();
    if (id === 'page-settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  tabs.forEach(button => button.addEventListener('click', () => showPage(button.dataset.target)));
  $$('[data-target]').forEach(element => {
    if (tabs.includes(element)) return;
    element.addEventListener('click', () => showPage(element.dataset.target));
  });

  function updateMoodButtons() {
    $$('#mood-group .mood-btn').forEach(button => {
      const active = button.dataset.mood === selectedMood;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  $$('#mood-group .mood-btn').forEach(button => {
    button.addEventListener('click', () => {
      selectedMood = selectedMood === button.dataset.mood ? null : button.dataset.mood;
      updateMoodButtons();
    });
  });
  function saveRecord() {
    const text = (inputText?.value || '').trim();
    if (!text) return toast('先写一句，再封存这一刻。');
    const now = new Date();
    const dateKey = toDateKey(now);
    const record = {
      id: `${now.getTime()}_${Math.random().toString(16).slice(2)}`,
      text,
      mood: selectedMood,
      dateKey,
      ts: now.getTime(),
      timeText: `${dateKey} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    };
    if (!changeRecords(latest => [...latest, record])) return;
    inputText.value = '';
    selectedMood = null;
    updateMoodButtons();
    hideTagSuggest();
    renderAll();
    toast('已封存这一刻');
  }
  $('#btn-save')?.addEventListener('click', saveRecord);
  $('#btn-clear-today')?.addEventListener('click', () => {
    if (!refreshRecords()) return toast('暂时无法读取本地记录，原数据未改动。');
    const today = toDateKey(new Date());
    if (!records.some(record => record.dateKey === today)) return toast('今天没有可清空的记录');
    if (!confirm('确定清空今天的所有记录吗？此操作不可撤销。')) return;
    if (changeRecords(latest => latest.filter(record => record.dateKey !== today))) { renderAll(); toast('今天的记录已清空'); }
  });
  function clearAllRecords() {
    if (!refreshRecords()) return toast('暂时无法读取本地记录，原数据未改动。');
    if (!records.length) return toast('没有记录可清空');
    if (!confirm('确定清空全部记录吗？此操作不可撤销。昵称会保留。')) return;
    if (changeRecords(() => [])) { renderAll(); toast('全部记录已清空'); }
  }
  $('#btn-wall-clear')?.addEventListener('click', clearAllRecords);
  $('#btn-clear-all')?.addEventListener('click', clearAllRecords);
  $('#wall-search')?.addEventListener('input', () => { refreshRecords(); renderWall(); });
  $('#btn-wall-clear-input')?.addEventListener('click', () => {
    if ($('#wall-search')) $('#wall-search').value = '';
    refreshRecords(); renderWall();
  });
  $('#btn-random-next')?.addEventListener('click', () => { refreshRecords(); currentRandomId = null; renderRandom(); });
  $('#btn-save-nickname')?.addEventListener('click', () => {
    const value = ($('#nickname-input')?.value || '').trim();
    if (!value) return toast('昵称不能为空');
    try { localStorage.setItem(LS_NICK, value); }
    catch { return toast('昵称保存失败，请检查浏览器本地存储。'); }
    renderHome(); renderSettings(); toast('昵称已保存');
  });
  $('#btn-export')?.addEventListener('click', () => {
    if (!refreshRecords()) return toast('暂时无法读取本地记录。');
    if (!records.length) return toast('还没有可导出的记录');
    const text = [...records].sort((a, b) => a.ts - b.ts).map(record => `${record.timeText}  ${MOODS[record.mood] ? MOODS[record.mood] + ' ' : ''}${record.text}`).join('\n');
    const fallback = () => prompt('复制下面的记录：', text);
    if (!navigator.clipboard?.writeText) return fallback();
    try { Promise.resolve(navigator.clipboard.writeText(text)).then(() => toast('已复制到剪贴板')).catch(fallback); }
    catch { fallback(); }
  });

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    setText('#install-tip', '此浏览器支持安装，点击“添加到桌面”即可。');
  });
  $('#btn-install')?.addEventListener('click', async () => {
    if (!installPrompt) return toast('请用浏览器“分享”或菜单，选择“添加到主屏幕”。');
    const current = installPrompt;
    installPrompt = null;
    try {
      await current.prompt();
      const choice = await current.userChoice;
      toast(choice.outcome === 'accepted' ? '已发起安装' : '已取消安装');
    } catch { toast('请用浏览器菜单添加到主屏幕。'); }
  });

  function hideTagSuggest() {
    if (!tagSuggest) return;
    tagSuggest.style.display = 'none';
    tagSuggest.innerHTML = '';
  }
  function suggestTags() {
    if (!inputText || !tagSuggest || composing) return;
    refreshRecords();
    const cursor = inputText.selectionStart ?? inputText.value.length;
    const left = inputText.value.slice(0, cursor);
    const match = left.match(/[#＃]([^\s#＃]*)$/);
    if (!match) return hideTagSuggest();
    const counter = new Map();
    records.forEach(record => {
      for (const found of record.text.matchAll(/[#＃]([^\s#＃]+)/g)) counter.set(found[1], (counter.get(found[1]) || 0) + 1);
    });
    const tags = [...counter.entries()].sort((a, b) => b[1] - a[1]).map(entry => entry[0]).filter(tag => tag.startsWith(match[1])).slice(0, 12);
    hideTagSuggest();
    if (!tags.length) return;
    tags.forEach(tag => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-suggest-item';
      button.textContent = '#' + tag;
      button.addEventListener('click', () => {
        const newLeft = left.replace(/[#＃]([^\s#＃]*)$/, '#' + tag + ' ');
        inputText.value = newLeft + inputText.value.slice(cursor);
        inputText.focus();
        inputText.setSelectionRange(newLeft.length, newLeft.length);
        hideTagSuggest();
      });
      tagSuggest.appendChild(button);
    });
    tagSuggest.style.display = 'flex';
  }
  inputText?.addEventListener('input', suggestTags);
  inputText?.addEventListener('compositionstart', () => { composing = true; });
  inputText?.addEventListener('compositionend', () => { composing = false; suggestTags(); });
  inputText?.addEventListener('keydown', event => {
    if (event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'Escape') hideTagSuggest();
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); saveRecord(); }
  });
  document.addEventListener('click', event => {
    if (event.target !== inputText && !tagSuggest?.contains(event.target)) hideTagSuggest();
  });
  window.addEventListener('resize', hideTagSuggest);
  function refreshFromOtherPage(event) {
    if (event?.key && event.key !== LS_KEY && event.key !== LS_NICK) return;
    if (refreshRecords()) renderAll();
    const nickname = getNickname();
    const field = $('#nickname-input');
    if (field && field.value === lastNickname) field.value = nickname;
    lastNickname = nickname;
  }
  window.addEventListener('storage', refreshFromOtherPage);
  window.addEventListener('focus', refreshFromOtherPage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFromOtherPage(); });

  const readable = refreshRecords();
  renderAll();
  renderSettings();
  updateMoodButtons();
  tabs.forEach(tab => { if (tab.dataset.target === 'page-home') { tab.classList.add('active'); tab.setAttribute('aria-current', 'page'); } });
  if (!readable) toast('暂时无法读取本地记录，原数据未改动。请检查浏览器存储。');
})();
