(() => {
  "use strict";

  const STORAGE_KEY = "se_state_v1";
  const ROSTER_PREFIX = "se_roster_v1:";
  const VERSION = 1;

  const elScreen = document.getElementById("screen");
  const elHudSub = document.getElementById("hudSub");
  const btnBack = document.getElementById("btnBack");
  const btnRestart = document.getElementById("btnRestart");
  const btnTeacher = document.getElementById("btnTeacher");

  const teacherModal = document.getElementById("teacherModal");
  const teacherCodesEl = document.getElementById("teacherCodes");
  const toggleMassModeEl = document.getElementById("toggleMassMode");
  const importBoxEl = document.getElementById("importBox");
  const importStatusEl = document.getElementById("importStatus");
  const btnImport = document.getElementById("btnImport");
  const btnRunSecretScan = document.getElementById("btnRunSecretScan");
  const btnResetAll = document.getElementById("btnResetAll");

  const detailModal = document.getElementById("detailModal");
  const detailBodyEl = document.getElementById("detailBody");

  const historyStack = [];
  const minigame = { timerId: null };
  const FIXED_CODES = { 2: "1024", 3: "2333", 4: "4068", 5: "6666" };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function $(sel, root = elScreen) {
    return root.querySelector(sel);
  }
  function $all(sel, root = elScreen) {
    return Array.from(root.querySelectorAll(sel));
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function randomInt(minInclusive, maxInclusive) {
    const span = maxInclusive - minInclusive + 1;
    if (span <= 0) return minInclusive;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return minInclusive + (buf[0] % span);
  }

  function random4Digits() {
    return String(randomInt(0, 9999)).padStart(4, "0");
  }

  function normalizeSeat(seatRaw) {
    const cleaned = String(seatRaw || "").trim().replace(/\s+/g, "");
    const m = cleaned.match(/^(\d+)-(\d+)$/);
    if (!m) return null;
    const r = Number(m[1]);
    const c = Number(m[2]);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r <= 0 || c <= 0) return null;
    return `${r}-${c}`;
  }

  function seatToRC(seat) {
    const norm = normalizeSeat(seat);
    if (!norm) return null;
    const [r, c] = norm.split("-").map(Number);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return { r, c };
  }

  function adjacentSeats(a, b) {
    const ra = seatToRC(a);
    const rb = seatToRC(b);
    if (!ra || !rb) return false;
    return ra.r === rb.r && Math.abs(ra.c - rb.c) === 1;
  }

  function formatMass(m) {
    if (!Number.isFinite(m)) return "—";
    return `${m.toFixed(2)} M☉`;
  }

  function tipForMass(m) {
    if (!Number.isFinite(m)) return { kind: "", text: "" };
    if (m < 0.08) return { kind: "bad", text: "核心温度可能不足（< 0.08 M☉）" };
    if (m <= 8) return { kind: "good", text: "典型恒星质量（0.08–8 M☉）" };
    return { kind: "warn", text: "大质量恒星（> 8 M☉）：未来可能发生超新星" };
  }

  function getEndingForMass(m) {
    if (!Number.isFinite(m)) return null;
    if (m < 0.08) return { key: "browndwarf", label: "褐矮星", title: "先帝创业未半" };
    if (m <= 8) return { key: "whitedwarf", label: "白矮星", title: "一直很安静" };
    if (m <= 20) return { key: "neutronstar", label: "中子星", title: "打工人，打工魂" };
    return { key: "blackhole", label: "黑洞", title: "我吃吃吃" };
  }

  function base64EncodeUnicode(text) {
    const utf8 = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
    return btoa(utf8);
  }

  function base64DecodeUnicode(b64) {
    const bin = atob(b64);
    const esc = Array.from(bin)
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("");
    return decodeURIComponent(esc);
  }

  function exportCode(record) {
    return `SE1:${base64EncodeUnicode(JSON.stringify({ v: VERSION, t: Date.now(), record }))}`;
  }

  function importCode(code) {
    const trimmed = String(code || "").trim();
    const m = trimmed.match(/^SE1:([A-Za-z0-9+/=]+)$/);
    if (!m) return { ok: false, error: "格式不对" };
    const payload = safeJsonParse(base64DecodeUnicode(m[1]), null);
    if (!payload || payload.v !== VERSION || !payload.record) return { ok: false, error: "内容损坏/版本不匹配" };
    return { ok: true, record: payload.record };
  }

  function defaultState() {
    return {
      v: VERSION,
      route: "opening",
      galaxyName: "",
      starName: "",
      mass: null,
      adjustmentsLeft: 3,
      massMaxMode: "normal", // normal|expanded
      teacherCodes: null,
      teacherUnlock: { 1: false, 2: false, 3: false, 4: false, 5: false },
      l1Rolled: false,
      l3Order: [null, null, null, null],
      l4Step: 0,
      registry: { className: "", seat: "", epitaph: "", recordId: null, export: "" },
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeJsonParse(raw, null) : null;
    const st = { ...defaultState(), ...(parsed || {}) };
    if (!st.teacherCodes) st.teacherCodes = { 1: random4Digits() };
    if (!st.teacherUnlock) st.teacherUnlock = { 1: false, 2: false, 3: false, 4: false, 5: false };
    return st;
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function rosterKey(className) {
    return `${ROSTER_PREFIX}${String(className || "").trim()}`;
  }

  function loadRoster(className) {
    const raw = localStorage.getItem(rosterKey(className));
    const arr = raw ? safeJsonParse(raw, []) : [];
    return Array.isArray(arr) ? arr : [];
  }

  function saveRoster(className, roster) {
    localStorage.setItem(rosterKey(className), JSON.stringify(roster));
  }

  function upsertRosterRecord(className, record) {
    const roster = loadRoster(className);
    const id = record.id || `rec_${Date.now()}_${randomInt(1000, 9999)}`;
    const now = Date.now();
    const normalized = {
      ...record,
      id,
      className: String(record.className || className || "").trim(),
      seat: normalizeSeat(record.seat) || "",
      updatedAt: now,
      createdAt: record.createdAt || now,
    };
    const idx = roster.findIndex((r) => r && r.id === id);
    if (idx >= 0) roster[idx] = normalized;
    else roster.push(normalized);
    saveRoster(className, roster);
    return normalized;
  }

  function clearMinigame() {
    if (minigame.timerId) window.clearInterval(minigame.timerId);
    minigame.timerId = null;
  }

  function setHud() {
    const name = state.starName ? `⭐ ${state.starName}` : "未命名恒星";
    const m = Number.isFinite(state.mass) ? ` · ${formatMass(state.mass)}` : "";
    elHudSub.textContent = `${name}${m}`;
  }

  function setScreen(html) {
    elScreen.innerHTML = html;
  }

  function pushRoute(nextRoute) {
    clearMinigame();
    if (state.route !== nextRoute) historyStack.push(state.route);
    state.route = nextRoute;
    saveState();
    render();
  }

  function ensureUnlocked(level, nextRoute) {
    // 第一关不需要密码；从第二关开始教师控制解锁
    if (level === 1) return pushRoute(nextRoute);
    if (state.teacherUnlock[level]) return pushRoute(nextRoute);
    state.route = `unlock:${level}:${nextRoute}`;
    saveState();
    render();
  }

  function showTeacherPanel() {
    teacherCodesEl.textContent = `第1关：无需密码\n第2-5关：密码固定（不显示）`;
    toggleMassModeEl.checked = state.massMaxMode === "expanded";
    importStatusEl.textContent = "";
    if (!teacherModal.open) teacherModal.showModal();
  }

  function showDetail(rec) {
    detailBodyEl.innerHTML = `
      <div class="col">
        <div class="panel">
          <div class="panel__title">⭐ ${escapeHtml(rec.starName || "未命名")}</div>
          <div class="hint">座位：<span class="mono">${escapeHtml(rec.seat || "—")}</span> · 质量：<span class="mono">${formatMass(Number(rec.mass))}</span></div>
        </div>
        <div class="panel">
          <div class="panel__title">结局</div>
          <div class="p">${escapeHtml(rec.ending || "—")}${rec.secretBinary ? "（双星触发）" : ""}</div>
          <div class="hint">${escapeHtml(rec.endingTitle || "")}</div>
        </div>
        <div class="panel">
          <div class="panel__title">墓志铭 / 寄语</div>
          <div class="p">${escapeHtml(rec.epitaph || "—")}</div>
        </div>
      </div>
    `;
    detailModal.showModal();
  }

  function computeBinaryIds(roster) {
    const bySeat = new Map();
    roster.forEach((r) => r?.seat && bySeat.set(r.seat, r));
    const ids = new Set();
    for (const r of roster) {
      if (!r?.seat) continue;
      const rc = seatToRC(r.seat);
      if (!rc) continue;
      for (const s of [`${rc.r}-${rc.c - 1}`, `${rc.r}-${rc.c + 1}`]) {
        const other = bySeat.get(s);
        if (!other) continue;
        const m1 = Number(r.mass);
        const m2 = Number(other.mass);
        if (m1 >= 1 && m1 <= 8 && m2 >= 1 && m2 <= 8) {
          ids.add(r.id);
          ids.add(other.id);
        }
      }
    }
    return ids;
  }

  function runBinaryScanForClass(className) {
    const roster = loadRoster(className);
    const ids = computeBinaryIds(roster);
    let updated = 0;
    const next = roster.map((r) => {
      if (!r) return r;
      const should = ids.has(r.id);
      if (Boolean(r.secretBinary) !== should) {
        updated += 1;
        return { ...r, secretBinary: should, updatedAt: Date.now() };
      }
      return r;
    });
    saveRoster(className, next);
    return { updated, pairs: Math.floor(ids.size / 2) };
  }

  function resetRun() {
    clearMinigame();
    const keepCodes = state.teacherCodes;
    const keepMode = state.massMaxMode;
    const keepClass = state.registry.className;

    state = defaultState();
    state.teacherCodes = keepCodes;
    state.massMaxMode = keepMode;
    state.registry.className = keepClass || "";
    saveState();
    historyStack.length = 0;
    render();
  }

  function hardResetAll() {
    clearMinigame();
    localStorage.clear();
    state = loadState();
    historyStack.length = 0;
    render();
  }

  function renderOpening() {
    setScreen(`
      <div class="col">
        <div class="h1">开场：欢迎来到宇宙</div>
        <div class="p muted">在一片分子云中，一团气体正在坍缩。那就是你。</div>
        <div class="panel">
          <div class="panel__title">命名班级星系</div>
          <input class="input" id="galaxyName" placeholder="例如：高二3班 / 3-2班 / 2026A" value="${escapeHtml(state.galaxyName)}" />
          <div class="hint" style="margin-top:8px">会用于星系标题，也会作为默认“班级”名称。</div>
        </div>
        <div class="panel">
          <div class="panel__title">请输入你的恒星名称</div>
          <input class="input" id="starName" placeholder="例如：小灯一号 / RX-03 / 打工星" value="${escapeHtml(state.starName)}" />
          <div class="hint" style="margin-top:8px">变量保存：<span class="mono">starName</span></div>
        </div>
        <button class="btn" id="btnIgnite">点燃宇宙</button>
      </div>
    `);

    $("#btnIgnite")?.addEventListener("click", () => {
      const galaxyName = String($("#galaxyName")?.value || "").trim();
      const name = String($("#starName")?.value || "").trim();
      if (!galaxyName) return $("#galaxyName")?.focus();
      if (!name) return $("#starName")?.focus();
      state.galaxyName = galaxyName.slice(0, 32);
      if (!String(state.registry.className || "").trim()) state.registry.className = state.galaxyName;
      state.starName = name.slice(0, 24);
      saveState();
      ensureUnlocked(1, "l1");
    });
  }

  function renderUnlock() {
    const parts = String(state.route).split(":");
    const level = Number(parts[1]);
    const nextRoute = parts.slice(2).join(":");

    setScreen(`
      <div class="col">
        <div class="h1">第${level}关：需要老师解锁</div>
        <div class="p muted">请输入该关的 4 位数解锁码（学生不能跳关）。</div>
        <div class="panel">
          <div class="panel__title">解锁码</div>
          <input class="input mono" id="unlockCode" inputmode="numeric" maxlength="4" placeholder="4 位数" />
          <div class="hint" id="unlockHint" style="margin-top:8px"></div>
        </div>
        <button class="btn" id="btnUnlock">解锁并进入</button>
        <div class="toast hint">老师可在右上角 <span class="kbd">教师</span> 面板查看随机解锁码。</div>
      </div>
    `);

    $("#btnUnlock")?.addEventListener("click", () => {
      const code = String($("#unlockCode")?.value || "").trim();
      const expected = FIXED_CODES[level] ?? state.teacherCodes[level];
      if (code === expected) {
        state.teacherUnlock[level] = true;
        saveState();
        pushRoute(nextRoute || `l${level}`);
        return;
      }
      const hint = $("#unlockHint");
      if (hint) hint.textContent = "解锁失败：解锁码不正确。";
      $("#unlockCode")?.focus();
    });
  }

  function renderL1() {
    if (!state.l1Rolled || !Number.isFinite(state.mass)) {
      const max = state.massMaxMode === "expanded" ? 30 : 15;
      // 增加 <0.08 的概率：分段抽样
      const lowProb = 0.08; // 8% 概率落入褐矮星范围
      const roll = randomInt(0, 9999) / 10000;
      let raw;
      if (roll < lowProb) {
        raw = randomInt(3, 7) / 100; // 0.03–0.07
      } else {
        raw = randomInt(8, max * 100) / 100; // 0.08–max
      }
      state.mass = clamp(raw, 0.03, max);
      state.adjustmentsLeft = 3;
      state.l1Rolled = true;
      saveState();
    }

    const tip = tipForMass(state.mass);
    const chipClass = tip.kind === "good" ? "chip--good" : tip.kind === "warn" ? "chip--warn" : tip.kind === "bad" ? "chip--bad" : "";

    setScreen(`
      <div class="col">
        <div class="h1">第一关：原恒星形成（恒星妊娠期）</div>
        <div class="p muted">教学目标：恒星质量决定命运。</div>

        <div class="panel">
          <div class="panel__title">你的初始质量</div>
          <div class="p"><span class="mono">⭐ ${formatMass(state.mass)}</span></div>
          <div class="p muted">你仍处在吸积阶段。你可以改变自己的质量。</div>
          <div class="row" style="flex-wrap:wrap">
            <span class="chip ${chipClass}">提示：${escapeHtml(tip.text)}</span>
            <span class="chip">剩余调整次数：<span class="mono">${state.adjustmentsLeft}</span></span>
          </div>
        </div>

        <div class="grid2">
          <button class="btn" id="btnAccrete" ${state.adjustmentsLeft <= 0 ? "disabled" : ""}>吸积气体 +0.5</button>
          <button class="btn btn--ghost" id="btnEject" ${state.adjustmentsLeft <= 0 ? "disabled" : ""}>抛射物质 -0.3</button>
        </div>
        <button class="btn btn--ghost" id="btnHold" ${state.adjustmentsLeft <= 0 ? "disabled" : ""}>保持现状</button>

        <div class="hr"></div>
        <button class="btn" id="btnIgniteCore">点燃核心</button>
      </div>
    `);

    function spendTurn(delta) {
      if (state.adjustmentsLeft <= 0) return;
      state.adjustmentsLeft -= 1;
      state.mass = clamp((state.mass || 0) + delta, 0.01, 60);
      saveState();
      render();
    }

    $("#btnAccrete")?.addEventListener("click", () => spendTurn(0.5));
    $("#btnEject")?.addEventListener("click", () => spendTurn(-0.3));
    $("#btnHold")?.addEventListener("click", () => spendTurn(0));

    $("#btnIgniteCore")?.addEventListener("click", () => {
      if (Number(state.mass) < 0.08) return pushRoute("end:browndwarf");
      pushRoute("l1done");
    });
  }

  function renderL1Done() {
    setScreen(`
      <div class="col">
        <div class="h1">第一关完成：恒星点燃</div>
        <div class="panel">
          <div class="p">你的核心温度足够高，氢聚变得以启动。</div>
          <div class="p muted">接下来，我们要学习主序星阶段如何通过<span class="mono">引力</span>与<span class="mono">辐射压</span>维持稳定。</div>
          <div class="row" style="flex-wrap:wrap">
            <span class="chip">当前质量：<span class="mono">${formatMass(Number(state.mass))}</span></span>
          </div>
        </div>
        <button class="btn" id="btnNextL2">继续：进入第二关</button>
      </div>
    `);
    $("#btnNextL2")?.addEventListener("click", () => ensureUnlocked(2, "l2"));
  }

  function renderL2() {
    setScreen(`
      <div class="col">
        <div class="h1">第二关：主序星平衡小游戏（恒星青少年期）</div>
        <div class="p muted">教学目标：引力 vs 核聚变。用“按住加热、松手冷却”维持平衡，在 15 秒内把稳定度推到 100。</div>

        <div class="arena">
          <div class="arena__center">
            <div class="arrow">重力<br/>↓↓↓</div>
            <div class="core"><span class="core__glow">恒星核心</span></div>
            <div class="arrow">辐射压<br/>↑↑↑</div>
          </div>

          <div class="bars">
            <div class="bar">
              <div class="bar__label">恒星稳定度</div>
              <div class="bar__track"><div class="bar__fill" id="barSt"></div></div>
              <div class="bar__value mono" id="vSt">—</div>
            </div>
            <div class="bar">
              <div class="bar__label">重力压力</div>
              <div class="bar__track"><div class="bar__fill" id="barG"></div></div>
              <div class="bar__value mono" id="vG">—</div>
            </div>
            <div class="bar">
              <div class="bar__label">核聚变压力</div>
              <div class="bar__track"><div class="bar__fill" id="barF"></div></div>
              <div class="bar__value mono" id="vF">—</div>
            </div>
          </div>

          <div class="row" style="justify-content:space-between; margin-top:12px">
            <div class="hint">剩余时间：<span class="mono" id="timeLeft">15.0</span>s</div>
            <div class="hint" id="miniHint"></div>
          </div>

          <button class="btn" id="btnHold" style="margin-top:12px">按住加热</button>
          <button class="btn" id="btnStart" style="margin-top:10px">开始挑战</button>
        </div>
      </div>
    `);

    const TARGET_MS = 15000;
    const st = { stability: 65, gravity: 48 + randomInt(0, 6), fusion: 50, elapsed: 0, running: false, holding: false };
    const tickMs = 250;

    const elBarSt = $("#barSt");
    const elBarG = $("#barG");
    const elBarF = $("#barF");
    const elVSt = $("#vSt");
    const elVG = $("#vG");
    const elVF = $("#vF");
    const elTime = $("#timeLeft");
    const elHint = $("#miniHint");
    const btnStart = $("#btnStart");
    const btnHold = $("#btnHold");

    function setBar(el, v) {
      if (!el) return;
      el.style.width = `${clamp(v, 0, 100)}%`;
    }

    function uiUpdate() {
      setBar(elBarSt, st.stability);
      setBar(elBarG, st.gravity);
      setBar(elBarF, st.fusion);
      if (elVSt) elVSt.textContent = st.stability.toFixed(0);
      if (elVG) elVG.textContent = st.gravity.toFixed(0);
      if (elVF) elVF.textContent = st.fusion.toFixed(0);
      if (elTime) elTime.textContent = (Math.max(0, TARGET_MS - st.elapsed) / 1000).toFixed(1);
    }

    function stop(msg, color) {
      st.running = false;
      clearMinigame();
      if (elHint) {
        elHint.textContent = msg;
        elHint.style.color = color;
      }
      if (btnStart) btnStart.disabled = false;
    }

    function start() {
      clearMinigame();
      st.running = true;
      st.stability = 65;
      st.gravity = 48 + randomInt(0, 6);
      st.fusion = 50;
      st.elapsed = 0;
      st.holding = false;
      if (btnStart) btnStart.disabled = true;
      if (elHint) {
        elHint.textContent = "让重力与核聚变尽量接近平衡，稳定度才会上升。";
        elHint.style.color = "rgba(245,246,255,.68)";
      }
      uiUpdate();

      minigame.timerId = window.setInterval(() => {
        if (!st.running) return;
        st.elapsed += tickMs;
        st.gravity = clamp(st.gravity + 0.5, 0, 100);
        if (st.holding) {
          st.fusion = clamp(st.fusion + 2.6, 0, 100);
        } else {
          st.fusion = clamp(st.fusion - 1.7, 0, 100);
        }
        const diff = Math.abs(st.gravity - st.fusion);
        const balance = clamp(1 - diff / 12, 0, 1); // 越接近越高
        const overheat = st.fusion > st.gravity + 10 ? (st.fusion - st.gravity - 10) * 0.06 : 0;
        const gain = 2 * balance;
        const decay = 0.6 + (1 - balance) * 0.9 + overheat;
        st.stability = clamp(st.stability + gain - decay, 0, 100);
        uiUpdate();
        if (st.stability <= 0) return stop("失败：稳定度崩溃。重新挑战。", "rgba(251,113,133,.95)");
        if (st.stability >= 100) {
          stop("成功：稳定度达到 100，主序星平衡建立！", "rgba(52,211,153,.95)");
          pushRoute("l2done");
        }
        if (st.elapsed >= TARGET_MS) {
          stop("失败：时间到但稳定度未达 100。", "rgba(251,113,133,.95)");
        }
      }, tickMs);
    }

    $("#btnStart")?.addEventListener("click", start);
    const setHolding = (val) => {
      if (!st.running) return;
      st.holding = val;
      if (btnHold) btnHold.textContent = val ? "加热中…" : "按住加热";
    };
    btnHold?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btnHold.setPointerCapture(e.pointerId);
      setHolding(true);
    });
    btnHold?.addEventListener("pointerup", (e) => {
      e.preventDefault();
      setHolding(false);
      btnHold.releasePointerCapture(e.pointerId);
    });
    btnHold?.addEventListener("pointerleave", () => setHolding(false));
    btnHold?.addEventListener("pointercancel", () => setHolding(false));

    uiUpdate();
  }

  function renderL2Done() {
    setScreen(`
      <div class="col">
        <div class="h1">第二关完成：主序星稳定</div>
        <div class="panel">
          <div class="p">你成功让恒星在引力与核聚变的对抗中保持平衡。</div>
          <div class="p muted">现实中，这意味着恒星可以稳定燃烧数十亿年（取决于质量）。</div>
          <div class="row" style="flex-wrap:wrap">
            <span class="chip">当前质量：<span class="mono">${formatMass(Number(state.mass))}</span></span>
          </div>
        </div>
        <button class="btn" id="btnNextL3">继续：进入第三关</button>
      </div>
    `);
    $("#btnNextL3")?.addEventListener("click", () => ensureUnlocked(3, "l3"));
  }

  function renderL3() {
    const steps = [
      { id: 0, text: "氢燃料逐渐不足，核心堆积“炉渣”氦" },
      {
        id: 1,
        text: "核心收缩：温度不足以点燃氦聚变，失去热压力支撑，引力能转化为热能",
      },
      {
        id: 2,
        text: "壳层聚变：核心升温，热压力迅速增加，核心收缩、外壳膨胀",
      },
      {
        id: 3,
        text: "核心氦开始燃烧，热压力与引力再平衡；外壳温度低于 4000K，发红变大，形成红巨星",
      },
    ];

    const order = Array.isArray(state.l3Order) ? state.l3Order.slice(0, 4) : [null, null, null, null];
    while (order.length < 4) order.push(null);
    const used = new Set(order.filter((v) => v !== null));
    const pool = steps.filter((s) => !used.has(s.id));
    const isComplete = order.every((v) => v !== null);
    const isCorrect = isComplete && order.every((v, i) => v === i);

    setScreen(`
      <div class="col">
        <div class="h1">第三关：恒星中年危机</div>
        <div class="p muted">将“恒星面临的中年危机的因果链”拖拽排序，从上到下排列正确顺序。</div>

        <div class="panel">
          <div class="panel__title">拖拽排序（从上到下）</div>
          <div class="hint" id="l3Hint">把卡片拖入排序区。</div>
        </div>

        <div class="dragArea">
          <div class="dragCol">
            <div class="dragCol__title">卡片池</div>
            <div class="dragPool" id="dragPool" data-drop="pool">
              ${pool
                .map(
                  (s) => `
                    <div class="dragCard" draggable="true" data-id="${s.id}">
                      ${escapeHtml(s.text)}
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="dragCol">
            <div class="dragCol__title">排序区</div>
            <div class="dragSlots">
              ${order
                .map((id, idx) => {
                  const step = steps.find((s) => s.id === id);
                  return `
                    <div class="dragSlot" data-drop="slot" data-slot="${idx}">
                      <div class="dragSlot__index">第 ${idx + 1} 步</div>
                      <div class="dragSlot__body">
                        ${
                          step
                            ? `<div class="dragCard" draggable="true" data-id="${step.id}">${escapeHtml(step.text)}</div>`
                            : `<div class="dragPlaceholder">拖拽到这里</div>`
                        }
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        </div>

        <div class="row" style="justify-content:flex-end; gap:8px">
          <button class="btn btn--ghost" id="btnL3Reset">重置排序</button>
          <button class="btn" id="btnL3Check" ${isComplete ? "" : "disabled"}>检查顺序</button>
        </div>
      </div>
    `);

    const hint = $("#l3Hint");

    function updateOrder(nextOrder) {
      state.l3Order = nextOrder;
      saveState();
      renderL3();
    }

    function handleDropToSlot(slotIndex, cardId) {
      const next = Array.isArray(state.l3Order) ? state.l3Order.slice(0, 4) : [null, null, null, null];
      const currentIndex = next.indexOf(cardId);
      if (currentIndex >= 0) next[currentIndex] = null;
      next[slotIndex] = cardId;
      updateOrder(next);
    }

    function handleDropToPool(cardId) {
      const next = Array.isArray(state.l3Order) ? state.l3Order.slice(0, 4) : [null, null, null, null];
      const currentIndex = next.indexOf(cardId);
      if (currentIndex >= 0) next[currentIndex] = null;
      updateOrder(next);
    }

    $all(".dragCard").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        const id = card.getAttribute("data-id");
        e.dataTransfer?.setData("text/plain", id ?? "");
        e.dataTransfer?.setDragImage(card, 10, 10);
      });
      card.addEventListener("pointerdown", (e) => {
        // Prevent long-press text selection on touch only
        if (e.pointerType === "touch") e.preventDefault();
      });
    });

    $all("[data-drop='slot']").forEach((slot) => {
      slot.addEventListener("dragover", (e) => e.preventDefault());
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer?.getData("text/plain"));
        const slotIndex = Number(slot.getAttribute("data-slot"));
        if (!Number.isFinite(id) || !Number.isFinite(slotIndex)) return;
        handleDropToSlot(slotIndex, id);
      });
    });

    const poolEl = $("#dragPool");
    poolEl?.addEventListener("dragover", (e) => e.preventDefault());
    poolEl?.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = Number(e.dataTransfer?.getData("text/plain"));
      if (!Number.isFinite(id)) return;
      handleDropToPool(id);
    });

    // Tap-to-place fallback for mobile
    let selectedId = null;
    function setSelected(id) {
      selectedId = id;
      $all(".dragCard").forEach((c) => c.classList.remove("is-selected"));
      if (id === null) return;
      const target = $all(".dragCard").find((c) => Number(c.getAttribute("data-id")) === id);
      target?.classList.add("is-selected");
      if (hint) {
        hint.textContent = "已选中卡片，请点击排序区的空位放置。";
        hint.style.color = "rgba(245,246,255,.68)";
      }
    }

    $all(".dragCard").forEach((card) => {
      card.addEventListener("click", () => {
        const id = Number(card.getAttribute("data-id"));
        if (!Number.isFinite(id)) return;
        setSelected(id);
      });
    });

    $all("[data-drop='slot']").forEach((slot) => {
      slot.addEventListener("click", () => {
        if (selectedId === null) return;
        const slotIndex = Number(slot.getAttribute("data-slot"));
        if (!Number.isFinite(slotIndex)) return;
        handleDropToSlot(slotIndex, selectedId);
      });
    });

    poolEl?.addEventListener("click", () => setSelected(null));

    $("#btnL3Reset")?.addEventListener("click", () => updateOrder([null, null, null, null]));

    $("#btnL3Check")?.addEventListener("click", () => {
      if (!isComplete) return;
      if (isCorrect) {
        if (hint) {
          hint.textContent = "正确：这条因果链最终让恒星外壳变大变红，形成红巨星。";
          hint.style.color = "rgba(52,211,153,.95)";
        }
        setTimeout(() => pushRoute("l3done"), 600);
      } else {
        if (hint) {
          hint.textContent = "顺序不对：请再次思考“核心收缩 → 壳层聚变 → 红巨星”的因果关系。";
          hint.style.color = "rgba(251,191,36,.95)";
        }
        if (navigator.vibrate) navigator.vibrate(30);
      }
    });
  }

  function renderL3Done() {
    const mass = Number(state.mass);
    const isMid = Number.isFinite(mass) && mass <= 8;
    const title = isMid ? "第三关完成：红巨星阶段" : "第三关完成：超巨星序章";
    const lines = isMid
      ? [
          "核心收缩与壳层聚变让外壳变大变红，恒星进入红巨星阶段。",
          "对中质量恒星而言，这已经是主反应的终点，之后将进入行星状星云与白矮星阶段。",
        ]
      : [
          "核心收缩与壳层聚变让恒星进入“超巨星”阶段。",
          "对大质量恒星而言，这只是更重元素聚变的开端，真正的命运分叉还在后面。",
        ];

    setScreen(`
      <div class="col">
        <div class="h1">${escapeHtml(title)}</div>
        <div class="panel">
          <div class="p">${escapeHtml(lines[0])}</div>
          <div class="p muted">${escapeHtml(lines[1])}</div>
        </div>
        <button class="btn" id="btnNextL4">继续：进入第四关</button>
      </div>
    `);
    $("#btnNextL4")?.addEventListener("click", () => ensureUnlocked(4, "l4"));
  }

  function renderL4() {
    const m = Number(state.mass);
    if (m <= 8) {
      setScreen(`
        <div class="col">
          <div class="h1">第四关：命运分叉路口（行星状星云）</div>
          <div class="p muted">外层气体被缓慢抛出，形成行星状星云。核心留下白矮星。</div>
          <div class="nebula" aria-hidden="true"></div>
          <button class="btn" id="btnToL5">继续：最终命运</button>
        </div>
      `);
      $("#btnToL5")?.addEventListener("click", () => ensureUnlocked(5, "l5"));
      return;
    }

    // 洋葱层：从外到内填写元素
    const layers = ["氢", "氦", "碳", "氧", "硅", "铁"];
    const filledCount = clamp(Number(state.l4Step || 0), 0, layers.length);
    const nextIndex = filledCount;
    const completed = filledCount >= layers.length;
    const options = layers.slice();

    const onionHtml = layers
      .map((_, i) => {
        const filled = i < filledCount;
        const active = i === nextIndex && !completed;
        const isCore = i === layers.length - 1;
        const label = filled ? layers[i] : active ? "？" : "";
        return `<div class="onion__layer ${filled ? "is-filled" : ""} ${active ? "is-active" : ""} ${isCore ? "is-core" : ""}" style="--i:${i}" data-layer="${i}"><span class="onion__label">${escapeHtml(
          label
        )}</span></div>`;
      })
      .join("");

    setScreen(`
      <div class="col">
        <div class="h1">第四关：命运分叉路口（大质量恒星的“洋葱层”）</div>
        <div class="p muted">请从外到内填写每一层发生核聚变的元素：</div>

        <div class="onionWrap">
          <div class="onion" aria-label="恒星洋葱层结构（从外到内）">
            ${onionHtml}
          </div>

          <div class="panel">
            <div class="panel__title">互动：填“洋葱层”</div>
            <div class="p">
              ${
                completed
                  ? `你已填完所有层。铁无法再释放能量：核心失去支撑，坍缩将引发爆发。`
                  : `现在请填写：第 <span class="mono">${nextIndex + 1}</span> 层（从外到内）`
              }
            </div>
            <div class="hint" id="onionHint"></div>
            <div class="grid2" style="margin-top:10px">
              ${options
                .map((e, i) => {
                  const used = i < filledCount;
                  return `<button class="btn ${used ? "btn--ghost" : ""}" ${used ? "disabled" : ""} data-pick="${escapeHtml(
                    e
                  )}" type="button">${escapeHtml(e)}</button>`;
                })
                .join("")}
            </div>
          </div>
        </div>

        ${completed ? `<div class="explosion" aria-hidden="true"></div>` : ""}
        <div class="row" style="justify-content:flex-end; gap:8px">
          ${
            completed
              ? `<button class="btn" id="btnSupernova" type="button">超新星爆发</button>`
              : `<button class="btn btn--ghost" id="btnOnionReset" type="button">重置填写</button>`
          }
        </div>
      </div>
    `);

    $all("[data-pick]").forEach((b) =>
      b.addEventListener("click", (e) => {
        if (completed) return;
        const pick = e.currentTarget?.getAttribute("data-pick") || "";
        const need = layers[nextIndex];
        const hint = $("#onionHint");
        if (pick === need) {
          state.l4Step = clamp(filledCount + 1, 0, layers.length);
          saveState();
          render();
          return;
        }
        if (hint) {
          hint.textContent = `不对：这一层更接近“${need}”的聚变阶段。再试一次。`;
          hint.style.color = "rgba(251,191,36,.95)";
        }
        if (navigator.vibrate) navigator.vibrate(30);
      })
    );

    $("#btnOnionReset")?.addEventListener("click", () => {
      state.l4Step = 0;
      saveState();
      render();
    });

    $("#btnSupernova")?.addEventListener("click", () => ensureUnlocked(5, "l5"));
  }

  function renderL5() {
    const end = getEndingForMass(Number(state.mass));
    if (!end) return pushRoute("opening");

    const text =
      end.key === "whitedwarf"
        ? "你缓慢冷却。在宇宙中安静存在数十亿年。"
        : end.key === "neutronstar"
          ? "一个茶匙物质，重达 10 亿吨。"
          : end.key === "blackhole"
            ? "连光也无法逃离你的引力。"
            : "你的核心温度不够，氢聚变没有发生。";

    setScreen(`
      <div class="col">
        <div class="h1">第五关：恒星结局</div>
        <div class="panel">
          <div class="panel__title">结局：${escapeHtml(end.label)}</div>
          <div class="p">${escapeHtml(text)}</div>
          <div class="row" style="flex-wrap:wrap">
            <span class="chip">质量：<span class="mono">${formatMass(Number(state.mass))}</span></span>
            <span class="chip chip--good">结局名：<span class="mono">${escapeHtml(end.title)}</span></span>
          </div>
        </div>
        <button class="btn" id="btnRegistry">宇宙登记</button>
      </div>
    `);

    $("#btnRegistry")?.addEventListener("click", () => pushRoute("registry"));
  }

  function renderBrownDwarfEnd() {
    setScreen(`
      <div class="col">
        <div class="h1">结局：褐矮星</div>
        <div class="panel">
          <div class="p">你的核心温度不够。</div>
          <div class="p">氢聚变没有发生。</div>
          <div class="p">你成为了——<span class="mono">褐矮星</span></div>
          <div class="hr"></div>
          <div class="p"><span class="mono">结局：先帝创业未半</span></div>
        </div>
        <button class="btn" id="btnRestart2">重新开始</button>
      </div>
    `);
    $("#btnRestart2")?.addEventListener("click", resetRun);
  }

  function renderRegistry() {
    const end = getEndingForMass(Number(state.mass));

    setScreen(`
      <div class="col">
        <div class="h1">宇宙登记</div>
        <div class="p muted">输入班级与座位号，生成“登记码”。</div>

        <div class="panel">
          <div class="row" style="flex-wrap:wrap">
            <span class="chip">⭐ <span class="mono">${escapeHtml(state.starName || "未命名")}</span></span>
            <span class="chip">质量：<span class="mono">${formatMass(Number(state.mass))}</span></span>
            <span class="chip">结局：<span class="mono">${escapeHtml(end?.label || "—")}</span></span>
          </div>
        </div>

        <div class="grid2">
          <div class="panel">
            <div class="panel__title">班级</div>
            <input class="input" id="className" placeholder="例如：3-2班" value="${escapeHtml(state.registry.className || state.galaxyName || "")}" />
          </div>
          <div class="panel">
            <div class="panel__title">座位号</div>
            <input class="input mono" id="seat" placeholder="例如：3-2" value="${escapeHtml(state.registry.seat || "")}" />
            <div class="hint" style="margin-top:6px">格式：<span class="mono">行-列</span>，如 <span class="mono">3-2</span></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel__title">墓志铭 / 寄语</div>
          <textarea class="textarea" id="epitaph" rows="3" placeholder="写一句属于你的恒星的话">${escapeHtml(
            state.registry.epitaph || ""
          )}</textarea>
        </div>

        <button class="btn" id="btnSaveRegistry">提交登记</button>

        <div class="panel" id="exportPanel" style="display:none">
          <div class="panel__title">登记码（离线汇总用）</div>
          <div class="hint">复制后发给老师；老师可在“教师控制台”批量导入，生成全班星系地图。</div>
          <textarea class="textarea mono" id="exportBox" rows="4" readonly></textarea>
          <div class="row" style="justify-content:flex-end; gap:8px; margin-top:8px">
            <button class="btn btn--ghost" id="btnCopyCode" type="button">复制登记码</button>
            <button class="btn" id="btnToSecret" type="button">继续</button>
          </div>
          <div class="hint" id="copyHint" style="margin-top:6px"></div>
        </div>
      </div>
    `);

    $("#btnSaveRegistry")?.addEventListener("click", async () => {
      const className = String($("#className")?.value || "").trim();
      const seat = normalizeSeat($("#seat")?.value || "");
      const epitaph = String($("#epitaph")?.value || "").trim().slice(0, 80);
      if (!className) return $("#className")?.focus();
      if (!seat) return $("#seat")?.focus();

      const ending = getEndingForMass(Number(state.mass));
      const saved = upsertRosterRecord(className, {
        id: state.registry.recordId,
        starName: state.starName,
        mass: Number(state.mass),
        ending: ending?.label || "",
        endingTitle: ending?.title || "",
        epitaph,
        className,
        seat,
      });

      state.registry.className = className;
      state.registry.seat = seat;
      state.registry.epitaph = epitaph;
      state.registry.recordId = saved.id;
      state.registry.export = exportCode(saved);
      saveState();

      const panel = $("#exportPanel");
      const box = $("#exportBox");
      if (panel) panel.style.display = "block";
      if (box) box.value = state.registry.export;

      const hint = $("#copyHint");
      try {
        await navigator.clipboard.writeText(state.registry.export);
        if (hint) hint.textContent = "已复制登记码。";
      } catch {
        if (hint) hint.textContent = "请手动长按复制。";
      }
    });

    $("#btnCopyCode")?.addEventListener("click", async () => {
      const hint = $("#copyHint");
      try {
        await navigator.clipboard.writeText(state.registry.export || "");
        if (hint) hint.textContent = "已复制登记码。";
      } catch {
        if (hint) hint.textContent = "复制失败：请手动复制。";
      }
    });

    $("#btnToSecret")?.addEventListener("click", () => pushRoute("secret"));
  }

  function renderSecret() {
    const className = String(state.registry.className || "").trim();
    const recordId = state.registry.recordId;
    if (!className || !recordId) return pushRoute("registry");

    const roster = loadRoster(className);
    const me = roster.find((r) => r && r.id === recordId);
    if (!me) return pushRoute("registry");

    const meMass = Number(me.mass);
    const partner = roster.find(
      (r) =>
        r &&
        r.id !== me.id &&
        adjacentSeats(me.seat, r.seat) &&
        meMass >= 1 &&
        meMass <= 8 &&
        Number(r.mass) >= 1 &&
        Number(r.mass) <= 8
    );

    if (partner) {
      runBinaryScanForClass(className);
      setScreen(`
        <div class="col">
          <div class="h1">隐藏结局触发：双星系统</div>
          <div class="panel">
            <div class="p">你并不是孤独的一颗星。</div>
            <div class="p">你和另一颗恒星互相环绕。</div>
            <div class="hr"></div>
            <div class="p">当白矮星吸积伴星物质——质量突破<span class="mono">钱德拉塞卡极限</span>，Ia 型超新星爆发。</div>
            <div class="p"><span class="mono">隐藏结局：不要小瞧我们之间的羁绊啊</span></div>
          </div>
          <button class="btn" id="btnToMap">进入班级星系地图</button>
        </div>
      `);
      $("#btnToMap")?.addEventListener("click", () => pushRoute("map"));
      return;
    }

    setScreen(`
      <div class="col">
        <div class="h1">隐藏结局检测</div>
        <div class="panel">
          <div class="p muted">规则：两颗恒星质量 <span class="mono">1–8 M☉</span> 且座位相邻，触发“双星系统”。</div>
          <div class="p">暂未发现你的双星伙伴。</div>
          <div class="hint">无服务器模式下，需要把相邻座位同学的登记码导入到同一台设备（老师的手机通常最方便）。</div>
        </div>
        <button class="btn" id="btnToMap2">进入班级星系地图</button>
      </div>
    `);
    $("#btnToMap2")?.addEventListener("click", () => pushRoute("map"));
  }

  function renderMap() {
    const className = String(state.registry.className || "").trim();
    if (!className) return pushRoute("registry");

    const roster = loadRoster(className)
      .filter((r) => r && r.className === className)
      .slice()
      .sort((a, b) => {
        const ra = seatToRC(a.seat) || { r: 9999, c: 9999 };
        const rb = seatToRC(b.seat) || { r: 9999, c: 9999 };
        return ra.r !== rb.r ? ra.r - rb.r : ra.c - rb.c;
      });

    const binaryIds = computeBinaryIds(roster);
    const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(Math.max(1, roster.length)))));

    setScreen(`
      <div class="col">
        <div class="h1">${
          escapeHtml(
            state.galaxyName
              ? state.galaxyName.endsWith("星系")
                ? state.galaxyName
                : state.galaxyName + "星系"
              : className + "班星系"
          )
        }</div>
        <div class="p muted">每颗星代表一位同学。点击查看详情。</div>

        <div class="row" style="flex-wrap:wrap">
          <span class="chip">已登记：<span class="mono">${roster.length}</span></span>
          <span class="chip chip--warn">双星标记：黄色</span>
        </div>

        <div class="galaxy__grid" style="grid-template-columns: repeat(${cols}, 1fr)">
          ${
            roster.length
              ? roster
                  .map((rec) => {
                    const isBinary = binaryIds.has(rec.id) || Boolean(rec.secretBinary);
                    return `
                      <button class="starBtn ${isBinary ? "starBtn--binary" : ""}" data-star-id="${escapeHtml(rec.id)}" type="button" title="${escapeHtml(
                        rec.starName || ""
                      )}">
                        ⭐<span class="mono small" style="margin-left:6px">${escapeHtml(rec.seat || "")}</span>
                      </button>
                    `;
                  })
                  .join("")
              : `<div class="hint">暂无数据：需要先完成“宇宙登记”，或让老师导入登记码。</div>`
          }
        </div>

        <div class="toast hint">无服务器小技巧：老师把所有学生的登记码导入到同一台手机后，就能看到完整“班级星系”。</div>
      </div>
    `);

    $all("[data-star-id]").forEach((b) =>
      b.addEventListener("click", (e) => {
        const id = e.currentTarget?.getAttribute("data-star-id");
        const rec = roster.find((r) => r && r.id === id);
        if (rec) showDetail(rec);
      })
    );
  }

  function render() {
    clearMinigame();
    setHud();

    btnBack.disabled = historyStack.length === 0;
    btnRestart.disabled = state.route === "opening";

    if (state.route === "opening") return renderOpening();
    if (state.route.startsWith("unlock:")) return renderUnlock();
    if (state.route === "l1") return renderL1();
    if (state.route === "l1done") return renderL1Done();
    if (state.route === "l2") return renderL2();
    if (state.route === "l2done") return renderL2Done();
    if (state.route === "l3") return renderL3();
    if (state.route === "l3done") return renderL3Done();
    if (state.route === "l4") return renderL4();
    if (state.route === "l5") return renderL5();
    if (state.route === "registry") return renderRegistry();
    if (state.route === "secret") return renderSecret();
    if (state.route === "map") return renderMap();
    if (state.route === "end:browndwarf") return renderBrownDwarfEnd();

    state.route = "opening";
    saveState();
    renderOpening();
  }

  function startStarfield() {
    const canvas = document.getElementById("starfield");
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars = [];

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp((w * h) / 14000, 70, 140));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        s: Math.random() * 0.45 + 0.15,
        a: Math.random() * 0.65 + 0.25,
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        st.y += st.s;
        if (st.y > h + 10) {
          st.y = -10;
          st.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(245,246,255,${st.a})`;
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    requestAnimationFrame(tick);
  }

  btnBack.addEventListener("click", () => {
    clearMinigame();
    const prev = historyStack.pop();
    if (!prev) return;
    state.route = prev;
    saveState();
    render();
  });

  btnRestart.addEventListener("click", () => {
    const ok = confirm("只重置本次游戏进度（不清空已导入的班级星系数据）。继续吗？");
    if (ok) resetRun();
  });

  btnTeacher.addEventListener("click", showTeacherPanel);

  toggleMassModeEl.addEventListener("change", () => {
    state.massMaxMode = toggleMassModeEl.checked ? "expanded" : "normal";
    saveState();
    // 保持面板数据同步
    showTeacherPanel();
  });

  btnImport.addEventListener("click", () => {
    const lines = String(importBoxEl.value || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      importStatusEl.textContent = "没有检测到登记码。";
      return;
    }

    let ok = 0;
    let bad = 0;
    const touched = new Set();
    for (const line of lines) {
      const res = importCode(line);
      if (!res.ok) {
        bad += 1;
        continue;
      }
      const rec = res.record;
      const className = String(rec.className || "").trim();
      if (!className) {
        bad += 1;
        continue;
      }
      upsertRosterRecord(className, rec);
      touched.add(className);
      ok += 1;
    }

    importStatusEl.textContent = `导入完成：成功 ${ok} 条，失败 ${bad} 条。`;
    if (!state.registry.className && touched.size === 1) {
      state.registry.className = Array.from(touched)[0];
      saveState();
    }
  });

  btnRunSecretScan.addEventListener("click", () => {
    const className = String(state.registry.className || "").trim();
    if (!className) {
      importStatusEl.textContent = "请先导入登记码，或先完成一次“宇宙登记”。";
      return;
    }
    const res = runBinaryScanForClass(className);
    importStatusEl.textContent = `双星检测完成：更新 ${res.updated} 条记录（约 ${res.pairs} 组配对）。`;
    if (state.route === "map") render();
  });

  btnResetAll.addEventListener("click", () => {
    const ok = confirm("这会清空本机所有数据（包含班级星系与关卡解锁码）。确定吗？");
    if (ok) hardResetAll();
  });

  // init
  startStarfield();
  render();
})();
