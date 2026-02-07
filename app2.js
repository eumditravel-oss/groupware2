/* app2.js (UPDATED) */
(() => {
  "use strict";

  /***********************
   * 공정 마스터(고정)
   ***********************/
  const PROCESS_MASTER = {
    "구조": ["기초","기둥","보","슬라브","옹벽","철골","동바리","구조검토"],
    "마감": ["가설","창호","내부","외부","세대","마감검토"]
  };

  /***********************
   * Roles
   ***********************/
  const ROLE_ORDER = ["staff","leader","manager","director","vp","svp","ceo"];
  const ROLE_LABEL_KO = {
    staff:"사원", leader:"팀장", manager:"실장", director:"본부장", vp:"상무", svp:"부사장", ceo:"대표"
  };
  function roleRank(role){
    const i = ROLE_ORDER.indexOf(role);
    return i >= 0 ? i : 0;
  }
  function isStaff(user){ return (user?.role || "staff") === "staff"; }
  function isLeaderPlus(user){ return roleRank(user?.role || "staff") >= roleRank("leader"); }

  /***********************
   * Storage (메인과 동일)
   ***********************/
  const LS_KEY  = "CONCOST_GROUPWARE_DB_V05";
  const LS_USER = "CONCOST_GROUPWARE_USER_V05";

  function safeParse(s, fallback){ try { return JSON.parse(s); } catch { return fallback; } }

  function uuid(){
    try{
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
        return crypto.randomUUID();
      }
    }catch{}
    const hex = [];
    for (let i=0;i<256;i++) hex[i] = (i+256).toString(16).slice(1);
    let r = new Uint8Array(16);
    try{
      if (typeof crypto !== "undefined" && crypto.getRandomValues){
        crypto.getRandomValues(r);
      } else {
        for (let i=0;i<16;i++) r[i] = Math.floor(Math.random()*256);
      }
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

  function pad2(n){ return String(n).padStart(2,"0"); }
  function nowISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function clamp(n,a,b){ return Math.min(b, Math.max(a,n)); }

  function loadDB(){
    const raw = localStorage.getItem(LS_KEY);
    return raw ? safeParse(raw, null) : null;
  }
  function saveDB(db){
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  function ensureChecklistShape(item){
    if (!Array.isArray(item.confirmations)) item.confirmations = [];
    if (typeof item.status !== "string") item.status = "open";
    if (typeof item.doneBy !== "string") item.doneBy = "";
    if (typeof item.doneAt !== "string") item.doneAt = "";
    if (typeof item.createdAt !== "string") item.createdAt = item.createdAt ? String(item.createdAt) : "";
    return item;
  }

  function ensureDB(){
    const db = loadDB();
    if (db && typeof db === "object") {
      if (!Array.isArray(db.sharedFiles)) db.sharedFiles = [];
      if (!Array.isArray(db.tasks)) db.tasks = [];
      if (!Array.isArray(db.messages)) db.messages = [];
      if (!Array.isArray(db.approvals)) db.approvals = [];
      // ✅ 게시판 데이터(신설)
      if (!db.boards || typeof db.boards !== "object") db.boards = {};
      return db;
    }

    const seed = {
      meta:{ version:"0.5", createdAt: nowISO() },
      users: [{ userId:"u_staff_1", name:"작업자A", role:"staff" }],
      projects: [{ projectId:"2025001", projectCode:"2025001", projectName:"(샘플)프로젝트", startDate:"", endDate:"" }],
      logs: [],
      checklists: [],
      sharedFiles: [
        { fileId: uuid(), name:"[작업명] 파일이름.docx", size:"200 KB", createdAt:"2022-07-07", updatedAt:"2022-07-15", uploader:"업로드 이름 아카이브" },
        { fileId: uuid(), name:"공지사항_관련문서.jpg", size:"1.2 MB", createdAt:"2022-07-13", updatedAt:"2022-07-15", uploader:"업로드 이름 아카이브" },
        { fileId: uuid(), name:"[날짜] 프로젝트이름.docx", size:"316 KB", createdAt:"2022-07-18", updatedAt:"2022-07-19", uploader:"업로드 이름 아카이브" },
      ],
      tasks: [
        { taskId: uuid(), title:"사업 이름 예시", owner:"-", progress:23, status:"진행", note:"기능 테스트 및 버그 확인" },
        { taskId: uuid(), title:"사업 이름 예시", owner:"-", progress:17, status:"지연", note:"모바일 디자인 제작" },
        { taskId: uuid(), title:"사업 이름 예시", owner:"-", progress:64, status:"지연", note:"코드 리뷰" },
        { taskId: uuid(), title:"사업 이름 예시", owner:"-", progress:49, status:"진행", note:"시스템 유지보수" },
      ],
      messages: [],
      // ✅ 게시판 시드
      boards: {
        "work-standards": [
          { postId: uuid(), title:"[샘플] 기준서 업로드/공지", author:"관리자", createdAt: nowISO(), body:"건설사별 기준서를 이 게시판에서 관리합니다." }
        ],
        "mgmt-plan": [],
        "mgmt-pt": [],
        "struct-estimate-write": [],
        "struct-estimate-manage": [],
        "civil-estimate-write": [],
        "civil-estimate-manage": [],
        "finish-estimate-write": [],
        "finish-estimate-manage": []
      }
    };
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
    return seed;
  }

  function getUserId(db){
    const saved = localStorage.getItem(LS_USER);
    if (saved && db.users.some(u => u.userId === saved)) return saved;
    localStorage.setItem(LS_USER, db.users[0].userId);
    return db.users[0].userId;
  }
  function userById(db, id){ return db.users.find(u => u.userId === id) || null; }
  function projById(db, id){ return db.projects.find(p => p.projectId === id) || null; }

  /***********************
   * DOM helpers
   ***********************/
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  function el(tag, attrs={}, ...children){
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})){
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) n.setAttribute(k, String(v));
    }
    for (const c of children){
      if (c == null) continue;
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  }
  function toast(msg){
    const host = $("#toast2");
    if (!host) return;
    const t = el("div", { class:"t" }, msg);
    host.appendChild(t);
    setTimeout(() => t.remove(), 2300);
  }

  function modalOpen(title, bodyNode){
    $("#modal2Title").textContent = title || "";
    const body = $("#modal2Body");
    body.innerHTML = "";
    if (bodyNode) body.appendChild(bodyNode);
    $("#modal2").classList.remove("hidden");
  }
  function modalClose(){ $("#modal2").classList.add("hidden"); }

  /***********************
 * Menu Model (홈화면=대시보드)
 ***********************/
const MENU = [
  // ✅ 홈화면 = 대시보드(단일 항목)
  { key:"home", label:"홈화면", kind:"single", type:"route" },

  // ✅ 이하 대분류(그룹) + 하위
  {
    groupId: "work",
    label: "업무관리",
    kind: "group",
    items: [
      { key:"work-project", label:"프로젝트 작성", type:"route" },
      { key:"work-standards", label:"건설사별 기준서", type:"board" },
      { key:"work-log", label:"업무일지", type:"route" },
      { key:"work-approve", label:"업무일지 승인", type:"route" },
      { key:"work-time", label:"프로젝트 소요시간", type:"route" },
      { key:"work-schedule", label:"종합 공정관리", type:"route" }
    ]
  },
  {
    groupId: "mgmt",
    label: "경영지원팀",
    kind: "group",
    items: [
      { key:"mgmt-plan", label:"기획안 제출", type:"board" },
      { key:"mgmt-pt", label:"PT자료 관리", type:"board" }
    ]
  },
  {
    groupId: "struct",
    label: "구조팀",
    kind: "group",
    items: [
      { key:"struct-checklist", label:"프로젝트별 체크리스트", type:"route" },
      { key:"struct-checklist-list", label:"체크리스트 목록", type:"route" },
      { key:"struct-estimate-write", label:"견적조건 작성", type:"board" },
      { key:"struct-estimate-manage", label:"견적조건 관리", type:"board" },
      { key:"struct-fin", label:"철골ㆍ철콘산출(FIN)", type:"link", url:"https://eumditravel-oss.github.io/FIN2/" }
    ]
  },
  {
    groupId: "civil",
    label: "토목ㆍ조경팀",
    kind: "group",
    items: [
      { key:"civil-checklist", label:"프로젝트별 체크리스트", type:"route" },
      { key:"civil-checklist-list", label:"체크리스트 목록", type:"route" },
      { key:"civil-estimate-write", label:"견적조건 작성", type:"board" },
      { key:"civil-estimate-manage", label:"견적조건 관리", type:"board" }
    ]
  },
  {
    groupId: "finish",
    label: "마감팀",
    kind: "group",
    items: [
      { key:"finish-checklist", label:"프로젝트별 체크리스트", type:"route" },
      { key:"finish-checklist-list", label:"체크리스트 목록", type:"route" },
      { key:"finish-estimate-write", label:"견적조건 작성", type:"board" },
      { key:"finish-estimate-manage", label:"견적조건 관리", type:"board" }
    ]
  }
];

// ✅ 그룹 기본 펼침 상태
const DEFAULT_OPEN_GROUPS = new Set(["work"]);

function parseHash(){
  const raw = (location.hash || "").replace(/^#/, "");
  const key = decodeURIComponent(raw || "home");

  const allKeys = new Set([
    ...MENU.filter(x=>x.kind==="single").map(x=>x.key),
    ...MENU.filter(x=>x.kind==="group").flatMap(g => g.items.map(i => i.key))
  ]);

  return allKeys.has(key) ? key : "home";
}
function setHash(key){ location.hash = `#${encodeURIComponent(key)}`; }

// ✅ routeTitle 제거했으면 이 함수는 있어도 되고(호출 안하면 됨), 없어도 됨
function setRouteTitle(text){
  const t = $("#routeTitle2");
  if (t) t.textContent = text || "";
}

// ✅ 기존 권한 로직 유지(승인/체크리스트 작성은 staff 숨김)
function allowedKeysFor(user){
  const all = new Set([
    ...MENU.filter(x=>x.kind==="single").map(x=>x.key),
    ...MENU.filter(x=>x.kind==="group").flatMap(g => g.items.map(i => i.key))
  ]);

  if (!isStaff(user)) return all;

  const denied = new Set([
    "work-approve",
    "struct-checklist","civil-checklist","finish-checklist"
  ]);
  for (const k of denied) all.delete(k);
  return all;
}

function renderSide2(db){
  const host = $("#sideMenu2");
  host.innerHTML = "";

  const cur = parseHash();
  const me = userById(db, getUserId(db));
  const allowed = allowedKeysFor(me);

  const openState = safeParse(localStorage.getItem("APP2_SIDE_OPEN") || "", null) || {};
  function isOpen(groupId){
    if (openState[groupId] === true) return true;
    if (openState[groupId] === false) return false;
    return DEFAULT_OPEN_GROUPS.has(groupId);
  }
  function setOpen(groupId, v){
    openState[groupId] = !!v;
    localStorage.setItem("APP2_SIDE_OPEN", JSON.stringify(openState));
  }

  // ✅ 1) 홈화면(단일 버튼)
  const home = MENU.find(x=>x.kind==="single" && x.key==="home");
  if (home && allowed.has("home")){
    host.appendChild(
      el("button", {
        class:`navItem2 top ${cur==="home" ? "active" : ""}`,
        onclick:()=> setHash("home")
      }, home.label)
    );
    host.appendChild(el("div", { style:"height:8px;" }));
  }

  // ✅ 2) 그룹들
  MENU.filter(x=>x.kind==="group").forEach(group=>{
    const visibleItems = group.items.filter(it => allowed.has(it.key));
    if (!visibleItems.length) return;

    const opened = isOpen(group.groupId);

    const head = el("button", {
      class:`navGroup2 ${opened ? "open" : ""}`,
      onclick:()=>{
        const next = !isOpen(group.groupId);
        setOpen(group.groupId, next);
        renderSide2(db);
      }
    },
      el("span", { class:"sgTitle2" }, group.label),
      el("span", { class:"sgChevron2", "aria-hidden":"true" }, opened ? "▾" : "▸")
    );

    const list = el("div", { class:`sideGroupList2 ${opened ? "" : "hidden"}` });

    visibleItems.forEach(it=>{
  list.appendChild(
    el("button", {
      class:`navItem2 ${cur===it.key ? "active" : ""}`,
      onclick:()=>{
        if (it.type === "link" && it.url){
          window.open(it.url, "_blank", "noopener,noreferrer");
          return;
        }
        setHash(it.key);
      }
    }, it.label)
  );
});


    host.appendChild(head);
    host.appendChild(list);
  });
}


  /***********************
 * Aggregations (기존)
 ***********************/
function computeProjectDays(db, projectId){
  const set = new Set();
  for (const l of (db.logs||[])){
    if (l.status !== "approved") continue;
    if (l.projectId !== projectId) continue;
    set.add(`${l.projectId}__${l.date}`);
  }
  return set.size;
}
function computeProjectHeadcount(db, projectId){
  const set = new Set();
  for (const l of (db.logs||[])){
    if (l.status !== "approved") continue;
    if (l.projectId !== projectId) continue;
    set.add(l.writerId);
  }
  return set.size;
}
function computeProjectBreakdown(db, projectId){
  const map = {};
  for (const l of (db.logs||[])){
    if (l.status !== "approved") continue;
    if (l.projectId !== projectId) continue;
    const k = `${l.category}||${l.process}`;
    map[k] = (map[k]||0) + (Number(l.hours||0)); // ✅ ratio -> hours
  }
  return map;
}

// ✅ [여기에 추가]
const HOURS_PER_DAY = 8;

function computeProjectTotalDays(db, projectId){
  let totalHours = 0;
  for (const l of (db.logs||[])){
    if (l.status !== "approved") continue;
    if (l.projectId !== projectId) continue;
    totalHours += Number(l.hours||0);
  }
  return Math.ceil(totalHours / HOURS_PER_DAY);
}

function computeProjectTotalHours(db, projectId){
  let totalHours = 0;
  for (const l of (db.logs||[])){
    if (l.status !== "approved") continue;
    if (l.projectId !== projectId) continue;
    totalHours += Number(l.hours||0);
  }
  return totalHours;
}


  /***********************
   * Home (대시보드)
   ***********************/
  function computeKpis(db){
    const today = todayISO();
    const logs = Array.isArray(db.logs) ? db.logs : [];
    const approvalsWait = logs.filter(l => l.status === "submitted").length;

    const todayMy = logs.filter(l => l.date === today).length;
    const inProgress = logs.filter(l => (l.status === "submitted" || l.status === "approved")).length;

    const unread = Array.isArray(db.messages) ? db.messages.filter(m => m.read !== true).length : 0;

    const progressRate = inProgress ? Math.round((logs.filter(l=>l.status==="approved").length / inProgress) * 100) : 0;

    return { todayMy, inProgress, unread, approvalsWait, progressRate };
  }

  function kpiCard(label, value, badgeText){
    return el("div", { class:"kpi" },
      el("div", { class:"kpi-top" },
        el("div", { class:"kpi-label" }, label),
        badgeText ? el("div", { class:"kpi-badge" }, badgeText) : el("div")
      ),
      el("div", { class:"kpi-value" }, String(value))
    );
  }

  function viewHome(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("홈 화면 · 대시보드");

    const k = computeKpis(db);

    const kpiGrid = el("div", { class:"kpiGrid" },
      kpiCard("오늘 업무일지", k.todayMy, ""),
      kpiCard("진행 중 업무", k.inProgress, `${k.progressRate}%`),
      kpiCard("미확인 메시지", k.unread, ""),
      kpiCard("대기 결재", k.approvalsWait, "")
    );

    const files = Array.isArray(db.sharedFiles) ? db.sharedFiles : [];
    const filesTable = el("div", { class:"card2", style:"padding:0;" },
      el("div", { class:"card2-title", style:"display:flex;align-items:center;justify-content:space-between;" },
        el("div", {}, "작업 파일 공유"),
        el("button", { class:"btn2 ghost2", onclick:()=>toast("추후 서버 업로드 연동 예정") }, "더보기")
      ),
      el("div", { class:"tableWrap" },
        el("table", { class:"tbl2" },
          el("thead", {},
            el("tr", {},
              el("th", {}, "파일명"),
              el("th", { class:"w120" }, "파일크기"),
              el("th", { class:"w120" }, "등록일"),
              el("th", { class:"w120" }, "수정일"),
              el("th", { class:"w180" }, "업로드"),
              el("th", { class:"w120" }, "")
            )
          ),
          el("tbody", {},
            ...(files.slice(0,5).map(f=>{
              const actions = el("div", { class:"rowActions" },
                el("button", { class:"iconBtn", title:"보기", onclick:()=>toast("보기(placeholder)") }, "🔍"),
                el("button", { class:"iconBtn", title:"다운", onclick:()=>toast("다운(placeholder)") }, "⬇️"),
                el("button", { class:"iconBtn", title:"공유", onclick:()=>toast("공유(placeholder)") }, "🔗")
              );
              return el("tr", {},
                el("td", { class:"fileName" }, f.name || "-"),
                el("td", { class:"mutedCell" }, f.size || "-"),
                el("td", { class:"mutedCell" }, f.createdAt || "-"),
                el("td", { class:"mutedCell" }, f.updatedAt || "-"),
                el("td", { class:"mutedCell" }, f.uploader || "-"),
                el("td", {}, actions)
              );
            }))
          )
        )
      )
    );

    const tasks = Array.isArray(db.tasks) ? db.tasks : [];
    const progressCard = el("div", { class:"card2", style:"padding:0;" },
      el("div", { class:"card2-title" }, "개별 진행 상황"),
      el("div", { class:"list2" },
        ...(tasks.slice(0,6).map(t=>{
          const pct = clamp(Number(t.progress||0),0,100);
          const statusCls = (t.status==="지연") ? "tag danger" : (t.status==="완료" ? "tag ok" : "tag");
          return el("div", { class:"progressRow" },
            el("div", { class:"avatar" }, "👤"),
            el("div", { class:"pCol" },
              el("div", { class:"pTop" },
                el("div", { class:"pTitle" }, t.title || "업무"),
                el("div", { class: statusCls }, t.status || "진행")
              ),
              el("div", { class:"bar" },
                el("div", { class:"barFill", style:`width:${pct}%;` })
              ),
              el("div", { class:"pNote" }, t.note || "")
            ),
            el("div", { class:"pPct" }, `${pct}%`)
          );
        }))
      )
    );

    view.appendChild(kpiGrid);
    view.appendChild(filesTable);
    view.appendChild(progressCard);
  }

  /***********************
   * 게시판(신설 폴더/탭) - 구성만 (간단 CRUD)
   ***********************/
  function ensureBoard(db, boardKey){
    if (!db.boards || typeof db.boards !== "object") db.boards = {};
    if (!Array.isArray(db.boards[boardKey])) db.boards[boardKey] = [];
    return db.boards[boardKey];
  }

  function viewBoard(db, boardKey, title){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle(title);

    const me = userById(db, getUserId(db));
    const list = ensureBoard(db, boardKey);

    const top = el("div", { class:"card2", style:"padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;" },
      el("div", {},
        el("div", { style:"font-weight:1100;" }, title),
        el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:4px;" }, "게시판 형태로 구성만 적용(추후 파일 업로드/권한/검색 확장 가능)")
      ),
      el("button", {
        class:"btn2 primary2",
        onclick:()=>{
          const t = prompt("제목");
          if (!t || !t.trim()) return;
          const b = prompt("내용(간단)") || "";
          list.unshift({ postId: uuid(), title: t.trim(), author: me?.name || "-", createdAt: nowISO(), body: b });
          saveDB(db);
          render();
        }
      }, "새 글")
    );

    const rows = list.slice(0, 30).map(p=>{
      const openBtn = el("button", {
        class:"btn2 ghost2",
        onclick:()=>{
          modalOpen(p.title, el("div", {},
            el("div", { class:"muted2", style:"padding:0 0 10px 0;" }, `${p.author || "-"} · ${p.createdAt || "-"}`),
            el("div", { style:"white-space:pre-wrap;font-weight:900;line-height:1.5;" }, p.body || "")
          ));
        }
      }, "보기");

      return el("div", { class:"boardRow2" },
        el("div", { class:"boardTitle2" }, p.title || "-"),
        el("div", { class:"boardMeta2" }, `${p.author || "-"} · ${p.createdAt || "-"}`),
        el("div", { style:"display:flex;justify-content:flex-end;" }, openBtn)
      );
    });

    const empty = el("div", { class:"card2", style:"padding:14px;color:var(--muted);font-weight:900;" }, "등록된 글이 없습니다.");

    view.appendChild(top);
    view.appendChild(
      el("div", { class:"card2", style:"padding:12px 14px;" },
        el("div", { style:"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;" },
          el("div", { style:"font-weight:1100;" }, "목록"),
          el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, `총 ${list.length}건`)
        ),
        list.length ? el("div", { class:"boardList2" }, ...rows) : empty
      )
    );
  }

  /* ✅ REPLACE: viewProjectEditor(db) - FULL (상단: 상세 / 하단: 리스트 + 우측 년도 드롭다운) */
function viewProjectEditor(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("업무관리 · 프로젝트 작성");

  db.projects = Array.isArray(db.projects) ? db.projects : [];

  // -----------------------
  // state
  // -----------------------
  const LS_SEL  = "APP2_PROJECTEDITOR_SELECTED";
  const LS_YEAR = "APP2_PROJECTEDITOR_YEAR";

  let selectedId = (localStorage.getItem(LS_SEL) || db.projects[0]?.projectId || "");
  let yearFilter = (localStorage.getItem(LS_YEAR) || "ALL");

  function projByIdLocal(id){
    return db.projects.find(p => p.projectId === id) || null;
  }

  function projectYear(p){
    const code = String(p.projectCode || p.projectId || "");
    const y = code.slice(0,4);
    return /^\d{4}$/.test(y) ? y : "";
  }

  function buildYearOptions(){
    const set = new Set();
    // DB에 있는 프로젝트에서 연도 수집
    db.projects.forEach(p=>{
      const y = projectYear(p);
      if (y) set.add(y);
    });

    // 현재년도 기준 +/- 2도 추가(빈 화면 방지)
    const cy = new Date().getFullYear();
    for (let i=cy-2;i<=cy+2;i++) set.add(String(i));

    return Array.from(set).sort((a,b)=>b.localeCompare(a)); // 최신년도 먼저
  }

  function buildYearSelect(value, onChange){
    const years = buildYearOptions();
    const s = el("select", {
      class:"yearSelect2",
      onchange:(e)=>onChange?.(e.target.value)
    });

    s.appendChild(el("option", { value:"ALL" }, "전체년도"));
    years.forEach(y=>{
      const o = el("option", { value:y }, `${y}년`);
      if (y === value) o.selected = true;
      s.appendChild(o);
    });
    return s;
  }

  // -----------------------
  // Top bar (설명 + 우측 버튼)
  // -----------------------
  const addBtn = el("button", {
    class:"btn2 primary2",
    onclick:()=>{
      const id = (prompt("프로젝트 코드(예: 2025001)") || "").trim();
      const name = (prompt("프로젝트 명칭") || "").trim();
      if (!id) return toast("프로젝트 코드를 입력해 주세요.");
      if (db.projects.some(p => (p.projectId === id || p.projectCode === id))) return toast("동일 코드가 이미 존재합니다.");
      if (!name) return toast("프로젝트 명칭을 입력해 주세요.");

      db.projects.unshift({
        projectId: id,
        projectCode: id,
        projectName: name,
        buildingUse: "",
        grossArea: "",
        structureType: "",
        startDate: "",
        endDate: ""
      });
      saveDB(db);
      selectedId = id;
      localStorage.setItem(LS_SEL, selectedId);
      render();
    }
  }, "+ 새 프로젝트");

  const topBar = el("div", {
    class:"card2",
    style:"padding:12px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;"
  },
    el("div", {},
      el("div", { style:"font-weight:1100;" }, "프로젝트 기본정보 작성/관리"),
      el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:4px;" },
        "‘프로젝트 소요시간’ 화면에서 표시하는 기본정보(용도/연면적/구조형식 등)를 여기서 입력합니다."
      )
    ),
    addBtn
  );

  // -----------------------
  // Cards: 상단 상세 / 하단 리스트
  // -----------------------
  const detailCard = el("div", { class:"card2", style:"padding:0; margin-bottom:12px;" });
  const listCard = el("div", { class:"card2 projectEditorListLimit", style:"padding:0;" });

  view.appendChild(topBar);
  view.appendChild(detailCard);
  view.appendChild(listCard);

  function rerender(){
    // ---- year filter 적용한 리스트
    const filtered = (yearFilter === "ALL")
      ? db.projects.slice()
      : db.projects.filter(p => projectYear(p) === yearFilter);

    // 선택 보정
    if (!selectedId || !filtered.some(p=>p.projectId===selectedId)){
      selectedId = filtered[0]?.projectId || db.projects[0]?.projectId || "";
      localStorage.setItem(LS_SEL, selectedId);
    }

    // -----------------------
    // DETAIL (상단)
    // -----------------------
    detailCard.innerHTML = "";
    detailCard.appendChild(el("div", { class:"card2-title" }, "프로젝트 상세 입력"));

    const p = projByIdLocal(selectedId);

    if (!p){
      detailCard.appendChild(el("div", { class:"wtEmpty2" }, "프로젝트를 선택하거나 생성하면 상세 입력이 표시됩니다."));
    } else {
      const codeInput = el("input", { class:"btn2", type:"text", value: p.projectCode || p.projectId || "", placeholder:"프로젝트 코드" });
      const nameInput = el("input", { class:"btn2", type:"text", value: p.projectName || "", placeholder:"프로젝트 명칭" });
      const useInput  = el("input", { class:"btn2", type:"text", value: p.buildingUse || "", placeholder:"예) 물류센터, 주상복합 등" });
      const areaInput = el("input", { class:"btn2", type:"text", value: p.grossArea || "", placeholder:"예) 123,456 ㎡" });
      const stInput   = el("input", { class:"btn2", type:"text", value: p.structureType || "", placeholder:"예) RC / S / SRC 등" });
      const sDate     = el("input", { class:"btn2", type:"date", value: p.startDate || "" });
      const eDate     = el("input", { class:"btn2", type:"date", value: p.endDate || "" });

      const saveBtn = el("button", {
        class:"btn2 primary2",
        onclick:()=>{
          const newCode = (codeInput.value || "").trim();
          const newName = (nameInput.value || "").trim();
          if (!newCode) return toast("프로젝트 코드는 필수입니다.");
          if (!newName) return toast("프로젝트 명칭은 필수입니다.");

          const dup = db.projects.some(x =>
            x.projectId !== p.projectId &&
            (x.projectId === newCode || x.projectCode === newCode)
          );
          if (dup) return toast("동일 코드가 이미 존재합니다.");

          p.projectCode = newCode;
          p.projectName = newName;
          p.buildingUse = (useInput.value || "").trim();
          p.grossArea = (areaInput.value || "").trim();
          p.structureType = (stInput.value || "").trim();
          p.startDate = sDate.value || "";
          p.endDate = eDate.value || "";

          saveDB(db);
          toast("저장 완료");
          render();
        }
      }, "저장");

      const delBtn = el("button", {
        class:"btn2 ghost2",
        onclick:()=>{
          if (!confirm("이 프로젝트를 삭제할까요? (소요시간/업무일지 데이터는 남을 수 있습니다)")) return;
          db.projects = db.projects.filter(x => x.projectId !== p.projectId);
          saveDB(db);
          toast("삭제 완료");
          selectedId = db.projects[0]?.projectId || "";
          localStorage.setItem(LS_SEL, selectedId);
          render();
        }
      }, "삭제");

      detailCard.appendChild(
        el("div", { style:"padding:12px 14px;" },
          el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;" },
            el("div", { style:"font-weight:1100;" }, "기본정보"),
            el("div", { style:"display:flex;gap:8px;" }, delBtn, saveBtn)
          ),
          el("div", { style:"display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;" },
            codeInput, nameInput
          ),
          el("div", { style:"display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;" },
            useInput, areaInput, stInput
          ),
          el("div", { style:"display:grid;grid-template-columns:1fr 1fr;gap:10px;" },
            sDate, eDate
          )
        )
      );
    }

    // -----------------------
    // LIST (하단) + 우측 년도 드롭다운
    // -----------------------
    listCard.innerHTML = "";

    const yearSel = buildYearSelect(yearFilter, (v)=>{
      yearFilter = v;
      localStorage.setItem(LS_YEAR, yearFilter);
      rerender();
    });

    const listHead = el("div", {
      class:"card2-title",
      style:"display:flex;align-items:center;justify-content:space-between;gap:10px;"
    },
      el("div", {}, "프로젝트 리스트"),
      yearSel // ✅ 우측 빨간영역 = 년도 드롭다운
    );

    listCard.appendChild(listHead);

    if (!filtered.length){
      listCard.appendChild(el("div", { class:"wtEmpty2" }, "해당 년도에 등록된 프로젝트가 없습니다."));
      return;
    }

    const listHost = el("div", { class:"wtList2" });
    filtered.forEach(pp=>{
      const active = (pp.projectId === selectedId);
      listHost.appendChild(
        el("button", {
          class:`wtProjItem2 ${active ? "active" : ""}`,
          onclick:()=>{
            selectedId = pp.projectId;
            localStorage.setItem(LS_SEL, selectedId);
            rerender();
          }
        },
          el("div", { class:"wtProjTitle2" }, `${pp.projectCode||pp.projectId} (${pp.projectName||""})`.trim()),
          el("div", { class:"wtProjMeta2" }, `용도: ${pp.buildingUse||"-"} · 연면적: ${pp.grossArea||"-"} · 구조: ${pp.structureType||"-"}`)
        )
      );
    });
    listCard.appendChild(listHost);
  }

  rerender();
}






  /***********************
   * 기존 뷰(업무일지/승인/소요시간/공정관리/체크리스트)
   ***********************/
  function makeEmptyEntry(db){
  const p = db.projects?.[0]?.projectId || "";
  return { projectId: p, category:"구조", process: PROCESS_MASTER["구조"][0], hours: 1, content:"" };
}


  function buildProjectSelect(db, value, onChange){
    const s = el("select", { class:"btn2", onchange:(e)=>onChange?.(e.target.value) });
    for (const p of (db.projects||[])){
      const o = el("option", { value:p.projectId }, `${p.projectCode} (${p.projectName})`);
      if (p.projectId === value) o.selected = true;
      s.appendChild(o);
    }
    return s;
  }
  function buildCategorySelect(value, onChange){
    const s = el("select", { class:"btn2", onchange:(e)=>onChange?.(e.target.value) },
      el("option", { value:"구조" }, "구조"),
      el("option", { value:"마감" }, "마감")
    );
    s.value = value;
    return s;
  }
  function buildProcessSelect(category, value, onChange){
    const s = el("select", { class:"btn2", onchange:(e)=>onChange?.(e.target.value) });
    for (const p of PROCESS_MASTER[category] || []){
      const o = el("option", { value:p }, p);
      if (p === value) o.selected = true;
      s.appendChild(o);
    }
    return s;
  }

  function viewLog(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("업무관리 · 업무일지");

    const uid = getUserId(db);
    const dateInput = el("input", { class:"btn2", type:"date", value: todayISO() });

    let entries = [ makeEmptyEntry(db) ];
    const entriesHost = el("div", { class:"view2" });

    function rerenderEntries(){
      entriesHost.innerHTML = "";
      entries.forEach((ent, idx) => entriesHost.appendChild(renderEntryCard(ent, idx)));
    }

    function renderEntryCard(ent, idx){
      const projectSel = buildProjectSelect(db, ent.projectId, v => ent.projectId = v);

      const hours = el("input", {
  class:"btn2",
  type:"number",
  min:"0",
  step:"0.5",                 // 0.5시간 단위 (원하면 0.25 가능)
  placeholder:"시간",
  value: ent.hours ?? 1,
  oninput:(e)=> ent.hours = Math.max(0, Number(e.target.value||0))
});


      const catSel = buildCategorySelect(ent.category, (v)=>{
        ent.category = v;
        ent.process = PROCESS_MASTER[v][0];
        rerenderEntries();
      });
      const procSel = buildProcessSelect(ent.category, ent.process, (v)=> ent.process = v);

      const content = el("textarea", {
        class:"ta2",
        placeholder:"작업내용을 입력하세요",
        oninput:(e)=> ent.content = e.target.value
      }, ent.content || "");

      const delBtn = el("button", {
        class:"btn2 ghost2",
        onclick:()=>{
          if (entries.length <= 1) return toast("최소 1개 항목은 필요합니다.");
          entries.splice(idx,1);
          rerenderEntries();
        }
      }, "삭제");

      return el("div", { class:"card2", style:"padding:12px 14px;" },
        el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;" },
          el("div", { style:"font-weight:1100;" }, `업무 항목 ${idx+1}`),
          delBtn
        ),
        el("div", { style:"display:grid;grid-template-columns:1fr 160px;gap:10px;margin-bottom:10px;" },
    projectSel, hours
  ),
        el("div", { style:"display:grid;grid-template-columns:160px 1fr;gap:10px;margin-bottom:10px;" },
          catSel, procSel
        ),
        content
      );
    }

    const addBtn = el("button", { class:"btn2", onclick:()=>{ entries.push(makeEmptyEntry(db)); rerenderEntries(); } }, "+ 업무 항목 추가");

    const submitBtn = el("button", {
      class:"btn2 primary2",
      onclick:()=>{
        const date = dateInput.value;
        if (!date) return toast("날짜를 선택해 주세요.");

        for (let i=0;i<entries.length;i++){
          const e = entries[i];
          if (!e.projectId) return toast(`업무 항목 ${i+1}: 프로젝트를 선택해 주세요.`);
          if (!e.content || !e.content.trim()) return toast(`업무 항목 ${i+1}: 작업내용을 입력해 주세요.`);
          if (!(e.hours > 0))
  return toast(`업무 항목 ${i+1}: 투입시간(시간)을 입력해 주세요.`);

        }

        const submittedAt = nowISO();
        db.logs = Array.isArray(db.logs) ? db.logs : [];
        for (const e of entries){
          db.logs.push({
            logId: uuid(),
            date,
            projectId: e.projectId,
            category: e.category,
            process: e.process,
            content: e.content.trim(),
            hours: Number(e.hours)||0,
            writerId: uid,
            status: "submitted",
            submittedAt,
            approvedBy: "",
            approvedAt: "",
            rejectedBy: "",
            rejectedAt: "",
            rejectReason: ""
          });
        }

        saveDB(db);
        toast("업무일지 제출 완료 (승인 대기)");
        render();
      }
    }, "제출하기");

    view.appendChild(
      el("div", { class:"card2", style:"padding:12px 14px;" },
        el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;" },
          el("div", { style:"font-weight:1100;" }, "업무일지 작성"),
          addBtn
        ),
        el("div", { style:"display:flex;gap:10px;align-items:center;margin-bottom:10px;" },
          el("div", { style:"font-weight:900;color:var(--muted);font-size:12px;" }, "날짜"),
          dateInput
        ),
        entriesHost,
        el("div", { style:"display:flex;justify-content:flex-end;margin-top:12px;" }, submitBtn)
      )
    );

    rerenderEntries();
  }

  function viewApprove(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("업무관리 · 업무일지 승인");

    const uid = getUserId(db);
    const submitted = (db.logs||[]).filter(l => l.status === "submitted")
      .sort((a,b)=>(a.submittedAt||"").localeCompare(b.submittedAt||""));

    const groups = new Map();
    for (const l of submitted){
      const k = `${l.writerId}__${l.date}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(l);
    }

    if (!groups.size){
      view.appendChild(el("div", { class:"card2", style:"padding:14px;" }, "승인 대기 업무일지가 없습니다."));
      return;
    }

    for (const arr of groups.values()){
      const writer = userById(db, arr[0].writerId);
      const date = arr[0].date;

      const approveBtn = el("button", {
        class:"btn2 primary2",
        onclick:()=>{
          if (!confirm(`${writer?.name||"작성자"} · ${date} (${arr.length}건) 승인할까요?`)) return;
          const t = nowISO();
          for (const l of arr){
            l.status = "approved";
            l.approvedBy = uid;
            l.approvedAt = t;
          }
          saveDB(db);
          toast("승인 완료");
          render();
        }
      }, "승인");

      const rejectBtn = el("button", {
        class:"btn2 ghost2",
        onclick:()=>{
          const reason = prompt("반려 사유(선택)") || "";
          if (!confirm(`${writer?.name||"작성자"} · ${date} (${arr.length}건) 반려할까요?`)) return;
          const t = nowISO();
          for (const l of arr){
            l.status = "rejected";
            l.rejectedBy = uid;
            l.rejectedAt = t;
            l.rejectReason = reason;
          }
          saveDB(db);
          toast("반려 처리 완료");
          render();
        }
      }, "반려");

      const list = el("div", { style:"display:flex;flex-direction:column;gap:10px;margin-top:12px;" },
        ...arr.map(l=>{
          const p = projById(db, l.projectId);
          return el("div", { style:"border:1px solid var(--line);border-radius:12px;padding:10px;" },
            el("div", { style:"font-weight:1100;" }, `${p?.projectName||"프로젝트"} · ${l.category}/${l.process} · ${Number(l.hours||0)}시간`),
            el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:4px;" }, l.content)
          );
        })
      );

      view.appendChild(
        el("div", { class:"card2", style:"padding:12px 14px;" },
          el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;" },
            el("div", { style:"font-weight:1100;" }, `승인 대기: ${writer?.name||"작성자"} · ${date} (${arr.length}건)`),
            el("div", { style:"display:flex;gap:8px;" }, rejectBtn, approveBtn)
          ),
          list
        )
      );
    }
  }

  /* ✅ REPLACE: viewDashboard(db) - FULL (좌측=프로젝트 리스트 / 우측=프로젝트 상세) */
function viewDashboard(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("업무관리 · 프로젝트 소요시간");

  // -----------------------
  // state (localStorage)
  // -----------------------
  const LS_SEL = "APP2_WORKTIME_SELECTED";
  const LS_Q   = "APP2_WORKTIME_QUERY";

  let query = (localStorage.getItem(LS_Q) || "").trim();
  let selectedId = (localStorage.getItem(LS_SEL) || "");

  // -----------------------
  // helpers
  // -----------------------
  const logs = Array.isArray(db.logs) ? db.logs : [];
  const users = Array.isArray(db.users) ? db.users : [];
  const projects = Array.isArray(db.projects) ? db.projects : [];

  function userName(uid){
    return (users.find(u => u.userId === uid)?.name) || uid || "-";
  }
  function uniq(arr){
    return Array.from(new Set(arr));
  }
  function projText(p){
    const code = p.projectCode || p.projectId || "";
    const name = p.projectName || "";
    return `${code} ${name}`.trim();
  }
  function projectMatchesQuery(p){
    if (!query) return true;
    const t = (projText(p) || "").toLowerCase();
    return t.includes(query.toLowerCase());
  }

  function computePartStats(projectId, part){
    const partLogs = logs.filter(l =>
      l.status === "approved" &&
      l.projectId === projectId &&
      (l.category || "") === part
    );

    const days = uniq(partLogs.map(l => `${l.projectId}__${l.date}`)).length;
    const peopleIds = uniq(partLogs.map(l => l.writerId).filter(Boolean));
    const peopleNames = peopleIds.map(userName);

    return { part, days, headcount: peopleIds.length, peopleNames };
  }

  function computeTotalDays(projectId){
    const approved = logs.filter(l => l.status === "approved" && l.projectId === projectId);
    return uniq(approved.map(l => `${l.projectId}__${l.date}`)).length;
  }

  function pickDefaultProjectId(list){
    if (selectedId && list.some(p => p.projectId === selectedId)) return selectedId;
    return list[0]?.projectId || "";
  }

  // -----------------------
  // UI: Top controls (검색)
  // -----------------------
  const qInput = el("input", {
    class:"wtSearch2",
    type:"text",
    placeholder:"프로젝트 검색 (코드/명칭)",
    value: query,
    oninput:(e)=>{
      query = (e.target.value || "").trim();
      localStorage.setItem(LS_Q, query);
      rerender();
    }
  });

  // -----------------------
// UI: Year dropdown
// -----------------------
const LS_Y = "APP2_WORKTIME_YEAR";
let selectedYear = Number(localStorage.getItem(LS_Y) || "") || (new Date().getFullYear());

function projectYear(p){
  // 1) startDate 우선 (YYYY-MM-DD)
  const s = (p?.startDate || "").slice(0,4);
  if (/^\d{4}$/.test(s)) return Number(s);

  // 2) endDate
  const e = (p?.endDate || "").slice(0,4);
  if (/^\d{4}$/.test(e)) return Number(e);

  // 3) 코드/ID 앞 4자리 (2025001 등)
  const code = String(p?.projectCode || p?.projectId || "").slice(0,4);
  if (/^\d{4}$/.test(code)) return Number(code);

  return null;
}

function buildYearOptions(){
  const years = projects
    .map(projectYear)
    .filter(y => Number.isFinite(y))
    .sort((a,b)=>b-a);

  const uniqYears = Array.from(new Set(years));
  if (!uniqYears.length) uniqYears.push(new Date().getFullYear());

  // 선택 년도가 목록에 없으면 첫 항목으로 보정
  if (!uniqYears.includes(selectedYear)) selectedYear = uniqYears[0];

  const sel = el("select", {
    class:"btn2",
    onchange:(e)=>{
      selectedYear = Number(e.target.value);
      localStorage.setItem(LS_Y, String(selectedYear));
      rerender();
    }
  });

  uniqYears.forEach(y=>{
    const opt = el("option", { value:String(y) }, `${y}년`);
    if (y === selectedYear) opt.selected = true;
    sel.appendChild(opt);
  });

  return sel;
}

let yearSelect = buildYearOptions();

// ✅ 상단바: (좌) 검색 / (우) 년도 드롭박스
const topBar = el("div", { class:"card2 wtTop2" },
  el("div", { class:"wtTopRow2" },
    qInput,
    el("div", { style:"margin-left:auto;display:flex;gap:10px;align-items:center;" },
      yearSelect
    )
  )
);


  // -----------------------
  // Layout: 좌(리스트) / 우(상세)
  // -----------------------
  const left  = el("div", { class:"wtLeft2" });
  const right = el("div", { class:"wtRight2" });
  const grid  = el("div", { class:"wtGrid2" }, left, right);

  view.appendChild(topBar);
  view.appendChild(grid);

  // -----------------------
  // Render
  // -----------------------
  function rerender(){
    const list = projects
  .filter(p => projectYear(p) === selectedYear)
  .filter(p => projectMatchesQuery(p));


    // 비어있을 때
    if (!list.length){
      left.innerHTML = "";
      right.innerHTML = "";
      left.appendChild(el("div", { class:"card2", style:"padding:14px;" }, "조건에 맞는 프로젝트가 없습니다."));
      right.appendChild(el("div", { class:"card2", style:"padding:14px;" }, "프로젝트를 선택하면 상세가 표시됩니다."));
      return;
    }

    // 선택 프로젝트 결정/저장
    selectedId = pickDefaultProjectId(list);
    localStorage.setItem(LS_SEL, selectedId);

    // ----- LEFT: 프로젝트 리스트
    left.innerHTML = "";
    left.appendChild(el("div", { class:"card2-title" }, "프로젝트 리스트"));

    const listHost = el("div", { class:"wtList2" });
    list.forEach(p=>{
      const active = (p.projectId === selectedId);

      const totalHours = computeProjectTotalHours(db, p.projectId);
      const totalDays  = computeProjectTotalDays(db, p.projectId);

      listHost.appendChild(
        el("button", {
          class:`wtProjItem2 ${active ? "active" : ""}`,
          onclick:()=>{
            selectedId = p.projectId;
            localStorage.setItem(LS_SEL, selectedId);
            rerender();
          }
        },
          el("div", { class:"wtProjTitle2" }, projText(p) || "(무제)"),
          el("div", { class:"wtProjMeta2" }, `총 투입시간: ${totalHours}시간 / 환산일수: ${totalDays}일`)
        )
      );
    });
    left.appendChild(listHost);

    // ----- RIGHT: 프로젝트 상세
    const sp = projById(db, selectedId);
    right.innerHTML = "";
    right.appendChild(el("div", { class:"card2-title" }, "프로젝트 상세"));

    const use = sp?.buildingUse || sp?.use || sp?.purpose || "-";
    const area = sp?.grossArea || sp?.area || sp?.gfa || "-";
    const structure = sp?.structureType || sp?.structure || "-";

    const header = el("div", { class:"wtDetailHead2" },
      el("div", { class:"wtDetailTitle2" }, sp?.projectName || "(프로젝트명 없음)"),
      el("div", { class:"wtDetailSub2" }, (sp?.projectCode || sp?.projectId || "")),
      el("div", { class:"wtInfoGrid2" },
        el("div", { class:"wtInfoItem2" },
          el("div", { class:"wtInfoLabel2" }, "건물용도"),
          el("div", { class:"wtInfoVal2" }, String(use))
        ),
        el("div", { class:"wtInfoItem2" },
          el("div", { class:"wtInfoLabel2" }, "연면적"),
          el("div", { class:"wtInfoVal2" }, String(area))
        ),
        el("div", { class:"wtInfoItem2" },
          el("div", { class:"wtInfoLabel2" }, "구조형식"),
          el("div", { class:"wtInfoVal2" }, String(structure))
        )
      )
    );

    const parts = ["구조","토목ㆍ조경","마감"];
    const partStats = parts.map(part => computePartStats(selectedId, part));
    const totalDaysCalendar = computeTotalDays(selectedId);

    const body = el("div", { class:"wtDetailBody2" },
      el("div", { class:"wtTotal2" },
        el("div", { class:"wtTotalLabel2" }, "프로젝트 총 소요일수(캘린더 기준)"),
        el("div", { class:"wtTotalVal2" }, `${totalDaysCalendar}일`)
      ),
      el("div", { class:"wtPartGrid2" },
        ...partStats.map(s=>{
          const peopleLine = s.peopleNames.length ? s.peopleNames.join(", ") : "-";
          return el("div", { class:"wtPartCard2" },
            el("div", { class:"wtPartTitle2" }, s.part),
            el("div", { class:"wtPartRow2" },
              el("div", { class:"wtPartK2" }, "작업일수"),
              el("div", { class:"wtPartV2" }, `${s.days}일`)
            ),
            el("div", { class:"wtPartRow2" },
              el("div", { class:"wtPartK2" }, "투입인원"),
              el("div", { class:"wtPartV2" }, `${s.headcount}명`)
            ),
            el("div", { class:"wtPartRow2 col" },
              el("div", { class:"wtPartK2" }, "투입인원 이름"),
              el("div", { class:"wtPeople2" }, peopleLine)
            )
          );
        })
      )
    );

    right.appendChild(header);
    right.appendChild(body);
  }

  rerender();
}




  function viewWorkCalendar(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("업무관리 · 종합 공정관리");

  const LS_YEAR = "APP2_WORKSCHEDULE_YEAR";
  const cy = new Date().getFullYear();
  let year = (localStorage.getItem(LS_YEAR) || String(cy));

  function buildYearSelect(){
    const s = el("select", {
      class:"yearSelect2",
      onchange:(e)=>{
        year = e.target.value;
        localStorage.setItem(LS_YEAR, year);
        toast(`${year}년 선택`);
      }
    });

    for (let y=cy-3; y<=cy+1; y++){
      const yy = String(y);
      const o = el("option", { value:yy }, `${yy}년`);
      if (yy === year) o.selected = true;
      s.appendChild(o);
    }
    return s;
  }

  // ✅ 상단바(좌측: 검색/설명 영역, 우측: 년도 드롭다운)
  const topBar = el("div", {
    class:"card2",
    style:"padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;"
  },
    el("div", { style:"font-weight:1100;" }, "종합 공정관리"),
    buildYearSelect() // ✅ 우측 빨간영역 = 년도 드롭다운
  );

  view.appendChild(topBar);

  // 기존 placeholder 유지
  view.appendChild(
    el("div", { class:"card2", style:"padding:14px;" },
      el("div", { style:"font-weight:1100;margin-bottom:6px;" }, "캘린더(placeholder)"),
      el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, "요청 시 캘린더 UI를 확장합니다.")
    )
  );
}


  function viewChecklist(db, teamLabel){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle(`${teamLabel} · 프로젝트별 체크리스트`);

    const uid = getUserId(db);
    const me = userById(db, uid);
    if (!isLeaderPlus(me)){
      toast("작성 권한(Leader+)이 필요합니다.");
      return;
    }

    db.checklists = Array.isArray(db.checklists) ? db.checklists : [];
    view.appendChild(
      el("div", { class:"card2", style:"padding:14px;" },
        el("div", { style:"font-weight:1100;margin-bottom:6px;" }, "체크리스트(placeholder)"),
        el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, "필요 시 기존 체크리스트 로직을 이관해 동일 기능으로 맞춥니다.")
      )
    );
  }

  function viewChecklistList(db, teamLabel){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle(`${teamLabel} · 체크리스트 목록`);
    view.appendChild(
      el("div", { class:"card2", style:"padding:14px;" },
        el("div", { style:"font-weight:1100;margin-bottom:6px;" }, "체크리스트 목록(placeholder)"),
        el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, "필요 시 목록/확인 기능을 확장합니다.")
      )
    );
  }

  /***********************
   * Router
   ***********************/
  function renderView(db){
    const key = parseHash();

    // 홈
    if (key === "home") return viewHome(db);

    // 업무관리
    if (key === "work-project") return viewProjectEditor(db);   // ✅ 추가
    if (key === "work-standards") return viewBoard(db, "work-standards", "업무관리 · 건설사별 기준서");
    if (key === "work-log") return viewLog(db);
    if (key === "work-approve") return viewApprove(db);
    if (key === "work-time") return viewDashboard(db);
    if (key === "work-schedule") return viewWorkCalendar(db);

    // 경영지원팀(게시판)
    if (key === "mgmt-plan") return viewBoard(db, "mgmt-plan", "경영지원팀 · 기획안 제출");
    if (key === "mgmt-pt") return viewBoard(db, "mgmt-pt", "경영지원팀 · PT자료 관리");

    // 구조팀
    if (key === "struct-checklist") return viewChecklist(db, "구조팀");
    if (key === "struct-checklist-list") return viewChecklistList(db, "구조팀");
    if (key === "struct-estimate-write") return viewBoard(db, "struct-estimate-write", "구조팀 · 견적조건 작성");
    if (key === "struct-estimate-manage") return viewBoard(db, "struct-estimate-manage", "구조팀 · 견적조건 관리");

    // 토목ㆍ조경팀
    if (key === "civil-checklist") return viewChecklist(db, "토목ㆍ조경팀");
    if (key === "civil-checklist-list") return viewChecklistList(db, "토목ㆍ조경팀");
    if (key === "civil-estimate-write") return viewBoard(db, "civil-estimate-write", "토목ㆍ조경팀 · 견적조건 작성");
    if (key === "civil-estimate-manage") return viewBoard(db, "civil-estimate-manage", "토목ㆍ조경팀 · 견적조건 관리");

    // 마감팀
    if (key === "finish-checklist") return viewChecklist(db, "마감팀");
    if (key === "finish-checklist-list") return viewChecklistList(db, "마감팀");
    if (key === "finish-estimate-write") return viewBoard(db, "finish-estimate-write", "마감팀 · 견적조건 작성");
    if (key === "finish-estimate-manage") return viewBoard(db, "finish-estimate-manage", "마감팀 · 견적조건 관리");

    // fallback
    viewHome(db);
  }

  function render(){
    const db = ensureDB();
    const uid = getUserId(db);
    const me = userById(db, uid);

    $("#profile2").textContent = `${me?.name||"-"} (${ROLE_LABEL_KO[me?.role||"staff"]||"-"})`;

    renderSide2(db);

    const allowed = allowedKeysFor(me);
    const cur = parseHash();
    if (!allowed.has(cur)){
      setHash("home");
      return;
    }

    renderView(db);
  }

  function boot(){
    $("#btnClose")?.addEventListener("click", ()=>{
      if (window.opener) window.close();
      else location.href = "./index.html";
    });

    $("#modal2Close")?.addEventListener("click", modalClose);
    $("#modal2")?.addEventListener("click", (e)=>{ if (e.target === $("#modal2")) modalClose(); });

    window.addEventListener("hashchange", render);

    if (!location.hash) setHash("home");
    render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
