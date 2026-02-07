/* app2.js (업무관리 대시보드 = 이미지 구성 "홈" 추가) */
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
      // 신규 필드 방어(기존 데이터 깨지지 않게)
      if (!Array.isArray(db.sharedFiles)) db.sharedFiles = [];
      if (!Array.isArray(db.tasks)) db.tasks = [];
      if (!Array.isArray(db.messages)) db.messages = [];
      if (!Array.isArray(db.approvals)) db.approvals = []; // (필요 시 확장)
      return db;
    }

    const seed = {
      meta:{ version:"0.5", createdAt: nowISO() },
      users: [{ userId:"u_staff_1", name:"작업자A", role:"staff" }],
      projects: [{ projectId:"2025001", projectCode:"2025001", projectName:"(샘플)프로젝트", startDate:"", endDate:"" }],
      logs: [],
      checklists: [],
      // 홈 대시보드용
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
      messages: []
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
   * Routes (업무관리 전용)
   ***********************/
  const SIDE2 = [
    { key:"home",           label:"대시보드" },          // ✅ 추가(이미지 구성)
    { key:"log",            label:"업무일지" },
    { key:"approve",        label:"승인" },
    { key:"dashboard",      label:"프로젝트 소요시간" },
    { key:"calendar",       label:"종합 공정관리" },
    { key:"checklist",      label:"프로젝트별 체크리스트" },
    { key:"checklist-view", label:"체크리스트 목록" }
  ];

  function parseHash(){
    const raw = (location.hash || "").replace(/^#/, "");
    const key = decodeURIComponent(raw || "home");
    return SIDE2.some(x=>x.key===key) ? key : "home";
  }
  function setHash(key){ location.hash = `#${encodeURIComponent(key)}`; }

  function setRouteTitle(text){
    const t = $("#routeTitle2");
    if (t) t.textContent = text || "";
  }

  function allowedWorkRoutesFor(user){
    // staff도 홈은 사용 가능
    if (isStaff(user)) return new Set(["home","log","checklist-view"]);
    return new Set(["home","log","approve","dashboard","calendar","checklist","checklist-view"]);
  }

  function renderSide2(db){
    const host = $("#sideMenu2");
    host.innerHTML = "";
    const cur = parseHash();
    const me = userById(db, getUserId(db));
    const allowed = allowedWorkRoutesFor(me);

    SIDE2.forEach(m=>{
      if (!allowed.has(m.key)) return;
      host.appendChild(
        el("button", {
          class:`sideItem2 ${cur===m.key ? "active" : ""}`,
          onclick:()=> setHash(m.key)
        }, m.label)
      );
    });
  }

  /***********************
   * Aggregations
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
      map[k] = (map[k]||0) + (Number(l.ratio)||0);
    }
    return map;
  }

  /***********************
   * Control builders
   ***********************/
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

  /***********************
   * Home (대시보드) - 이미지 구성
   ***********************/
  function computeKpis(db){
    const today = todayISO();
    const logs = Array.isArray(db.logs) ? db.logs : [];
    const approvalsWait = logs.filter(l => l.status === "submitted").length;

    const todayMy = logs.filter(l => l.date === today).length;
    const inProgress = logs.filter(l => (l.status === "submitted" || l.status === "approved")).length;

    const unread = Array.isArray(db.messages) ? db.messages.filter(m => m.read !== true).length : 0;

    // 진행률(%) 예시: 승인 대기/전체 비율 (표시용)
    const progressRate = inProgress ? Math.round((logs.filter(l=>l.status==="approved").length / inProgress) * 100) : 0;

    return {
      todayMy,
      inProgress,
      unread,
      approvalsWait,
      progressRate
    };
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
    setRouteTitle("업무관리 · 대시보드");

    const k = computeKpis(db);

    // KPI row
    const kpiGrid = el("div", { class:"kpiGrid" },
      kpiCard("오늘 업무일지", k.todayMy, ""),
      kpiCard("진행 중 업무", k.inProgress, `${k.progressRate}%`),
      kpiCard("미확인 메시지", k.unread, ""),
      kpiCard("대기 결재", k.approvalsWait, "")
    );

    // 작업 파일 공유
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

    // 개별 진행 상황
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
   * VIEWS (기존)
   ***********************/
  function makeEmptyEntry(db){
    const p = db.projects?.[0]?.projectId || "";
    return { projectId: p, category:"구조", process: PROCESS_MASTER["구조"][0], ratio:50, content:"" };
  }

  function viewLog(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("업무일지");

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

      const ratio = el("input", {
        class:"btn2",
        type:"number", min:"0", max:"100", step:"1",
        value: ent.ratio,
        oninput:(e)=> ent.ratio = clamp(Number(e.target.value||0),0,100)
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
          el("div", { style:"font-weight:1000;" }, `업무 항목 ${idx+1}`),
          delBtn
        ),
        el("div", { style:"display:grid;grid-template-columns:1fr 160px;gap:10px;margin-bottom:10px;" },
          projectSel, ratio
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
          if (!(e.ratio>=0 && e.ratio<=100)) return toast(`업무 항목 ${i+1}: 업무비율(0~100)을 입력해 주세요.`);
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
            ratio: Number(e.ratio)||0,
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
          el("div", { style:"font-weight:1000;" }, "업무일지 작성"),
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
    setRouteTitle("승인");

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
            el("div", { style:"font-weight:1000;" }, `${p?.projectName||"프로젝트"} · ${l.category}/${l.process} · ${l.ratio}%`),
            el("div", { style:"color:var(--muted);font-size:12px;margin-top:4px;" }, l.content)
          );
        })
      );

      view.appendChild(
        el("div", { class:"card2", style:"padding:12px 14px;" },
          el("div", { style:"display:flex;justify-content:space-between;align-items:center;gap:10px;" },
            el("div", { style:"font-weight:1000;" }, `승인 대기: ${writer?.name||"작성자"} · ${date} (${arr.length}건)`),
            el("div", { style:"display:flex;gap:8px;" }, rejectBtn, approveBtn)
          ),
          list
        )
      );
    }
  }

  function viewDashboard(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("프로젝트 소요시간");

    const projects = db.projects || [];
    const stats = projects.map(p=>{
      const days = computeProjectDays(db, p.projectId);
      const headcount = computeProjectHeadcount(db, p.projectId);
      const approvedEntries = (db.logs||[]).filter(l=>l.status==="approved" && l.projectId===p.projectId).length;
      return { ...p, days, headcount, approvedEntries };
    });

    if (!stats.length){
      view.appendChild(el("div", { class:"card2", style:"padding:14px;" }, "프로젝트가 없습니다."));
      return;
    }

    let selected = stats[0].projectId;
    const sp = projById(db, selected);

    const breakdown = computeProjectBreakdown(db, selected);
    const rows = Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).slice(0, 12);

    view.appendChild(
      el("div", { class:"card2", style:"padding:12px 14px;" },
        el("div", { style:"font-weight:1000;margin-bottom:10px;" }, `Selected: ${sp?.projectName||"-"}`),
        rows.length ? el("div", { style:"display:flex;flex-direction:column;gap:8px;" },
          ...rows.map(([k,v])=>{
            const [cat, proc] = k.split("||");
            return el("div", { style:"border:1px solid var(--line);border-radius:12px;padding:10px;" },
              el("div", { style:"font-weight:1000;" }, `${cat} · ${proc}`),
              el("div", { style:"color:var(--muted);font-size:12px;margin-top:4px;" }, `${v}%`)
            );
          })
        ) : el("div", { style:"color:var(--muted);" }, "승인된 업무일지가 없습니다.")
      )
    );
  }

  function viewWorkCalendar(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("종합 공정관리");
    view.appendChild(
      el("div", { class:"card2", style:"padding:14px;" },
        el("div", { style:"font-weight:1000;margin-bottom:6px;" }, "캘린더(placeholder)"),
        el("div", { style:"color:var(--muted);font-size:12px;" }, "요청 시 캘린더 UI 전체를 이 파일로 이관해 동일 구성으로 확장합니다.")
      )
    );
  }

  function viewChecklist(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("프로젝트별 체크리스트");

    const uid = getUserId(db);
    const me = userById(db, uid);
    if (!isLeaderPlus(me)){
      setHash("checklist-view");
      return;
    }

    db.checklists = Array.isArray(db.checklists) ? db.checklists : [];
    view.appendChild(
      el("div", { class:"card2", style:"padding:14px;" },
        el("div", { style:"font-weight:1000;margin-bottom:6px;" }, "체크리스트(Leader+ 작성)"),
        el("div", { style:"color:var(--muted);font-size:12px;" }, "필요 시 기존 체크리스트 로직을 그대로 이관해 동일 기능으로 맞춥니다.")
      )
    );
  }

  function viewChecklistView(db){
    const view = $("#view2");
    view.innerHTML = "";
    setRouteTitle("체크리스트 목록");
    view.appendChild(
      el("div", { class:"card2", style:"padding:14px;" },
        el("div", { style:"font-weight:1000;margin-bottom:6px;" }, "체크리스트 목록"),
        el("div", { style:"color:var(--muted);font-size:12px;" }, "필요 시 목록/확인 기능을 동일하게 확장합니다.")
      )
    );
  }

  function renderView(db){
    const key = parseHash();
    if (key === "home") viewHome(db);
    else if (key === "log") viewLog(db);
    else if (key === "approve") viewApprove(db);
    else if (key === "dashboard") viewDashboard(db);
    else if (key === "calendar") viewWorkCalendar(db);
    else if (key === "checklist") viewChecklist(db);
    else if (key === "checklist-view") viewChecklistView(db);
    else viewHome(db);
  }

  function render(){
    const db = ensureDB();
    const uid = getUserId(db);
    const me = userById(db, uid);

    $("#profile2").textContent = `${me?.name||"-"} (${ROLE_LABEL_KO[me?.role||"staff"]||"-"})`;

    renderSide2(db);

    const allowed = allowedWorkRoutesFor(me);
    const cur = parseHash();
    if (!allowed.has(cur)){
      setHash(isStaff(me) ? "home" : "home");
      return;
    }

    renderView(db);
  }

  function boot(){
    $("#btnClose")?.addEventListener("click", ()=> window.close());
    $("#modal2Close")?.addEventListener("click", modalClose);
    $("#modal2")?.addEventListener("click", (e)=>{ if (e.target === $("#modal2")) modalClose(); });

    window.addEventListener("hashchange", render);

    if (!location.hash) setHash("home");
    render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
