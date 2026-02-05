/* app.js (Groupware Main) v1.1
   ✅ 목적: “대쉬보드만 보임 / 소메뉴 안뜸 / 프로필·생일 미표시” 같은 증상 방지용 안전장치 추가
   - 기존 v1 기능은 그대로 유지
   - DOM 누락/구조 불일치 시에도 앱이 “죽지 않게” 가드 처리
*/

(() => {
  "use strict";

  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  // ---------------------------
  // DOM (가드 포함)
  // ---------------------------
  function mustEl(id){
    const el = document.getElementById(id);
    return el || null;
  }

  const els = {
    topTabs: mustEl("topTabs"),
    megaMenu: mustEl("megaMenu"),
    sideMenu: mustEl("sideMenu"),
    view: mustEl("view"),
    birthdayCard: mustEl("birthdayCard"),
    profileCard: mustEl("profileCard"),
    logoHome: mustEl("logoHome"),
    toast: mustEl("toast"),
  };

  function fatalDomReport(){
    const miss = Object.entries(els).filter(([,v]) => !v).map(([k]) => k);
    if (miss.length){
      // 최소한 콘솔에 남기고, 화면에도 안내(가능하면)
      console.error("[Groupware] Missing DOM elements:", miss);
      // view가 있으면 간단 안내라도 표시
      if (els.view){
        els.view.innerHTML = `
          <div class="card">
            <div class="card-title">레이아웃 요소 누락</div>
            <div class="muted small" style="margin-top:10px; line-height:1.6">
              index.html에서 필수 영역이 누락되었습니다.<br/>
              누락: <b>${escapeHtml(miss.join(", "))}</b><br/>
              (필수 id: topTabs, megaMenu, sideMenu, view, birthdayCard, profileCard, logoHome, toast)
            </div>
          </div>
        `;
      }
      return true;
    }
    return false;
  }

  // ---------------------------
  // ✅ 탭/메뉴 정의
  // ---------------------------
  const TOP_TABS = [
    { key:"전자메일", label:"전자메일" },
    { key:"게시판", label:"게시판" },
    { key:"전자결재", label:"전자결재" },
    { key:"일정관리", label:"일정관리" },
    { key:"업무관리", label:"업무관리" },
  ];

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
    if (!host) return;
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function setActiveTopTab(tabKey){
    if (!els.topTabs) return;
    $$("#topTabs .topTab").forEach(b => {
      b.classList.toggle("active", b.dataset.key === tabKey);
    });
  }

  function setActiveSide(route){
    if (!els.sideMenu) return;
    $$("#sideMenu .side-item").forEach(b => {
      b.classList.toggle("active", b.dataset.route === route);
    });
  }

  function renderTopTabs(){
    if (!els.topTabs) return;
    els.topTabs.innerHTML = "";
    TOP_TABS.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topTab";
      btn.dataset.key = t.key;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        const first = (SIDE_MENUS[t.key] && SIDE_MENUS[t.key][0]) ? SIDE_MENUS[t.key][0].route : "#대쉬보드/home";
        location.hash = first;
      });
      els.topTabs.appendChild(btn);
    });
  }

  function renderMegaMenu(){
    if (!els.megaMenu) return;

    const cols = $$("#megaMenu .mega-col");
    const keys = ["전자메일","게시판","전자결재","일정관리","업무관리"];

    // ✅ index.html의 mega-col 개수가 부족해도 앱이 죽지 않게
    keys.forEach((k, i) => {
      const col = cols[i];
      if (!col) return;
      const itemsWrap = $(".mega-col-items", col);
      if (!itemsWrap) return;

      itemsWrap.innerHTML = "";
      (SIDE_MENUS[k] || []).forEach(m => {
        const a = document.createElement("a");
        a.href = m.route;
        a.className = "mega-item";
        a.textContent = m.label;
        a.addEventListener("click", (e) => {
          if (m.action === "openApp2") {
            e.preventDefault();
            openApp2();
          } else {
            closeMega();
          }
        });
        itemsWrap.appendChild(a);
      });
    });

    const wrap = $(".navWrap");
    if (wrap){
      wrap.addEventListener("mouseenter", () => openMega());
      wrap.addEventListener("mouseleave", () => closeMega());
    }
  }

  function openMega(){ if (els.megaMenu) els.megaMenu.classList.add("open"); }
  function closeMega(){ if (els.megaMenu) els.megaMenu.classList.remove("open"); }

  function renderSideMenu(tabKey){
    if (!els.sideMenu) return;
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
  // Profile / Birthday
  // ---------------------------
  function renderProfile(){
    if (!els.profileCard) return;
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
    if (!els.birthdayCard) return;
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
    if (!els.view) return;
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
    if (!els.view) return;
    els.view.innerHTML = `
      <div class="card">
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="muted small" style="margin-top:10px">해당 기능은 추후 연결 예정입니다.</div>
      </div>
    `;
  }

  function viewWorkShortcut(){
    if (!els.view) return;
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
    const b = $("#btnOpenApp2");
    if (b) b.addEventListener("click", openApp2);
  }

  function bindDashboardLinks(){
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
    if (tab === "대쉬보드") return "대쉬보드";
    return TOP_TABS.some(t => t.key === tab) ? tab : "대쉬보드";
  }

  function route(){
    // DOM이 깨진 상태면 라우팅으로 더 진행하지 않음(대쉬보드만 보임 증상 방지용)
    if (fatalDomReport()) return;

    document.body.classList.add("routeChanging");
    setTimeout(() => document.body.classList.remove("routeChanging"), 160);

    const { tab, page, raw } = parseHash();
    const t = resolveTopTab(tab);

    // ✅ birthdayCard: 대쉬보드에서만
    renderBirthdayCard(t === "대쉬보드");

    if (t === "대쉬보드"){
      setActiveTopTab("");           // 탭 active 없음
      renderSideMenu("전자메일");    // 좌측은 기본 메뉴 유지(원하면 대쉬보드 전용 메뉴로 변경 가능)
      setActiveSide("");             // 사이드 active 없음
      viewDashboard();
      bindDashboardLinks();
      return;
    }

    setActiveTopTab(t);
    renderSideMenu(t);
    setActiveSide(raw);

    if (t === "업무관리" && page === "shortcut"){
      viewWorkShortcut();
      return;
    }

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
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m+1, 0);

    const dow = first.getDay();
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
    if (fatalDomReport()) return;

    renderTopTabs();
    renderMegaMenu();
    renderProfile();

    if (els.logoHome){
      els.logoHome.addEventListener("click", (e) => {
        e.preventDefault();
        location.hash = "#대쉬보드/home";
      });
    }

    window.addEventListener("hashchange", route);

    if (!location.hash) location.hash = "#대쉬보드/home";
    route();
  }

  init();
})();
