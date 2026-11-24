(() => {
  const config = window.FLEET_CONFIG || {};
  const apiBase = `${String(config.supabaseUrl || "").replace(/\/$/, "")}/rest/v1`;
  const cache = { vehicles: [], services: [], readings: [], documents: [], profile: null, activeId: null, view: "overview" };
  const $ = id => document.getElementById(id);
  let toastTimer;
  let editingVehicle = false;
  const configured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey && !config.supabaseUrl.includes("YOUR_PROJECT_ID") && !config.supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY"));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
  const dateObj = value => value ? new Date(`${value}T00:00:00`) : null;
  const dateText = value => value ? dateObj(value).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" }) : "Not set";
  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const dayDiff = value => value ? Math.round((dateObj(value) - today()) / 86400000) : null;
  const fmtKm = value => value == null || value === "" ? "—" : `${Number(value).toLocaleString()} km`;
  const activeVehicle = () => { const v=cache.vehicles.find(row=>String(row.id)===String(cache.activeId)); return v?{...v,...(cache.profile||{}),id:v.id}:null; };
  const request = async (table, method="GET", params={}, body=null) => {
    const url = new URL(`${apiBase}/${table}`);
    Object.entries(params).forEach(([key,value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { method, headers: { apikey: config.supabaseAnonKey, Accept:"application/json", ...(body ? { "Content-Type":"application/json", Prefer:"return=representation" } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(data?.message || data?.hint || `Database returned HTTP ${response.status}`);
    return data;
  };
  const showError = message => { $("error-detail").textContent = message; $("error-state").hidden = false; $("overview-view").hidden = true; $("history-view").hidden = true; $("documents-view").hidden = true; };
  const toast = (message, error=false) => { $("toast").textContent = message; $("toast").className = `toast show${error ? " error" : ""}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").className="toast", 3200); };
  const closeDialog = id => $(id).close();
  const showDialog = id => { const f = $(id).querySelector("form"); if (f) f.reset(); const e = $(id).querySelector(".form-error"); if (e) e.hidden = true; $(id).showModal(); };
  const openVehicleForm = edit => { editingVehicle=edit; showDialog("vehicle-dialog"); $("vehicle-dialog-title").textContent=edit?"Update vehicle details":"Add a vehicle"; $("vehicle-dialog-subtitle").textContent=edit?"Save a new profile revision for this vehicle.":"Vehicle profile, service plan, and compliance details."; $("save-vehicle").textContent=edit?"Save details":"Save vehicle"; if(edit){const v={...activeVehicle(),odometer_km:currentKm()};const form=$("vehicle-form");for(const [key,value] of Object.entries(v)){const field=form.elements.namedItem(key);if(field&&value!=null)field.value=String(value);}} };
  const setBusy = (id, label, busy) => { const b=$(id); b.disabled=busy; b.textContent=busy?label:b.dataset.label; };
  const statusInfo = date => { if (!date) return { text:"Not set", className:"neutral" }; const days=dayDiff(date); if(days<0) return {text:`Expired ${Math.abs(days)}d ago`,className:"expired"}; if(days<=30) return {text:days===0?"Due today":`Due in ${days}d`,className:"attention"}; return {text:`Valid (${days}d left)`,className:"current"}; };
  function complianceCard(title, provider, date, icon, kind) { const s=statusInfo(date); return `<article class="compliance-card"><div class="compliance-icon ${kind}">${icon}</div><div class="compliance-body"><div class="compliance-title-row"><div><h3>${title}</h3><p>${escapeHtml(provider || "Provider not recorded")}</p></div><span class="status ${s.className}">${s.text}</span></div><div class="compliance-foot"><span>Expiry: <b>${dateText(date)}</b></span></div></div></article>`; }
  function lastService() { const v=activeVehicle(); if(!v) return null; return cache.services.filter(x=>String(x.vehicle_id)===String(v.id)).slice().sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date)))[0] || null; }
  function latestReading() { const v=activeVehicle(); if(!v) return null; return cache.readings.filter(x=>String(x.vehicle_id)===String(v.id)).slice().sort((a,b)=>String(b.recorded_at).localeCompare(String(a.recorded_at)))[0] || null; }
  function currentKm() { const v=activeVehicle(); return latestReading()?.odometer_km ?? v?.odometer_km ?? null; }
  function servicePlan() {
    const v=activeVehicle(); if(!v) return null;
    const last=lastService();
    const lastKm=last?.odometer_km ?? v.last_service_km;
    const lastDate=last?.service_date ?? v.last_service_date;
    const intervalKm=Number(v.service_interval_km || 5000);
    const intervalMonths=Number(v.service_interval_months || 6);
    const targetKm=lastKm == null ? null : Number(lastKm)+intervalKm;
    const remainingKm=targetKm == null || currentKm() == null ? null : targetKm-Number(currentKm());
    let targetDate=null;
    if(lastDate){const d=dateObj(lastDate); d.setMonth(d.getMonth()+intervalMonths); targetDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
    const remainingDays=targetDate ? dayDiff(targetDate) : (v.service_due ? dayDiff(v.service_due) : null);
    return {last,lastKm,lastDate,intervalKm,intervalMonths,targetKm,remainingKm,targetDate:targetDate||v.service_due||null,remainingDays};
  }
  function renderVehiclePicker() {
    const select=$("vehicle-select");
    if(!cache.vehicles.length){select.innerHTML='<option value="">No vehicles</option>';return;}
    select.innerHTML=cache.vehicles.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.registration)} — ${escapeHtml(v.name)}</option>`).join("");
    if(!cache.activeId || !cache.vehicles.some(v=>String(v.id)===String(cache.activeId))) cache.activeId=cache.vehicles[0].id;
    select.value=String(cache.activeId);
  }
  function renderSummary() {
    const v=activeVehicle();
    if(!v){$("health-value").textContent="—";$("health-note").textContent="Add a vehicle to get started";$("expiry-value").textContent="—";$("expiry-note").textContent="No compliance records";$("service-target-value").textContent="—";$("service-target-note").textContent="No service plan";$("odometer-value").textContent="—";$("odometer-note").textContent="No reading recorded";return;}
    const compliance=[{name:"Insurance",date:v.insurance_expiry},{name:"Revenue licence",date:v.licence_expiry},{name:"Emissions test",date:v.emissions_expiry}].filter(x=>x.date).sort((a,b)=>dateObj(a.date)-dateObj(b.date));
    const urgent=compliance.filter(x=>dayDiff(x.date)<=30).length;
    const plan=servicePlan();
    const serviceUrgent=(plan.remainingKm!=null&&plan.remainingKm<=500)||(plan.remainingDays!=null&&plan.remainingDays<=30);
    $("health-value").textContent=urgent+Number(serviceUrgent);
    $("health-note").textContent=urgent+Number(serviceUrgent)===0?"No actions needed":"Actions needed soon";
    if(compliance.length){const first=compliance[0];$("expiry-value").textContent=dayDiff(first.date)<0?"Expired":`${Math.max(0,dayDiff(first.date))} days`;$("expiry-note").textContent=`${first.name} · ${dateText(first.date)}`;}else{$("expiry-value").textContent="—";$("expiry-note").textContent="Add compliance expiry dates";}
    if(plan.remainingKm!=null||plan.remainingDays!=null){const km=plan.remainingKm==null?null:Math.max(0,plan.remainingKm);const days=plan.remainingDays==null?null:Math.max(0,plan.remainingDays);$("service-target-value").textContent=km!=null?`${km.toLocaleString()} km left`:days!=null?`${days} days left`:"Due";$("service-target-note").textContent=`At ${fmtKm(plan.targetKm)}${plan.targetDate?` or ${dateText(plan.targetDate)}`:""}`;}else{$("service-target-value").textContent="—";$("service-target-note").textContent="Add last service date and km";}
    $("odometer-value").textContent=fmtKm(currentKm());$("odometer-note").textContent=latestReading()?`Updated ${dateText(latestReading().recorded_at)}`:"Latest recorded reading";
  }
  function renderOverview() {
    const v=activeVehicle();
    if(!v){$("overview-view").hidden=true;$("health-cards").hidden=true;$("empty-state").hidden=false;return;}
    $("empty-state").hidden=true;$("health-cards").hidden=false;
    const specs=[v.year,v.fuel_type,v.transmission].filter(Boolean).join(" · ") || "Vehicle details";
    $("vehicle-summary").innerHTML=`<div class="vehicle-card-top"><span class="reg-pill">▰ ${escapeHtml(v.registration)}</span><span class="vehicle-specs">${escapeHtml(specs)}</span><button class="text-button" id="edit-vehicle-details">✎ Edit details</button><button class="text-button" id="odometer-from-card">↻ Update km</button></div><h2>${escapeHtml(v.name)}</h2><p class="vehicle-subtitle">${escapeHtml([v.make,v.model].filter(Boolean).join(" ")||"Fleet vehicle")}</p><div class="vehicle-note">ⓘ ${escapeHtml(v.notes||"Add vehicle notes such as oil grade or maintenance instructions.")}</div>`;
    const p=servicePlan();
    const kmTotal=p?.intervalKm||5000; const kmUsed=p?.lastKm!=null&&currentKm()!=null?Math.max(0,Number(currentKm())-Number(p.lastKm)):0; const kmRemaining=p?.remainingKm; const kmPct=Math.min(100,Math.round(kmUsed/kmTotal*100));
    const dayTotal=(p?.intervalMonths||6)*30; const daysUsed=p?.lastDate&&p?.targetDate?Math.max(0,dayTotal-(p.remainingDays??0)):0; const dayPct=Math.min(100,Math.round(daysUsed/dayTotal*100));
    const kmText=kmRemaining==null?"Set last service km":kmRemaining<0?`${Math.abs(kmRemaining).toLocaleString()} km overdue`:`${kmRemaining.toLocaleString()} km left`;
    const timeText=p?.remainingDays==null?"Set last service date":p.remainingDays<0?`${Math.abs(p.remainingDays)} days overdue`:`${p.remainingDays} days left`;
    $("service-summary").innerHTML=`<div class="section-heading"><div><h2>Dual-trigger service schedule</h2><p>Every ${p.intervalKm.toLocaleString()} km or ${p.intervalMonths} months</p></div><span class="status ${(p.remainingKm!=null&&p.remainingKm<=500)||(p.remainingDays!=null&&p.remainingDays<=30)?"attention":"current"}">${(p.remainingKm!=null&&p.remainingKm<=500)||(p.remainingDays!=null&&p.remainingDays<=30)?"Service due soon":"On schedule"}</span></div><div class="trigger-grid"><div class="trigger-box"><div class="trigger-top"><span>MILEAGE TRIGGER</span><b>${kmText}</b></div><div class="progress-track"><span style="width:${kmPct}%"></span></div><div class="trigger-foot"><span>Last: ${fmtKm(p.lastKm)}</span><span>Target: ${fmtKm(p.targetKm)}</span></div></div><div class="trigger-box"><div class="trigger-top"><span>TIME TRIGGER</span><b>${timeText}</b></div><div class="progress-track"><span style="width:${dayPct}%"></span></div><div class="trigger-foot"><span>Last: ${dateText(p.lastDate)}</span><span>Due: ${dateText(p.targetDate)}</span></div></div></div><div class="service-card-actions"><button class="text-button" data-view="history">View ${cache.services.filter(x=>String(x.vehicle_id)===String(v.id)).length} service records →</button><button class="primary-button small" id="service-from-card">＋ Log completed service</button></div>`;
    $("compliance-list").innerHTML=complianceCard("Motor Insurance",v.insurance_provider,v.insurance_expiry,"◈","ins-icon")+complianceCard("Revenue Licence (eRL)",v.licence_provider,v.licence_expiry,"✧","lic-icon")+complianceCard("Emission Test (VET)",v.emissions_provider,v.emissions_expiry,"≋","em-icon");
    renderSummary(); $("service-count").textContent=cache.services.filter(x=>String(x.vehicle_id)===String(v.id)).length; $("document-count").textContent=cache.documents.filter(x=>String(x.vehicle_id)===String(v.id)).length;
    $("service-from-card")?.addEventListener("click",()=>showDialog("service-dialog")); $("odometer-from-card")?.addEventListener("click",()=>showDialog("odometer-dialog")); $("edit-vehicle-details")?.addEventListener("click",()=>openVehicleForm(true));
  }
  function renderHistory() {
    const v=activeVehicle(); const rows=cache.services.filter(x=>String(x.vehicle_id)===String(v?.id)).slice().sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date)));
    $("service-history-list").innerHTML=rows.length?`<div class="history-table"><div class="history-head"><span>DATE</span><span>WORK COMPLETED</span><span>ODOMETER</span><span>PROVIDER</span><span>COST</span></div>${rows.map(x=>`<div class="history-row"><span>${dateText(x.service_date)}</span><b>${escapeHtml(x.description)}</b><span>${fmtKm(x.odometer_km)}</span><span>${escapeHtml(x.provider||"—")}</span><span>${x.cost==null?"—":Number(x.cost).toLocaleString(undefined,{style:"currency",currency:"LKR",maximumFractionDigits:2})}</span></div>`).join("")}</div>`:'<div class="empty-inline"><h3>No service records yet</h3><p>Log completed maintenance to start a history for this vehicle.</p></div>';
    $("service-count").textContent=rows.length;
  }
  function renderDocuments() {
    const v=activeVehicle(); const rows=cache.documents.filter(x=>String(x.vehicle_id)===String(v?.id)).slice().sort((a,b)=>String(a.title).localeCompare(String(b.title)));
    $("document-list").innerHTML=rows.length?`<div class="history-table document-table"><div class="history-head"><span>DOCUMENT</span><span>CATEGORY</span><span>PROVIDER</span><span>EXPIRY</span><span>LINK</span></div>${rows.map(x=>`<div class="history-row"><b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.category)}</span><span>${escapeHtml(x.provider||"—")}</span><span>${dateText(x.expires_on)}</span><a href="${safeUrl(x.document_url)}" target="_blank" rel="noopener noreferrer">Open ↗</a></div>`).join("")}</div>`:'<div class="empty-inline"><h3>No documents saved</h3><p>Add a link to an insurance certificate, licence, test report, or service receipt.</p></div>';
    $("document-count").textContent=rows.length;
  }
  const safeUrl = value => { try { const u=new URL(value); return ["https:","http:"].includes(u.protocol)?escapeHtml(u.href):"#"; } catch { return "#"; } };
  function renderView() {
    $("overview-view").hidden=cache.view!=="overview"; $("history-view").hidden=cache.view!=="history"; $("documents-view").hidden=cache.view!=="documents";
    $("page-title").textContent=cache.view==="overview"?"Overview & compliance":cache.view==="history"?"Service history":"Document vault"; $("breadcrumb-view").textContent=$("page-title").textContent;
    document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===cache.view));
    if(cache.view==="overview")renderOverview(); else if(cache.view==="history")renderHistory(); else renderDocuments();
  }
  async function loadVehicleData() {
    const v=activeVehicle(); if(!v){cache.services=[];cache.readings=[];cache.documents=[];cache.profile=null;renderView();return;}
    const filter={select:"*",vehicle_id:`eq.${v.id}`};
    const [services,readings,documents,profiles]=await Promise.all([
      request("service_records","GET",{...filter,order:"service_date.desc"}),
      request("odometer_readings","GET",{...filter,order:"recorded_at.desc"}),
      request("vehicle_documents","GET",{...filter,order:"created_at.desc"}), request("vehicle_profiles","GET",{...filter,order:"created_at.desc",limit:"1"})
    ]);
    cache.services=services||[];cache.readings=readings||[];cache.documents=documents||[];cache.profile=profiles?.[0]||null;const selected=$("vehicle-select").selectedOptions[0];const active=activeVehicle();if(selected&&active)selected.textContent=`${active.registration} — ${active.name}`;renderView();
  }
  async function loadFleet() {
    $("error-state").hidden=true;
    if(!configured()) return showError("Add the Supabase project URL and publishable key to config.js.");
    try { cache.vehicles=await request("vehicles","GET",{select:"*",order:"registration.asc"}); renderVehiclePicker(); await loadVehicleData(); $("updated-label").textContent=`Last refreshed ${new Date().toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}`; }
    catch(error){showError(error.message||"Could not load fleet data. Check Supabase settings and run supabase-upgrade.sql.");}
  }
  function setActiveView(view) { cache.view=view; renderView(); }
  function formObject(form) { return Object.fromEntries(new FormData(form)); }
  function cleanObject(obj, numbers=[]) { for(const key of Object.keys(obj)) if(obj[key]==="")obj[key]=null; for(const key of numbers) obj[key]=obj[key]==null?null:Number(obj[key]); return obj; }
  async function saveForm(formId,table,buttonId,errorId,prepare) {
    const form=$(formId); const button=$(buttonId); const error=$(errorId); const original=button.textContent; button.disabled=true; button.textContent="Saving…"; error.hidden=true;
    try { const data=await prepare(formObject(form)); const result=await request(table,"POST",{},data); await loadVehicleData(); form.closest("dialog").close(); toast("Saved to the shared fleet."); return result; }
    catch(e){error.textContent=e.message||"Could not save this record.";error.hidden=false;}
    finally{button.disabled=false;button.textContent=original;}
  }
  document.addEventListener("click",event=>{const button=event.target.closest("[data-view]");if(button)setActiveView(button.dataset.view);});
  document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>closeDialog(button.dataset.close)));
  $("open-vehicle").addEventListener("click",()=>openVehicleForm(false)); $("empty-add").addEventListener("click",()=>openVehicleForm(false));
  $("open-service").addEventListener("click",()=>showDialog("service-dialog")); $("open-document").addEventListener("click",()=>showDialog("document-dialog")); $("open-odometer").addEventListener("click",()=>showDialog("odometer-dialog"));
  $("vehicle-select").addEventListener("change",async e=>{cache.activeId=e.target.value;try{await loadVehicleData();renderSummary();}catch(error){showError(error.message);}});
  $("retry").addEventListener("click",loadFleet);
  $("vehicle-form").addEventListener("submit",async e=>{e.preventDefault();const button=$("save-vehicle"),err=$("vehicle-error");button.disabled=true;button.textContent="Saving…";err.hidden=true;try{const d=cleanObject(formObject(e.currentTarget),["year","odometer_km","service_interval_km","service_interval_months","last_service_km"]);d.service_interval_km=d.service_interval_km??5000;d.service_interval_months=d.service_interval_months??6;if(editingVehicle){const current=activeVehicle();d.vehicle_id=current.id;await request("vehicle_profiles","POST",{},d);if(d.odometer_km!=null&&Number(d.odometer_km)!==Number(currentKm()))await request("odometer_readings","POST",{}, {vehicle_id:current.id,odometer_km:d.odometer_km,recorded_at:new Date().toISOString().slice(0,10),notes:"Profile update"});await loadVehicleData();e.currentTarget.closest("dialog").close();toast("Vehicle details saved.");}else{const result=await request("vehicles","POST",{},d);const added=Array.isArray(result)?result[0]:result;cache.vehicles=[...cache.vehicles,added].sort((a,b)=>String(a.registration).localeCompare(String(b.registration)));cache.activeId=added.id;cache.profile=null;renderVehiclePicker();await loadVehicleData();e.currentTarget.closest("dialog").close();toast("Vehicle added to the shared fleet.");}}catch(error){err.textContent=error.message;err.hidden=false;}finally{button.disabled=false;button.textContent="Save vehicle";}});
  $("service-form").addEventListener("submit",async e=>{e.preventDefault();const v=activeVehicle();if(!v)return;await saveForm("service-form","service_records","save-service","service-error",async raw=>{const d=cleanObject(raw,["odometer_km","cost"]);d.vehicle_id=v.id;if(d.odometer_km!=null)await request("odometer_readings","POST",{}, {vehicle_id:v.id,odometer_km:d.odometer_km,recorded_at:d.service_date,notes:"From completed service"});return d;});});
  $("odometer-form").addEventListener("submit",async e=>{e.preventDefault();const v=activeVehicle();if(!v)return;await saveForm("odometer-form","odometer_readings","save-odometer","odometer-error",raw=>{const d=cleanObject(raw,["odometer_km"]);d.vehicle_id=v.id;return d;});});
  $("document-form").addEventListener("submit",async e=>{e.preventDefault();const v=activeVehicle();if(!v)return;await saveForm("document-form","vehicle_documents","save-document","document-error",raw=>{const d=cleanObject(raw);d.vehicle_id=v.id;return d;});});
  loadFleet();
})();
