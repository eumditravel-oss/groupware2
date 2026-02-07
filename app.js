/* app.js (Groupware Main) v1.2 — FULL (FIXED)
   ✅ 병합본(기존 v0.5 기능 + 현재 v1.1 DOM 가드)
   ✅ 제외조건 반영
   - ❌ "산출" 탭/메뉴/뷰/링크: 전부 제거
   - ✅ "업무관리" 탭 유지
     - 업무관리 소메뉴는 "업무관리 바로가기" 1개만 유지
     - 링크: app2.html (새 창)
   ✅ 대분류 탭 순서(산출 제외 충돌 해결)
   - 전자메일 / 게시판 / 전자결재 / 일정관리 / 업무관리
*/

(() => {
  "use strict";

  /***********************
   * DOM helpers
   ***********************/
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id) || null;

  function mustEl(id){
    const el = byId(id);
    return el || null;
  }

  const els = {
    topTabs:       mustEl("topTabs"),
    megaMenu:      mustEl("megaMenu"),
    sideMenu:      mustEl("sideMenu"),
    view:          mustEl("view"),
    birthdayCard:  mustEl("birthdayCard"),
    profileCard:   mustEl("profileCard"),
    logoHome:      mustEl("logoHome"),
    toast:         mustEl("toast"),
    modalBackdrop: mustEl("modalBackdrop"),
    modalTitle:    mustEl("modalTitle"),
    modalBody:     mustEl("modalBody"),
    modalFoot:     mustEl("modalFoot"),
    modalClose:    mustEl("modalClose"),
    badgePending:  mustEl("badgePending"),
  };

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function fatalDomReport(){
    const required = ["topTabs","megaMenu","sideMenu","view","birthdayCard","profileCard","logoHome","toast"];
    const miss = required.filter(k => !els[k]).map(k=>k);
    if (miss.length){
      console.error("[Groupware] Missing DOM elements:", miss);
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

  /***********************
   * Toast / Modal
   ***********************/
  function toast(msg){
    const host = els.toast;
    if (!host) return;
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function modalOpen(title, bodyNode, footNode){
    if (!els.modalBackdrop) return;
    if (els.modalTitle) els.modalTitle.textContent = title || "";
    if (els.modalBody){
      els.modalBody.innerHTML = "";
      if (bodyNode) els.modalBody.appendChild(bodyNode);
    }
    if (els.modalFoot){
      els.modalFoot.innerHTML = "";
      if (footNode) els.modalFoot.appendChild(footNode);
    }
    els.modalBackdrop.classList.remove("hidden");
  }

  function modalClose(){
    if (!els.modalBackdrop) return;
    els.modalBackdrop.classList.add("hidden");
  }

  /***********************
   * Scroll / Background Fix
   ***********************/
  function applyScrollFix(){
    document.documentElement.style.height = "100%";
    document.body.style.minHeight = "100%";
    document.body.style.overflowY = "auto";
    document.body.style.overflowX = "hidden";

    const styleId = "conc0st-scroll-fix";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      * { scrollbar-gutter: auto; }
      html, body { height: 100%; background: #f4f6f9; }
      #view { overflow: visible !important; background: transparent !important; }
      .layout, .container, .main, .content, .right, .center, .page, .app {
        overflow-y: visible !important;
        overflow-x: hidden !important;
        background: transparent;
      }
      body { overscroll-behavior: none; }
    `;
    document.head.appendChild(style);
  }

  /***********************
   * Roles
   ***********************/
  const ROLE_ORDER = ["staff","leader","manager","director","vp","svp","ceo"];

  const ROLE_LABEL_KO = {
    staff:"사원",
    leader:"팀장",
    manager:"실장",
    director:"본부장",
    vp:"상무",
    svp:"부사장",
    ceo:"대표"
  };

  function roleRank(role){
    const i = ROLE_ORDER.indexOf(role);
    return i >= 0 ? i : 0;
  }
  function isStaff(user){ return (user?.role || "staff") === "staff"; }
  function isLeaderPlus(user){ return roleRank(user?.role || "staff") >= roleRank("leader"); }

  /***********************
   * Storage / DB
   ***********************/
  const LS_KEY  = "CONCOST_GROUPWARE_DB_V05";
  const LS_USER = "CONCOST_GROUPWARE_USER_V05";

  function safeParse(s, fallback){ try { return JSON.parse(s); } catch { return fallback; } }

  function pad2(n){ return String(n).padStart(2,"0"); }
  function nowISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function uuid(){
    try{
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    }catch{}
    const hex = [];
    for (let i=0;i<256;i++) hex[i] = (i+256).toString(16).slice(1);
    let r = new Uint8Array(16);
    try{
      if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(r);
      else for (let i=0;i<16;i++) r[i] = Math.floor(Math.random()*256);
    }catch{
      for (let i=0;i<16;i++) r[i] = Math.floor(Math.random()*256);
    }
    r[6] = (r[6] & 0x0f) | 0x40;
    r[8] = (r[8] & 0x3f) | 0x80;
    return (
      hex[r[0]]+hex[r[1]]+hex[r[2]]+hex[r[3]]+"-"+
      hex[r[4]]+hex[r[5]]+"-"+
      hex[r[6]]+hex[r[7]]+"-"+
      hex[r[8]]+hex[r[9]]+"-"+
      hex[r[10]]+hex[r[11]]+hex[r[12]]+hex[r[13]]+hex[r[14]]+hex[r[15]]
    );
  }

  function loadDB(){
    const raw = localStorage.getItem(LS_KEY);
    return raw ? safeParse(raw, null) : null;
  }
  function saveDB(db){
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  function makeSeedDB(){
    return {
      meta: {
        version:"0.5",
        createdAt: nowISO(),
        seedMailsVersion: "2026-02-03",
        seedBoardVersion: "2026-01-31",
        seedProjectsVersion: "2026-01-31",
      },
      users: [
        { userId:"u_staff_1", name:"작업자A", role:"staff", avatarDataUrl:"" },
        { userId:"u_staff_2", name:"작업자B", role:"staff", avatarDataUrl:"" },
        { userId:"u_leader",  name:"팀장", role:"leader", avatarDataUrl:"" },
        { userId:"u_manager", name:"실장", role:"manager", avatarDataUrl:"" },
        { userId:"u_director",name:"본부장", role:"director", avatarDataUrl:"" },
        { userId:"u_vp",      name:"상무", role:"vp", avatarDataUrl:"" },
        { userId:"u_svp",     name:"부사장", role:"svp", avatarDataUrl:"" },
        { userId:"u_ceo",     name:"대표", role:"ceo", avatarDataUrl:"" }
      ],
      projects: [
        { projectId:"2025001", projectCode:"2025001", projectName:"[공간종합건축사사무소]서천특화시장재건축 사업 견적용역", startDate:"", endDate:"" },
        { projectId:"2025029", projectCode:"2025029", projectName:"[삼성물산]평택 P4 Ph3 물량산출 용역", startDate:"", endDate:"" }
      ],

      // 전자메일(더미)
      mails: [
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 문의사항 답변", from:"ㅇㅇ건설", at:"2026-01-26 09:12" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 물량산출 체크리스트 송부", from:"ㅇㅇ건설", at:"2026-01-24 10:03" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 수량 물량증감 비교검토 요청", from:"ㅇㅇ건설", at:"2026-01-23 10:03" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 변경률 확인 요청", from:"ㅇㅇ건설", at:"2026-01-22 10:03" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 아이템 변경 요청", from:"ㅇㅇ건설", at:"2026-01-21 10:03" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 내역 반영 요청", from:"ㅇㅇ건설", at:"2026-01-20 10:03" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ 프로젝트 수정요청", from:"ㅇㅇ건설", at:"2026-01-19 10:03" },

        { mailId: uuid(), box:"sent", subject:"[ㅇㅇ건설(주)] ㅇㅇㅇ프로젝트 구조 작업 데이터 송부", from:"(보낸메일)", at:"2026-01-20 16:22" },
        { mailId: uuid(), box:"sent", subject:"[ㅇㅇ건설(주)] ㅇㅇㅇ프로젝트 산출서 송부", from:"(보낸메일)", at:"2026-01-19 16:22" },
        { mailId: uuid(), box:"sent", subject:"[ㅇㅇ건설(주)] ㅇㅇㅇ프로젝트 작업도면 송부", from:"(보낸메일)", at:"2026-01-18 16:22" },
        { mailId: uuid(), box:"sent", subject:"[ㅇㅇ건설(주)] ㅇㅇㅇ프로젝트 도면 수정에 의한 자료 송부", from:"(보낸메일)", at:"2026-01-17 16:22" },
        { mailId: uuid(), box:"sent", subject:"[ㅇㅇ건설(주)] ㅇㅇㅇ프로젝트 구조 물량 비교표 송부", from:"(보낸메일)", at:"2026-01-16 16:22" },

        { mailId: uuid(), box:"inbox", subject:'[체크리스트 자료]ㅇㅇㅇ 프로젝트 PM "ㅇㅇㅇ" 체크리스트 송부', from:"(보낸메일)", at:"2026-02-02 09:40" },
        { mailId: uuid(), box:"inbox", subject:'[체크리스트 자료]ㅇㅇㅇ 프로젝트 PM "ㅇㅇㅇ" 체크리스트 송부(보완 요청)', from:"(보낸메일)", at:"2026-02-03 14:18" },
        { mailId: uuid(), box:"sent",  subject:'[체크리스트 자료]ㅇㅇㅇ 프로젝트 PM "ㅇㅇㅇ" 체크리스트 송부(회신)', from:"(보낸메일)", at:"2026-02-03 16:02" },

        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ프로젝트 신축공사 견적용역_납품 1차 자료 송부_(주)컨코스트", from:"ㅇㅇ건설(주)", at:"2026-02-04 10:05" },
        { mailId: uuid(), box:"inbox", subject:"[ㅇㅇ건설(주)] ㅇㅇ프로젝트 신축공사 견적용역_납품 1차 자료 확인요청", from:"ㅇㅇ건설(주)", at:"2026-02-04 15:22" },
        { mailId: uuid(), box:"sent",  subject:"[ㅇㅇ건설(주)] ㅇㅇ프로젝트 신축공사 견적용역_납품 1차 자료 송부_(주)컨코스트", from:"ㅇㅇ건설(주)", at:"2026-02-04 09:55" },
      ],

            // 게시판(더미)
      boardPosts: [
        { postId: uuid(), boardKey:"ceo",     title:"2월 운영 메시지", writer:"대표", at:"2026-02-02", views: 31,  isNotice:true },
        { postId: uuid(), boardKey:"weekly",  title:"주간 프로젝트 진행사항(2월 1주차)", writer:"PMO", at:"2026-02-03", views: 237, isNotice:true },
        { postId: uuid(), boardKey:"gallery", title:"25년 송년의밤 회식", writer:"관리팀", at:"2026-02-01", views: 355, isNotice:false },
        { postId: uuid(), boardKey:"notice",  title:"2025년 연말정산 안내", writer:"총무팀", at:"2026-01-26", views: 137, isNotice:true },
        { postId: uuid(), boardKey:"hr",      title:"인사발령(260126)", writer:"인사팀", at:"2026-01-26", views: 194, isNotice:true },
        { postId: uuid(), boardKey:"minutes", title:"주간 회의록(1월 3주차)", writer:"PMO", at:"2026-01-21", views: 298, isNotice:false }
      ],


      // 전자결재(더미)
      approvals: [
        { docId: uuid(), box:"inbox", title:"지출결의서(자재비) 승인 요청", from:"작업자A", at:"2026-01-26 11:20", status:"pending" },
        { docId: uuid(), box:"sent",  title:"품의서(장비임차) 제출", from:"(보낸결재)", at:"2026-01-24 09:10", status:"submitted" }
      ],

      // 일정(더미)
      staffSchedules: [
        { evId: uuid(), type:"휴가", name:"작업자A", date:"2026-01-29", note:"연차" },
        { evId: uuid(), type:"외근", name:"작업자B", date:"2026-01-30", note:"현장 방문(평택)" }
      ],

      // 생일(더미)
      birthdays: [
        { bId: uuid(), name: "ㅇㅇㅇ 사원", md: "05-06" },
        { bId: uuid(), name: "ㅇㅇㅇ 사원", md: "05-11" },
        { bId: uuid(), name: "ㅇㅇㅇ 사원", md: "06-02" }
      ],

      // 업무관리(이 앱에서는 “바로가기만” 사용하지만, 기존 스키마는 유지)
      logs: [],
      checklists: []
    };
  }

  function isPlainObject(x){
    return x && typeof x === "object" && !Array.isArray(x);
  }

  function upgradeDB(db){
    const seed = makeSeedDB();

    function syncSeedMails(db, seed){
      const prevVer = String(db?.meta?.seedMailsVersion || "");
      const nextVer = String(seed?.meta?.seedMailsVersion || "");
      if (!nextVer) return;
      if (prevVer === nextVer) return;

      const exist = new Set((db.mails || []).map(m => `${m.box}||${m.subject}||${m.at}`));
      (seed.mails || []).forEach(m=>{
        const k = `${m.box}||${m.subject}||${m.at}`;
        if (!exist.has(k)){
          db.mails.push(m);
          exist.add(k);
        }
      });

      db.meta.seedMailsVersion = nextVer;
    }

    if (!isPlainObject(db)) return seed;

    if (!isPlainObject(db.meta)) db.meta = {};
    if (typeof db.meta.version !== "string") db.meta.version = seed.meta.version;
    if (typeof db.meta.createdAt !== "string") db.meta.createdAt = seed.meta.createdAt;

    const ARR_FIELDS = ["users","projects","mails","boardPosts","approvals","staffSchedules","birthdays","logs","checklists"];
    for (const k of ARR_FIELDS){
      if (!Array.isArray(db[k])) db[k] = Array.isArray(seed[k]) ? seed[k].slice() : [];
    }

    syncSeedMails(db, seed);

    if (!db.users.length) db.users = seed.users.slice();
    if (!db.projects.length) db.projects = seed.projects.slice();

    db.users = db.users.map(u => ({
      userId: String(u?.userId || uuid()),
      name: String(u?.name || "-"),
      role: String(u?.role || "staff"),
      avatarDataUrl: typeof u?.avatarDataUrl === "string" ? u.avatarDataUrl : ""
    }));

    db.mails = db.mails.map(m => ({
      mailId: String(m?.mailId || uuid()),
      box: String(m?.box || "inbox"),
      subject: String(m?.subject || ""),
      from: String(m?.from || ""),
      at: String(m?.at || "")
    }));

        db.boardPosts = db.boardPosts.map(p => ({
      postId: String(p?.postId || uuid()),
      boardKey: String(p?.boardKey || "notice"),
      title: String(p?.title || ""),
      writer: String(p?.writer || ""),
      at: String(p?.at || ""),
      views: Number.isFinite(Number(p?.views)) ? Number(p.views) : 0,
      isNotice: !!p?.isNotice
    }));


    db.approvals = db.approvals.map(a => ({
      docId: String(a?.docId || uuid()),
      box: String(a?.box || "inbox"),
      title: String(a?.title || ""),
      from: String(a?.from || ""),
      at: String(a?.at || ""),
      status: String(a?.status || "pending")
    }));

    db.staffSchedules = db.staffSchedules.map(e => ({
      evId: String(e?.evId || uuid()),
      type: String(e?.type || "휴가"),
      name: String(e?.name || ""),
      date: String(e?.date || ""),
      note: String(e?.note || "")
    }));

    db.birthdays = db.birthdays.map(b => ({
      bId: String(b?.bId || uuid()),
      name: String(b?.name || "ㅇㅇㅇ 사원"),
      md: String(b?.md || "01-01")
    }));

    db.logs = (db.logs || []).map(l => ({
      logId: String(l?.logId || uuid()),
      date: String(l?.date || ""),
      projectId: String(l?.projectId || (db.projects[0]?.projectId || "")),
      category: String(l?.category || "구조"),
      process: String(l?.process || ""),
      content: String(l?.content || ""),
      ratio: Number(l?.ratio || 0),
      writerId: String(l?.writerId || (db.users[0]?.userId || "")),
      status: String(l?.status || "submitted"),
      submittedAt: String(l?.submittedAt || ""),
      approvedBy: String(l?.approvedBy || ""),
      approvedAt: String(l?.approvedAt || ""),
      rejectedBy: String(l?.rejectedBy || ""),
      rejectedAt: String(l?.rejectedAt || ""),
      rejectReason: String(l?.rejectReason || "")
    }));

    db.checklists = Array.isArray(db.checklists) ? db.checklists : [];
    return db;
  }

  function ensureDB(){
    const loaded = loadDB();
    const db = upgradeDB(loaded);
    localStorage.setItem(LS_KEY, JSON.stringify(db));
    return db;
  }

  function getUserId(db){
    const saved = localStorage.getItem(LS_USER);
    if (saved && db.users.some(u => u.userId === saved)) return saved;
    localStorage.setItem(LS_USER, db.users[0].userId);
    return db.users[0].userId;
  }
  function userById(db, id){ return db.users.find(u => u.userId === id) || null; }

  /***********************
   * Tabs / Menus
   ***********************/
  const TOP_TABS = [
    { key:"전자메일", label:"전자메일" },
    { key:"게시판",   label:"게시판" },
    { key:"전자결재", label:"전자결재" },
    { key:"일정관리", label:"일정관리" },
    { key:"업무관리", label:"업무관리" },
  ];

  const SIDE_MENUS = {
    "전자메일": [
      { key:"mail-inbox",     label:"받은편지함",     route:"#전자메일/mail-inbox" },
      { key:"mail-sent",      label:"보낸편지함",     route:"#전자메일/mail-sent" },
      { key:"mail-draft",     label:"임시보관함",     route:"#전자메일/mail-draft" },
      { key:"mail-scheduled", label:"예약메세지보기", route:"#전자메일/mail-scheduled" },
      { key:"mail-starred",   label:"중요편지함",     route:"#전자메일/mail-starred" },
    ],
    "게시판": [
      { key:"ceo",     label:"CEO Message", route:"#게시판/ceo" },
      { key:"notice",  label:"전사공지",     route:"#게시판/notice" },
      { key:"hr",      label:"인사발령",     route:"#게시판/hr" },
      { key:"bid",     label:"경조사",       route:"#게시판/bid" },
      { key:"orders",  label:"수주소식",     route:"#게시판/orders" },
      { key:"minutes", label:"회의록",       route:"#게시판/minutes" },
      { key:"weekly",  label:"주간 프로젝트 진행사항", route:"#게시판/weekly" },
      { key:"manual",  label:"매뉴얼",       route:"#게시판/manual" },
      { key:"gallery", label:"사진첩",       route:"#게시판/gallery" },
      { key:"free",    label:"자유게시판",   route:"#게시판/free" }
    ],
    "전자결재": [
      { key:"ea-inbox", label:"받은결재함", route:"#전자결재/ea-inbox" },
      { key:"ea-sent",  label:"보낸결재함", route:"#전자결재/ea-sent" },
      { key:"ea-write", label:"문서작성",   route:"#전자결재/ea-write" }
    ],
    "일정관리": [
      { key:"vacation",         label:"휴가관리",     route:"#일정관리/vacation" },
      { key:"company-calendar", label:"회사공식일정", route:"#일정관리/company-calendar" }
    ],
    "업무관리": [
      { key:"shortcut", label:"업무관리 바로가기", route:"#업무관리/shortcut", action:"openApp2" }
    ]
  };

  function firstMenuRoute(tabKey){
    if (tabKey === "대쉬보드") return "#대쉬보드/home";
    const m = SIDE_MENUS[tabKey]?.[0];
    return m?.route || "#대쉬보드/home";
  }

  /***********************
   * MegaMenu
   ***********************/
  function openMega(){ if (els.megaMenu) els.megaMenu.classList.add("open"); }
  function closeMega(){ if (els.megaMenu) els.megaMenu.classList.remove("open"); }

  function renderTopTabs(){
    if (!els.topTabs) return;
    els.topTabs.innerHTML = "";

    TOP_TABS.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topTab top-tab";
      btn.dataset.key = t.key;
      btn.textContent = t.label;
      btn.addEventListener("click", () => { location.hash = firstMenuRoute(t.key); });
      els.topTabs.appendChild(btn);
    });
  }

  function renderMegaMenu(){
    if (!els.megaMenu) return;

    const root = $(".mega-inner", els.megaMenu) || els.megaMenu;
    const cols = $$(".mega-col", root);

    const keys = TOP_TABS.map(t => t.key);
    keys.forEach((k, i) => {
      const col = cols[i];
      if (!col) return;

      const title = $(".mega-col-title", col);
      if (title) title.textContent = k;

      const itemsWrap = $(".mega-col-items", col);
      if (!itemsWrap) return;

      itemsWrap.innerHTML = "";
      (SIDE_MENUS[k] || []).forEach(m => {
        const a = document.createElement("a");
        a.href = m.route;
        a.className = "mega-item";
        a.textContent = m.label;
        a.addEventListener("click", (e) => {
          if (m.action === "openApp2"){
            e.preventDefault();
            openApp2();
          } else {
            closeMega();
          }
        });
        itemsWrap.appendChild(a);
      });
    });

    const wrap = $(".navWrap") || els.topTabs?.parentElement;
    if (wrap && !wrap.dataset.megaBound){
      wrap.dataset.megaBound = "1";
      let closeTimer = null;

      const open = ()=>{ clearTimeout(closeTimer); openMega(); };
      const close = ()=>{ clearTimeout(closeTimer); closeTimer = setTimeout(closeMega, 120); };

      wrap.addEventListener("mouseenter", open);
      wrap.addEventListener("mouseleave", close);
      els.megaMenu.addEventListener("mouseenter", open);
      els.megaMenu.addEventListener("mouseleave", close);

      els.topTabs?.addEventListener("click", (e)=>{
        if (e.target?.closest(".topTab, .top-tab")) return;
        if (e.target?.closest("#megaMenu")) return;
        els.megaMenu.classList.toggle("open");
      });
    }
  }

  function setActiveTopTab(tabKey){
    if (!els.topTabs) return;
    $$("#topTabs .topTab, #topTabs .top-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.key === tabKey);
    });
  }

  function renderSideMenu(tabKey){
    if (!els.sideMenu) return;

    if (tabKey === "대쉬보드"){
      els.sideMenu.innerHTML = "";
      return;
    }

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

  function setActiveSide(route){
    if (!els.sideMenu) return;
    const r = decodeURIComponent(String(route || ""));
    $$("#sideMenu .side-item").forEach(b => {
      const br = decodeURIComponent(String(b.dataset.route || ""));
      b.classList.toggle("active", br === r);
    });
  }

  /***********************
   * Profile
   ***********************/
  async function fileToDataURL(file){
    return new Promise((resolve,reject)=>{
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result||""));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function dom(html){
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  function renderProfile(db){
    if (!els.profileCard) return;

    const uid = getUserId(db);
    const me = userById(db, uid);

    const avatarInput = document.createElement("input");
    avatarInput.type = "file";
    avatarInput.accept = "image/*";
    avatarInput.id = "avatarInput";
    avatarInput.className = "hidden";

    const avatarPreview = document.createElement("img");
    avatarPreview.id = "avatarPreview";
    avatarPreview.alt = "profile";

    const avatarPlaceholder = document.createElement("div");
    avatarPlaceholder.id = "avatarPlaceholder";
    avatarPlaceholder.className = "avatar-placeholder";
    avatarPlaceholder.innerHTML = `<div class="avatar-icon">👤</div><div class="avatar-text">사진 업로드</div>`;

    avatarPreview.addEventListener("error", () => {
      avatarPreview.hidden = true;
      avatarPreview.removeAttribute("src");
      avatarPlaceholder.hidden = false;
    });

    if (me?.avatarDataUrl){
      avatarPreview.src = me.avatarDataUrl;
      avatarPreview.hidden = false;
      avatarPlaceholder.hidden = true;
    } else {
      avatarPreview.hidden = true;
      avatarPlaceholder.hidden = false;
    }

    const avatarBox = document.createElement("div");
    avatarBox.className = "avatar";
    avatarBox.setAttribute("role","button");
    avatarBox.tabIndex = 0;
    avatarBox.appendChild(avatarPreview);
    avatarBox.appendChild(avatarPlaceholder);
    avatarBox.addEventListener("click", ()=>avatarInput.click());
    avatarBox.addEventListener("keydown",(e)=>{
      if (e.key === "Enter" || e.key === " ") avatarInput.click();
    });

    avatarInput.addEventListener("change", async (e)=>{
      const file = e.target.files && e.target.files[0];
      if (!file || !me) return;
      try{
        const dataUrl = await fileToDataURL(file);
        me.avatarDataUrl = dataUrl;
        saveDB(db);

        avatarPreview.src = dataUrl;
        avatarPreview.hidden = false;
        avatarPlaceholder.hidden = true;
        toast("프로필 사진 변경 완료");
      }catch(err){
        console.error(err);
        toast("프로필 사진 업로드 실패");
      }
    });

    const roleSelect = document.createElement("select");
    roleSelect.className = "select profileSelect";
    ROLE_ORDER.forEach(r=>{
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = ROLE_LABEL_KO[r] || r;
      roleSelect.appendChild(opt);
    });
    roleSelect.value = (me?.role || "staff");
    roleSelect.addEventListener("change", ()=>{
      if (!me) return;
      me.role = roleSelect.value;
      saveDB(db);
      toast("직급 변경 완료");
    });

    els.profileCard.innerHTML = "";
    els.profileCard.appendChild(
      dom(`
        <div class="profileCard card">
          <div class="profileTop"></div>
          <div class="profileBody">
            <div class="profileRow"><div class="profileKey">성명</div><div class="profileVal">-</div></div>
            <div class="profileRow"><div class="profileKey">직급</div><div class="profileVal"></div></div>
            <div class="profileRow"><div class="profileKey">부서</div><div class="profileVal">-</div></div>
          </div>
        </div>
      `)
    );

    const top = $(".profileTop", els.profileCard);
    const roleVal = $$(".profileVal", els.profileCard)[1];

    if (top){
      top.appendChild(avatarBox);
      top.appendChild(avatarInput);
    }
    if (roleVal) roleVal.appendChild(roleSelect);
  }

  /***********************
   * Birthdays (대쉬보드에서만)
   ***********************/
  function renderBirthdayCard(db, visible){
    if (!els.birthdayCard) return;
    if (!visible){
      els.birthdayCard.innerHTML = "";
      els.birthdayCard.classList.add("hidden");
      els.birthdayCard.style.display = "none";
      return;
    }

    els.birthdayCard.classList.remove("hidden");
    els.birthdayCard.style.display = "";

    const items = Array.isArray(db.birthdays) ? db.birthdays.slice() : [];

    function nextTime(md){
      const [mm, dd] = String(md||"").split("-").map(Number);
      if (!mm || !dd) return Number.POSITIVE_INFINITY;

      const now = new Date();
      const y = now.getFullYear();
      const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);

      const t0 = new Date(y, mm - 1, dd, 0, 0, 0, 0);
      if (t0 >= today0) return t0.getTime();
      const t1 = new Date(y + 1, mm - 1, dd, 0, 0, 0, 0);
      return t1.getTime();
    }

    items.sort((a,b)=> nextTime(a.md) - nextTime(b.md));
    const top = items.slice(0, 8);

    const body = top.length
      ? `<div class="bdayGrid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
          ${top.map(x=>`
            <div class="bdayItem">
              <div class="bdayAvatar">👤</div>
              <div class="bdayName">${escapeHtml(String(x.name||"ㅇㅇㅇ 사원"))}</div>
              <div class="bdayDate">${escapeHtml(String(x.md||"-- --"))}</div>
            </div>
          `).join("")}
        </div>`
      : `<div class="bdayEmpty">다가오는 생일이 없습니다.</div>`;

    els.birthdayCard.innerHTML = `
      <div class="bdayCard card">
        <div class="bdayHead">
          <div class="bdayTitle">다가오는 생일</div>
        </div>
        ${body}
      </div>
    `;
  }

  /***********************
   * Views
   ***********************/
  function setRouteTitle(text){
    const t = byId("routeTitle");
    if (t) t.textContent = text || "";
  }

  function viewDashboard(db){
    if (!els.view) return;
    els.view.innerHTML = "";
    setRouteTitle("Dashboard");

    function sortByAtDesc(a, b){ return String(b.at||"").localeCompare(String(a.at||"")); }
    function sortByDateAsc(a, b){ return String(a.date||"").localeCompare(String(b.date||"")); }

    const inboxMails = (db.mails || []).filter(m => m.box === "inbox").slice().sort(sortByAtDesc).slice(0, 6);
    const recentPosts = (db.boardPosts || []).slice().sort((a,b)=>String(b.at||"").localeCompare(String(a.at||""))).slice(0, 7);
    const inboxApprovals = (db.approvals || []).filter(d => d.box === "inbox").slice().sort(sortByAtDesc).slice(0, 6);

    const upcoming = (db.staffSchedules || [])
      .slice()
      .sort(sortByDateAsc)
      .filter(x => x.date >= todayISO())
      .slice(0, 7);

    function dashListCard({ title, subtitle, items, emptyText, onGo }){
      const head = dom(`
        <div class="dashCardHead">
          <button class="dashCardTitleLink" type="button">${escapeHtml(title)}</button>
          <div class="dashCardSub">${escapeHtml(subtitle || " ")}</div>
        </div>
      `);
      const titleBtn = $(".dashCardTitleLink", head);
      if (titleBtn) titleBtn.addEventListener("click", onGo);

      const list = document.createElement("div");
      list.className = "dashList";

      if (!items || !items.length){
        const empty = document.createElement("div");
        empty.className = "dashEmpty";
        empty.textContent = emptyText || "자료가 존재하지 않습니다.";
        list.appendChild(empty);
      } else {
        items.forEach(it=>{
          const row = dom(`
            <div class="dashItem">
              <div class="dashItemTitle">${escapeHtml(it.title)}</div>
              <div class="dashItemMeta">${escapeHtml(it.meta || "")}</div>
            </div>
          `);
          list.appendChild(row);
        });
      }

      const card = document.createElement("div");
      card.className = "dashCard card";
      card.appendChild(head);
      card.appendChild(list);
      return card;
    }

    const cardMail = dashListCard({
      title: "전자메일",
      subtitle: "받은메일함",
      items: inboxMails.map(m => ({ title: m.subject, meta: `${m.from} · ${m.at}` })),
      emptyText: "받은메일함에 메일이 없습니다.",
      onGo: ()=> location.hash = "#전자메일/mail-inbox"
    });

    const cardBoard = dashListCard({
      title: "게시판",
      subtitle: "최근 게시물",
      items: recentPosts.map(p => ({ title: `[${p.boardKey}] ${p.title}`, meta: `${p.writer} · ${p.at}` })),
      emptyText: "최근 게시물이 없습니다.",
      onGo: ()=> location.hash = "#게시판/notice"
    });

    const cardEA = dashListCard({
      title: "전자결재",
      subtitle: "받은결재함",
      items: inboxApprovals.map(d => ({ title: d.title, meta: `${d.from} · ${d.at}` })),
      emptyText: "받은결재함에 문서가 없습니다.",
      onGo: ()=> location.hash = "#전자결재/ea-inbox"
    });

    const cardSchedule = dashListCard({
      title: "일정관리",
      subtitle: "다가오는 휴가/외근",
      items: upcoming.map(e => ({ title: `${e.type} · ${e.name}`, meta: `${e.date} · ${e.note || ""}`.trim() })),
      emptyText: "다가오는 휴가/외근 일정이 없습니다.",
      onGo: ()=> location.hash = "#일정관리/vacation"
    });

    const wrap = dom(`<div class="dashWrap"></div>`);
    const grid = dom(`<div class="dashGrid"></div>`);
    grid.appendChild(cardMail);
    grid.appendChild(cardBoard);
    grid.appendChild(cardEA);
    grid.appendChild(cardSchedule);
    wrap.appendChild(grid);
    els.view.appendChild(wrap);
  }

  function viewMail(db, sub){
    if (!els.view) return;
    els.view.innerHTML = "";

    const boxBySub = {
      "mail-inbox": "inbox",
      "mail-sent": "sent",
      "mail-draft": "draft",
      "mail-scheduled": "scheduled",
      "mail-starred": "starred",
    };
    const labelBySub = {
      "mail-inbox": "받은편지함",
      "mail-sent": "보낸편지함",
      "mail-draft": "임시보관함",
      "mail-scheduled": "예약메세지보기",
      "mail-starred": "중요편지함",
    };

    const box = boxBySub[sub] || "inbox";
    const folderTitle = labelBySub[sub] || "받은편지함";
    setRouteTitle(`전자메일 · ${folderTitle}`);

    const all = (db.mails || [])
      .filter(m => String(m.box||"") === String(box))
      .slice()
      .sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));

    const mailUIKey = "CONCOST_MAIL_UI_V1";
    const ui = safeParse(localStorage.getItem(mailUIKey) || "{}", {});
    if (!ui.star) ui.star = {};
    if (!ui.check) ui.check = {};
    ui.cat = ui.cat || "basic";
    function saveUI(){ localStorage.setItem(mailUIKey, JSON.stringify(ui)); }

    const showCatTabs = (box === "inbox" || box === "sent");
    const catTabs = showCatTabs ? [
      { key:"basic",     label:"기본" },
      { key:"checklist", label:"체크리스트" },
      { key:"deliver",   label:"납품메일" },
    ] : [];
    if (!showCatTabs) ui.cat = "basic";

    const layout = dom(`
      <div class="mailG">
        <div class="mailGTop card">
          <div class="mailGTopLeft">
            <button class="btn tiny mailGIcon" type="button" title="새 메일">✎</button>
            <button class="btn tiny mailGIcon" type="button" title="새로고침">⟳</button>
          </div>

          <div class="mailGTopMid">
            <div class="mailGTabs" id="mailGTabs" style="${showCatTabs ? "" : "display:none;"}"></div>
          </div>

          <div class="mailGTopRight">
            <input class="mailGSearch" id="mailGSearch" placeholder="메일 검색" />
            <div class="mailGCount" id="mailGCount"></div>
          </div>
        </div>

        <div class="mailGBody">
          <div class="mailGList card">
            <div class="mailGListHead">
              <label class="mailGChkAll">
                <input type="checkbox" id="mailChkAll">
                <span></span>
              </label>
            </div>
            <div class="mailGRows" id="mailGRows"></div>
          </div>
        </div>
      </div>
    `);

    els.view.appendChild(layout);

    const tabsHost = byId("mailGTabs");
    const rowsHost = byId("mailGRows");
    const qEl = byId("mailGSearch");
    const countEl = byId("mailGCount");
    const chkAll = byId("mailChkAll");

    function renderTabs(){
      if (!tabsHost) return;
      if (!showCatTabs){ tabsHost.innerHTML = ""; return; }
      tabsHost.innerHTML = "";
      catTabs.forEach(t=>{
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mailGTab" + (ui.cat === t.key ? " active" : "");
        b.textContent = t.label;
        b.addEventListener("click", ()=>{
          ui.cat = t.key;
          saveUI();
          renderTabs();
          applyFilter();
        });
        tabsHost.appendChild(b);
      });
    }

    function rowEl(m){
      const id = m.mailId || "";
      const isStar = !!ui.star[id];
      const isChecked = !!ui.check[id];

      const row = dom(`
        <div class="mailGRow" data-id="${escapeHtml(id)}">
          <div class="mailGCol mailGColChk">
            <label class="mailGChk">
              <input type="checkbox" ${isChecked ? "checked" : ""}>
              <span></span>
            </label>
          </div>

          <div class="mailGCol mailGColStar" title="중요">
            <button class="mailGStar ${isStar ? "on" : ""}" type="button" aria-label="star">★</button>
          </div>

          <div class="mailGCol mailGColFrom">
            <div class="mailGFrom">${escapeHtml(m.from || "-")}</div>
          </div>

          <div class="mailGCol mailGColSubject">
            <div class="mailGSubject">${escapeHtml(m.subject || "")}</div>
          </div>

          <div class="mailGCol mailGColAt">
            <div class="mailGAt">${escapeHtml(m.at || "-")}</div>
          </div>
        </div>
      `);

      const cb = row.querySelector('input[type="checkbox"]');
      if (cb){
        cb.addEventListener("change", ()=>{
          ui.check[id] = cb.checked;
          saveUI();
          syncChkAll();
        });
      }

      const starBtn = row.querySelector(".mailGStar");
      if (starBtn){
        starBtn.addEventListener("click", (e)=>{
          e.stopPropagation();
          ui.star[id] = !ui.star[id];
          saveUI();
          starBtn.classList.toggle("on", !!ui.star[id]);
          if (box === "starred") applyFilter();
        });
      }

      return row;
    }

    function renderRows(items){
      if (!rowsHost) return;
      rowsHost.innerHTML = "";
      if (countEl) countEl.textContent = `${items.length}개`;

      if (!items.length){
        rowsHost.appendChild(dom(`<div class="mailGEmpty">메일이 없습니다.</div>`));
        if (chkAll) chkAll.checked = false;
        return;
      }

      items.forEach(m => rowsHost.appendChild(rowEl(m)));
      syncChkAll();
    }

    let filteredCache = [];

    function syncChkAll(){
      if (!chkAll) return;
      const ids = (filteredCache || []).map(m => m.mailId).filter(Boolean);
      if (!ids.length){ chkAll.checked = false; return; }
      chkAll.checked = ids.every(id => !!ui.check[id]);
    }

    function applyFilter(){
      const q = (qEl ? qEl.value : "").trim().toLowerCase();
      let items = all.slice();

      if (showCatTabs){
        const subOf = (m)=> String(m.subject || "");
        if (ui.cat === "checklist"){
          items = items.filter(m => subOf(m).includes("[체크리스트 자료]"));
        } else if (ui.cat === "deliver"){
          items = items.filter(m => subOf(m).includes("_납품") || subOf(m).includes("납품"));
        } else {
          items = items.filter(m => {
            const s = subOf(m);
            return !(s.includes("[체크리스트 자료]") || s.includes("_납품") || s.includes("납품"));
          });
        }
      }

      if (box === "starred"){
        items = items.filter(m => !!ui.star[m.mailId]);
      }

      if (q){
        items = items.filter(m=>{
          const s = `${m.from||""} ${m.subject||""} ${m.at||""}`.toLowerCase();
          return s.includes(q);
        });
      }

      filteredCache = items;
      renderRows(items);
    }

    if (qEl){
      qEl.addEventListener("keydown", (e)=>{ if (e.key === "Enter") applyFilter(); });
      qEl.addEventListener("input", ()=> applyFilter());
    }

    if (chkAll){
      chkAll.addEventListener("change", ()=>{
        const ids = (filteredCache || []).map(m => m.mailId).filter(Boolean);
        ids.forEach(id => ui.check[id] = chkAll.checked);
        saveUI();
        applyFilter();
      });
    }

    renderTabs();
    applyFilter();
  }

    function viewBoard(db, sub){
    if (!els.view) return;
    els.view.innerHTML = "";

    const boardKey = String(sub || "notice");
    const labelMap = {
      ceo:"CEO Message",
      notice:"전사공지",
      hr:"인사발령",
      bid:"경조사",
      orders:"수주소식",
      minutes:"회의록",
      weekly:"주간 프로젝트 진행사항",
      manual:"매뉴얼",
      gallery:"사진첩",
      free:"자유게시판"
    };

    const title = `게시판 · ${labelMap[boardKey] || boardKey}`;
    setRouteTitle(title);

    const all = (db.boardPosts || [])
      .filter(p => String(p.boardKey||"") === boardKey)
      .slice()
      .sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));

    // UI state (검색/페이징 유지)
    const uiKey = `CONCOST_BOARD_UI_V1_${boardKey}`;
    const ui = safeParse(localStorage.getItem(uiKey) || "{}", {});
    ui.field = ui.field || "title"; // title | writer
    ui.q = typeof ui.q === "string" ? ui.q : "";
    ui.page = Number.isFinite(Number(ui.page)) ? Number(ui.page) : 1;
    const PAGE_SIZE = 10;

    function saveUI(){ localStorage.setItem(uiKey, JSON.stringify(ui)); }

    // layout
    const wrap = dom(`
      <div class="boardWrap">
        <div class="boardHead card">
          <div class="boardHeadTitle">${escapeHtml(title)}</div>
          <div class="boardSearchRow">
            <select class="boardSel" id="boardField">
              <option value="title">제목</option>
              <option value="writer">작성자</option>
            </select>
            <input class="boardQ" id="boardQ" placeholder="검색어를 입력해주세요." />
            <button class="btn boardBtn" id="boardSearchBtn" type="button">검색</button>
          </div>
        </div>

        <div class="boardCard card">
          <div class="boardTopLine">
            <div class="boardCount" id="boardCount"></div>
          </div>

          <div class="boardList" id="boardList"></div>

          <div class="boardPager" id="boardPager"></div>
        </div>
      </div>
    `);

    els.view.appendChild(wrap);

    const fieldEl = byId("boardField");
    const qEl = byId("boardQ");
    const btnEl = byId("boardSearchBtn");
    const listEl = byId("boardList");
    const cntEl = byId("boardCount");
    const pagerEl = byId("boardPager");

    if (fieldEl) fieldEl.value = ui.field;
    if (qEl) qEl.value = ui.q;

    function badgeHTML(p){
      return p?.isNotice ? `<span class="bBadge">공지</span>` : `<span class="bNo">${escapeHtml(String(p.no||""))}</span>`;
    }

    function computeNo(items){
      // 최신순 정렬 기준으로 표시번호 부여(공지 아닌 글만)
      let n = items.length;
      return items.map(it=>{
        const x = { ...it };
        if (!x.isNotice){
          x.no = String(n);
          n -= 1;
        } else {
          x.no = "";
        }
        return x;
      });
    }

    function filtered(){
      const q = String(ui.q || "").trim().toLowerCase();
      let items = all.slice();

      // 공지 우선(상단 고정 느낌)
      items.sort((a,b)=>{
        const an = a?.isNotice ? 1 : 0;
        const bn = b?.isNotice ? 1 : 0;
        if (an !== bn) return bn - an;
        return String(b.at||"").localeCompare(String(a.at||""));
      });

      if (q){
        if (ui.field === "writer"){
          items = items.filter(p => String(p.writer||"").toLowerCase().includes(q));
        } else {
          items = items.filter(p => String(p.title||"").toLowerCase().includes(q));
        }
      }

      return computeNo(items);
    }

    function render(){
      const items = filtered();
      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      ui.page = Math.min(Math.max(1, ui.page), totalPages);
      saveUI();

      if (cntEl) cntEl.textContent = `전체 ${total}건`;

      const start = (ui.page - 1) * PAGE_SIZE;
      const pageItems = items.slice(start, start + PAGE_SIZE);

      if (listEl){
        listEl.innerHTML = "";

        // header row
        listEl.appendChild(dom(`
          <div class="bRow bHead">
            <div class="bCell bNoCol">번호</div>
            <div class="bCell bTitleCol">제목</div>
            <div class="bCell bAtCol">작성일</div>
            <div class="bCell bViewCol">조회</div>
          </div>
        `));

        if (!pageItems.length){
          listEl.appendChild(dom(`<div class="bEmpty">표시할 게시물이 없습니다</div>`));
        } else {
          pageItems.forEach(p=>{
            const row = dom(`
              <div class="bRow">
                <div class="bCell bNoCol">${badgeHTML(p)}</div>
                <div class="bCell bTitleCol">
                  <div class="bTitle">${escapeHtml(p.title || "")}</div>
                  <div class="bSub">${escapeHtml(p.writer || "-")}</div>
                </div>
                <div class="bCell bAtCol">${escapeHtml(p.at || "-")}</div>
                <div class="bCell bViewCol">${escapeHtml(String(Number(p.views||0)))}</div>
              </div>
            `);

            // (추후 상세보기 연결 대비) 지금은 토스트만
            row.addEventListener("click", ()=>{
              toast("상세보기는 추후 연결 예정입니다.");
            });

            listEl.appendChild(row);
          });
        }
      }

      // pager
      if (pagerEl){
        pagerEl.innerHTML = "";

        const mkBtn = (label, page, disabled=false, active=false) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bPageBtn" + (active ? " active" : "");
          b.textContent = label;
          b.disabled = !!disabled;
          b.addEventListener("click", ()=>{
            ui.page = page;
            saveUI();
            render();
          });
          return b;
        };

        pagerEl.appendChild(mkBtn("«", 1, ui.page === 1));
        pagerEl.appendChild(mkBtn("‹", Math.max(1, ui.page - 1), ui.page === 1));

        // 가운데 페이지 번호(최대 7개)
        const span = 3;
        let s = Math.max(1, ui.page - span);
        let e = Math.min(totalPages, ui.page + span);
        if (e - s < span * 2){
          s = Math.max(1, e - span * 2);
          e = Math.min(totalPages, s + span * 2);
        }
        for (let i=s;i<=e;i++){
          pagerEl.appendChild(mkBtn(String(i), i, false, i === ui.page));
        }

        pagerEl.appendChild(mkBtn("›", Math.min(totalPages, ui.page + 1), ui.page === totalPages));
        pagerEl.appendChild(mkBtn("»", totalPages, ui.page === totalPages));
      }
    }

    function doSearch(){
      ui.field = fieldEl ? fieldEl.value : "title";
      ui.q = qEl ? qEl.value : "";
      ui.page = 1;
      saveUI();
      render();
    }

    if (btnEl) btnEl.addEventListener("click", doSearch);
    if (qEl){
      qEl.addEventListener("keydown", (e)=>{ if (e.key === "Enter") doSearch(); });
      qEl.addEventListener("input", ()=>{ ui.q = qEl.value; saveUI(); render(); });
    }
    if (fieldEl){
      fieldEl.addEventListener("change", ()=>{ ui.field = fieldEl.value; saveUI(); render(); });
    }

    render();
  }


  function viewEA(db, sub){
    if (!els.view) return;
    els.view.innerHTML = "";

    const box = (sub === "ea-sent") ? "sent" : "inbox";
    const label = (box === "sent") ? "보낸결재함" : "받은결재함";
    const title = `전자결재 · ${label}`;
    setRouteTitle(title);

    const items = (db.approvals || [])
      .filter(a => String(a.box||"") === box)
      .slice()
      .sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));

    const card = dom(`
      <div class="card">
        <div class="card-head">
          <div class="card-title">${escapeHtml(title)}</div>
          <div class="badge">${items.length}건</div>
        </div>
        <div class="list"></div>
      </div>
    `);

    const list = $(".list", card);
    if (list){
      if (!items.length){
        list.appendChild(dom(`<div class="empty">표시할 결재 문서가 없습니다</div>`));
      } else {
        items.forEach(d=>{
          const st = d.status ? ` · ${d.status}` : "";
          list.appendChild(dom(`
            <div class="list-item">
              <div class="list-title">${escapeHtml(d.title || "")}</div>
              <div class="list-sub">${escapeHtml(`${d.from || "-"} · ${d.at || "-"}${st}`)}</div>
            </div>
          `));
        });
      }
    }

    els.view.appendChild(dom(`<div class="stack"></div>`));
    $(".stack", els.view).appendChild(card);
  }

  function viewSchedule(db, sub){
    if (!els.view) return;
    els.view.innerHTML = "";

    const label = (sub === "vacation") ? "휴가관리" : "회사공식일정";
    const title = `일정관리 · ${label}`;
    setRouteTitle(title);

    const items = (db.staffSchedules || [])
      .slice()
      .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))
      .slice(0, 50);

    const card = dom(`
      <div class="card">
        <div class="card-head">
          <div class="card-title">${escapeHtml(title)}</div>
          <div class="badge">${items.length}건</div>
        </div>
        <div class="list"></div>
      </div>
    `);

    const list = $(".list", card);
    if (list){
      if (!items.length){
        list.appendChild(dom(`<div class="empty">표시할 일정이 없습니다</div>`));
      } else {
        items.forEach(e=>{
          list.appendChild(dom(`
            <div class="list-item">
              <div class="list-title">${escapeHtml(`${e.type || "-"} · ${e.name || "-"}`)}</div>
              <div class="list-sub">${escapeHtml(`${e.date || "-"} · ${e.note || ""}`.trim())}</div>
            </div>
          `));
        });
      }
    }

    els.view.appendChild(dom(`<div class="stack"></div>`));
    $(".stack", els.view).appendChild(card);
  }

  function viewWorkShortcut(){
    if (!els.view) return;
    els.view.innerHTML = "";
    setRouteTitle("업무관리");

    const card = dom(`
      <div class="card">
        <div class="card-title">업무관리</div>
        <div class="muted small" style="margin-top:10px">
          업무관리 기능은 그룹웨어와 분리되어 별도 창에서 실행됩니다.
        </div>
        <div style="margin-top:12px">
          <button class="btn primary" id="btnOpenApp2" type="button">업무관리 바로가기 (새 창)</button>
        </div>
      </div>
    `);

    const b = $("#btnOpenApp2", card);
    if (b) b.addEventListener("click", openApp2);

    els.view.appendChild(dom(`<div class="stack"></div>`));
    $(".stack", els.view).appendChild(card);
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

  /***********************
   * Routing
   ***********************/
  function parseHash(){
    const h = (location.hash || "#대쉬보드/home").replace(/^#/, "");
    const [tabRaw, pageRaw] = h.split("/");
    const tab = decodeURIComponent(tabRaw || "대쉬보드");
    const page = decodeURIComponent(pageRaw || "home");
    return { tab, page, raw:"#"+h };
  }

  function resolveTopTab(tab){
    if (tab === "대쉬보드") return "대쉬보드";
    return TOP_TABS.some(t => t.key === tab) ? tab : "대쉬보드";
  }

  function route(){
    if (fatalDomReport()) return;

    document.body.classList.add("routeChanging");
    setTimeout(() => document.body.classList.remove("routeChanging"), 160);

    const db = ensureDB();
    const { tab, page, raw } = parseHash();
    const t = resolveTopTab(tab);

    renderProfile(db);
    renderBirthdayCard(db, t === "대쉬보드");

    renderTopTabs();
    renderMegaMenu();

    if (t === "대쉬보드"){
      setActiveTopTab("");
      renderSideMenu("대쉬보드");
      setActiveSide("");
      viewDashboard(db);

      if (els.badgePending){
        els.badgePending.textContent = "";
        els.badgePending.classList.add("hidden");
      }
      return;
    }

    setActiveTopTab(t);
    renderSideMenu(t);
    setActiveSide(location.hash || raw);

    if (t === "전자메일"){
      viewMail(db, page);
    } else if (t === "게시판"){
      viewBoard(db, page);
    } else if (t === "전자결재"){
      if (page === "ea-write") viewPlaceholder("전자결재 · 문서작성 (준비중)");
      else viewEA(db, page);
    } else if (t === "일정관리"){
      viewSchedule(db, page);
    } else if (t === "업무관리"){
      if (page === "shortcut") viewWorkShortcut();
      else location.hash = "#업무관리/shortcut";
    } else {
      location.hash = "#대쉬보드/home";
    }

    if (els.badgePending){
      const n = (db.approvals||[]).filter(x=>x.box==="inbox").length;
      if (t === "대쉬보드"){
        els.badgePending.textContent = String(n);
        els.badgePending.classList.remove("hidden");
      } else {
        els.badgePending.textContent = "";
        els.badgePending.classList.add("hidden");
      }
    }
  }

  /***********************
   * App2 open
   ***********************/
  function openApp2(){
    const w = window.open("app2.html", "CONCOST_WORK", "width=1400,height=900");
    if (!w) toast("팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도하세요.");
  }

  /***********************
   * Init
   ***********************/
  function init(){
    if (fatalDomReport()) return;

    applyScrollFix();
    ensureDB();

    if (els.modalClose) els.modalClose.addEventListener("click", modalClose);
    if (els.modalBackdrop){
      els.modalBackdrop.addEventListener("click", (e)=>{
        if (e.target === els.modalBackdrop) modalClose();
      });
    }

    if (els.logoHome){
      els.logoHome.addEventListener("click", (e)=>{
        e.preventDefault();
        location.hash = "#대쉬보드/home";
      });
    }

    window.addEventListener("hashchange", ()=>{
      closeMega();
      route();
    });

    if (!location.hash) location.hash = "#대쉬보드/home";
    route();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
