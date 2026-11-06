// 参加者特典版：アクセスコードの確認と、GASから結果を受け取る部分。
// 計算や説明文はこのファイルにも、公開するほかのファイルにも入れない（結果はGASが作る）。
// 結果とお名前は、この端末（ブラウザ）の中にだけ保存する。
(function () {
  "use strict";

  // GASのウェブアプリのURL（だれでも呼べる窓口。秘密の情報ではない）
  var GAS_URL = "https://script.google.com/macros/s/AKfycbw7MXZNdaTkHapwK-3ICbo31nwO5G-8058fsf6b0g1k0sBwgiGDEP8f3XZ24YUVOV3z-Q/exec";
  var TIMEOUT_MS = 45000;
  var HISTORY_MAX = 50;
  var KEY_CODE = "nr_code", KEY_PENDING = "nr_pending", KEY_HISTORY = "nr_history";

  function $(id) { return document.getElementById(id); }

  /* ---------- 端末の中の保存（使えないブラウザでも動くようにする） ---------- */

  var memory = {};
  function load(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return key in memory ? memory[key] : fallback;
    }
  }
  function save(key, value) {
    memory[key] = value;
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても続ける */ }
  }
  function remove(key) {
    delete memory[key];
    try { window.localStorage.removeItem(key); } catch (e) { /* なにもしない */ }
  }

  /* ---------- GASとの通信 ---------- */

  function post(params) {
    var body = new URLSearchParams();
    Object.keys(params).forEach(function (k) { body.append(k, String(params[k])); });
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return window.fetch(GAS_URL, { method: "POST", body: body, signal: ctrl ? ctrl.signal : undefined, credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("http_" + res.status);
        return res.json();
      })
      .then(function (data) { if (timer) clearTimeout(timer); return data; },
            function (err) { if (timer) clearTimeout(timer); throw err; });
  }

  // 受付番号：通信が切れて送り直すときも同じ番号を使い、二重に減らないようにする
  function newRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  var REASONS = {
    not_found: "コードが見つかりません。入力をご確認ください。",
    inactive: "このコードは、現在お使いいただけません。",
    expired: "このコードの有効期限が過ぎています。",
    limit_reached: "このコードは、10回すべて使い終わりました。",
    rate_limited: "ただいま受け付けを一時停止しています。10分ほどたってから、もう一度お試しください。",
    request_mismatch: "前回の続きを受け取れませんでした。もう一度、生年月日を入れて「結果を見る」を押してください。",
    request_expired: "時間がたったため、前回の続きを受け取れませんでした。もう一度、生年月日を入れて「結果を見る」を押してください。"
  };
  var NETWORK_ERROR = "通信がうまくいきませんでした。電波のよいところで、上の「結果を受け取る」を押してください。（回数が二重に減ることはありません）";
  var SERVER_ERROR = "うまくいきませんでした。少し時間をおいて、もう一度お試しください。";

  /* ---------- コード ---------- */

  var remaining = null;
  var expiresAt = "";

  function normalizeCode(text) {
    var s = String(text || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (s.indexOf("NR") === 0) s = s.slice(2);
    s = s.slice(0, 8);
    return s.length ? "NR-" + s.slice(0, 4) + (s.length > 4 ? "-" + s.slice(4) : "") : "";
  }

  function formatExpires(text) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(text || "");
    return m ? Number(m[1]) + "年" + Number(m[2]) + "月" + Number(m[3]) + "日 " + m[4] : "";
  }

  function showCodeStatus(text, ok) {
    $("code-status").textContent = text;
    $("code-status").className = "status" + (ok ? "" : " ng");
  }

  function showRemaining() {
    var exp = formatExpires(expiresAt);
    if (remaining <= 0) { showCodeStatus(REASONS.limit_reached, false); return; }
    showCodeStatus("このコードは使えます。残り " + remaining + " 回" + (exp ? "（有効期限：" + exp + "）" : ""), true);
  }

  function checkCode() {
    var code = normalizeCode($("code").value);
    $("code").value = code;
    $("error").textContent = "";
    if (!/^NR-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code)) {
      showCodeStatus("コードは「NR-」から始まる12文字です。", false);
      return Promise.resolve();
    }
    busy(true);
    showCodeStatus("確認しています…", true);
    return post({ action: "check", code: code }).then(function (res) {
      busy(false);
      if (res && res.ok && res.valid) {
        remaining = res.remaining;
        expiresAt = res.expires_at;
        save(KEY_CODE, code);
        showRemaining();
        $("step-birth").hidden = false;
      } else {
        $("step-birth").hidden = true;
        showCodeStatus(REASONS[res && res.reason] || SERVER_ERROR, false);
      }
    }, function () {
      busy(false);
      showCodeStatus("通信がうまくいきませんでした。もう一度「確認する」を押してください。", false);
    });
  }

  /* ---------- 結果を受け取る ---------- */

  function busy(on) {
    ["btn-check", "btn-fortune", "btn-retry"].forEach(function (id) { $(id).disabled = on; });
    $("btn-fortune").textContent = on ? "受け取っています…" : "結果を見る（1回分を使います）";
  }

  function sameBirth(a, b) { return a.year === b.year && a.month === b.month && a.day === b.day; }

  function startFortune() {
    $("error").textContent = "";
    var birth = { year: Number($("b-year").value), month: Number($("b-month").value), day: Number($("b-day").value) };
    var name = $("name").value.trim();
    if (!birth.year || !birth.month || !birth.day) { $("error").textContent = "生年月日（年・月・日）を選んでください。"; return Promise.resolve(); }

    // 同じ生年月日の結果がこの端末にあれば、回数を使わずにそれを表示する（結果は同じになるため）
    var saved = null;
    load(KEY_HISTORY, []).forEach(function (h) { if (!saved && sameBirth(h.birth, birth)) saved = h; });
    if (saved) {
      var entry = saved.name === name ? saved : addHistory(name, birth, saved.result);
      showResult(entry);
      $("error").textContent = "";
      return Promise.resolve();
    }

    if (!window.confirm("1回分を使って、結果を表示します。よろしいですか？" + (remaining !== null ? "\n（いまの残り：" + remaining + " 回）" : ""))) return Promise.resolve();

    var pending = { request_id: newRequestId(), code: load(KEY_CODE, ""), name: name, birth: birth, at: Date.now() };
    save(KEY_PENDING, pending); // 送る前に保存しておく（通信が切れても同じ受付番号で送り直せる）
    return sendPending(pending);
  }

  function sendPending(pending) {
    busy(true);
    return post({
      action: "fortune", code: pending.code, request_id: pending.request_id,
      year: pending.birth.year, month: pending.birth.month, day: pending.birth.day
    }).then(function (res) {
      busy(false);
      if (res && res.ok && res.done) {
        remove(KEY_PENDING);
        if (typeof res.remaining === "number") { remaining = res.remaining; showRemaining(); }
        var entry = addHistory(pending.name, pending.birth, res.result);
        refreshPending();
        showResult(entry);
        return;
      }
      if (res && res.ok === true && res.reason) {
        // 回数を使わずに断られた（期限切れ・上限など）。続きはないので、待ちの状態を消す
        remove(KEY_PENDING);
        refreshPending();
        if (typeof res.remaining === "number") remaining = res.remaining;
        $("error").textContent = REASONS[res.reason] || SERVER_ERROR;
        if (res.reason === "limit_reached" || res.reason === "expired" || res.reason === "inactive") {
          showCodeStatus(REASONS[res.reason], false);
        }
        return;
      }
      if (res && res.error === "invalid_birth") {
        remove(KEY_PENDING);
        refreshPending();
        $("error").textContent = "生年月日をご確認ください。";
        return;
      }
      // サーバー側のエラー：記録されていないので、同じ受付番号で送り直してよい
      refreshPending();
      $("error").textContent = SERVER_ERROR + "（上の「結果を受け取る」で送り直せます）";
    }, function () {
      busy(false);
      refreshPending();
      $("error").textContent = NETWORK_ERROR;
    });
  }

  function refreshPending() {
    $("pending").hidden = !load(KEY_PENDING, null);
  }

  /* ---------- この端末に保存した結果 ---------- */

  function addHistory(name, birth, result) {
    var list = load(KEY_HISTORY, []);
    var entry = { id: newRequestId(), name: name, birth: birth, result: result, at: Date.now() };
    list.unshift(entry);
    save(KEY_HISTORY, list.slice(0, HISTORY_MAX));
    renderHistory();
    return entry;
  }

  function label(h) {
    return h.name ? h.name + "さん" : h.birth.month + "月" + h.birth.day + "日生まれ";
  }

  function renderHistory() {
    var list = load(KEY_HISTORY, []);
    var box = $("history");
    box.innerHTML = "";
    $("step-history").hidden = !list.length;
    list.forEach(function (h) {
      var item = document.createElement("span");
      item.className = "item";
      var open = document.createElement("button");
      open.type = "button";
      open.textContent = label(h);
      open.addEventListener("click", function () { showResult(h); });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "×";
      del.setAttribute("aria-label", label(h) + "の結果をこの端末から消す");
      del.addEventListener("click", function () {
        if (!window.confirm(label(h) + "の結果を、この端末から消しますか？\n（消しても、使った回数はもどりません）")) return;
        save(KEY_HISTORY, load(KEY_HISTORY, []).filter(function (x) { return x.id !== h.id; }));
        renderHistory();
      });
      item.appendChild(open);
      item.appendChild(del);
      box.appendChild(item);
    });
  }

  /* ---------- 結果の表示（主催者版と同じ部品） ---------- */

  var current = null;

  function showTab(key) {
    var tabs = document.querySelectorAll(".tabs button");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("now", tabs[i].getAttribute("data-tab") === key);
    ["self", "2026", "2027"].forEach(function (k) { $("panel-" + k).classList.toggle("show", k === key); });
  }

  function showResult(entry) {
    current = entry;
    window.RESULT_VIEW.render(entry.result, entry.name);
    $("gate").hidden = true;
    $("backbar").hidden = false;
    $("result").classList.add("show");
    showTab("self");
    window.scrollTo(0, 0);
  }

  function showGate() {
    $("result").classList.remove("show");
    $("backbar").hidden = true;
    $("gate").hidden = false;
    $("name").value = "";
    $("b-year").value = ""; $("b-month").value = ""; refreshDays();
    window.scrollTo(0, 0);
  }

  /* ---------- 入力欄 ---------- */

  function fillSelect(sel, from, to, placeholder) {
    var keep = sel.value;
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = ""; ph.textContent = placeholder;
    sel.appendChild(ph);
    var dir = from <= to ? 1 : -1;
    for (var v = from; dir > 0 ? v <= to : v >= to; v += dir) {
      var o = document.createElement("option");
      o.value = String(v); o.textContent = String(v);
      sel.appendChild(o);
    }
    if (keep && sel.querySelector('option[value="' + keep + '"]')) sel.value = keep;
  }
  function refreshDays() {
    var y = Number($("b-year").value) || 2000, m = Number($("b-month").value);
    var max = m ? new Date(y, m, 0).getDate() : 31;
    fillSelect($("b-day"), 1, max, "--");
  }

  $("eto-img").addEventListener("error", function () { $("eto").classList.add("noimg"); });
  $("b-year").addEventListener("change", refreshDays);
  $("b-month").addEventListener("change", refreshDays);
  $("btn-check").addEventListener("click", checkCode);
  $("code").addEventListener("keydown", function (e) { if (e.key === "Enter") checkCode(); });
  $("btn-fortune").addEventListener("click", startFortune);
  $("btn-retry").addEventListener("click", function () {
    var p = load(KEY_PENDING, null);
    if (p) { $("error").textContent = ""; sendPending(p); }
  });
  $("btn-drop").addEventListener("click", function () {
    if (!window.confirm("前回の続きを受け取るのをやめますか？\n（すでに1回分が使われている場合、その分はもどりません）")) return;
    remove(KEY_PENDING);
    refreshPending();
  });
  $("btn-back").addEventListener("click", showGate);

  var tabButtons = document.querySelectorAll(".tabs button");
  for (var i = 0; i < tabButtons.length; i++) {
    tabButtons[i].addEventListener("click", function () { showTab(this.getAttribute("data-tab")); });
  }

  // PDFの保存名が「年末リセット_名前」になるよう、印刷中だけタイトルを変える
  $("btn-pdf").addEventListener("click", function () {
    var original = document.title;
    var b = current.birth;
    document.title = "律子塾 年末リセット_" + (current.name || (b.year + "年" + b.month + "月" + b.day + "日生まれ"));
    window.print();
    document.title = original;
  });

  // PDFの保存のしかたは、スマホでは操作がちがうので、案内の文を差し替える
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var howto = document.querySelector(".pdf-row p");
  if (howto && isIOS) {
    howto.textContent = "iPhone・iPadの場合：印刷の画面が開いたら、上の共有ボタン（四角に↑のマーク）を押し、「“ファイル”に保存」を選ぶとPDFとして保存できます。";
  } else if (howto && /Android/.test(ua)) {
    howto.textContent = "Androidの場合：印刷の画面が開いたら、いちばん上のプリンターの選択を「PDF形式で保存」にして、PDFのボタンを押してください。";
  }

  fillSelect($("b-year"), 2026, 1900, "----");
  fillSelect($("b-month"), 1, 12, "--");
  refreshDays();
  renderHistory();
  refreshPending();

  var savedCode = load(KEY_CODE, "");
  if (savedCode) { $("code").value = savedCode; checkCode(); }
})();
