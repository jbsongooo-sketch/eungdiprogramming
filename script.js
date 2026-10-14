// 브라우저에서 공개해도 되는 Supabase Project URL과 publishable/anon key만 입력하세요.
// .env 값은 정적 HTML에 자동 주입되지 않습니다. 설정 방법은 README.md를 참고하세요.
const SUPABASE_URL = window.SUPABASE_CONFIG?.url || "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_PUBLIC_KEY = window.SUPABASE_CONFIG?.publishableKey || "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";

const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_PROJECT_ID") && !SUPABASE_PUBLIC_KEY.includes("YOUR_SUPABASE_");
const db = configured && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY) : null;
const $ = (id) => document.getElementById(id);
const state = { user: null, cars: [], records: [], authMode: "login", view: "dashboard" };

document.addEventListener("DOMContentLoaded", init);
async function init() {
  bindEvents();
  updateToday();
  if (!db) {
    $("setupHint").hidden = false;
    $("authSubmit").disabled = true;
    $("authToggle").disabled = true;
    $("authMessage").textContent = "Supabase 연결 설정 후 로그인할 수 있습니다.";
    return;
  }
  try {
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw error;
    if (session) await enterApp(session.user);
  } catch (error) {
    toast(error.message || "로그인 상태를 확인하지 못했습니다.");
  }
  db.auth.onAuthStateChange((_event, session) => {
    // Supabase auth callbacks should not await another Supabase request.
    if (session && state.user?.id !== session.user.id) queueMicrotask(() => void enterApp(session.user));
    if (!session && state.user) showAuth();
  });
}
function bindEvents() {
  $("authForm").addEventListener("submit", submitAuth);
  $("authToggle").addEventListener("click", toggleAuth);
  $("logoutButton").addEventListener("click", async () => { await db?.auth.signOut(); showAuth(); });
  ["addCarButton", "addCarInline", "addCarSmall"].forEach(id => $(id).addEventListener("click", () => openCarDialog()));
  ["addRecordTop", "addRecordButton"].forEach(id => $(id).addEventListener("click", () => openRecordDialog()));
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  document.querySelectorAll("[data-go-history]").forEach(btn => btn.addEventListener("click", () => setView("history")));
  document.querySelectorAll(".close-dialog,.cancel-dialog").forEach(btn => btn.addEventListener("click", () => btn.closest("dialog").close()));
  $("carForm").addEventListener("submit", saveCar);
  $("recordForm").addEventListener("submit", saveRecord);
  ["searchInput", "carFilter", "statusFilter"].forEach(id => $(id).addEventListener("input", renderHistory));
  $("carsGrid").addEventListener("click", handleCarAction);
  $("sidebarCars").addEventListener("click", e => { const btn = e.target.closest("[data-car-id]"); if (btn) { $("carFilter").value = btn.dataset.carId; setView("history"); renderHistory(); } });
  [$("upcomingRows"), $("historyRows")].forEach(el => el.addEventListener("click", handleRecordAction));
}
async function submitAuth(event) {
  event.preventDefault(); if (!db) return;
  const email = $("authEmail").value.trim(), password = $("authPassword").value;
  $("authSubmit").disabled = true; $("authMessage").textContent = "";
  try {
    const result = state.authMode === "signup" ? await db.auth.signUp({ email, password }) : await db.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (state.authMode === "signup" && !result.data.session) {
      $("authPassword").value = "";
      $("authMessage").textContent = "가입 완료! 이메일 인증 후 로그인해 주세요.";
    } else if (result.data.user) {
      $("authPassword").value = "";
      await enterApp(result.data.user);
    }
  } catch (error) { $("authMessage").textContent = error.message || "인증에 실패했습니다."; }
  finally { $("authSubmit").disabled = false; }
}
function toggleAuth() {
  state.authMode = state.authMode === "login" ? "signup" : "login";
  $("authSubmit").textContent = state.authMode === "login" ? "로그인" : "회원가입";
  $("authToggle").textContent = state.authMode === "login" ? "회원가입" : "로그인";
  $("authSwitchText").textContent = state.authMode === "login" ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?";
  $("authPassword").autocomplete = state.authMode === "login" ? "current-password" : "new-password";
}
async function enterApp(user) {
  state.user = user; $("authScreen").hidden = true; $("appShell").hidden = false;
  $("userEmail").textContent = user.email; $("userAvatar").textContent = (user.email || "M").slice(0, 1).toUpperCase();
  await loadData();
}
function showAuth() { state.user = null; state.cars = []; state.records = []; $("authPassword").value = ""; $("appShell").hidden = true; $("authScreen").hidden = false; }
async function loadData() {
  const [carsRes, recordsRes] = await Promise.all([
    db.from("cars").select("id,name,make,model,year,plate,created_at").order("created_at", { ascending: false }),
    db.from("maintenance_records").select("id,car_id,name,last_service_date,interval_days,notes,created_at").order("last_service_date", { ascending: false })
  ]);
  if (carsRes.error || recordsRes.error) { toast((carsRes.error || recordsRes.error).message); return; }
  state.cars = carsRes.data || []; state.records = recordsRes.data || [];
  renderAll();
}
function renderAll() { renderCars(); renderFilters(); renderStats(); renderUpcoming(); renderHistory(); }
function renderCars() {
  $("sidebarCars").innerHTML = state.cars.map(c => `<button class="sidebar-car" data-car-id="${esc(c.id)}"><span class="mini-car">⌁</span><span><strong>${esc(c.name)}</strong><small>${esc([c.make,c.model].filter(Boolean).join(" ") || "내 자동차")}</small></span></button>`).join("");
  $("carsGrid").innerHTML = state.cars.map(c => {
    const records = state.records.filter(r => r.car_id === c.id), next = records.map(r => ({ r, days: daysUntil(nextDate(r)) })).sort((a,b)=>a.days-b.days)[0];
    const title = [c.make,c.model].filter(Boolean).join(" ");
    return `<article class="car-card"><div class="car-visual">⌁</div><div class="car-card-body"><div class="car-title-row"><div><h3>${esc(c.name)}</h3><p>${esc(title || "차량 정보")}${c.year ? ` · ${esc(c.year)}` : ""}</p></div><span class="row-actions"><button class="row-action" data-car-action="edit" data-id="${esc(c.id)}" aria-label="차량 수정">✎</button><button class="row-action" data-car-action="delete" data-id="${esc(c.id)}" aria-label="차량 삭제">×</button></span></div><div class="car-meta"><span>${esc(c.plate || "차량 번호 미등록")}</span><strong>${records.length}개 정비 항목</strong></div><div class="car-progress"><span></span></div><div class="car-meta"><span>가장 가까운 정비</span><strong>${next ? (next.days < 0 ? `${Math.abs(next.days)}일 초과` : `${next.days}일 후`) : "일정 없음"}</strong></div></div></article>`;
  }).join("");
  if (!state.cars.length) $("carsGrid").innerHTML = `<div class="empty-state">등록된 자동차가 없습니다. ‘자동차 등록’을 눌러 시작하세요.</div>`;
}
function renderFilters() {
  const old = $("carFilter").value;
  $("carFilter").innerHTML = `<option value="">모든 차량</option>` + state.cars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  if (state.cars.some(c=>c.id===old)) $("carFilter").value=old;
  const recCar = $("recordCar"), selected = recCar.value;
  recCar.innerHTML = state.cars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  if (state.cars.some(c=>c.id===selected)) recCar.value=selected;
}
function renderStats() {
  const days = state.records.map(r=>daysUntil(nextDate(r)));
  $("statCars").textContent=state.cars.length; $("statRecords").textContent=state.records.length;
  $("statOverdue").textContent=days.filter(d=>d<0).length; $("statDue").textContent=days.filter(d=>d>=0&&d<=30).length;
}
function renderUpcoming() {
  const rows=[...state.records].sort((a,b)=>daysUntil(nextDate(a))-daysUntil(nextDate(b))).slice(0,6);
  $("upcomingRows").innerHTML=rows.map(recordRow).join(""); $("upcomingEmpty").hidden=rows.length>0;
}
function renderHistory() {
  if (!$("historyRows")) return;
  const query=$("searchInput").value.trim().toLowerCase(), carId=$("carFilter").value, filter=$("statusFilter").value;
  const rows=state.records.filter(r=>{
    const car=carById(r.car_id), d=daysUntil(nextDate(r)), status=d<0?"overdue":d<=30?"soon":"ok";
    return (!query||`${r.name} ${car?.name||""} ${car?.make||""} ${car?.model||""}`.toLowerCase().includes(query))&&(!carId||r.car_id===carId)&&(!filter||filter===status);
  }).sort((a,b)=>daysUntil(nextDate(a))-daysUntil(nextDate(b)));
  $("historyRows").innerHTML=rows.map(r=>`<tr><td><span class="record-name">${esc(r.name)}<small>${esc(r.notes||"정비 항목")}</small></span></td><td>${esc(carById(r.car_id)?.name||"삭제된 차량")}</td><td>${fmtDate(r.last_service_date)}</td><td>${Number(r.interval_days)}일</td><td>${fmtDate(nextDate(r))}</td><td>${remaining(r)}</td><td>${actionButtons(r.id)}</td></tr>`).join(""); $("historyEmpty").hidden=rows.length>0;
}
function recordRow(r) { const d=daysUntil(nextDate(r)); const c=carById(r.car_id); return `<tr><td><span class="record-name">${esc(r.name)}<small>${Number(r.interval_days)}일 주기</small></span></td><td>${esc(c?.name||"삭제된 차량")}</td><td>${fmtDate(nextDate(r))}</td><td>${remaining(r)}</td><td><span class="status ${statusClass(d)}">${statusText(d)}</span></td><td>${actionButtons(r.id)}</td></tr>`; }
function actionButtons(id) { return `<span class="row-actions"><button class="row-action" data-record-action="edit" data-id="${esc(id)}" aria-label="수정">✎</button><button class="row-action" data-record-action="delete" data-id="${esc(id)}" aria-label="삭제">×</button></span>`; }
async function handleCarAction(e) { const b=e.target.closest("[data-car-action]"); if (!b) return; const car=carById(b.dataset.id); if (!car) return; if(b.dataset.carAction==="edit") openCarDialog(car); else if(b.dataset.carAction==="delete"&&confirm(`‘${car.name}’과 연결된 정비 기록을 모두 삭제할까요?`)){const {error}=await db.from("cars").delete().eq("id",car.id);if(error)toast(error.message);else{toast("자동차와 연결된 정비 기록을 삭제했습니다.");await loadData();}} }
async function handleRecordAction(e) { const b=e.target.closest("[data-record-action]"); if (!b) return; const r=state.records.find(x=>x.id===b.dataset.id); if (!r) return; if (b.dataset.recordAction==="edit") openRecordDialog(r); else if (confirm(`‘${r.name}’ 정비 항목을 삭제할까요?`)) { const {error}=await db.from("maintenance_records").delete().eq("id",r.id); if(error)toast(error.message); else {toast("정비 항목을 삭제했습니다."); await loadData();} } }
function openCarDialog(car=null) { $("carForm").reset(); $("carId").value=car?.id||""; $("carDialogTitle").textContent=car?"자동차 수정":"자동차 등록"; $("carName").value=car?.name||""; $("carMake").value=car?.make||""; $("carModel").value=car?.model||""; $("carYear").value=car?.year||""; $("carPlate").value=car?.plate||""; $("carDialog").showModal(); }
function openRecordDialog(record=null) { if(!state.cars.length){toast("먼저 자동차를 등록해 주세요.");openCarDialog();return;} renderFilters(); $("recordForm").reset(); $("recordId").value=record?.id||""; $("recordDialogTitle").textContent=record?"정비 기록 수정":"정비 기록 추가"; $("recordCar").value=record?.car_id||state.cars[0].id; $("recordName").value=record?.name||""; $("lastService").value=record?.last_service_date||localDateString(); $("intervalDays").value=record?.interval_days||""; $("recordNotes").value=record?.notes||""; $("recordDialog").showModal(); }
async function saveCar(e) { e.preventDefault(); if(!state.user)return; const id=$("carId").value; const payload={owner_id:state.user.id,name:$("carName").value.trim(),make:nullable("carMake"),model:nullable("carModel"),year:numberOrNull("carYear"),plate:nullable("carPlate")}; const q=id?db.from("cars").update(payload).eq("id",id):db.from("cars").insert(payload); const {error}=await q; if(error){toast(error.message);return;} $("carDialog").close();toast(id?"차량 정보를 수정했습니다.":"자동차를 등록했습니다.");await loadData(); }
async function saveRecord(e) { e.preventDefault(); if(!state.user)return; const id=$("recordId").value; const payload={owner_id:state.user.id,car_id:$("recordCar").value,name:$("recordName").value.trim(),last_service_date:$("lastService").value,interval_days:Number($("intervalDays").value),notes:nullable("recordNotes")}; const q=id?db.from("maintenance_records").update(payload).eq("id",id):db.from("maintenance_records").insert(payload); const {error}=await q; if(error){toast(error.message);return;} $("recordDialog").close();toast(id?"정비 기록을 수정했습니다.":"정비 기록을 추가했습니다.");await loadData(); }
async function setView(view) { state.view=view; $("dashboardView").hidden=view!=="dashboard"; $("historyView").hidden=view!=="history"; $("breadcrumbView").textContent=view==="dashboard"?"대시보드":"정비 이력"; document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view)); if(view==="history")renderHistory(); }
function carById(id){return state.cars.find(c=>c.id===id)}
function nextDate(r){const [year,month,day]=r.last_service_date.split("-").map(Number);return new Date(Date.UTC(year,month-1,day+Number(r.interval_days))).toISOString().slice(0,10)}
function daysUntil(date){return Math.round((dateUtcDay(date)-dateUtcDay(localDateString()))/86400000)}
function dateUtcDay(date){const [year,month,day]=date.split("-").map(Number);return Date.UTC(year,month-1,day)}
function localDateString(date=new Date()){const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`}
function remaining(r){const d=daysUntil(nextDate(r));return d<0?`<span class="status overdue">${Math.abs(d)}일 초과</span>`:`<span class="status ${statusClass(d)}">${d===0?"오늘":`${d}일 후`}</span>`}
function statusClass(d){return d<0?"overdue":d<=30?"soon":"ok"} function statusText(d){return d<0?"기한 초과":d<=30?"예정":"여유"}
function fmtDate(v){return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(`${v}T00:00:00`))}
function nullable(id){return $(id).value.trim()||null} function numberOrNull(id){return $(id).value?Number($(id).value):null}
function updateToday(){ $("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date()); }
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
