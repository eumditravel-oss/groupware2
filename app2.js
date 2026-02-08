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
 * Approval Flow (사원 → 팀장 → 실장)
 ***********************/
const APPROVAL_CHAIN = ["leader", "manager"]; // team장, 실장

function initialApprovalStepForWriterRole(writerRole){
  // 작성자 직급에 따라 "다음 결재자"를 반환
  const r = writerRole || "staff";

  if (r === "staff") return "leader";
  if (r === "leader") return "manager";

  // 실장 이상이 작성한 건은 즉시 승인 처리(원하면 director로 확장 가능)
  return null;
}

function isFinalStep(step){
  return step === APPROVAL_CHAIN[APPROVAL_CHAIN.length - 1];
}

function nextStep(step){
  const i = APPROVAL_CHAIN.indexOf(step);
  if (i < 0) return null;
  return APPROVAL_CHAIN[i + 1] || null;
}

function ensureApprovalShape(log){
  if (!log) return log;
  if (typeof log.approvalStep !== "string") log.approvalStep = "";
  if (!Array.isArray(log.approvalHistory)) log.approvalHistory = [];
  return log;
}


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

  /* =========================
 * 1) ensureDB()에 데이터 구조 추가
 *  - 위치: ensureDB() 내부의 "if (db && typeof db === 'object')" 블록
 * ========================= */
function ensureDB(){
  const db = loadDB();
  seedSampleProjectsIfEmpty(db);
ensureChecklistStore(db);

  if (db && typeof db === "object") {
    if (!Array.isArray(db.sharedFiles)) db.sharedFiles = [];
    if (!Array.isArray(db.tasks)) db.tasks = [];
    if (!Array.isArray(db.messages)) db.messages = [];
    if (!Array.isArray(db.approvals)) db.approvals = [];
    if (!Array.isArray(db.projectPM)) db.projectPM = [];
    // ✅ 게시판 데이터(신설)
    if (!db.boards || typeof db.boards !== "object") db.boards = {};

    /* ✅ [ADD] 납품 데이터/권한 */
    if (!Array.isArray(db.deliveryFiles)) db.deliveryFiles = [];             // 업로드된 납품파일
    if (!Array.isArray(db.deliveryAccess)) db.deliveryAccess = [];           // 일일 열람 권한(승인 완료)
    if (!Array.isArray(db.deliveryAccessRequests)) db.deliveryAccessRequests = []; // 권한 요청(대기)

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
    projectPM: [],
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
    },

    /* ✅ [ADD] 납품 데이터/권한 (seed) */
    deliveryFiles: [],
    deliveryAccess: [],
    deliveryAccessRequests: []
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
  // ✅ 매번 열 때도 body 직속 보장
  const modal = $("#modal2");
  if (modal && modal.parentElement !== document.body){
    document.body.appendChild(modal);
  }

  $("#modal2Title").textContent = title || "";
  const body = $("#modal2Body");
  body.innerHTML = "";
  if (bodyNode) body.appendChild(bodyNode);

  document.body.classList.add("modalOpen2");
  $("#modal2").classList.remove("hidden");
}


  function modalClose(){
  $("#modal2").classList.add("hidden");

  // ✅ 모달 닫힐 때: 오버레이 복원
  document.body.classList.remove("modalOpen2");
}

  /***********************
 * Menu Model (홈화면=대시보드)
 ***********************/
