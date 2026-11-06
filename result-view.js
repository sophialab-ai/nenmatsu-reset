// 結果の表示：result-builder.js が作った結果を、画面に出す（計算や説明文は持たない）
// 主催者版と、参加者特典版で共通に使う。
window.RESULT_VIEW = (function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function setText(id, text) { $(id).textContent = text; }
  function fillTags(ul, items) {
    ul.innerHTML = "";
    items.forEach(function (f) {
      var li = document.createElement("li");
      li.textContent = f;
      ul.appendChild(li);
    });
  }
  function fillBadges(box, items) {
    box.innerHTML = "";
    items.forEach(function (t) {
      var s = document.createElement("span");
      s.className = "badge";
      s.textContent = t;
      box.appendChild(s);
    });
  }
  function nameWithYomi(id, name, yomi) {
    var el = $(id);
    el.textContent = name;
    var y = document.createElement("span");
    y.className = "yomi";
    y.textContent = "（" + yomi + "）";
    el.appendChild(y);
  }

  function renderHeader(r, name) {
    var b = r.birth, h = r.header;
    $("eto").classList.remove("noimg");
    $("eto-img").src = h.img;
    $("eto-img").alt = h.animal;
    setText("eto-kanji", h.branch);
    setText("p-name", name ? name + "さん" : "");
    setText("p-born", b.year + "年" + b.month + "月" + b.day + "日生まれ");
    setText("p-kanshi", h.kanshiName + "（" + h.kanshiYomi + "）");
    var heads = document.querySelectorAll(".js-print-name");
    for (var i = 0; i < heads.length; i++) heads[i].textContent = (name ? name + "さん" : b.month + "月" + b.day + "日生まれ") + "｜";
  }

  function renderSelf(s) {
    setText("lp-num", s.lifePath.value);
    setText("lp-title", s.lifePath.title);
    setText("lp-desc", s.lifePath.desc);
    setText("lp-calc", "計算：" + s.lifePath.calcText);

    nameWithYomi("k-name", s.kanshi.name, s.kanshi.yomi);
    setText("k-desc", s.kanshi.desc);

    nameWithYomi("ky-name", s.kyusei.name, s.kyusei.yomi);
    setText("ky-desc", s.kyusei.desc);
    setText("ky-note", s.kyusei.note);

    nameWithYomi("sz-name", s.seiza.name, s.seiza.yomi);
    setText("sz-desc", s.seiza.desc);
    setText("sz-note", s.seiza.note);
  }

  function render2026(y) {
    setText("a26-age", "2026年に " + y.age + "歳");
    fillBadges($("a26-badges"), y.badges);
    setText("a26-note", y.note);
    $("a26-note").style.display = $("a26-note").textContent ? "block" : "none";

    setText("py26-num", y.personalYear.value);
    setText("py26-theme", y.personalYear.theme);
    setText("py26-desc", y.personalYear.desc);
    fillTags($("py26-keys"), y.personalYear.keys);
    setText("py26-calc", "計算：" + y.personalYear.calcText);

    var cycle = $("cycle");
    cycle.innerHTML = "";
    for (var i = 1; i <= 9; i++) {
      var s = document.createElement("span");
      s.textContent = i;
      if (i < y.cycle.value) s.className = "past";
      if (i === y.cycle.value) s.className = "now";
      cycle.appendChild(s);
    }
    setText("cycle-text", y.cycle.text);
    setText("cycle-phase", y.cycle.phase);

    setText("m12-num", y.december.value);
    setText("m12-title", y.december.title);
    setText("m12-desc", y.december.desc);
  }

  function render2027(y) {
    var flow = $("flow");
    flow.innerHTML = "";
    y.flow.forEach(function (f, i) {
      if (i > 0) {
        var ar = document.createElement("div");
        ar.className = "arrow";
        ar.textContent = "→";
        flow.appendChild(ar);
      }
      var d = document.createElement("div");
      d.className = "step " + f.mark;
      d.innerHTML = '<p class="yr"></p><p class="num"></p><p class="th"></p>';
      d.querySelector(".yr").textContent = f.year + "年";
      d.querySelector(".num").textContent = f.value;
      d.querySelector(".th").textContent = f.theme;
      flow.appendChild(d);
    });

    setText("a27-age", "2027年に " + y.age + "歳");
    fillBadges($("a27-badges"), y.badges);

    setText("py27-num", y.personalYear.value);
    setText("py27-theme", y.personalYear.theme);
    setText("py27-desc", y.personalYear.desc);
    setText("py27-calc", "計算：" + y.personalYear.calcText);
    fillTags($("py27-focus"), y.personalYear.focus);
    setText("py27-prepare", y.personalYear.prepare);

    setText("m1-num", y.january.value);
    setText("m1-title", y.january.title);
    setText("m1-desc", y.january.desc);

    var months = $("months");
    months.innerHTML = "";
    y.months.forEach(function (pm) {
      var d = document.createElement("div");
      d.innerHTML = '<p class="m"></p><p class="n"></p><p class="t"></p>';
      d.querySelector(".m").textContent = pm.month + "月";
      d.querySelector(".n").textContent = pm.value;
      d.querySelector(".t").textContent = pm.title;
      months.appendChild(d);
    });

    // 月別ガイド：同じ数字の月はまとめて1つ（例：「1月・10月」）
    var guide = $("guide");
    guide.innerHTML = "";
    y.guide.forEach(function (g) {
      var d = document.createElement("div");
      d.className = "guide-item";
      d.innerHTML =
        '<div class="guide-top"><span class="guide-num"></span>' +
        '<div><p class="guide-months"></p><p class="guide-title"></p></div></div>' +
        '<p class="guide-lead"></p><p class="guide-body"></p>' +
        '<p class="guide-q"><b>自分への問い</b><span></span></p>';
      d.querySelector(".guide-num").textContent = g.value;
      d.querySelector(".guide-months").textContent = g.months.map(function (m) { return m + "月"; }).join("・");
      d.querySelector(".guide-title").textContent = g.title;
      d.querySelector(".guide-lead").textContent = g.lead;
      d.querySelector(".guide-body").textContent = g.body;
      d.querySelector(".guide-q span").textContent = g.question;
      guide.appendChild(d);
    });
  }

  // name は画面に出すだけ（結果の中には入れない）
  function render(result, name) {
    renderHeader(result, name);
    renderSelf(result.self);
    render2026(result.y2026);
    render2027(result.y2027);
  }

  return { render: render };
})();
