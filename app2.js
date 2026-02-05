/* app2.js (Work Window) v1
   ✅ 업무관리 기능 모음(별도창)
   - 업무일지 / 승인 / 프로젝트 소요시간 / 종합 공정관리
   - 프로젝트별 체크리스트 / 체크리스트 목록
   - FIN산출 / ㅇㅇ산출 (현재 placeholder)
*/

(() => {
  "use strict";

  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  const MENU = [
    { key:"log", label:"업무일지", hint:"Daily log" },
    { key:"approval", label:"승인", hint:"Approvals" },
    { key:"time", label:"프로젝트 소요시간", hint:"Time tracking" },
    { key:"master", label:"종합 공정관리", hint:"Master control" },
    { key:"chk_project", label:"프로젝트별 체크리스트", hint:"By project" },
    { key:"chk_list", label:"체크리스트 목록", hint:"All items" },
    { key:"fin", label:"FIN산출", hint:"Open FIN (placeholder)" },
    { key:"etc", label:"ㅇㅇ산출", hint:"placeholder" },
  ];

  const SAMPLE_ITEMS = {
    log: [
      { id:"L-001", title:"업무일지 - 구조 검토", meta:"Today · Project A" },
      { id:"L-002", title:"업무일지 - 도면 정리", meta:"Yesterday · Project B" },
    ],
    approval: [
      { id:"A-101", title:"승인 요청 - 업무일지", meta:"대기 2건" },
      { id:"A-102", title:"승인 요청 - 체크리스트", meta:"대기 1건" },
    ],
    time: [
      { id:"T-900", title:"Project A · 12.5h", meta:"이번 주 누적" },
      { id:"T-901", title:"Project B · 6.0h", meta:"이번 주 누적" },
    ],
    master: [
      { id:"M-001", title:"공정 마스터(placeholder)", meta:"구조/마감 통합" },
    ],
    chk_project: [
      { id:"CP-01", title:"Project A 체크리스트", meta:"진행률 40%" },
      { id:"CP-02", title:"Project B 체크리스트", meta:"진행률 70%" },
    ],
    chk_list: [
      { id:"CL-01", title:"체크리스트 항목(placeholder)", meta:"전체 목록" },
    ],
    fin: [
      { id:"FIN", title:"FIN산출 열기", meta:"새 탭으로 이동(placeholder)" },
    ],
    etc: [
      { id:"ETC", title:"ㅇㅇ산출(placeholder)", meta:"추후 연결" },
    ],
  };

  const els = {
    menu: $("#wMenu"),
    listTitle: $("#wListTitle"),
    items: $("#wItems"),
    detailTitle: $("#wDetailTitle"),
    detailBody: $("#wDetailBody"),
    btnBack: $("#btnBack"),
    btnCreate: $("#btnCreate"),
    miniCal: $("#wMiniCal"),
  };

  let currentKey = "log";
  let currentItemId = null;

  function renderMenu(){
    els.menu.innerHTML = "";
    MENU.forEach(m => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wMenuBtn";
      btn.dataset.key = m.key;
      btn.innerHTML = `
        <span>${escapeHtml(m.label)}</span>
        <span class="wMenuHint">${escapeHtml(m.hint)}</span>
      `;
      btn.addEventListener("click", () => {
        currentKey = m.key;
        currentItemId = null;
        render();
      });
      els.menu.appendChild(btn);
    });
  }

  function renderList(){
    const m = MENU.find(x => x.key === currentKey);
    els.listTitle.textContent = m ? m.label : "업무관리";

    const items = SAMPLE_ITEMS[currentKey] || [];
    els.items.innerHTML = "";

    if (items.length === 0){
      els.items.innerHTML = `<div style="padding:12px;color:#6b6b73;font-weight:900;">표시할 항목이 없습니다</div>`;
      return;
    }

    items.forEach(it => {
      const div = document.createElement("div");
      div.className = "wItem";
      div.dataset.id = it.id;
      div.innerHTML = `
        <div class="wItemTop">
          <div class="wItemTitle">${escapeHtml(it.title)}</div>
          <div style="font-size:12px;font-weight:900;color:#6b6b73">${escapeHtml(it.id)}</div>
        </div>
        <div class="wItemMeta">${escapeHtml(it.meta)}</div>
      `;
      div.addEventListener("click", () => {
        currentItemId = it.id;
        renderDetail();
        setActiveItem();
      });
      els.items.appendChild(div);
    });
  }

  function setActiveMenu(){
    $$(".wMenuBtn").forEach(b => b.classList.toggle("active", b.dataset.key === currentKey));
  }
  function setActiveItem(){
    $$(".wItem").forEach(b => b.classList.toggle("active", b.dataset.id === currentItemId));
  }

  function renderDetail(){
    const m = MENU.find(x => x.key === currentKey);
    els.detailTitle.textContent = m ? `${m.label} 상세` : "상세";

    if (!currentItemId){
      els.detailBody.innerHTML = `
        <div class="wBlock">
          <div class="wBlockTitle">선택된 항목 없음</div>
          <div class="wText">왼쪽 목록에서 항목을 선택하세요.</div>
        </div>
      `;
      return;
    }

    // FIN은 “외부 링크” placeholder
    if (currentKey === "fin"){
      els.detailBody.innerHTML = `
        <div class="wBlock">
          <div class="wBlockTitle">FIN산출</div>
          <div class="wText">현재는 placeholder 입니다. 연결 시 아래 버튼으로 외부 URL을 열도록 하면 됩니다.</div>
          <div style="margin-top:12px">
            <button class="wBtn primary" id="btnOpenFIN" type="button">FIN 산출 열기(새 탭)</button>
          </div>
        </div>
      `;
      $("#btnOpenFIN").addEventListener("click", () => {
        window.open("https://eumditravel-oss.github.io/FIN2/", "_blank");
      });
      return;
    }

    els.detailBody.innerHTML = `
      <div class="wBlock">
        <div class="wBlockTitle">${escapeHtml(currentItemId)}</div>
        <div class="wText">
          선택된 모듈: <b>${escapeHtml(m ? m.label : currentKey)}</b><br/>
          이 영역에 실제 입력 폼/상세/승인 흐름을 붙이면 됩니다.
        </div>
      </div>
    `;
  }

  function renderMiniCal(){
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();

    const first = new Date(y, mo, 1);
    const last = new Date(y, mo+1, 0);
    const dow = first.getDay();
    const days = last.getDate();

    const cells = [];
    for (let i=0;i<dow;i++) cells.push({d:"", empty:true});
    for (let d=1; d<=days; d++) cells.push({d, empty:false});
    while (cells.length % 7 !== 0) cells.push({d:"", empty:true});

    els.miniCal.innerHTML = "";
    cells.forEach(c => {
      const div = document.createElement("div");
      div.className = "wCalCell" + (c.empty ? " empty" : "");
      div.textContent = c.d;
      els.miniCal.appendChild(div);
    });
  }

  function render(){
    setActiveMenu();
    renderList();
    renderDetail();
    setActiveItem();
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function init(){
    renderMenu();
    renderMiniCal();

    els.btnBack.addEventListener("click", () => window.close());
    els.btnCreate.addEventListener("click", () => {
      alert("Create (placeholder) — 추후 입력 모달/작성화면 연결");
    });

    render();
  }

  init();
})();