const MENU = [
  { key:"home", label:"홈화면", kind:"single", type:"route" },

  /* =========================
 * 2) MENU에 카테고리 2개 추가
 *  - 위치: MENU 상수의 "work" 그룹 items 안
 *  - 요구: "종합 공정관리" 밑에 배치
 * ========================= */
{
  groupId: "work",
  label: "업무관리",
  kind: "group",
  items: [
    { key:"work-project", label:"프로젝트 작성", type:"route" },
    { key:"work-pm", label:"프로젝트 PM지정", type:"route" },
    { key:"work-standards", label:"건설사별 기준서", type:"board" },
    { key:"work-log", label:"업무일지", type:"route" },
    { key:"work-approve", label:"업무일지 승인", type:"route" },
    { key:"work-time", label:"프로젝트 소요시간", type:"route" },
    { key:"work-schedule", label:"종합 공정관리", type:"route" },

    /* ✅ [ADD] 종합 공정관리 하위 성격 */
    { key:"work-delivery", label:"납품 프로젝트 관리", type:"route" },
    { key:"work-delivery-upload", label:"납품자료 업로드", type:"route" }
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

  // ✅ "구조팀" → "구조ㆍBIM팀"
  {
    groupId: "struct",
    label: "구조ㆍBIM팀",
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
 * Project PM (신설)
 ***********************/
const PM_PARTS = [
  { key:"structBim", label:"구조ㆍBIM" },
  { key:"civilLandscape", label:"토목ㆍ조경" },
  { key:"finish", label:"마감" }
];

function projectYearFromProject(p){
  const s = (p?.startDate || "").slice(0,4);
  if (/^\d{4}$/.test(s)) return s;
  const e = (p?.endDate || "").slice(0,4);
  if (/^\d{4}$/.test(e)) return e;
  const code = String(p?.projectCode || p?.projectId || "").slice(0,4);
  if (/^\d{4}$/.test(code)) return code;
  return "";
}

function ensurePMShape(rec){
  if (!rec || typeof rec !== "object") return null;
  if (typeof rec.year !== "string") rec.year = "";
  if (typeof rec.projectId !== "string") rec.projectId = "";
  if (!rec.parts || typeof rec.parts !== "object") rec.parts = {};
  if (typeof rec.updatedAt !== "string") rec.updatedAt = "";
  if (typeof rec.updatedBy !== "string") rec.updatedBy = "";
  return rec;
}

function getPMRecord(db, year, projectId){
  db.projectPM = Array.isArray(db.projectPM) ? db.projectPM : [];
  return db.projectPM.map(ensurePMShape).find(x => x.year === year && x.projectId === projectId) || null;
}

function setPMForParts(db, year, projectId, partKeys, userId, updaterId){
  db.projectPM = Array.isArray(db.projectPM) ? db.projectPM : [];
  let rec = getPMRecord(db, year, projectId);
  if (!rec){
    rec = { pmId: uuid(), year, projectId, parts:{}, updatedAt:"", updatedBy:"" };
    db.projectPM.unshift(rec);
  }
  partKeys.forEach(k => { rec.parts[k] = userId; });
  rec.updatedAt = nowISO();
  rec.updatedBy = updaterId || "";
  return rec;
}

function userNameById(db, uid){
  const u = (db.users||[]).find(x => x.userId === uid);
  return u?.name || uid || "-";
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

  function kpiCard(title, value, sub){
  return el("div", {
    class: "card2",
    style: "padding:12px 14px; display:flex; flex-direction:column; gap:6px;"
  },
    el("div", { style:"font-size:12px; font-weight:1000; color:var(--muted);" }, title),
    el("div", { style:"font-size:26px; font-weight:1200; letter-spacing:-0.4px;" }, String(value ?? 0)),
    el("div", { style:"font-size:12px; font-weight:900; color:var(--muted);" }, sub || "\u00A0")
  );
}


  /***********************
   * Home (대시보드)
   ***********************/
  function computeKpis(db){
  const logs = Array.isArray(db.logs) ? db.logs : [];
  const projects = Array.isArray(db.projects) ? db.projects : [];

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-base

  const monthStart = new Date(y, m, 1);
  const monthEnd   = new Date(y, m + 1, 0);

  const isSameMonth = (d)=>{
    if (!d) return false;
    const x = new Date(d);
    return x >= monthStart && x <= monthEnd;
  };

  // 1️⃣ 승인 대기 업무일지
  const approvalsWait = logs.filter(l => l.status === "submitted").length;

  // 2️⃣ 이번 달 업무가 있는 프로젝트
  const monthProjectIds = new Set(
    logs
      .filter(l => isSameMonth(l.date))
      .map(l => l.projectId)
  );

  // 3️⃣ 진행중 / 완료 프로젝트
  let inProgressProjects = 0;
  let doneProjects = 0;

  monthProjectIds.forEach(pid=>{
    const p = projects.find(x => x.projectId === pid);
    if (!p || !p.endDate) {
      inProgressProjects++;
      return;
    }
    const end = new Date(p.endDate);
    if (end < today) doneProjects++;
    else inProgressProjects++;
  });

  // 4️⃣ 다가오는 납품일 (7일 이내)
  const UPCOMING_DAYS = 7;
  const upcoming = projects.filter(p=>{
    if (!p.endDate) return false;
    const end = new Date(p.endDate);
    const diff = (end - today) / (1000*60*60*24);
    return diff >= 0 && diff <= UPCOMING_DAYS;
  }).length;

  return {
    approvalsWait,
    inProgressProjects,
    doneProjects,
    upcoming
  };
}


  function viewHome(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("홈 화면 · 대시보드");

  /***********************
   * KPI (상단 4개)
   ***********************/
  const k = computeKpis(db);

  const kpiGrid = el("div", { class:"kpiGrid" },
    kpiCard("승인대기 업무일지", k.approvalsWait, ""),
    kpiCard("이 달 진행중 프로젝트", k.inProgressProjects, ""),
    kpiCard("이 달 진행완료 프로젝트", k.doneProjects, ""),
    kpiCard("다가오는 납품일정", k.upcoming, "7일 이내")
  );

  /***********************
   * 홈 선택 상태 (PM 선택)
   ***********************/
  const LS_PM_SEL = "APP2_HOME_PM_SELECTED";
  let selectedPid = localStorage.getItem(LS_PM_SEL) || "";

  const uid = getUserId(db);
  const me = userById(db, uid);

  /***********************
   * 카드 1: 배정받은 현재 프로젝트 관리(PM)
   ***********************/
  const myRole = me?.role || "staff";

  /* PM 프로젝트 */
  const myPMProjects = (db.projectPM || [])
    .filter(r => Object.values(r.parts || {}).includes(myRole))
    .map(r => projById(db, r.projectId))
    .filter(Boolean);


  const pmList = myPMProjects.length
    ? el("div", { class:"list2" },
        ...myPMProjects.map(p=>{
          const active = p.projectId === selectedPid;
          return el("button", {
            class:`wtProjItem2 ${active ? "active" : ""}`,
            onclick:()=>{
              localStorage.setItem(LS_PM_SEL, p.projectId);
              render(); // 홈 다시 그림
            }
          },
            el("div", { class:"wtProjTitle2" },
              `${p.projectCode || p.projectId} (${p.projectName || ""})`
            )
          );
        })
      )
    : el("div", { class:"wtEmpty2" }, "배정된 PM 프로젝트가 없습니다.");

  const pmCard = el("div", { class:"card2", style:"padding:0;" },
    el("div", { class:"card2-title" }, "배정받은 현재 프로젝트 관리(PM)"),
    pmList
  );

  /***********************
   * 카드 2: 작업인원 공정률
   * (업무일지 승인 비율 기준)
   ***********************/
  function calcWorkerProgress(projectId){
    const rows = {};
    for (const l of (db.logs || [])){
      if (l.projectId !== projectId) continue;
      const w = l.writerId || "-";
      if (!rows[w]) rows[w] = { total:0, approved:0 };
      rows[w].total += Number(l.hours || 0);
      if (l.status === "approved"){
        rows[w].approved += Number(l.hours || 0);
      }
    }
    return Object.entries(rows).map(([uid,v])=>{
      const pct = v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0;
      return {
        uid,
        name: userById(db, uid)?.name || uid,
        pct
      };
    });
  }

  let progressBody;
  if (!selectedPid){
    progressBody = el("div", { class:"wtEmpty2" }, "좌측에서 프로젝트를 선택하세요.");
  } else {
    const rows = calcWorkerProgress(selectedPid);
    progressBody = rows.length
      ? el("div", { class:"list2" },
          ...rows.map(r=>
            el("div", { class:"progressRow" },
              el("div", { class:"avatar" }, "👤"),
              el("div", { class:"pCol" },
                el("div", { class:"pTop" },
                  el("div", { class:"pTitle" }, r.name),
                  el("div", { class:"tag" }, "승인율")
                ),
                el("div", { class:"bar" },
                  el("div", { class:"barFill", style:`width:${r.pct}%;` })
                )
              ),
              el("div", { class:"pPct" }, `${r.pct}%`)
            )
          )
        )
      : el("div", { class:"wtEmpty2" }, "해당 프로젝트의 승인된 업무일지가 없습니다.");
  }

  const progressCard = el("div", { class:"card2", style:"padding:0;" },
    el("div", { class:"card2-title" }, "작업인원 공정률"),
    progressBody
  );

  /***********************
   * 최종 렌더
   ***********************/
  view.appendChild(kpiGrid);
  view.appendChild(pmCard);
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


function viewPMAssign(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("업무관리 · 프로젝트 PM지정");

  db.projects = Array.isArray(db.projects) ? db.projects : [];
  db.users = Array.isArray(db.users) ? db.users : [];
  db.projectPM = Array.isArray(db.projectPM) ? db.projectPM : [];

  const updaterId = getUserId(db);
  const me = userById(db, updaterId);
  const myRole = me?.role || "staff";

  /***********************
   * Helpers
   ***********************/
  function buildYearOptions(){
    const set = new Set();
    for (const p of db.projects){
      const y = projectYearFromProject(p);
      if (y) set.add(y);
    }
    if (!set.size) set.add(String(new Date().getFullYear()));
    return Array.from(set).sort((a,b)=>b.localeCompare(a));
  }

  function projectsByYear(y){
    return db.projects.filter(p => projectYearFromProject(p) === y);
  }

  function projLabel(p){
    return `${p.projectCode||p.projectId} (${p.projectName||""})`.trim();
  }

  // 값이 roleKey면 직급 라벨로, userId면 기존처럼 이름으로 표시(하위호환)
  function displayAssignee(db, v){
    if (!v) return "-";
    if (ROLE_LABEL_KO[v]) return ROLE_LABEL_KO[v]; // roleKey
    return userNameById(db, v);                    // userId(기존 데이터)
  }

  /* =========================
 * 공용 팝업 프로젝트/직급 검색창 (새 창)
 * - ✅ 전역 함수로 두어야 다른 뷰에서도 호출 가능
 * ========================= */
function openPickerWindow({ title, items, placeholder, onPick }){
  const w = 560, h = 640;
  const left = Math.max(0, Math.floor((window.screenX || 0) + ((window.outerWidth || 1200) - w)/2));
  const top  = Math.max(0, Math.floor((window.screenY || 0) + ((window.outerHeight || 800) - h)/2));

  const payload = { title, items, placeholder };

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${payload.title || "선택"}</title>
  <style>
    body{ margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR"; background:#f4f6f9; }
    .wrap{ padding:16px; }
    h1{ margin:0 0 8px; font-size:18px; }
    input{ width:100%; padding:10px; border-radius:10px; border:1px solid #ddd; margin-bottom:10px; }
    ul{ list-style:none; padding:0; margin:0; max-height:460px; overflow:auto; }
    li{ padding:10px; border-radius:10px; cursor:pointer; }
    li:hover{ background:#eee; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${payload.title || ""}</h1>
    <input id="q" placeholder="${payload.placeholder || ""}" />
    <ul id="list"></ul>
  </div>

  <script>
    const items = ${JSON.stringify(payload.items || [])};
    const list = document.getElementById("list");
    const q = document.getElementById("q");

    function render(){
      const v = q.value.toLowerCase();
      list.innerHTML = "";
      items
        .filter(x => (x.label || "").toLowerCase().includes(v))
        .forEach(x => {
          const li = document.createElement("li");
          li.textContent = x.label;
          li.onclick = () => {
            window.opener.postMessage({ type:"APP2_PICK", value:x.value, label:x.label }, "*");
            window.close();
          };
          list.appendChild(li);
        });
    }
    q.addEventListener("input", render);
    render();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type:"text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const win = window.open(
    url,
    "APP2_PICKER",
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  if (!win){
    URL.revokeObjectURL(url);
    toast("팝업이 차단되었습니다.");
    return;
  }

  const handler = (ev)=>{
    if (!ev?.data || ev.data.type !== "APP2_PICK") return;
    window.removeEventListener("message", handler);
    URL.revokeObjectURL(url);
    onPick?.(ev.data.value, ev.data.label);
  };
  window.addEventListener("message", handler);

  const timer = setInterval(()=>{
    if (win.closed){
      clearInterval(timer);
      window.removeEventListener("message", handler);
      URL.revokeObjectURL(url);
    }
  }, 400);
}




  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  /***********************
   * State (form mode)
   ***********************/
  let formMode = "new";
  let editingKey = null; // {year, projectId}

  /***********************
   * UI - Year
   ***********************/
  const years = buildYearOptions();
  const yearSel = el("select", { class:"btn2" }, ...years.map(y => el("option", { value:y }, `${y}년`)));

  /***********************
   * UI - Project "box" (readonly input) + popup
   ***********************/
  let selectedProjectId = "";
  const projectBox = el("input", {
    class:"btn2",
    type:"text",
    value:"",
    placeholder:"프로젝트 선택",
    readonly:"readonly",
    style:"cursor:pointer;"
  });

  function openProjectPicker(){
    const y = yearSel.value;
    const list = projectsByYear(y).map(p => ({
      value: p.projectId,
      label: projLabel(p),
      sub: `${p.projectCode||p.projectId}`
    }));

    if (!list.length){
      toast("해당 년도에 등록된 프로젝트가 없습니다.");
      return;
    }

    openPickerWindow({
      title: `${y}년 프로젝트 선택`,
      items: list,
      placeholder: "코드/명칭 검색",
      onPick:(value, label)=>{
        selectedProjectId = value;
        projectBox.value = label || "";
        // 모드 리셋
        formMode = "new";
        editingKey = null;
        rerenderModeBadge();
      }
    });
  }

  projectBox.addEventListener("click", openProjectPicker);

  yearSel.addEventListener("change", ()=>{
    // 년도 바뀌면 선택 초기화
    selectedProjectId = "";
    projectBox.value = "";
    formMode = "new";
    editingKey = null;
    rerenderModeBadge();
  });

  /***********************
   * UI - Team checkboxes
   ***********************/
  const checks = {};
  const partBox = el("div", { style:"display:flex;gap:14px;flex-wrap:wrap;" },
    ...PM_PARTS.map(pt=>{
      const cb = el("input", { type:"checkbox" });
      checks[pt.key] = cb;
      return el("label", { style:"display:flex;align-items:center;gap:8px;font-weight:1000;" },
        cb, el("span", {}, pt.label)
      );
    })
  );

  /***********************
   * UI - "사용자 선택" = 직급 선택 박스 (readonly) + popup
   ***********************/
  let selectedRole = ""; // roleKey (staff/leader/manager/...)
  const roleBox = el("input", {
    class:"btn2",
    type:"text",
    value:"",
    placeholder:"사용자 선택(직급)",
    readonly:"readonly",
    style:"cursor:pointer;"
  });

  function openRolePicker(){
    const items = ROLE_ORDER.map(r => ({
      value: r,
      label: ROLE_LABEL_KO[r] || r,
      sub: r
    }));

    openPickerWindow({
      title: "직급 선택",
      items,
      placeholder: "직급 검색 (예: 팀장, 실장)",
      onPick:(value, label)=>{
        selectedRole = value;
        roleBox.value = label || "";
        formMode = "new";
        editingKey = null;
        rerenderModeBadge();
      }
    });
  }

  roleBox.addEventListener("click", openRolePicker);

  /***********************
   * Mode badge
   ***********************/
  const modeBadge = el("div", { style:"font-weight:1000;font-size:12px;color:var(--muted);" });

  function rerenderModeBadge(){
    if (formMode === "edit" && editingKey){
      modeBadge.textContent = `수정 모드 · ${editingKey.year}년 · ${editingKey.projectId}`;
    } else {
      modeBadge.textContent = "신규 지정 모드";
    }
  }
  rerenderModeBadge();

  function getSelectedParts(){
    return PM_PARTS.map(x=>x.key).filter(k => checks[k]?.checked);
  }

  function ensureInputs(){
    const y = yearSel.value;
    const pid = selectedProjectId;

    if (!y) { toast("년도를 선택해 주세요."); return null; }
    if (!pid) { toast("프로젝트 명칭 박스를 눌러 프로젝트를 선택해 주세요."); return null; }

    const selectedParts = getSelectedParts();
    if (!selectedParts.length) { toast("구조ㆍBIM / 토목ㆍ조경 / 마감 중 1개 이상 선택해 주세요."); return null; }

    if (!selectedRole) { toast("‘사용자 선택(직급)’ 박스를 눌러 직급을 선택해 주세요."); return null; }

    return { y, pid, selectedParts, targetRole: selectedRole };
  }

  /***********************
   * Buttons
   ***********************/
  const confirmBtn = el("button", {
    class:"btn2 primary2",
    onclick:()=>{
      const x = ensureInputs();
      if (!x) return;

      const exists = getPMRecord(db, x.y, x.pid);
      if (exists){
        toast("이미 PM 지정된 프로젝트입니다. ‘수정’ 기능을 사용하세요.");
        return;
      }

      // ✅ role로 저장
      db.projectPM = Array.isArray(db.projectPM) ? db.projectPM : [];
      let rec = getPMRecord(db, x.y, x.pid);
      if (!rec){
        rec = { pmId: uuid(), year: x.y, projectId: x.pid, parts:{}, updatedAt:"", updatedBy:"" };
        db.projectPM.unshift(rec);
      }
      x.selectedParts.forEach(k => { rec.parts[k] = x.targetRole; });
      rec.updatedAt = nowISO();
      rec.updatedBy = updaterId;

      saveDB(db);
      toast("PM 최종 확정 완료");
      formMode = "new"; editingKey = null;
      rerenderModeBadge();
      rerenderList();
    }
  }, "확인(최종 확정)");

  const editBtn = el("button", {
    class:"btn2",
    onclick:()=>{
      const x = ensureInputs();
      if (!x) return;

      const exists = getPMRecord(db, x.y, x.pid);
      if (!exists){
        toast("기존 PM 지정 데이터가 없습니다. ‘확인(최종 확정)’으로 먼저 등록하세요.");
        return;
      }

      // ✅ role로 수정 저장
      x.selectedParts.forEach(k => { exists.parts[k] = x.targetRole; });
      exists.updatedAt = nowISO();
      exists.updatedBy = updaterId;

      saveDB(db);
      toast("PM 수정 완료");
      formMode = "new"; editingKey = null;
      rerenderModeBadge();
      rerenderList();
    }
  }, "수정");

  /***********************
   * Top card (form)
   ***********************/
  const topCard = el("div", { class:"card2", style:"padding:12px 14px;" },
    el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;" },
      el("div", { style:"font-weight:1100;" }, "프로젝트 PM 지정"),
      modeBadge
    ),

    // 1) 년도 + 2) 프로젝트명 박스(클릭=새 창)
    el("div", { style:"display:grid;grid-template-columns:160px 1fr;gap:10px;margin-bottom:10px;" },
      yearSel,
      projectBox
    ),

    // 3) 팀 체크박스
    el("div", { style:"margin-bottom:10px;" }, partBox),

    // 4) 직급 선택 박스(클릭=새 창)
    el("div", { style:"display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px;" },
      roleBox
    ),

    // 5,6) 버튼
    el("div", { style:"display:flex;gap:10px;justify-content:flex-end;" },
      editBtn,
      confirmBtn
    ),

    el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:10px;" },
      "절차: ①년도 → ②프로젝트 명칭 박스 클릭(새 창) → ③팀 선택 → ④사용자 선택(직급) 박스 클릭(새 창) → ⑤확인(최종 확정). 기존 변경은 ‘수정’ 사용."
    )
  );

  /***********************
   * List card
   ***********************/
  const listCard = el("div", { class:"card2", style:"padding:0;margin-top:12px;" });

  view.appendChild(topCard);
  view.appendChild(listCard);

  function loadToFormForEdit(rec){
    yearSel.value = rec.year || yearSel.value;

    // 프로젝트
    const p = projById(db, rec.projectId);
    selectedProjectId = rec.projectId || "";
    projectBox.value = p ? projLabel(p) : (rec.projectId || "");

    // parts 체크: 값이 있으면 체크
    for (const pt of PM_PARTS){
      const v = rec.parts?.[pt.key] || "";
      checks[pt.key].checked = !!v;
    }

    // 직급: parts 중 첫 값(우선순위)
    const pick =
      rec.parts?.structBim ||
      rec.parts?.civilLandscape ||
      rec.parts?.finish ||
      "";

    if (ROLE_LABEL_KO[pick]){
      selectedRole = pick;
      roleBox.value = ROLE_LABEL_KO[pick];
    } else {
      // 기존 userId 데이터면: 현재는 “직급 시스템”이라 roleBox에는 userId/이름을 그대로 노출(하위호환)
      selectedRole = "";
      roleBox.value = displayAssignee(db, pick);
    }

    formMode = "edit";
    editingKey = { year: rec.year, projectId: rec.projectId };
    rerenderModeBadge();
    toast("상단 폼에 불러왔습니다. 수정 후 ‘수정’ 버튼을 누르세요.");
  }

  function rerenderList(){
    listCard.innerHTML = "";
    listCard.appendChild(el("div", { class:"card2-title" }, "PM 지정 현황"));

    const rows = (db.projectPM||[])
      .map(ensurePMShape)
      .filter(Boolean)
      .slice(0, 300);

    if (!rows.length){
      listCard.appendChild(el("div", { class:"wtEmpty2" }, "PM 지정 데이터가 없습니다."));
      return;
    }

    const tbody = el("tbody", {},
      ...rows.map(r=>{
        const p = projById(db, r.projectId);
        const pname = p ? `${p.projectCode||p.projectId} (${p.projectName||""})`.trim() : r.projectId;

        const editRowBtn = el("button", {
          class:"btn2 ghost2",
          onclick:()=>{
            const rec = getPMRecord(db, r.year, r.projectId);
            if (!rec) return toast("레코드를 찾을 수 없습니다.");
            loadToFormForEdit(rec);
          }
        }, "수정");

        return el("tr", {},
          el("td", { class:"mutedCell" }, r.year || "-"),
          el("td", {}, pname),
          el("td", { class:"mutedCell" }, displayAssignee(db, r.parts?.structBim || "")),
          el("td", { class:"mutedCell" }, displayAssignee(db, r.parts?.civilLandscape || "")),
          el("td", { class:"mutedCell" }, displayAssignee(db, r.parts?.finish || "")),
          el("td", {}, editRowBtn),
          el("td", { class:"mutedCell" }, `${r.updatedAt || "-"} · ${displayAssignee(db, r.updatedBy || "")}`)
        );
      })
    );

    const tbl = el("table", { class:"tbl2" },
      el("thead", {},
        el("tr", {},
          el("th", {}, "년도"),
          el("th", {}, "프로젝트"),
          el("th", {}, "구조ㆍBIM PM"),
          el("th", {}, "토목ㆍ조경 PM"),
          el("th", {}, "마감 PM"),
          el("th", { class:"w120" }, "수정"),
          el("th", { class:"w220" }, "업데이트")
        )
      ),
      tbody
    );

    listCard.appendChild(el("div", { class:"tableWrap" }, tbl));
  }

  rerenderList();
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
  const me = userById(db, uid);

  const dateInput = el("input", { class:"btn2", type:"date", value: todayISO() });

  // ✅ 편집 모드 상태
  let editing = null; 
  // editing = { date:"YYYY-MM-DD", logIds:[...], status:"submitted|rejected" }

  let entries = [ makeEmptyEntry(db) ];
  const entriesHost = el("div", { class:"view2" });

  function myLogsByDate(date){
    db.logs = Array.isArray(db.logs) ? db.logs : [];
    return db.logs
      .filter(l => l.writerId === uid && l.date === date)
      .sort((a,b)=> (a.submittedAt||"").localeCompare(b.submittedAt||""));
  }

  function canEditStatus(status){
    return status === "submitted" || status === "rejected";
  }

  function resetToNew(){
    editing = null;
    entries = [ makeEmptyEntry(db) ];
    rerenderHeader();
    rerenderEntries();
  }

  function loadForEdit(){
    const date = dateInput.value;
    if (!date) return toast("날짜를 선택해 주세요.");

    const list = myLogsByDate(date);
    if (!list.length){
      return toast("해당 날짜에 작성된 업무일지가 없습니다.");
    }

    // ✅ 승인된 건이 포함이면 수정 불가
    const hasApproved = list.some(x => x.status === "approved");
    if (hasApproved){
      return toast("승인 완료된 업무일지는 수정할 수 없습니다.");
    }

    // ✅ 수정 가능한 상태만 남김 (submitted/rejected)
    const editable = list.filter(x => canEditStatus(x.status));
    if (!editable.length){
      return toast("수정 가능한 업무일지가 없습니다.");
    }

    // 상태는 섞일 수 있는데, UI 표시는 대표 상태로
    const reprStatus = editable[0].status;

    editing = {
      date,
      logIds: editable.map(x => x.logId),
      status: reprStatus
    };

    // entries에 기존 값 주입
    entries = editable.map(l => ({
      projectId: l.projectId,
      category: l.category || "구조",
      process: l.process || (PROCESS_MASTER[l.category || "구조"]?.[0] || ""),
      hours: Number(l.hours || 0) || 1,
      content: l.content || ""
    }));

    // 최소 1개 보장
    if (!entries.length) entries = [ makeEmptyEntry(db) ];

    rerenderHeader();
    rerenderEntries();
    toast("기존 업무일지를 불러왔습니다. 수정 후 저장하세요.");
  }

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
      step:"0.5",
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

  const addBtn = el("button", {
    class:"btn2",
    onclick:()=>{ entries.push(makeEmptyEntry(db)); rerenderEntries(); }
  }, "+ 업무 항목 추가");

    function openMyLogCalendar(){
  // ✅ 내가 작성한 로그(approved 제외하고 표시할지 여부는 아래에서 결정)
  const logs = (db.logs||[]).filter(l => l.writerId === uid);

  // 날짜별 그룹
  const map = new Map(); // date -> logs[]
  for (const l of logs){
    if (!l.date) continue;
    if (!map.has(l.date)) map.set(l.date, []);
    map.get(l.date).push(l);
  }

  // ✅ 표시할 날짜 조건:
  // - 달력에는 "내가 작성한 날짜"는 모두 표시
  // - 단, 클릭 시 approved 포함이면 편집 불가 안내
  const allDates = Array.from(map.keys()).sort(); // YYYY-MM-DD

  if (!allDates.length){
    toast("작성된 업무일지가 없습니다.");
    return;
  }

  // 기본 월: 가장 최근 작성일 기준
  const last = allDates[allDates.length - 1];
  const m = last.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year  = m ? Number(m[1]) : new Date().getFullYear();
  let month = m ? Number(m[2]) : (new Date().getMonth()+1);

  function pad2(n){ return String(n).padStart(2,"0"); }
  function ymd(y,m,d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
  function parseYMD(s){
    const mm = String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!mm) return null;
    return { y:Number(mm[1]), mo:Number(mm[2]), d:Number(mm[3]) };
  }
  function daysInMonth(y,m){
    return new Date(y, m, 0).getDate();
  }
  function firstDow(y,m){
    return new Date(y, m-1, 1).getDay(); // 0~6
  }

  // ✅ 해당 날짜 클릭 시 실제 로드(기존 entries 채우는 로직)
  function loadDate(date){
    const list = (map.get(date) || []).slice()
      .sort((a,b)=> (a.submittedAt||"").localeCompare(b.submittedAt||""));

    if (!list.length){
      toast("해당 날짜에 작성된 업무일지가 없습니다.");
      return;
    }

    // 승인 포함이면 잠금
    if (list.some(x => x.status === "approved")){
      toast("승인 완료된 업무일지는 수정할 수 없습니다.");
      return;
    }

    // 수정 가능한 것만 (submitted/rejected)
    const editable = list.filter(x => canEditStatus(x.status));
    if (!editable.length){
      toast("수정 가능한 업무일지가 없습니다.");
      return;
    }

    const reprStatus = editable[0].status;

    editing = {
      date,
      logIds: editable.map(x => x.logId),
      status: reprStatus
    };

    entries = editable.map(l => ({
      projectId: l.projectId,
      category: l.category || "구조",
      process: l.process || (PROCESS_MASTER[l.category || "구조"]?.[0] || ""),
      hours: Number(l.hours || 0) || 1,
      content: l.content || ""
    }));

    if (!entries.length) entries = [ makeEmptyEntry(db) ];

    // ✅ 화면 날짜도 해당 날짜로 동기화
    dateInput.value = date;

    rerenderHeader();
    rerenderSubmitLabel();
    rerenderEntries();

    modalClose();
    toast("업무일지를 불러왔습니다. 수정 후 저장하세요.");
  }

  // ✅ 달력 UI
  const wrap = el("div", { style:"display:flex;flex-direction:column;gap:10px;min-width:320px;max-width:520px;" });

  const title = el("div", { style:"font-weight:1100;" }, "내 업무일지 불러오기");
  const hint  = el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" },
    "점(•)이 표시된 날짜에 작성된 업무일지가 있습니다. 날짜를 클릭하면 불러옵니다."
  );

  const header = el("div", { style:"display:flex;align-items:center;justify-content:space-between;gap:8px;" });

  const prevBtn = el("button", { class:"btn2 ghost2" }, "◀");
  const nextBtn = el("button", { class:"btn2 ghost2" }, "▶");
  const ymLabel = el("div", { style:"font-weight:1100;" });

  header.appendChild(prevBtn);
  header.appendChild(ymLabel);
  header.appendChild(nextBtn);

  const dow = ["일","월","화","수","목","금","토"];
  const dowRow = el("div", { style:"display:grid;grid-template-columns:repeat(7,1fr);gap:6px;" },
    ...dow.map(t=> el("div", { style:"text-align:center;color:var(--muted);font-size:12px;font-weight:900;padding:4px 0;" }, t))
  );

  const grid = el("div", { style:"display:grid;grid-template-columns:repeat(7,1fr);gap:6px;" });

  function renderCal(){
    ymLabel.textContent = `${year}-${pad2(month)}`;
    grid.innerHTML = "";

    const start = firstDow(year, month);
    const dim = daysInMonth(year, month);

    // 앞 빈칸
    for (let i=0;i<start;i++){
      grid.appendChild(el("div", { style:"height:44px;" }));
    }

    for (let d=1; d<=dim; d++){
      const date = ymd(year, month, d);
      const dayLogs = map.get(date) || [];
      const has = dayLogs.length > 0;

      // 상태 요약: approved 존재 여부
      const hasApproved = has && dayLogs.some(x=>x.status==="approved");
      const editableCount = has ? dayLogs.filter(x=>canEditStatus(x.status)).length : 0;

      const btn = el("button", {
        type:"button",
        class:"btn2",
        style:[
          "height:44px; padding:0; border-radius:12px;",
          "display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;",
          has ? "font-weight:1100;" : "opacity:.45;",
          hasApproved ? "border:1px solid rgba(240,138,36,.55);" : ""
        ].join(" "),
        onclick:()=>{
          if (!has) return;
          loadDate(date);
        }
      },
        el("div", {}, String(d)),
        has
          ? el("div", { style:"font-size:11px;line-height:1;color:var(--muted);font-weight:1000;" },
              hasApproved ? "승인완료" : `• ${editableCount}건`
            )
          : el("div", { style:"font-size:11px;line-height:1;color:transparent;" }, ".")
      );

      grid.appendChild(btn);
    }

    // 뒷 빈칸(그리드 정렬)
    const totalCells = start + dim;
    const tail = (7 - (totalCells % 7)) % 7;
    for (let i=0;i<tail;i++){
      grid.appendChild(el("div", { style:"height:44px;" }));
    }
  }

  prevBtn.addEventListener("click", ()=>{
    month--;
    if (month <= 0){ month = 12; year--; }
    renderCal();
  });
  nextBtn.addEventListener("click", ()=>{
    month++;
    if (month >= 13){ month = 1; year++; }
    renderCal();
  });

  // (선택) 작성된 연/월만 빠르게 이동하는 드롭다운을 원하면 여기 확장 가능

  wrap.appendChild(title);
  wrap.appendChild(hint);
  wrap.appendChild(header);
  wrap.appendChild(dowRow);
  wrap.appendChild(grid);

  renderCal();

  modalOpen("기존 업무일지 불러오기", wrap);
}


  // ✅ 불러오기/초기화 버튼(수정 UI)
  const loadBtn = el("button", {
  class:"btn2 ghost2",
  onclick: openMyLogCalendar
}, "기존 불러오기");


  const resetBtn = el("button", {
    class:"btn2 ghost2",
    onclick:()=>{
      if (editing && !confirm("수정 모드를 종료하고 새로 작성할까요?")) return;
      resetToNew();
    }
  }, "새로작성");

  // 헤더(상태표시) 영역
  const modeBadge = el("div", { style:"font-weight:1000;font-size:12px;color:var(--muted);" });

  function rerenderHeader(){
    if (!editing){
      modeBadge.textContent = "새 업무일지 작성 모드";
    } else {
      const st = editing.status === "rejected" ? "반려(수정 후 재제출)" : "제출됨(수정)";
      modeBadge.textContent = `수정 모드 · ${editing.date} · ${st}`;
    }
  }

  const submitBtn = el("button", {
    class:"btn2 primary2",
    onclick:()=>{
      const date = dateInput.value;
      if (!date) return toast("날짜를 선택해 주세요.");

      for (let i=0;i<entries.length;i++){
        const e = entries[i];
        if (!e.projectId) return toast(`업무 항목 ${i+1}: 프로젝트를 선택해 주세요.`);
        if (!e.content || !e.content.trim()) return toast(`업무 항목 ${i+1}: 작업내용을 입력해 주세요.`);
        if (!(e.hours > 0)) return toast(`업무 항목 ${i+1}: 투입시간(시간)을 입력해 주세요.`);
      }

      db.logs = Array.isArray(db.logs) ? db.logs : [];

      // -------------------------
      // ✅ 수정 모드: 기존 로그 업데이트
      // -------------------------
      if (editing && editing.date === date){
        const targets = editing.logIds
          .map(id => db.logs.find(x => x.logId === id))
          .filter(Boolean);

        // 승인된 건이 새로 생겼으면 방어
        if (targets.some(t => t.status === "approved")){
          return toast("승인 완료된 업무일지는 수정할 수 없습니다.");
        }

        // 줄어든 경우: 초과 로그 삭제 확인
        if (entries.length < targets.length){
          if (!confirm(`기존 ${targets.length}건 중 ${targets.length - entries.length}건을 삭제할까요?`)) return;
          const toDelete = targets.slice(entries.length);
          db.logs = db.logs.filter(x => !toDelete.some(d => d.logId === x.logId));
        }

        const submittedAt = nowISO();

        // 업데이트(겹치는 구간)
        const min = Math.min(entries.length, targets.length);
        for (let i=0;i<min;i++){
          const l = targets[i];
          const e = entries[i];

          l.projectId = e.projectId;
          l.category  = e.category;
          l.process   = e.process;
          l.content   = e.content.trim();
          l.hours     = Number(e.hours)||0;

          // ✅ 반려건 수정 저장 시: 재제출 처리
          // ✅ 수정 저장 = 다시 결재 라인 태움
l.status = "submitted";
l.submittedAt = submittedAt;

l.approvedBy = ""; l.approvedAt = "";
l.rejectedBy = ""; l.rejectedAt = ""; l.rejectReason = "";

const firstStep = initialApprovalStepForWriterRole(me?.role || "staff");
l.approvalStep = firstStep || ""; // 실장 이상이면 "" (즉시승인 로직은 아래에서 처리)
l.approvalHistory = []; // 재상신이므로 결재이력 초기화(원하면 유지로 변경 가능)

        }

        // 추가된 항목: 새 로그 생성
        if (entries.length > targets.length){
          for (let i=targets.length;i<entries.length;i++){
            const e = entries[i];
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
        }

        saveDB(db);
        toast("업무일지 수정 저장 완료 (승인 대기)");
        render();
        return;
      }

      // -------------------------
      // ✅ 새 작성 모드: 기존과 동일하게 push
      // -------------------------
      const submittedAt = nowISO();
const firstStep = initialApprovalStepForWriterRole(me?.role || "staff");

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

    status: firstStep ? "submitted" : "approved",
    submittedAt,
    approvedBy: firstStep ? "" : uid,
    approvedAt: firstStep ? "" : submittedAt,

    rejectedBy: "",
    rejectedAt: "",
    rejectReason: "",

    approvalStep: firstStep || "",
    approvalHistory: []
  });
}


      saveDB(db);
      toast("업무일지 제출 완료 (승인 대기)");
      render();
    }
  }, "제출하기");

  function rerenderSubmitLabel(){
    submitBtn.textContent = editing ? "수정 저장" : "제출하기";
  }

  // date 변경 시: 수정모드 유지 여부 결정(날짜가 바뀌면 신규작성 모드로 자동 전환)
  dateInput.addEventListener("change", ()=>{
    if (editing && editing.date !== dateInput.value){
      editing = null;
      rerenderHeader();
      rerenderSubmitLabel();
    }
  });

  // 화면 구성
  const headerRow = el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;" },
    el("div", { style:"font-weight:1100;" }, "업무일지 작성"),
    el("div", { style:"display:flex;gap:8px;align-items:center;" },
      loadBtn, resetBtn, addBtn
    )
  );

  const dateRow = el("div", { style:"display:flex;gap:10px;align-items:center;margin-bottom:10px;" },
    el("div", { style:"font-weight:900;color:var(--muted);font-size:12px;" }, "날짜"),
    dateInput,
    el("div", { style:"margin-left:auto;" }, modeBadge)
  );

  view.appendChild(
    el("div", { class:"card2", style:"padding:12px 14px;" },
      headerRow,
      dateRow,
      entriesHost,
      el("div", { style:"display:flex;justify-content:flex-end;margin-top:12px;" },
        (rerenderSubmitLabel(), submitBtn)
      )
    )
  );

  rerenderHeader();
  rerenderEntries();
}


  function viewApprove(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("업무관리 · 업무일지 승인");

    const uid = getUserId(db);
    const me = userById(db, uid);
const myRole = me?.role || "staff";

const submitted = (db.logs||[])
  .map(ensureApprovalShape)
  .filter(l => l.status === "submitted" && (l.approvalStep || "") === myRole)
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
  ensureApprovalShape(l);

  // 결재 이력 저장
  l.approvalHistory.push({ by: uid, role: myRole, at: t });

  if (isFinalStep(l.approvalStep)){
    // ✅ 실장(최종) 승인
    l.status = "approved";
    l.approvedBy = uid;
    l.approvedAt = t;
    l.approvalStep = "";          // 반려 상태에서는 결재대기 없음
l.approvalHistory = l.approvalHistory || [];

  } else {
    // ✅ 팀장(중간) 승인 → 다음 결재자에게 넘김
    l.approvalStep = nextStep(l.approvalStep) || "";
    // 상태는 계속 submitted 유지 (다음 결재 대기)
  }
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

  const logs = Array.isArray(db.logs) ? db.logs : [];
  const projects = Array.isArray(db.projects) ? db.projects : [];
  const users = Array.isArray(db.users) ? db.users : [];

  function projName(pid){
    const p = projects.find(x=>x.projectId === pid);
    if (!p) return pid || "-";
    const code = p.projectCode || p.projectId || "";
    const name = p.projectName || "";
    return `${code} ${name}`.trim();
  }

      function projLabelForCalendar(pid){
    // projName() 결과에서 ']' 뒤 텍스트만 사용
    const full = projName(pid) || "";
    const idx = full.indexOf("]");
    if (idx >= 0 && idx < full.length - 1) return full.slice(idx + 1).trim();
    return full.trim();
  }

    
  function userName(uid){
    return (users.find(u=>u.userId === uid)?.name) || uid || "-";
  }

  // -----------------------
  // 상태: year / month
  // -----------------------
  const LS_Y = "APP2_SCHEDULE_YEAR";
  const LS_M = "APP2_SCHEDULE_MONTH";

  const now = new Date();
  let year  = Number(localStorage.getItem(LS_Y) || "") || now.getFullYear();
  let month = Number(localStorage.getItem(LS_M) || "") || (now.getMonth()+1); // 1~12

  function saveYM(){
    localStorage.setItem(LS_Y, String(year));
    localStorage.setItem(LS_M, String(month));
  }

  // -----------------------
  // 필터: 업무일지 포함 범위
  // - "업무일지에 작성된 내용" => rejected 제외, submitted/approved 포함
  // -----------------------
  function isIncludedStatus(s){
    return s !== "rejected";
  }

  // YYYY-MM-DD
  function pad2(n){ return String(n).padStart(2,"0"); }
  function ymd(y,m,d){ return `${y}-${pad2(m)}-${pad2(d)}`; }

  function parseYMD(dateStr){
    // 기대: "YYYY-MM-DD"
    if (!dateStr || typeof dateStr !== "string") return null;
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return { y:Number(m[1]), mo:Number(m[2]), d:Number(m[3]) };
  }

  // -----------------------
  // 상단: 제목 + (우) 년도 드롭박스 + 월 드롭박스
  // -----------------------
  function buildYearSelect(){
    // logs/프로젝트에서 년도 후보 만들기 (없으면 현재년도)
    const years = [];

    // logs.date 기반
    for (const l of logs){
      if (!isIncludedStatus(l.status)) continue;
      const p = parseYMD(l.date);
      if (p) years.push(p.y);
    }
    // 프로젝트 코드/ID 앞 4자리도 후보
    for (const p of projects){
      const code = String(p.projectCode || p.projectId || "").slice(0,4);
      if (/^\d{4}$/.test(code)) years.push(Number(code));
    }

    const uniq = Array.from(new Set(years.filter(Number.isFinite))).sort((a,b)=>b-a);
    if (!uniq.length) uniq.push(now.getFullYear());
    if (!uniq.includes(year)) year = uniq[0];

    const sel = el("select", {
      class:"btn2 calSelect2",
      onchange:(e)=>{
        year = Number(e.target.value);
        saveYM();
        rerender();
      }
    });
    uniq.forEach(y=>{
      const opt = el("option", { value:String(y) }, `${y}년`);
      if (y === year) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function buildMonthSelect(){
    const sel = el("select", {
      class:"btn2 calSelect2",
      onchange:(e)=>{
        month = Number(e.target.value);
        saveYM();
        rerender();
      }
    });
    for (let i=1;i<=12;i++){
      const opt = el("option", { value:String(i) }, `${i}월`);
      if (i === month) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  }

  const yearSel = buildYearSelect();
  const monthSel = buildMonthSelect();

  const topCard = el("div", { class:"card2 calTop2" },
    el("div", { class:"calTopRow2" },
      el("div", { class:"calTitle2" }, "종합 공정관리"),
      el("div", { class:"calCtrls2" }, yearSel, monthSel)
    )
  );

  const calCard = el("div", { class:"card2", style:"padding:12px 14px;" });
  view.appendChild(topCard);
  view.appendChild(calCard);

  // -----------------------
  // 렌더: 달력 그리드 + 띠지
  // -----------------------
  function buildLogMapForMonth(y, m){
    // key: YYYY-MM-DD -> logs[]
    const map = new Map();

    for (const l of logs){
      if (!isIncludedStatus(l.status)) continue;
      const p = parseYMD(l.date);
      if (!p) continue;
      if (p.y !== y || p.mo !== m) continue;

      const k = l.date;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(l);
    }

    // 날짜별 정렬: submittedAt/approvedAt/생성순 (없으면 content)
    for (const [k, arr] of map.entries()){
      arr.sort((a,b)=>{
        const ta = (a.approvedAt || a.submittedAt || "").toString();
        const tb = (b.approvedAt || b.submittedAt || "").toString();
        return ta.localeCompare(tb);
      });
    }
    return map;
  }

  function openDayModal(dateStr, dayLogs){
    // 상세: 해당 날짜의 업무일지 내용들
    const body = el("div", { class:"calModalBody2" });

    const head = el("div", { class:"calModalHead2" },
      el("div", { class:"calModalDate2" }, dateStr),
      el("div", { class:"calModalHint2" }, `총 ${dayLogs.length}건`)
    );

    const list = el("div", { class:"calModalList2" },
      ...dayLogs.map(l=>{
        const status = l.status || "";
        const statusText = status === "approved" ? "승인" : (status === "submitted" ? "제출" : status);
        const statusCls = status === "approved" ? "ok" : "wait";

        return el("div", { class:"calModalItem2" },
          el("div", { class:"calModalLine1_2" },
            el("div", { class:`calPill2 ${statusCls}` }, statusText),
            el("div", { class:"calModalProj2" }, projName(l.projectId)),
            el("div", { class:"calModalMeta2" }, `${l.category || "-"} / ${l.process || "-"} · ${Number(l.hours||0)}시간`)
          ),
          el("div", { class:"calModalLine2_2" }, `작성: ${userName(l.writerId)} · 제출/승인: ${(l.approvedAt || l.submittedAt || "-")}`),
          el("div", { class:"calModalContent2" }, (l.content || "").trim() || "(내용 없음)")
        );
      })
    );

    body.appendChild(head);
    body.appendChild(list);

    modalOpen("업무일지 상세", body);
  }

  function rerender(){
    saveYM();

    const logMap = buildLogMapForMonth(year, month);

    // 달력 계산
    const first = new Date(year, month-1, 1);
    const last  = new Date(year, month, 0);
    const daysInMonth = last.getDate();
    const startDow = first.getDay(); // 0(일)~6(토)

    calCard.innerHTML = "";

// ✅ wrapper + overlay 준비
const wrap = el("div", { class:"calWrap2" });
calCard.appendChild(wrap);


    // 요일 헤더
    const dow = ["일","월","화","수","목","금","토"];
    const dowRow = el("div", { class:"calDow2" },
      ...dow.map(t => el("div", { class:"calDowCell2" }, t))
    );

    const grid = el("div", { class:"calGrid2" });

    // 빈칸(이전달)
    for (let i=0;i<startDow;i++){
      grid.appendChild(el("div", { class:"calCell2 muted" }));
    }

    // 날짜 셀
    for (let d=1; d<=daysInMonth; d++){
      const dateStr = ymd(year, month, d);
      const dayLogs = logMap.get(dateStr) || [];

      const ribbons = el("div", { class:"calRibbons2" },
        ...dayLogs.slice(0,3).map(l=>{
          const status = l.status || "";
          const cls = status === "approved" ? "ok" : "wait";
          const text = `${projLabelForCalendar(l.projectId)} · ${l.category||"-"}/${l.process||"-"} · ${Number(l.hours||0)}h`;
          return el("div", { class:`calRibbon2 ${cls}`, title: (l.content||"").trim() }, text);
        })
      );

      const more = (dayLogs.length > 3)
        ? el("div", { class:"calMore2" }, `+${dayLogs.length-3} more`)
        : null;

      const cell = el("button", {
        class:`calCell2 ${dayLogs.length ? "has" : ""}`,
        onclick:()=>{
          if (!dayLogs.length) return;
          openDayModal(dateStr, dayLogs);
        },
        type:"button"
      },
        el("div", { class:"calDayTop2" },
          el("div", { class:"calDayNum2" }, String(d)),
          dayLogs.length ? el("div", { class:"calCount2" }, String(dayLogs.length)) : el("div")
        ),
        ribbons,
        more
      );

      grid.appendChild(cell);
    }

    // 뒷칸 채우기(그리드 정렬)
    const totalCells = startDow + daysInMonth;
    const tail = (7 - (totalCells % 7)) % 7;
    for (let i=0;i<tail;i++){
      grid.appendChild(el("div", { class:"calCell2 muted" }));
    }

        wrap.appendChild(dowRow);
wrap.appendChild(grid);


    

function dayIndexInMonth(y,m,day){ return day; } // 1~daysInMonth

function toDate(y,m,d){ return new Date(y, m-1, d); }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function addDays(dt, n){ const x = new Date(dt); x.setDate(x.getDate()+n); return x; }

function buildSegmentsFromSet(y,m,setDates){
  // setDates: Set(YYYY-MM-DD)
  const arr = Array.from(setDates)
    .map(s=>parseYMD(s))
    .filter(p=>p && p.y===y && p.mo===m)
    .sort((a,b)=> (a.d-b.d));

  const segs = [];
  if (!arr.length) return segs;

  let s = arr[0].d;
  let prev = arr[0].d;

  for (let i=1;i<arr.length;i++){
    const cur = arr[i].d;
    if (cur === prev + 1){
      prev = cur;
      continue;
    }
    segs.push({ startDay:s, endDay:prev });
    s = cur; prev = cur;
  }
  segs.push({ startDay:s, endDay:prev });
  return segs;
}

// 달력에서 "주별 row" 계산 (grid 셀 구성과 동일해야 함)
const weeks = [];
{
  // grid는 startDow 만큼 앞 빈칸 후 1~daysInMonth
  // row = 0.. ; col = 0..6
  let cell = 0;

  // 앞 빈칸
  for (let i=0;i<startDow;i++){
    if (!weeks[Math.floor(cell/7)]) weeks[Math.floor(cell/7)] = [];
    weeks[Math.floor(cell/7)][cell%7] = null;
    cell++;
  }
  for (let d=1; d<=daysInMonth; d++){
    if (!weeks[Math.floor(cell/7)]) weeks[Math.floor(cell/7)] = [];
    weeks[Math.floor(cell/7)][cell%7] = d; // day number
    cell++;
  }
  // 뒤 빈칸
  const totalCells = startDow + daysInMonth;
  const tail = (7 - (totalCells % 7)) % 7;
  for (let i=0;i<tail;i++){
    if (!weeks[Math.floor(cell/7)]) weeks[Math.floor(cell/7)] = [];
    weeks[Math.floor(cell/7)][cell%7] = null;
    cell++;
  }
}

const overlay = el("div", { class:"calOverlay2" });

// ✅ 오버레이는 달력 위에는 올라오되, 모달보다 무조건 아래
overlay.style.zIndex = "5"; // (모달은 CSS에서 9999로 올릴 예정)

wrap.appendChild(overlay);

// ✅ 요일헤더 높이/마진/그리드 위치를 실제 DOM 기준으로 계산해서 정확히 맞춤
syncOverlayToGrid(wrap, dowRow, grid, overlay);


    // ✅ 리사이즈/레이아웃 변경 시 overlay 위치/너비를 grid에 다시 맞춤
attachOverlayResizeObserver(wrap, dowRow, grid, overlay, () => {
  // overlay 안의 weekBlock/lanes는 grid-column 기반이라 대개 괜찮지만,
  // rowGap/colGap/width 재반영이 필요하면 rerender()를 호출하는게 가장 안전함.
  // 다만 무한루프 방지를 위해 여기서는 overlay 기준값만 갱신하고 그대로 둠.
});



// projectId -> date presence
const pres = buildPresenceByProject(year, month);

// 한 주(week)마다 span bar를 배치하기 위해 week overlay를 만들고 stack
// 레인 충돌 방지: 같은 주에서 bar들이 겹치면 다음 레인으로 내려감
for (let w=0; w<weeks.length; w++){
  const weekDays = weeks[w]; // length 7, day or null

  // 이 주에서 가능한 day 범위
  const minDay = Math.min(...weekDays.filter(Boolean));
  const maxDay = Math.max(...weekDays.filter(Boolean));

  // 빈 주면 패스
  if (!isFinite(minDay) || !isFinite(maxDay)) {
  // ✅ 실제 grid 첫 셀 높이 + rowGap 기반으로 빈 주도 정확히 맞춤
  const cells = Array.from(grid.querySelectorAll(".calCell2"));
  const sampleIdx = w * 7;
  const sampleCell = cells[sampleIdx] || cells[0];

  const gcs = getComputedStyle(grid);
  const rowGap = __num(gcs.rowGap || gcs.gap);

  const innerH = (overlay.__innerH != null)
    ? overlay.__innerH
    : (sampleCell ? sampleCell.offsetHeight : 120);

  overlay.appendChild(
    el("div", { style:`height:${innerH}px;margin-bottom:${rowGap}px;` })
  );
  continue;
}



  // ✅ 주 overlay block: 셀 높이와 맞춰야 함 (현재 cell min-height 120 + padding 감안)
  const weekBlock = el("div", { class:"calWeekOverlay2" });
  // ✅ weekBlock도 calGrid2와 동일한 7열/갭을 사용
weekBlock.style.display = "grid";
weekBlock.style.gridTemplateColumns = overlay.__gridCols || getComputedStyle(grid).gridTemplateColumns;
weekBlock.style.columnGap = overlay.__colGap || (getComputedStyle(grid).columnGap || getComputedStyle(grid).gap);

  // weekBlock은 7열 grid와 gap만 맞추고, 실제 레인은 아래에서 별도 stack

  // 레인 목록(각 레인은 7열 grid)
  const lanes = [];

  // helper: 특정 구간이 레인에서 비어있는지 체크
  function canPlace(laneOcc, c1, c2){
    for (let c=c1; c<=c2; c++){
      if (laneOcc[c]) return false;
    }
    return true;
  }
  function mark(laneOcc, c1, c2){
    for (let c=c1; c<=c2; c++) laneOcc[c] = true;
  }

  // 이 주에 걸리는 project segment들 모아서 배치
  const items = [];

  for (const [pid, setDates] of pres.entries()){
    const segs = buildSegmentsFromSet(year, month, setDates);

    // 월 단위 segment를 "주 단위"로 쪼개기
    for (const sg of segs){
      // 이 주와 겹치는 구간만
      const a = Math.max(sg.startDay, minDay);
      const b = Math.min(sg.endDay, maxDay);
      if (a > b) continue;

      // 주 내부 col 계산
      const colStart = weekDays.indexOf(a);
      const colEnd   = weekDays.indexOf(b);
      if (colStart < 0 || colEnd < 0) continue;

      items.push({ pid, a, b, colStart, colEnd });
    }
  }

  // 길이 긴 것부터 배치 (충돌 최소화)
  items.sort((x,y)=> ( (y.colEnd-y.colStart) - (x.colEnd-x.colStart) ));

  // 배치
  for (const it of items){
    // 레인 찾기
    let placed = false;
    for (let li=0; li<lanes.length; li++){
      const lane = lanes[li];
      if (canPlace(lane.occ, it.colStart, it.colEnd)){
        const { bg, ink } = hashColor(it.pid);
        lane.node.appendChild(
          el("div", {
            class:"calSpan2",
            style:`grid-column:${it.colStart+1} / ${it.colEnd+2}; --spanBg:${bg}; --spanInk:${ink};`,
            onclick:(e)=>{
              e.stopPropagation();
              // ✅ span 클릭 시: 해당 구간(주 단위 분절된 구간) 날짜들 상세
              const dates = [];
              for (let d=it.a; d<=it.b; d++){
                const ds = ymd(year, month, d);
                dates.push(ds);
              }
              const rangeLogs = logs
                .filter(l=>isIncludedStatus(l.status))
                .filter(l=>l.projectId===it.pid)
                .filter(l=>dates.includes(l.date));
              if (!rangeLogs.length) return;
              modalOpen(
                `프로젝트 상세 (${projName(it.pid)})`,
                el("div", {},
                  el("div", { class:"muted2", style:"padding:0 0 10px 0;" }, `${ymd(year,month,it.a)} ~ ${ymd(year,month,it.b)} (총 ${rangeLogs.length}건)`),
                  el("div", { class:"calModalList2" },
                    ...rangeLogs.map(l=>el("div", { class:"calModalItem2" },
                      el("div", { class:"calModalLine1_2" },
                        el("div", { class:`calPill2 ${l.status==="approved"?"ok":"wait"}` }, l.status==="approved"?"승인":"제출"),
                        el("div", { class:"calModalMeta2" }, `${l.date} · ${l.category||"-"} / ${l.process||"-"} · ${Number(l.hours||0)}시간`)
                      ),
                      el("div", { class:"calModalContent2" }, (l.content||"").trim() || "(내용 없음)")
                    ))
                  )
                )
              );
            }
          }, el("span", { class:"t" }, projName(it.pid)))
        );
        mark(lane.occ, it.colStart, it.colEnd);
        placed = true;
        break;
      }
    }
    if (!placed){
      // 새 레인 생성
      const laneNode = el("div", { class:"calLane2" });
      // ✅ lane도 calGrid2와 동일한 7열/갭 강제
laneNode.style.display = "grid";
laneNode.style.gridTemplateColumns = overlay.__gridCols || getComputedStyle(grid).gridTemplateColumns;
laneNode.style.columnGap = overlay.__colGap || (getComputedStyle(grid).columnGap || getComputedStyle(grid).gap);

      const occ = Array(7).fill(false);

      const { bg, ink } = hashColor(it.pid);
      laneNode.appendChild(
        el("div", {
          class:"calSpan2",
          style:`grid-column:${it.colStart+1} / ${it.colEnd+2}; --spanBg:${bg}; --spanInk:${ink};`,
          onclick:(e)=>{
            e.stopPropagation();
            const dates = [];
            for (let d=it.a; d<=it.b; d++){
              const ds = ymd(year, month, d);
              dates.push(ds);
            }
            const rangeLogs = logs
              .filter(l=>isIncludedStatus(l.status))
              .filter(l=>l.projectId===it.pid)
              .filter(l=>dates.includes(l.date));
            if (!rangeLogs.length) return;
            modalOpen(
              `프로젝트 상세 (${projName(it.pid)})`,
              el("div", {},
                el("div", { class:"muted2", style:"padding:0 0 10px 0;" }, `${ymd(year,month,it.a)} ~ ${ymd(year,month,it.b)} (총 ${rangeLogs.length}건)`),
                el("div", { class:"calModalList2" },
                  ...rangeLogs.map(l=>el("div", { class:"calModalItem2" },
                    el("div", { class:"calModalLine1_2" },
                      el("div", { class:`calPill2 ${l.status==="approved"?"ok":"wait"}` }, l.status==="approved"?"승인":"제출"),
                      el("div", { class:"calModalMeta2" }, `${l.date} · ${l.category||"-"} / ${l.process||"-"} · ${Number(l.hours||0)}시간`)
                    ),
                    el("div", { class:"calModalContent2" }, (l.content||"").trim() || "(내용 없음)")
                  ))
                )
              )
            );
          }
        }, el("span", { class:"t" }, projName(it.pid)))
      );
      mark(occ, it.colStart, it.colEnd);

      lanes.push({ node: laneNode, occ });
    }
  }

  // weekBlock 안에 레인들을 위에서부터 쌓기
  // (레이아웃 맞추기 위해 weekBlock에 7칸짜리 dummy 행을 하나 둔 뒤, 그 위에 lane들을 stack)
  const stack = el("div", { style:"grid-column:1 / -1; display:flex; flex-direction:column; gap:6px; padding:0 10px;" },
    ...lanes.map(x=>x.node)
  );

  // weekBlock은 7열 grid인데, stack을 전체폭으로
  weekBlock.appendChild(stack);

  // ✅ 실제 그리드 셀 높이/rowGap 기반으로 week 높이/간격을 1:1로 맞춤
const cells = Array.from(grid.querySelectorAll(".calCell2"));
const sampleIdx = w*7; // 이 주의 첫번째 셀
const sampleCell = cells[sampleIdx] || cells[0];

const gcs = getComputedStyle(grid);
const rowGap = __num(gcs.rowGap || gcs.gap);
const innerH = (overlay.__innerH != null) ? overlay.__innerH : (sampleCell ? sampleCell.offsetHeight : 120);
weekBlock.style.minHeight = `${innerH}px`;
weekBlock.style.marginBottom = `${rowGap}px`;
weekBlock.style.overflow = "hidden"; // ✅ 레인이 많아도 아래 주와 겹쳐 보이지 않게


overlay.appendChild(weekBlock);

}



    // 안내 문구
    calCard.appendChild(
      el("div", { class:"muted2", style:"padding:10px 0 0 0;" },
        "날짜 칸의 띠지를 클릭하면 해당 날짜의 업무일지 상세가 표시됩니다. (반려 제외, 제출/승인 포함)"
      )
    );
  }

    /***********************
 * ✅ Calendar Overlay Align Helpers
 ***********************/
function __num(v){ const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

function getOffsetTopWithin(parent, child){
  const pr = parent.getBoundingClientRect();
  const cr = child.getBoundingClientRect();
  return cr.top - pr.top;
}

// ✅ 날짜(일자) 영역 높이만큼 overlay를 아래로 내리기 위한 "셀 내부 top" 계산
function computeCellInnerMetrics(grid){
  const cell = grid?.querySelector(".calCell2.has:not(.muted)") || grid?.querySelector(".calCell2:not(.muted)");
  if (!cell) return { innerTop: 0, innerH: 0 };

  const dayTop = cell.querySelector(".calDayTop2");
  const cs = getComputedStyle(cell);

  const padTop = __num(cs.paddingTop);
  const padBottom = __num(cs.paddingBottom);
  const cellH = cell.offsetHeight;

  const dayH = dayTop ? dayTop.offsetHeight : 0;

  // 날짜줄 아래로 약간 여유
  const gap = 6;

  const innerTop = padTop + dayH + gap;
  const innerH = Math.max(0, cellH - innerTop - padBottom);

  return { innerTop, innerH };
}

function syncOverlayToGrid(wrap, dowRow, grid, overlay){
  if (!wrap || !dowRow || !grid || !overlay) return;

  wrap.style.position = "relative";

  overlay.style.position = "absolute";
  overlay.style.pointerEvents = "auto";

  // ✅ overlay 가로폭 = grid와 동일
  const gridRect = grid.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const leftInWrap = gridRect.left - wrapRect.left;

  overlay.style.left = `${leftInWrap}px`;
  overlay.style.width = `${grid.offsetWidth}px`;

  // ✅ overlay top = "grid top + (셀의 날짜영역 높이)"
  const gridTop = getOffsetTopWithin(wrap, grid);
  const { innerTop, innerH } = computeCellInnerMetrics(grid);

  overlay.__innerTop = innerTop;
  overlay.__innerH = innerH;

  overlay.style.top = `${gridTop + innerTop}px`;

  // grid 컬럼/갭 동기화
  const gcs = getComputedStyle(grid);
  overlay.__gridCols = gcs.gridTemplateColumns;
  overlay.__colGap   = gcs.columnGap || gcs.gap || "0px";
  overlay.__rowGap   = gcs.rowGap   || gcs.gap || "0px";
}


function attachOverlayResizeObserver(wrap, dowRow, grid, overlay, rerenderOverlays){
  // rerender() 전체를 다시 돌리면 비용이 커서, overlay 위치만 맞추고 lanes만 재계산하도록 훅 제공
  // (여기서는 가장 안전하게 rerenderOverlays()를 호출하도록 해둠)
  try{
    if (overlay.__ro) return;
    overlay.__ro = new ResizeObserver(() => {
      syncOverlayToGrid(wrap, dowRow, grid, overlay);
      if (typeof rerenderOverlays === "function") rerenderOverlays();
    });
    overlay.__ro.observe(wrap);
    overlay.__ro.observe(dowRow);
    overlay.__ro.observe(grid);
  }catch{
    window.addEventListener("resize", () => {
      syncOverlayToGrid(wrap, dowRow, grid, overlay);
      if (typeof rerenderOverlays === "function") rerenderOverlays();
    });
  }
}


  rerender();
}


  /* =========================
 * 4) 납품 권한/파일 공통 헬퍼 + 뷰 2개 구현
 *  - 위치: 기존 뷰들(viewLog/viewApprove/...) 근처 아무 곳(추천: viewWorkCalendar 아래)
 * ========================= */

/* ---- 권한 규칙 ----
0) 팀장(leader) 및 실장 이상(manager/director/vp/svp/ceo)은 승인 없이 열람 가능
1) 사원(staff)은 실장(manager) 승인 시 "당일 1일" 열람 가능
*/
function canViewDeliveryWithoutApproval(user){
  const r = user?.role || "staff";
  if (r === "leader") return true;
  return roleRank(r) >= roleRank("manager");
}
function hasTodayDeliveryGrant(db, userId){
  const today = todayISO();
  db.deliveryAccess = Array.isArray(db.deliveryAccess) ? db.deliveryAccess : [];
  return db.deliveryAccess.some(g => g.userId === userId && g.date === today);
}
function ensureDeliveryShapes(db){
  if (!Array.isArray(db.deliveryFiles)) db.deliveryFiles = [];
  if (!Array.isArray(db.deliveryAccess)) db.deliveryAccess = [];
  if (!Array.isArray(db.deliveryAccessRequests)) db.deliveryAccessRequests = [];
}

function projLabel(db, projectId){
  const p = projById(db, projectId);
  if (!p) return projectId || "-";
  const code = p.projectCode || p.projectId || "";
  const name = p.projectName || "";
  return `${code} (${name})`.trim();
}

function openProjectSearchPicker(db, onPick){
  const items = (db.projects||[]).map(p => ({
    value: p.projectId,
    label: projLabel(db, p.projectId)
  }));
  if (!items.length){
    toast("등록된 프로젝트가 없습니다.");
    return;
  }
  openPickerWindow({
    title: "프로젝트 검색",
    items,
    placeholder: "코드/명칭 검색",
    onPick:(value, label)=> onPick?.(value, label)
  });
}

function downloadDataUrl(filename, dataUrl){
  try{
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch{
    toast("다운로드에 실패했습니다.");
  }
}

/* =========================
 * (A) 납품 프로젝트 관리 (열람/다운로드 + 권한요청/승인)
 * ========================= */
function viewDeliveryManage(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("업무관리 · 납품 프로젝트 관리");

  ensureDeliveryShapes(db);

  const uid = getUserId(db);
  const me = userById(db, uid);

  const isManagerPlus = roleRank(me?.role || "staff") >= roleRank("manager");
  const canBypass = canViewDeliveryWithoutApproval(me);
  const grantedToday = hasTodayDeliveryGrant(db, uid);
  const canView = canBypass || grantedToday;

  // ---- 상단 안내/권한 ----
  const info = el("div", { class:"card2", style:"padding:12px 14px;margin-bottom:12px;" },
    el("div", { style:"font-weight:1100;" }, "열람/다운로드"),
    el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:6px;line-height:1.5;" },
      "권한 규칙: 팀장 및 실장 이상은 즉시 열람 가능. 사원은 실장 승인 시 당일 1일 열람 가능."
    )
  );

  // ---- 권한 요청 UI (사원 전용) ----
  const needApproval = (!canBypass && !grantedToday);
  if (needApproval){
    const alreadyReq = (db.deliveryAccessRequests||[]).some(r => r.userId === uid && r.date === todayISO());

    const reqBtn = el("button", {
      class:"btn2 primary2",
      onclick:()=>{
        if (alreadyReq) return toast("오늘 권한 요청이 이미 접수되었습니다.");
        db.deliveryAccessRequests.unshift({
          reqId: uuid(),
          userId: uid,
          date: todayISO(),
          requestedAt: nowISO(),
          status: "pending",
          decidedBy: "",
          decidedAt: ""
        });
        saveDB(db);
        toast("권한 요청이 접수되었습니다. (실장 승인 필요)");
        render();
      }
    }, alreadyReq ? "권한 요청(접수됨)" : "실장에게 권한 요청");

    info.appendChild(
      el("div", { style:"margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;" },
        reqBtn,
        el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" },
          "※ 승인되면 오늘 하루 열람 가능합니다."
        )
      )
    );
  } else {
    info.appendChild(
      el("div", { style:"margin-top:10px;color:var(--muted);font-size:12px;font-weight:900;" },
        canBypass ? "현재 권한: 즉시 열람 가능" : "현재 권한: 오늘자 열람 승인됨"
      )
    );
  }

  // ---- 실장 승인 패널 (실장 이상이면 언제든 표시) ----
  let approvePanel = null;
  if (isManagerPlus){
    const pend = (db.deliveryAccessRequests||[])
      .filter(r => r.status === "pending" && r.date === todayISO())
      .slice(0, 50);

    const rows = pend.map(r=>{
      const u = userById(db, r.userId);
      const name = u?.name || r.userId;
      const role = ROLE_LABEL_KO[u?.role || "staff"] || (u?.role || "-");

      const okBtn = el("button", {
        class:"btn2 primary2",
        onclick:()=>{
          r.status = "approved";
          r.decidedBy = uid;
          r.decidedAt = nowISO();

          const today = todayISO();
          db.deliveryAccess = Array.isArray(db.deliveryAccess) ? db.deliveryAccess : [];
          const exists = db.deliveryAccess.find(g => g.userId === r.userId && g.date === today);
          if (!exists){
            db.deliveryAccess.unshift({
              grantId: uuid(),
              userId: r.userId,
              date: today,
              approvedBy: uid,
              approvedAt: nowISO()
            });
          }

          saveDB(db);
          toast("권한 승인 완료");
          render();
        }
      }, "승인");

      const noBtn = el("button", {
        class:"btn2 ghost2",
        onclick:()=>{
          r.status = "rejected";
          r.decidedBy = uid;
          r.decidedAt = nowISO();
          saveDB(db);
          toast("권한 반려 처리");
          render();
        }
      }, "반려");

      return el("div", { class:"boardRow2" },
        el("div", { class:"boardTitle2" }, `${name} (${role})`),
        el("div", { class:"boardMeta2" }, `${r.date} · 요청: ${r.requestedAt || "-"}`),
        el("div", { style:"display:flex;justify-content:flex-end;gap:8px;" }, noBtn, okBtn)
      );
    });

    approvePanel = el("div", { class:"card2", style:"padding:12px 14px;margin-bottom:12px;" },
      el("div", { style:"font-weight:1100;margin-bottom:8px;" }, "실장 승인(오늘 요청)"),
      pend.length
        ? el("div", { class:"boardList2" }, ...rows)
        : el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, "오늘 접수된 권한 요청이 없습니다.")
    );
  }

  // ---- 본문: 프로젝트 선택 + 납품파일 선택 + 다운로드 ----
  let selectedProjectId = "";
  let selectedDeliveryId = "";

  const projectBox = el("input", {
    class:"btn2",
    type:"text",
    value:"",
    placeholder:"프로젝트 선택(클릭)",
    readonly:"readonly",
    style:"cursor:pointer;"
  });

  const deliveryBox = el("input", {
    class:"btn2",
    type:"text",
    value:"",
    placeholder:"납품자료 선택(프로젝트 선택 후 클릭)",
    readonly:"readonly",
    style:"cursor:pointer;"
  });

  const dlBtn = el("button", { class:"btn2 primary2", disabled:"disabled" }, "다운로드받기");

  function updateDlBtn(){
    if (!selectedDeliveryId){
      dlBtn.setAttribute("disabled","disabled");
    } else {
      dlBtn.removeAttribute("disabled");
    }
  }

  function openDeliveryPicker(){
    if (!selectedProjectId) return toast("먼저 프로젝트를 선택하세요.");
    if (!canView) return toast("열람 권한이 없습니다. 실장 승인 후 이용 가능합니다.");

    const list = (db.deliveryFiles||[])
      .filter(f => f.projectId === selectedProjectId)
      .slice()
      .sort((a,b)=>(b.uploadedAt||"").localeCompare(a.uploadedAt||""));

    if (!list.length){
      toast("해당 프로젝트의 납품자료가 없습니다.");
      return;
    }

    const body = el("div", { style:"display:flex;flex-direction:column;gap:10px;min-width:320px;max-width:720px;" });

    const rows = el("div", { class:"boardList2" },
      ...list.map(f=>{
        const dt = (f.uploadedAt || "").slice(0,10) || "-";
        const label = `${dt} · ${f.deliveryNo || "-"}차 · ${f.originalName || f.name || "파일"}`;

        return el("button", {
          class:"btn2",
          style:"text-align:left;justify-content:flex-start;",
          onclick:()=>{
            selectedDeliveryId = f.deliveryId || f.fileId || f.id || "";
            deliveryBox.value = label;
            updateDlBtn();
            modalClose();
            toast("납품자료를 선택했습니다.");
          }
        }, label);
      })
    );

    body.appendChild(
      el("div", { style:"font-weight:1100;" }, "납품자료 선택")
    );
    body.appendChild(
      el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" },
        "목록에서 파일을 선택하면 다운로드 버튼이 활성화됩니다."
      )
    );
    body.appendChild(rows);

    modalOpen("납품자료 선택", body);
  }

  projectBox.addEventListener("click", ()=>{
    openProjectSearchPicker(db, (pid, label)=>{
      selectedProjectId = pid;
      projectBox.value = label || projLabel(db, pid);

      // 선택 초기화
      selectedDeliveryId = "";
      deliveryBox.value = "";
      updateDlBtn();
    });
  });

  deliveryBox.addEventListener("click", openDeliveryPicker);

  dlBtn.addEventListener("click", ()=>{
    if (!selectedProjectId) return toast("프로젝트를 먼저 선택하세요.");
    if (!selectedDeliveryId) return toast("납품자료를 선택하세요.");
    if (!canView) return toast("열람 권한이 없습니다. 실장 승인 후 이용 가능합니다.");

    const file = (db.deliveryFiles||[]).find(f =>
      (f.deliveryId && f.deliveryId === selectedDeliveryId) ||
      (f.fileId && f.fileId === selectedDeliveryId) ||
      (f.id && f.id === selectedDeliveryId)
    );
    if (!file) return toast("파일 정보를 찾을 수 없습니다.");

    const dataUrl = file.dataUrl || file.url || "";
    if (!dataUrl || !String(dataUrl).startsWith("data:")){
      return toast("파일 데이터가 없습니다. (업로드 화면에서 다시 업로드 필요)");
    }

    const fname = (file.originalName || file.name || `delivery_${selectedDeliveryId}`).replace(/[\\/:*?"<>|]/g, "_");
    downloadDataUrl(fname, dataUrl);
  });

  // ---- 최근 업로드 목록(열람 가능 시) ----
  const recent = (db.deliveryFiles||[])
    .slice()
    .sort((a,b)=>(b.uploadedAt||"").localeCompare(a.uploadedAt||""))
    .slice(0, 20);

  const recentList = el("div", { class:"card2", style:"padding:12px 14px;margin-top:12px;" },
    el("div", { style:"font-weight:1100;margin-bottom:8px;" }, "최근 업로드(최대 20건)"),
    recent.length
      ? el("div", { class:"boardList2" },
          ...recent.map(f=>{
            const pLabel = projLabel(db, f.projectId);
            const dt = (f.uploadedAt || "").slice(0,10) || "-";
            const title = `${dt} · ${f.deliveryNo || "-"}차 · ${f.originalName || f.name || "파일"}`;

            const pickBtn = el("button", {
              class:"btn2 ghost2",
              onclick:()=>{
                if (!canView) return toast("열람 권한이 없습니다. 실장 승인 후 이용 가능합니다.");

                selectedProjectId = f.projectId || "";
                projectBox.value = pLabel;

                selectedDeliveryId = f.deliveryId || f.fileId || f.id || "";
                deliveryBox.value = title;

                updateDlBtn();
                toast("선택값을 반영했습니다.");
              }
            }, "선택");

            return el("div", { class:"boardRow2" },
              el("div", { class:"boardTitle2" }, title),
              el("div", { class:"boardMeta2" }, `${pLabel}`),
              el("div", { style:"display:flex;justify-content:flex-end;" }, pickBtn)
            );
          })
        )
      : el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, "업로드된 납품자료가 없습니다.")
  );

  const bodyCard = el("div", { class:"card2", style:"padding:12px 14px;" },
    el("div", { style:"font-weight:1100;margin-bottom:10px;" }, "프로젝트/납품자료 선택"),
    el("div", { style:"display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px;" },
      projectBox,
      deliveryBox
    ),
    el("div", { style:"display:flex;justify-content:flex-end;gap:10px;" },
      dlBtn
    ),
    el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:10px;line-height:1.5;" },
      canView
        ? "열람 가능 상태입니다. 프로젝트 → 납품자료 선택 후 다운로드하세요."
        : "열람 불가 상태입니다. (사원은 실장 승인 필요)"
    )
  );

  view.appendChild(info);
  if (approvePanel) view.appendChild(approvePanel);
  view.appendChild(bodyCard);
  view.appendChild(recentList);

  updateDlBtn();
}


/* =========================
 * (B) 납품자료 업로드
 *  - 로컬저장(localStorage) 기반: dataUrl 저장
 *  - 용량 제한(브라우저 저장소) 있음
 * ========================= */
function viewDeliveryUpload(db){
  const view = $("#view2");
  view.innerHTML = "";
  setRouteTitle("업무관리 · 납품자료 업로드");

  ensureDeliveryShapes(db);

  const uid = getUserId(db);
  const me = userById(db, uid);

  // 실장 이상만 업로드 허용 (원하면 leader 이상으로 완화 가능)
  const canUpload = roleRank(me?.role || "staff") >= roleRank("manager");

  const info = el("div", { class:"card2", style:"padding:12px 14px;margin-bottom:12px;" },
    el("div", { style:"font-weight:1100;" }, "납품자료 업로드"),
    el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:6px;line-height:1.5;" },
      "브라우저 로컬저장(localStorage)에 dataUrl로 저장됩니다. 파일이 크면 저장 실패/유실될 수 있습니다. (대용량은 서버/Drive 연동 권장)"
    ),
    el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;margin-top:6px;" },
      canUpload ? "업로드 권한: 가능" : "업로드 권한: 실장 이상만 가능"
    )
  );

  // -----------------------
  // state
  // -----------------------
  let selectedProjectId = "";
  let selectedProjectLabel = "";

  const projectBox = el("input", {
    class:"btn2",
    type:"text",
    value:"",
    placeholder:"프로젝트 선택(클릭)",
    readonly:"readonly",
    style:"cursor:pointer;"
  });

  const deliveryNoInput = el("input", {
    class:"btn2",
    type:"number",
    min:"1",
    step:"1",
    placeholder:"납품 차수 (예: 1, 2, 3...)",
    value:"1"
  });

  const memoInput = el("input", {
    class:"btn2",
    type:"text",
    placeholder:"메모(선택) 예: 구조 1차 납품",
    value:""
  });

  const fileInput = el("input", {
    class:"btn2",
    type:"file",
    accept:"*/*"
  });

  const uploadBtn = el("button", { class:"btn2 primary2", disabled:"disabled" }, "업로드");
  const resetBtn  = el("button", { class:"btn2 ghost2" }, "초기화");

  function updateUploadBtn(){
    const hasPid = !!selectedProjectId;
    const hasFile = !!(fileInput.files && fileInput.files[0]);
    if (canUpload && hasPid && hasFile){
      uploadBtn.removeAttribute("disabled");
    } else {
      uploadBtn.setAttribute("disabled","disabled");
    }
  }

  projectBox.addEventListener("click", ()=>{
    if (!(db.projects||[]).length) return toast("등록된 프로젝트가 없습니다.");
    openProjectSearchPicker(db, (pid, label)=>{
      selectedProjectId = pid;
      selectedProjectLabel = label || projLabel(db, pid);
      projectBox.value = selectedProjectLabel;
      updateUploadBtn();
    });
  });

  fileInput.addEventListener("change", updateUploadBtn);

  resetBtn.addEventListener("click", ()=>{
    selectedProjectId = "";
    selectedProjectLabel = "";
    projectBox.value = "";
    deliveryNoInput.value = "1";
    memoInput.value = "";
    fileInput.value = "";
    updateUploadBtn();
  });

  function readAsDataUrl(file){
    return new Promise((resolve, reject)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(String(fr.result || ""));
      fr.onerror = ()=> reject(new Error("FileReader error"));
      fr.readAsDataURL(file);
    });
  }

  uploadBtn.addEventListener("click", async ()=>{
    if (!canUpload) return toast("업로드 권한이 없습니다. (실장 이상)");
    if (!selectedProjectId) return toast("프로젝트를 선택하세요.");
    const f = fileInput.files && fileInput.files[0];
    if (!f) return toast("파일을 선택하세요.");

    // 용량 가드(로컬스토리지 한계 고려) - 필요 시 조정
    const MAX_MB = 8; // 보수적으로 8MB
    const sizeMb = (f.size || 0) / (1024*1024);
    if (sizeMb > MAX_MB){
      return toast(`파일이 너무 큽니다. (${sizeMb.toFixed(1)}MB) 로컬저장 한계로 업로드 불가`);
    }

    const deliveryNo = Math.max(1, Number(deliveryNoInput.value || 1));
    const memo = (memoInput.value || "").trim();

    let dataUrl = "";
    try{
      dataUrl = await readAsDataUrl(f);
    }catch{
      return toast("파일 읽기에 실패했습니다.");
    }

    const rec = {
      deliveryId: uuid(),
      projectId: selectedProjectId,
      deliveryNo,
      originalName: f.name || "file",
      mime: f.type || "",
      size: f.size || 0,
      dataUrl,                      // ✅ 다운로드용
      memo,
      uploadedBy: uid,
      uploadedByName: me?.name || "",
      uploadedAt: nowISO()
    };

    db.deliveryFiles = Array.isArray(db.deliveryFiles) ? db.deliveryFiles : [];
    db.deliveryFiles.unshift(rec);

    try{
      saveDB(db);
    }catch{
      // 저장 실패(용량 부족 등)
      // 방금 넣은 것 되돌림
      db.deliveryFiles = db.deliveryFiles.filter(x => x.deliveryId !== rec.deliveryId);
      return toast("저장공간 부족으로 업로드 실패 (파일 용량/개수 줄이기 필요)");
    }

    toast("업로드 완료");
    // 입력 리셋(프로젝트는 유지)
    fileInput.value = "";
    memoInput.value = "";
    updateUploadBtn();
    rerenderList();
  });

  const formCard = el("div", { class:"card2", style:"padding:12px 14px;" },
    el("div", { style:"font-weight:1100;margin-bottom:10px;" }, "업로드 입력"),
    el("div", { style:"display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px;" },
      projectBox,
      el("div", { style:"display:grid;grid-template-columns:180px 1fr;gap:10px;" },
        deliveryNoInput,
        memoInput
      ),
      fileInput
    ),
    el("div", { style:"display:flex;justify-content:flex-end;gap:10px;" },
      resetBtn,
      uploadBtn
    )
  );

  // -----------------------
  // list
  // -----------------------
  const listCard = el("div", { class:"card2", style:"padding:12px 14px;margin-top:12px;" });
  const listHost = el("div", { class:"boardList2" });

  function humanSize(bytes){
    const b = Number(bytes||0);
    if (b < 1024) return `${b}B`;
    const kb = b/1024;
    if (kb < 1024) return `${kb.toFixed(1)}KB`;
    const mb = kb/1024;
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    const gb = mb/1024;
    return `${gb.toFixed(2)}GB`;
  }

  function rerenderList(){
    listHost.innerHTML = "";

    const all = (db.deliveryFiles||[])
      .slice()
      .sort((a,b)=>(b.uploadedAt||"").localeCompare(a.uploadedAt||""))
      .slice(0, 50);

    if (!all.length){
      listHost.appendChild(
        el("div", { style:"color:var(--muted);font-size:12px;font-weight:900;" }, "업로드된 납품자료가 없습니다.")
      );
      return;
    }

    all.forEach(f=>{
      const pLabel = projLabel(db, f.projectId);
      const dt = (f.uploadedAt || "").slice(0,16) || "-";
      const title = `${dt} · ${f.deliveryNo || "-"}차 · ${f.originalName || f.name || "파일"}`;
      const meta = `${pLabel} · ${humanSize(f.size)} · 업로더: ${f.uploadedByName || userNameById(db, f.uploadedBy)}`;

      const delBtn = el("button", {
        class:"btn2 ghost2",
        onclick:()=>{
          if (!canUpload) return toast("삭제 권한이 없습니다. (실장 이상)");
          if (!confirm("이 납품자료를 삭제할까요?")) return;
          db.deliveryFiles = (db.deliveryFiles||[]).filter(x => x.deliveryId !== f.deliveryId);
          saveDB(db);
          toast("삭제 완료");
          rerenderList();
        }
      }, "삭제");

      const dlBtn = el("button", {
        class:"btn2 primary2",
        onclick:()=>{
          const dataUrl = f.dataUrl || "";
          if (!dataUrl || !String(dataUrl).startsWith("data:")) return toast("파일 데이터가 없습니다.");
          const fname = (f.originalName || `delivery_${f.deliveryId}`).replace(/[\\/:*?"<>|]/g, "_");
          downloadDataUrl(fname, dataUrl);
        }
      }, "다운로드");

      listHost.appendChild(
        el("div", { class:"boardRow2" },
          el("div", { class:"boardTitle2" }, title),
          el("div", { class:"boardMeta2" }, meta + (f.memo ? ` · 메모: ${f.memo}` : "")),
          el("div", { style:"display:flex;justify-content:flex-end;gap:8px;" }, dlBtn, delBtn)
        )
      );
    });
  }

  listCard.appendChild(el("div", { style:"font-weight:1100;margin-bottom:8px;" }, "최근 업로드(최대 50건)"));
  listCard.appendChild(listHost);

  view.appendChild(info);
  view.appendChild(formCard);
  view.appendChild(listCard);

  updateUploadBtn();
  rerenderList();
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



  /********************************
 * ✅ CHECKLIST (프로젝트별/목록) PATCH
 ********************************/

function seedSampleProjectsIfEmpty(db){
  if (Array.isArray(db.projects) && db.projects.length) return;

  db.projects = [];
  for (let i = 1; i <= 36; i++){
    const no = String(i).padStart(2, "0");
    const id = `20250${no}`; // 2025001~2025036
    db.projects.push({ id, name: `${id} (샘플 프로젝트 ${no})` });
  }
}

function ensureChecklistStore(db){
  if (!Array.isArray(db.checklists)) db.checklists = [];
}

function uid(prefix="cl"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowISO(){
  return new Date().toISOString();
}

function getProjectOptions(db){
  seedSampleProjectsIfEmpty(db);
  return (db.projects || []).map(p => ({ id: p.id, name: p.name || p.id }));
}

// staff 옵션: db.users가 있으면 staff만, 없으면 현재 로그인 사용자만이라도 표시
function getStaffOptions(db){
  const users = Array.isArray(db.users) ? db.users : [];
  const staff = users
    .filter(u => (u.role || "").toLowerCase().includes("staff") || (u.position || "").includes("사원") || (u.type || "") === "staff")
    .map(u => ({
      id: u.id || u.uid || u.email || u.name,
      name: u.name || u.displayName || u.id || "staff"
    }));

  if (staff.length) return staff;

  // fallback (기존 코드에 getUserId/getUserName이 있으면 그걸 쓰고, 없으면 placeholder)
  let meId = "me";
  let meName = "작업자A (staff)";
  try{
    if (typeof getUserId === "function") meId = getUserId(db) || meId;
    if (typeof getUserName === "function") meName = getUserName(db) || meName;
  }catch(e){}

  return [{ id: meId, name: meName }];
}

function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// 공통: 체크리스트 리스트 렌더 (mode = "embedded" | "full")
function renderChecklistListUI(db, { projectId, mode }){
  ensureChecklistStore(db);

  const wrap = el("div", { class:"card" });
  wrap.appendChild(
    el("div", { class:"card-head", style:"display:flex;align-items:center;justify-content:space-between;gap:12px;" },
      el("div", { class:"card-title" }, mode === "full" ? "체크리스트 목록(프로젝트별)" : "체크리스트 목록"),
      el("div", { class:"muted", style:"font-weight:800;" }, mode === "full" ? "" : "Leader+ 관리 화면")
    )
  );

  const listHost = el("div", { class:"stack", style:"margin-top:10px;" });

  function rerender(){
    listHost.innerHTML = "";

    const rows = db.checklists
      .filter(x => !projectId || x.projectId === projectId)
      .sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    if (!rows.length){
      listHost.appendChild(
        el("div", { class:"empty", style:"padding:14px;border:1px dashed rgba(0,0,0,.15);border-radius:14px;text-align:center;" },
          "체크리스트 항목이 없습니다."
        )
      );
      return;
    }

    rows.forEach(item => {
      const meta = el("div", { class:"muted", style:"font-size:12px;" },
        `${item.projectName || item.projectId || ""} · ${item.staffName || ""} · ${item.createdAt ? item.createdAt.slice(0,10) : ""}`
      );

      const title = el("div", { style:"font-weight:1000;" }, item.title || "(제목 없음)");
      const desc = item.desc ? el("div", { class:"muted", style:"margin-top:6px;" }, item.desc) : null;

      const btnDel = el("button", { class:"btn", type:"button" }, "삭제");
      btnDel.onclick = () => {
        if (!confirm("해당 체크리스트를 삭제할까요?")) return;
        db.checklists = db.checklists.filter(x => x.id !== item.id);
        if (typeof saveDB === "function") saveDB(db);
        rerender();
      };

      const btnToggle = el("button", { class:"btn", type:"button" }, item.done ? "완료해제" : "완료");
      btnToggle.onclick = () => {
        item.done = !item.done;
        item.doneAt = item.done ? nowISO() : null;
        if (typeof saveDB === "function") saveDB(db);
        rerender();
      };

      const right = el("div", { style:"display:flex;gap:8px;align-items:center;" }, btnToggle, btnDel);

      const row = el("div", {
        class:"card",
        style:"padding:12px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:rgba(255,255,255,.86);"
      });

      const head = el("div", { style:"display:flex;justify-content:space-between;gap:10px;align-items:flex-start;" },
        el("div", {}, title, meta),
        right
      );

      row.appendChild(head);
      if (desc) row.appendChild(desc);

      if (item.imageDataUrl){
        const img = el("img", {
          src: item.imageDataUrl,
          style:"margin-top:10px;max-width:420px;width:100%;border-radius:12px;border:1px solid rgba(0,0,0,.08);"
        });
        row.appendChild(img);
      }

      listHost.appendChild(row);
    });
  }

  wrap.appendChild(listHost);
  rerender();
  return wrap;
}

/**
 * ✅ 프로젝트별 체크리스트 화면
 * - 상단: 체크리스트 작성
 * - 하단: 체크리스트 목록(해당 프로젝트)
 */
function viewProjectChecklist(db){
  const view = $("#view");
  view.innerHTML = "";
  if (typeof setRouteTitle === "function") setRouteTitle("업무관리 · 프로젝트별 체크리스트");

  seedSampleProjectsIfEmpty(db);
  ensureChecklistStore(db);

  const projects = getProjectOptions(db);
  const staff = getStaffOptions(db);

  // 기본 프로젝트 선택값 (db.uiState에 저장)
  if (!db.uiState) db.uiState = {};
  if (!db.uiState.selectedProjectId) db.uiState.selectedProjectId = projects[0]?.id || "";
  const selectedProjectId = db.uiState.selectedProjectId;

  const projectSel = el("select", { class:"input", style:"width:100%;" });
  projects.forEach(p => {
    const opt = el("option", { value:p.id }, p.name);
    if (p.id === selectedProjectId) opt.selected = true;
    projectSel.appendChild(opt);
  });

  const staffSel = el("select", { class:"input", style:"width:100%;" });
  staff.forEach(s => {
    staffSel.appendChild(el("option", { value:s.id }, s.name));
  });

  const titleInput = el("input", { class:"input", placeholder:"체크리스트 제목(예: H10 → H13 변경)", style:"width:100%;" });
  const descInput = el("textarea", { class:"input", placeholder:"설명(선택)", style:"width:100%;min-height:88px;resize:vertical;" });

  const fileInput = el("input", { type:"file", accept:"image/*" });

  const btnAdd = el("button", { class:"btn", type:"button" }, "새 항목 추가");
  btnAdd.style.cssText = "border-radius:999px;font-weight:1000;padding:10px 14px;";

  // 작성 카드
  const formCard = el("div", { class:"card" },
    el("div", { class:"card-head" },
      el("div", { class:"card-title" }, "체크리스트 작성")
    ),

    el("div", { class:"grid", style:"display:grid;grid-template-columns:1.3fr .9fr;gap:16px;" },

      // 좌측(제목/설명)
      el("div", { class:"stack", style:"display:flex;flex-direction:column;gap:10px;" },
        el("div", { class:"muted", style:"font-size:12px;font-weight:900;" }, "제목"),
        titleInput,
        el("div", { class:"muted", style:"font-size:12px;font-weight:900;margin-top:4px;" }, "설명(선택)"),
        descInput
      ),

      // 우측(프로젝트/담당자/이미지)
      el("div", { class:"stack", style:"display:flex;flex-direction:column;gap:10px;" },
        el("div", { class:"muted", style:"font-size:12px;font-weight:900;" }, "프로젝트"),
        projectSel,
        el("div", { class:"muted", style:"font-size:12px;font-weight:900;margin-top:4px;" }, "담당자(staff)"),
        staffSel,
        el("div", { class:"muted", style:"font-size:12px;font-weight:900;margin-top:4px;" }, "이미지 첨부(선택)"),
        el("div", { style:"display:flex;gap:10px;align-items:center;" },
          el("label", { class:"btn", style:"cursor:pointer;" },
            "파일 선택",
            fileInput
          ),
          el("div", { class:"muted", id:"clFileName", style:"font-size:12px;" }, "선택된 파일 없음")
        ),
        el("div", { style:"display:flex;justify-content:flex-end;margin-top:6px;" }, btnAdd)
      )
    )
  );

  fileInput.onchange = () => {
    const label = $("#clFileName");
    if (!label) return;
    label.textContent = fileInput.files?.[0]?.name || "선택된 파일 없음";
  };

  // 하단 목록(프로젝트 필터)
  const listCardHost = el("div", { style:"margin-top:14px;" });
  function rerenderList(){
    // 선택값 저장
    db.uiState.selectedProjectId = projectSel.value;
    if (typeof saveDB === "function") saveDB(db);

    listCardHost.innerHTML = "";
    listCardHost.appendChild(renderChecklistListUI(db, { projectId: projectSel.value, mode:"embedded" }));
  }

  projectSel.onchange = rerenderList;

  btnAdd.onclick = async () => {
    const pid = projectSel.value;
    const pObj = projects.find(p => p.id === pid);

    const staffId = staffSel.value;
    const staffObj = staff.find(s => s.id === staffId);

    const title = (titleInput.value || "").trim();
    const desc = (descInput.value || "").trim();

    if (!pid){
      alert("프로젝트를 선택하세요.");
      return;
    }
    if (!title){
      alert("제목을 입력하세요.");
      titleInput.focus();
      return;
    }

    let imageDataUrl = "";
    const file = fileInput.files?.[0];
    if (file){
      try{
        imageDataUrl = await readFileAsDataURL(file);
      }catch(e){
        console.warn(e);
        alert("이미지 읽기 실패");
        return;
      }
    }

    const item = {
      id: uid("cl"),
      projectId: pid,
      projectName: pObj?.name || pid,
      staffId,
      staffName: staffObj?.name || staffId || "",
      title,
      desc,
      imageDataUrl,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      done: false,
      doneAt: null
    };

    db.checklists.unshift(item);
    if (typeof saveDB === "function") saveDB(db);

    // reset input
    titleInput.value = "";
    descInput.value = "";
    fileInput.value = "";
    const label = $("#clFileName");
    if (label) label.textContent = "선택된 파일 없음";

    rerenderList();
  };

  view.appendChild(formCard);
  view.appendChild(listCardHost);
  rerenderList();
}

/**
 * ✅ 체크리스트 목록(프로젝트별) 화면
 * - 목록만 표시 + 프로젝트 드롭다운
 */
function viewChecklistList(db){
  const view = $("#view");
  view.innerHTML = "";
  if (typeof setRouteTitle === "function") setRouteTitle("업무관리 · 체크리스트 목록");

  seedSampleProjectsIfEmpty(db);
  ensureChecklistStore(db);
  if (!db.uiState) db.uiState = {};

  const projects = getProjectOptions(db);

  const projectSel = el("select", { class:"input", style:"width:100%;max-width:520px;" });
  projects.forEach(p => {
    const opt = el("option", { value:p.id }, p.name);
    if (p.id === (db.uiState.selectedProjectId || projects[0]?.id)) opt.selected = true;
    projectSel.appendChild(opt);
  });

  const topRow = el("div", { style:"display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:10px;" },
    el("div", { class:"muted", style:"font-weight:900;font-size:12px;" }, "프로젝트"),
    projectSel
  );

  const host = el("div", {});
  function rerender(){
    db.uiState.selectedProjectId = projectSel.value;
    if (typeof saveDB === "function") saveDB(db);
    host.innerHTML = "";
    host.appendChild(renderChecklistListUI(db, { projectId: projectSel.value, mode:"full" }));
  }

  projectSel.onchange = rerender;

  view.appendChild(topRow);
  view.appendChild(host);
  rerender();
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

  /* =========================
 * 5) Router에 2개 route 연결
 *  - 위치: renderView(db) 내부 "업무관리" 섹션
 * ========================= */
function renderView(db){
  const key = parseHash();

  // 홈
  if (key === "home") return viewHome(db);

  // 업무관리
  if (key === "work-project") return viewProjectEditor(db);
  if (key === "work-pm") return viewPMAssign(db);
  if (key === "work-standards") return viewBoard(db, "work-standards", "업무관리 · 건설사별 기준서");
  if (key === "work-log") return viewLog(db);
  if (key === "work-approve") return viewApprove(db);
  if (key === "work-time") return viewDashboard(db);
  if (key === "work-schedule") return viewWorkCalendar(db);

  /* ✅ [ADD] */
  if (key === "work-delivery") return viewDeliveryManage(db);
  if (key === "work-delivery-upload") return viewDeliveryUpload(db);

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
const myRole = me?.role || "staff";


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
    // ✅ 모달을 body 직속으로 강제 이동 (stacking context 문제 원천 차단)
    const modal = $("#modal2");
    if (modal && modal.parentElement !== document.body){
      document.body.appendChild(modal);
    }

    

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
