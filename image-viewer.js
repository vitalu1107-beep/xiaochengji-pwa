/* Original attachment viewer: no upload, conversion or third-party dependency. */
((root) => {
  function create({ load, document: doc = root.document }) {
    const dialog = doc.getElementById("image-viewer");
    if (!dialog) return { open: async () => false, close() {}, isOpen: () => false };
    const stage = doc.getElementById("image-stage"), image = doc.getElementById("image-full");
    const closeButton = doc.getElementById("image-close"), previous = doc.getElementById("image-prev");
    const next = doc.getElementById("image-next"), zoomButton = doc.getElementById("image-zoom");
    const count = doc.getElementById("image-count"), status = doc.getElementById("image-status");
    let active = false, ids = [], index = 0, request = 0, objectUrl = null, opener = null;
    let scale = 1, x = 0, y = 0, fittedWidth = 0, fittedHeight = 0;
    let base = null, pinched = false, lastTap = null, lastTouchAt = 0;
    const pointers = new Map();
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const releaseUrl = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null; image.removeAttribute("src"); };
    function paint() {
      const limitX = Math.max(0, (fittedWidth * scale - stage.clientWidth) / 2);
      const limitY = Math.max(0, (fittedHeight * scale - stage.clientHeight) / 2);
      x = clamp(x, -limitX, limitX); y = clamp(y, -limitY, limitY);
      image.style.transform = `translate3d(${Math.round(x * 1000) / 1000}px, ${Math.round(y * 1000) / 1000}px, 0) scale(${scale})`;
      zoomButton.textContent = scale > 1 ? "−" : "+";
      zoomButton.setAttribute("aria-label", scale > 1 ? "还原图片" : "放大图片");
    }
    function fit() {
      if (!active || !image.naturalWidth || !image.naturalHeight) return;
      const ratio = Math.min(stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight);
      fittedWidth = image.naturalWidth * ratio; fittedHeight = image.naturalHeight * ratio;
      image.style.width = `${fittedWidth}px`; image.style.height = `${fittedHeight}px`;
      scale = 1; x = 0; y = 0; paint();
    }
    function zoom(value, anchor = { x: 0, y: 0 }) {
      const target = clamp(value, 1, 4), ratio = target / scale;
      x = anchor.x - (anchor.x - x) * ratio; y = anchor.y - (anchor.y - y) * ratio;
      scale = target; paint();
    }
    const point = (event) => {
      const box = stage.getBoundingClientRect();
      return { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 };
    };
    const toggleZoom = (anchor) => zoom(scale > 1 ? 1 : 2, anchor);
    async function render() {
      const token = ++request;
      releaseUrl(); pointers.clear(); base = null; pinched = false; lastTap = null;
      stage.classList.remove("is-interacting");
      scale = 1; x = 0; y = 0; paint(); image.hidden = true;
      count.textContent = `${index + 1} / ${ids.length}`;
      count.hidden = ids.length < 2; previous.hidden = next.hidden = ids.length < 2;
      previous.disabled = index === 0; next.disabled = index === ids.length - 1;
      zoomButton.disabled = true; status.hidden = false; status.textContent = "图片加载中…";
      try {
        const blob = await load(ids[index]);
        if (!active || token !== request) return;
        if (!blob) throw new Error("missing image");
        objectUrl = URL.createObjectURL(blob);
        image.alt = `记录图片 ${index + 1}`; image.src = objectUrl;
      } catch {
        if (active && token === request) status.textContent = "图片暂时无法读取";
      }
    }
    function step(direction) {
      const target = index + direction;
      if (target < 0 || target >= ids.length) return;
      index = target; void render();
    }
    function finishClose() {
      if (!active) return;
      active = false; request += 1; releaseUrl(); image.hidden = true;
      pointers.clear(); base = null; stage.classList.remove("is-interacting");
      if (opener?.isConnected) opener.focus();
      else doc.querySelector(".tabbar-btn.active")?.focus();
      opener = null;
    }
    function close() { if (!active) return; dialog.close(); finishClose(); }
    async function open(mediaIds, selectedIndex = 0, trigger = null) {
      if (!mediaIds?.length) return false;
      ids = [...mediaIds]; index = clamp(selectedIndex, 0, ids.length - 1); opener = trigger;
      active = true;
      if (!dialog.open) dialog.showModal();
      closeButton.focus();
      await render();
      return true;
    }
    function captureBase() {
      const points = [...pointers.values()];
      if (!points.length) { base = null; return; }
      const center = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
      base = { center, scale, x, y, distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0 };
    }
    image.addEventListener("load", () => {
      if (!active || !objectUrl) return;
      image.hidden = false; status.hidden = true; zoomButton.disabled = false; fit();
    });
    image.addEventListener("error", () => { if (active && objectUrl) { image.hidden = true; status.hidden = false; status.textContent = "图片暂时无法读取"; } });
    closeButton.addEventListener("click", close);
    previous.addEventListener("click", () => step(-1)); next.addEventListener("click", () => step(1));
    zoomButton.addEventListener("click", () => toggleZoom());
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("close", () => { if (!dialog.open) finishClose(); });
    stage.addEventListener("dblclick", (event) => {
      event.preventDefault();
      if (Date.now() - lastTouchAt > 500 && !image.hidden) toggleZoom(point(event));
    });
    stage.addEventListener("pointerdown", (event) => {
      if (image.hidden || (event.button != null && event.button !== 0)) return;
      pointers.set(event.pointerId, point(event));
      if (pointers.size === 1) pinched = false;
      if (pointers.size > 1) pinched = true;
      captureBase(); stage.setPointerCapture(event.pointerId); stage.classList.add("is-interacting");
    });
    stage.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId) || !base) return;
      pointers.set(event.pointerId, point(event));
      const points = [...pointers.values()];
      if (points.length > 1 && base.distance) {
        const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        scale = clamp(base.scale * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / base.distance, 1, 4);
        x = center.x - (base.center.x - base.x) * scale / base.scale;
        y = center.y - (base.center.y - base.y) * scale / base.scale; paint();
      } else if (scale > 1) {
        x = base.x + points[0].x - base.center.x; y = base.y + points[0].y - base.center.y; paint();
      }
    });
    stage.addEventListener("pointerup", (event) => {
      if (!pointers.has(event.pointerId)) return;
      const end = point(event), dx = end.x - base.center.x, dy = end.y - base.center.y;
      const singleTap = pointers.size === 1 && !pinched && Math.hypot(dx, dy) < 8;
      const swipe = pointers.size === 1 && !pinched && scale === 1 && Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.2;
      pointers.delete(event.pointerId);
      if (event.pointerType === "touch") {
        const now = Date.now(); lastTouchAt = now;
        if (singleTap && lastTap && now - lastTap.at < 300 && Math.hypot(end.x - lastTap.x, end.y - lastTap.y) < 28) { toggleZoom(end); lastTap = null; }
        else lastTap = singleTap ? { ...end, at: now } : null;
      }
      captureBase();
      if (!pointers.size) stage.classList.remove("is-interacting");
      if (swipe) step(dx < 0 ? 1 : -1);
    });
    stage.addEventListener("pointercancel", () => { pointers.clear(); base = null; lastTap = null; stage.classList.remove("is-interacting"); });
    doc.addEventListener("keydown", (event) => {
      if (!active) return;
      event.stopImmediatePropagation?.();
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1); }
      if (["+", "=", "-", "0"].includes(event.key)) { event.preventDefault(); if (!image.hidden) zoom(event.key === "0" ? 1 : scale + (event.key === "-" ? -.5 : .5)); }
    });
    root.window?.addEventListener("resize", () => { pointers.clear(); base = null; stage.classList.remove("is-interacting"); fit(); });
    return { open, close, isOpen: () => active };
  }
  root.SmallWinsImageViewer = { create };
})(typeof globalThis === "undefined" ? this : globalThis);
