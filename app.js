/* app.js (Groupware Main) v1
   ✅ 반영
   1) 대분류 탭: 전자메일 / 게시판 / 전자결재 / 일정관리 / 업무관리 (산출 제거)
   2) 업무관리 소메뉴: "업무관리 바로가기"만 남김
      - 클릭 시 app2.html 새 창 오픈(기능은 app2.js로 분리)
   3) 대쉬보드: 전자메일/게시판/전자결재 + 일정(와이드)
   4) birthdayCard는 대쉬보드에서만 노출
*/

(() => {
  "use strict";

  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  const els = {
    topTabs: $("#topTabs"),
    megaMenu: $("#megaMenu"),
    sideMenu: $("#sideMenu"),
    view: $("#view"),
    birthdayCard: $("#birthdayCard"),
    profileCard: $("#profileCard"),
    logoHome: $("#logoHome"),
    toast: $("#toast"),
  };

  // ✅ 탭 순서: 전자메일 / 게시판 / 전자결재 / 일정관리 / 업무관리
  const TOP_TABS = [
    { key:"전자메일", label:"전자메일" },
    { key:"게시판", label:"게시판" },
    { key:"전자결재", label:"전자결재" },
    { key:"일정관리", label:"일정관리" },
    { key:"업무관리", label:"업무관리" },
  ];

  // ✅ 사이드 메뉴 (업무관리=바로가기만)
  const SIDE_MENUS = {
    "전자메일": [
      { key:"inbox", label:"받은메일(placeholder)", route:"#전자메일/inbox" },
    ],
    "게시판": [
      { key:"notice", label:"공지사항(placeholder)", route:"#게시판/notice" },
      { key:"free", label:"자유게시판(placeholder)", route:"#게시판/free" },
    ],
    "전자결재": [
      { key:"pending", label:"결재 대기(placeholder)", route:"#전자결재/pending" },
      { key:"done", label:"결재 완료(placeholder)", route:"#전자결재/done" },
    ],
    "일정관리": [
      { key:"calendar", label:"캘린더(placeholder)", route:"#일정관리/calendar" },
      { key:"leave", label:"휴가/외근(placeholder)", route:"#일정관리/leave" },
    ],
    "업무관리": [
      { key:"work2", label:"업무관리 바로가기", route:"#업무관리/shortcut", action:"openApp2" },
    ],
  };

  // ---------------------------
  // UI helpers
  // ---------------------------
  function toast(msg){
    const host = els.toast;
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function setActiveTopTab(tabKey){
    $$("#topTabs .topTab").forEach(b => {
      b.classList.toggle("active", b.dataset.key === tabKey);
    });
  }

  function setActiveSide(route){
    $$("#sideMenu .side-item").forEach(b => {
      b.classList.toggle("active", b.dataset.route === route);
    });
  }

  function renderTopTabs(){
    els.topTabs.innerHTML = "";
    TOP_TABS.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topTab";
      btn.dataset.key = t.key;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        // 기본 진입 라우트: 탭별 첫 메뉴 or 대쉬보드
        const first = (SIDE_MENUS[t.key] && SIDE_MENUS[t.key][0]) ? SIDE_MENUS[t.key][0].route : "#대쉬보드/home";
        location.hash = first;
      });
      els.topTabs.appendChild(btn);
    });
  }

  function renderMegaMenu(){
    // index.html의 mega-col 순서와 동일(전자메일/게시판/전자결재/일정관리/업무관리)
    const cols = $$("#megaMenu .mega-col");
    const keys = ["전자메일","게시판","전자결재","일정관리","업무관리"];

    keys.forEach((k, i) => {
      const itemsWrap = $(".mega-col-items", cols[i]);
      itemsWrap.innerHTML = "";
      const menus = SIDE_MENUS[k] || [];
      menus.forEach(m => {
        const a = document.createElement("a");
        a.href = m.route;
        a.className = "mega-item";
        a.textContent = m.label;
        a.addEventListener("click", (e) => {
          if (m.action === "openApp2") {
            e.preventDefault();
            openApp2();
          } else {
            // mega menu 닫기
            closeMega();
          }
        });
        itemsWrap.appendChild(a);
      });
    });

    // hover로 열리게(간단)
    const wrap = $(".navWrap");
    wrap.addEventListener("mouseenter", () => openMega());
    wrap.addEventListener("mouseleave", () => closeMega());
  }

  function openMega(){ els.megaMenu.classList.add("open"); }
  function closeMega(){ els.megaMenu.classList.remove("open"); }

  function renderSideMenu(tabKey){
    const list = SIDE_MENUS[tabKey] || [];
    els.sideMenu.innerHTML = "";
    list.forEach(m => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "side-item";
      btn.dataset.route = m.route;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        if (m.action === "openApp2") openApp2();
        else location.hash = m.route;
      });
      els.sideMenu.appendChild(btn);
    });
  }

  // ---------------------------
  // Profile / Birthday (placeholder)
  // ---------------------------
  function renderProfile(){
    els.profileCard.innerHTML = `
      <div class="card profileCard">
        <div class="card-title">프로필</div>
        <div class="stack" style="margin-top:10px">
          <div class="row"><b>사용자</b><span class="muted small">Park Yongjin</span></div>
          <div class="row"><b>권한</b><span class="muted small">Staff</span></div>
        </div>
      </div>
    `;
  }

  function renderBirthdayCard(visible){
    if (!visible){
      els.birthdayCard.innerHTML = "";
      return;
    }
    els.birthdayCard.innerHTML = `
      <div class="card bdayCard">
        <div class="bdayHead">
          <div class="bdayTitle">다가오는 생일</div>
        </div>
        <div class="bdayEmpty">표시할 항목이 없습니다</div>
      </div>
    `;
  }

  // ---------------------------
  // Views
  // ---------------------------
  function viewDashboard(){
    // ✅ 대쉬보드: 메일/게시판/결재 + 일정 와이드
    els.view.innerHTML = `
      <div class="dashWrap">

        <div class="dashGrid">
          ${dashCard("전자메일", "최근 메일", [
            { t:"(placeholder) 결재 관련 메일", m:"오늘" },
            { t:"(placeholder) 공지", m:"어제" },
          ], "#전자메일/inbox")}

          ${dashCard("게시판", "최근 게시글", [
            { t:"(placeholder) 공지사항", m:"오늘" },
            { t:"(placeholder) 자유글", m:"어제" },
          ], "#게시판/notice")}

          ${dashCard("전자결재", "진행 현황", [
            { t:"(placeholder) 결재 대기", m:"2건" },
            { t:"(placeholder) 결재 완료", m:"5건" },
          ], "#전자결재/pending")}

          ${dashScheduleWide()}
        </div>

      </div>
    `;
  }

  function dashCard(title, sub, items, route){
    const rows = items.map(x => `
      <div class="dashItem">
        <div class="dashItemTitle">${escapeHtml(x.t)}</div>
        <div class="dashItemMeta">${escapeHtml(x.m)}</div>
      </div>
    `).join("");

    return `
      <div class="card dashCard">
        <div class="dashCardHead">
          <button class="dashCardTitleLink" type="button" data-route="${route}">${escapeHtml(title)}</button>
          <div class="dashCardSub">${escapeHtml(sub)}</div>
        </div>
        <div class="dashList">${rows}</div>
      </div>
    `;
  }

  function dashScheduleWide(){
    return `
      <div class="card dashCard dashSpan2">
        <div class="dashCardHead">
          <button class="dashCardTitleLink" type="button" data-route="#일정관리/calendar">일정관리</button>
          <div class="dashCardSub">달력 · 다가오는 휴가/외근</div>
        </div>

        <div class="schedWide">
          <div class="schedPanel">
            <div class="schedTitle">이번 달</div>
            ${simpleCalendarHtml()}
          </div>

          <div class="schedPanel">
            <div class="schedTitle">다가오는 휴가/외근</div>
            <div class="schedEmpty">표시할 일정이 없습니다</div>
          </div>
        </div>
      </div>
    `;
  }

  function viewPlaceholder(title){
    els.view.innerHTML = `
      <div class="card">
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="muted small" style="margin-top:10px">해당 기능은 추후 연결 예정입니다.</div>
      </div>
    `;
  }

  function viewWorkShortcut(){
    els.view.innerHTML = `
      <div class="card">
        <div class="card-title">업무관리</div>
        <div class="muted small" style="margin-top:10px">
          업무관리 기능은 그룹웨어와 분리되어 별도 창에서 실행됩니다.
        </div>
        <div style="margin-top:12px">
          <button class="btn primary" id="btnOpenApp2" type="button">업무관리 바로가기 (새 창)</button>
        </div>
      </div>
    `;
    $("#btnOpenApp2").addEventListener("click", openApp2);
  }

  function bindDashboardLinks(){
    // 카드 타이틀 클릭 시 라우트 이동
    $$(".dashCardTitleLink").forEach(b => {
      b.addEventListener("click", () => {
        const r = b.dataset.route;
        if (r) location.hash = r;
      });
    });
  }

  // ---------------------------
  // Routing
  // ---------------------------
  function parseHash(){
    const h = (location.hash || "#대쉬보드/home").replace(/^#/, "");
    const [tabRaw, pageRaw] = h.split("/");
    const tab = tabRaw || "대쉬보드";
    const page = pageRaw || "home";
    return { tab, page, raw:"#"+h };
  }

  function resolveTopTab(tab){
    // 대쉬보드는 별도, 그 외는 TOP_TABS에 존재해야 함
    if (tab === "대쉬보드") return "대쉬보드";
    const ok = TOP_TABS.some(t => t.key === tab);
    return ok ? tab : "대쉬보드";
  }

  function route(){
    document.body.classList.add("routeChanging");
    setTimeout(() => document.body.classList.remove("routeChanging"), 160);

    const { tab, page, raw } = parseHash();
    const t = resolveTopTab(tab);

    // ✅ birthdayCard: 대쉬보드에서만
    renderBirthdayCard(t === "대쉬보드");

    if (t === "대쉬보드"){
      setActiveTopTab("");      // 탭 active 없음
      renderSideMenu("전자메일"); // 기본 좌측 메뉴(원하면 대쉬보드 전용으로 바꿔도 됨)
      viewDashboard();
      bindDashboardLinks();
      return;
    }

    // 탭 활성/사이드 구성
    setActiveTopTab(t);
    renderSideMenu(t);
    setActiveSide(raw);

    // 탭별 페이지
    if (t === "업무관리" && page === "shortcut"){
      viewWorkShortcut();
      return;
    }

    // placeholder pages
    viewPlaceholder(`${t} / ${page}`);
  }

  // ---------------------------
  // 업무관리(별도창) 오픈
  // ---------------------------
  function openApp2(){
    const w = window.open("app2.html", "CONCOST_WORK", "width=1400,height=900");
    if (!w) toast("팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도하세요.");
  }

  // ---------------------------
  // Calendar (simple)
  // ---------------------------
  function simpleCalendarHtml(){
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const first = new Date(y, m, 1);
    const last = new Date(y, m+1, 0);

    const dow = first.getDay(); // 0 Sun
    const days = last.getDate();

    const cells = [];
    for (let i=0; i<dow; i++) cells.push(`<div class="cal-cell cal-empty"></div>`);
    for (let d=1; d<=days; d++){
      cells.push(`<div class="cal-cell"><div class="cal-day">${d}</div></div>`);
    }
    while (cells.length % 7 !== 0) cells.push(`<div class="cal-cell cal-empty"></div>`);

    return `
      <div class="cal-dow">
        <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
      </div>
      <div class="cal-grid">${cells.join("")}</div>
    `;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------------------------
  // Init
  // ---------------------------
  function init(){
    renderTopTabs();
    renderMegaMenu();
    renderProfile();

    els.logoHome.addEventListener("click", (e) => {
      // 로고 클릭 시 대쉬보드
      e.preventDefault();
      location.hash = "#대쉬보드/home";
    });

    window.addEventListener("hashchange", route);

    if (!location.hash) location.hash = "#대쉬보드/home";
    route();
  }

  init();
})();
