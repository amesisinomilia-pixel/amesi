let authToken=null, me=null;
let filter="default", selected=null, staff=[], depts=[], actor=null, rows=[];
let citizenRows=[], citizenSelected=null;
let staffDrafts=new Map();

const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);

// Tell the same-origin background watcher when the CaiPRUS UI is open.
// On mobile this prevents the native menu command from being replaced while
// its iframe is active.
let caiprusUiChannel=null;
try {
  caiprusUiChannel=new BroadcastChannel("caiprus-ui-state");
  caiprusUiChannel.postMessage({type:"caiprus-app-state",open:true});
  const announceClosed=()=>{
    try{caiprusUiChannel.postMessage({type:"caiprus-app-state",open:false})}catch(_){}
  };
  window.addEventListener("pagehide",announceClosed);
  window.addEventListener("beforeunload",announceClosed);
} catch(_) {}
// Publish a short-lived WorkAdventure heartbeat while the CaiPRUS UI is open.
// The map script uses this on mobile so it does not remove/re-register the
// native menu entry while the citizen/staff is actively inside CaiPRUS.
let caiprusUiHeartbeat=null;
async function startCaiPRUSUiHeartbeat(){
  try{
    if(typeof WA==="undefined")return;
    await WA.onInit();
    const beat=()=>WA.player.state.saveVariable("caiprusUiOpenAt",Date.now(),{public:false,persist:false}).catch(()=>{});
    await beat();
    caiprusUiHeartbeat=setInterval(beat,2000);
    const clearBeat=()=>{
      try{if(caiprusUiHeartbeat)clearInterval(caiprusUiHeartbeat)}catch(_){}
      try{WA.player.state.saveVariable("caiprusUiOpenAt",0,{public:false,persist:false}).catch(()=>{})}catch(_){}
    };
    window.addEventListener("pagehide",clearBeat,{once:true});
    window.addEventListener("beforeunload",clearBeat,{once:true});
  }catch(_){}
}
startCaiPRUSUiHeartbeat();



async function setupCaiPRUSMobileClose(){
  const btn=$("#caiprus-mobile-close");
  if(!btn)return;
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"") ||
    (navigator.maxTouchPoints>0 && Math.min(screen.width,screen.height)<=900);
  if(!mobile)return;
  try{
    if(typeof WA==="undefined")return;
    await WA.onInit();
    btn.classList.add("show");
    btn.onclick=()=>{
      try{WA.ui.modal.closeModal()}catch(e){console.error("CaiPRUS mobile close failed:",e)}
    };
  }catch(_){}
}
setupCaiPRUSMobileClose();

const E=s=>(s??"").toString().replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

async function api(url,opt={}){
  const headers={"Content-Type":"application/json",...(opt.headers||{})};
  if(authToken) headers.Authorization="Bearer "+authToken;
  const r=await fetch(url,{headers,...opt});
  let d={};
  try{d=await r.json()}catch{}
  if(!r.ok) throw Error(d.error||d.verification_error||"Request failed");
  return d;
}

function ago(s){
  let n=Math.floor((Date.now()-new Date(s))/1000);
  if(n<60)return n+"s"; n=Math.floor(n/60);
  if(n<60)return n+"m"; n=Math.floor(n/60);
  if(n<24)return n+"h"; return Math.floor(n/24)+"d";
}
function viewer(){return actor?.id||0}

function showStaffToast(message){
  let t=$("#staff-toast");
  if(!t){
    t=document.createElement("div");
    t.id="staff-toast";
    t.className="staff-toast";
    t.setAttribute("role","status");
    t.setAttribute("aria-live","polite");
    document.body.appendChild(t);
  }
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(showStaffToast.timer);
  showStaffToast.timer=setTimeout(()=>t.classList.remove("show"),3200);
}
showStaffToast.timer=null;

function setConn(id,state,text){
 const el=$(id); if(!el)return;
 el.classList.remove("ok","bad","warn"); el.classList.add(state);
 const label=el.querySelector("b"); if(label)label.textContent=text;
}

function showGate(message,detail=""){
  $("#auth-gate").classList.remove("hidden");
  $("#staff-app").classList.add("hidden");
  $("#citizen-app").classList.add("hidden");
  $("#auth-message").textContent=message;
  const d=$("#auth-detail");
  if(detail){d.textContent=detail;d.classList.remove("hidden")}else d.classList.add("hidden");
}

async function authenticateWorkAdventure(){
  showGate("Starting AI tools, please wait…");
  try{
    if(typeof WA==="undefined"){
      showGate("Ανοίξτε το CaiPRUS μέσα από το WorkAdventure για να συνεχίσετε.");
      return null;
    }
    await WA.onInit();
    const roomToken=WA.player.userRoomToken;
    if(!roomToken){
      showGate("Παρακαλούμε συνδεθείτε στο WorkAdventure για να χρησιμοποιήσετε το CaiPRUS.");
      return null;
    }

    const r=await fetch("/api/auth/workadventure",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        userRoomToken:roomToken,
        id:WA.player.id,
        name:WA.player.name
      })
    });
    const d=await r.json();
    if(!r.ok){
      const diag=d.diagnostic||{};
      let detail=d.verification_error||"";
      if(diag.issuer) detail+=`${detail?" · ":""}Issuer: ${diag.issuer}`;
      if(diag.alg) detail+=`${detail?" · ":""}Alg: ${diag.alg}`;
      if(diag.tried) detail+=`${detail?" · ":""}Tried: ${diag.tried.join(", ")}`;
      if(diag.next_step) detail+=`${detail?" · ":""}${diag.next_step}`;
      showGate(d.error||"Η ταυτοποίηση απέτυχε.",detail);
      console.error("CaiPRUS WorkAdventure auth:",d);
      return null;
    }
    authToken=d.token;
    me=d;
    if(d.auth_warning) console.warn("CaiPRUS authentication:",d.auth_warning);
    return d;
  }catch(e){
    console.error(e);
    showGate("Δεν ήταν δυνατή η σύνδεση με το WorkAdventure.",e.message||String(e));
    return null;
  }
}

async function refreshMatrixRuntime(){
 try{
   const x=await api("/api/matrix/status");
   if(!x.running){setConn("#conn-matrix","bad","Listener not running");return}
   if(x.encrypted_events_seen>0){
     setConn("#conn-matrix","warn",`Listening · ${x.messages_received} messages · ${x.encrypted_events_seen} encrypted`);return;
   }
   setConn("#conn-matrix",x.connected?"ok":"bad",x.connected?`Listening · ${x.messages_received} received`:`Listener reconnecting${x.last_error?" · "+x.last_error.slice(0,65):""}`);
 }catch(e){}
}

async function showConfiguredConnections(){
 try{
  const d=await api("/api/connections");
  setConn("#conn-openai",d.openai.configured?"warn":"bad",d.openai.configured?`Configured · ${d.openai.model||"model?"}`:"Not configured");
  setConn("#conn-matrix",d.matrix.configured?"warn":"bad",d.matrix.configured?`Configured${d.matrix.user_id?" · "+d.matrix.user_id:""}`:"Not configured");
  setConn("#conn-wa",d.workadventure.configured?"warn":"bad",d.workadventure.configured?"Configured":"Not configured");
  setConn("#conn-stats",d.staff_stats.configured?"warn":"bad",d.staff_stats.configured?"Configured":"Not configured");
 }catch(e){}
}

function connectionText(x,kind){
 if(x.ok){
   if(kind==="openai")return `Connected · ${x.model||"OK"}`;
   if(kind==="matrix")return `Connected · ${x.user_id||"OK"}`;
   if(kind==="workadventure")return `Connected · ${x.count??0} members${x.pages_fetched?` · ${x.pages_fetched} pages`:""}`;
   if(kind==="staff")return `Connected · ${x.count??0} records`;
   return "Connected";
 }
 if(!x.configured)return "Not configured";
 let detail=(x.message||"").replace(/\s+/g," ").trim();
 if(detail.length>105)detail=detail.slice(0,102)+"...";
 return `Failed${x.status?" · HTTP "+x.status:""}${detail?" · "+detail:""}`;
}

async function testConnections(){
 const btn=$("#test-connections");btn.disabled=true;btn.textContent="Testing…";
 try{
   const d=await api("/api/connections/test",{method:"POST",body:"{}"});
   setConn("#conn-openai",d.openai.ok?"ok":"bad",connectionText(d.openai,"openai"));
   setConn("#conn-matrix",d.matrix.ok?"ok":"bad",connectionText(d.matrix,"matrix"));
   setConn("#conn-wa",d.workadventure.ok?"ok":"bad",connectionText(d.workadventure,"workadventure"));
   setConn("#conn-stats",d.staff_stats.ok?"ok":(d.staff_stats.configured?"bad":"warn"),connectionText(d.staff_stats,"staff"));
   await loadStaff(); await load();
 }catch(e){alert("Connection test failed: "+e.message)}
 finally{btn.disabled=false;btn.textContent="Test connections"}
}

async function loadStaff(){
 staff=await api("/api/staff");
 actor=staff.find(x=>x.wa_id===me.member.wa_id)||staff.find(x=>x.id===me.member.staff_id)||null;
 if(!actor)throw Error("Authenticated Staff/Polit user is missing from the operator directory.");
 showActor();
}
function showActor(){
 $("#actor-name").textContent=actor.name;
 $("#actor-dept").textContent=`${actor.function_title||actor.department||actor.role} · ${(actor.tags||[]).join(", ")}`;
 $("#wa-state").textContent = me.auth_method==="wa_player_id_member_api"
   ? `${actor.name} · WorkAdventure member lookup`
   : `${actor.name} · cryptographically verified`;
}
function showDirectory(){
 $("#directory-list").innerHTML=staff.map(s=>`<div style="padding:10px;border-bottom:1px solid #e3e8ed">
 <b>${E(s.name)}</b><div style="font-size:12px;margin-top:3px">${E(s.function_title||"No function recorded")}</div>
 <div style="font-size:11px;color:#6f7b86;margin-top:3px">${E(s.department||"")} · tags: ${E((s.tags||[]).join(", "))} · source: ${E(s.source||"")}</div></div>`).join("");
 $("#directory-modal").classList.remove("hidden");
}


function showStaffMailboxLoading(){
    const rowsEl = $("#rows");
    const detailEl = $("#detail");

    if(rowsEl){
        rowsEl.innerHTML = `
            <div class="mailbox-starting">
                <div class="mailbox-spinner"></div>
                <strong>Starting AI tools, please wait</strong>
            </div>`;
    }

    if(detailEl){
        detailEl.innerHTML = `
            <div class="empty mailbox-loading">
                <div class="mailbox-spinner"></div>
                <h2>Starting AI tools, please wait</h2>
                <p>CaiPRUS is loading your mailbox.</p>
            </div>`;
    }
}

function showStaffMailboxReady(){
    if(selected) return;

    const detailEl = $("#detail");

    if(detailEl){
        detailEl.innerHTML = `
            <div class="empty">
                <div>💬</div>
                <h2>Select an inquiry</h2>
                <p>Review, route, assign, add an internal note or reply.</p>
            </div>`;
    }
}

async function bootStaff(){
 $("#auth-gate").classList.add("hidden");
 $("#staff-app").classList.remove("hidden");

 showStaffMailboxLoading();

 depts=await api("/api/departments");
 await loadStaff();

 const deptFilter=$("#dept-filter");
 deptFilter.innerHTML+=depts.map(x=>`<option>${E(x)}</option>`).join("");
 deptFilter.onchange=load;
 $("#search").oninput=()=>setTimeout(load,120);

 $$(".nav").forEach(b=>b.onclick=()=>{
   $$(".nav").forEach(x=>x.classList.remove("active"));
   b.classList.add("active");filter=b.dataset.status;selected=null;load();
 });

 $("#sync-staff").onclick=async()=>{
   $("#sync-staff").disabled=true;
   try{await api("/api/staff/sync",{method:"POST",body:"{}"});await loadStaff();await load();alert("Staff directory synced.")}
   finally{$("#sync-staff").disabled=false}
 };
 $("#directory-btn").onclick=showDirectory;
 $("#directory-x").onclick=()=>$("#directory-modal").classList.add("hidden");
 $("#test-connections").onclick=testConnections;

 await showConfiguredConnections();
 await load();

 showStaffMailboxReady();

 await refreshMatrixRuntime();
 setInterval(refreshMatrixRuntime,3000);
 setInterval(()=>load().catch(()=>{}),5000);
}

async function load(){
 let qs=new URLSearchParams({viewer:viewer(),status:filter,department:$("#dept-filter").value,q:$("#search").value});
 rows=await api("/api/inquiries?"+qs);renderRows();
 let s=await api("/api/summary?viewer="+viewer());
 $("#s-open").textContent=s.open;$("#s-urgent").textContent=s.urgent;$("#s-unassigned").textContent=s.unassigned;$("#s-waiting").textContent=s.waiting;
 if(selected&&rows.some(x=>x.id===selected)){
   const reply=$("#reply");
   const hasLocalDraft=staffDrafts.has(selected);
   const activelyWriting=reply && document.activeElement===reply;

   // Never rebuild the open inquiry while the operator is composing a reply.
   // Replacing #detail destroys the textarea, which used to remove focus and
   // erase whatever was typed every time the 5-second inbox poll ran.
   if(!activelyWriting && !hasLocalDraft) openItem(selected,false);
 }
}

function renderRows(){
 $("#rows").innerHTML=rows.map(x=>`<div class="item ${x.id===selected?"selected":""}" data-id="${x.id}">
 <div class="top"><span class="p-dot ${E(x.priority)}"></span><span class="name">${E(x.citizen_name)}</span><span class="time">${ago(x.created_at)}</span></div>
 <div class="subject">${E(x.subject)}</div><div class="preview">${E(x.messages.at(-1)?.body||x.summary)}</div>
 <div class="chips"><span class="chip">${E(x.status.replaceAll("_"," "))}</span><span class="chip">${E(x.visibility)}</span>${x.assigned_staff?`<span class="chip">👤 ${E(x.assigned_staff.name)}</span>`:""}</div></div>`).join("");
 $$(".item").forEach(x=>x.onclick=()=>openItem(+x.dataset.id));
}

async function openItem(id,rerender=true){
 const previousId=selected;
 const previousReply=$("#reply");
 if(previousId && previousReply && previousReply.value){
   staffDrafts.set(previousId,previousReply.value);
 }
 selected=id;let x=await api(`/api/inquiries/${id}?viewer=${viewer()}`);if(rerender)renderRows();
 const eligible=staff.filter(s=>{
   let tags=new Set((s.tags||[]).map(t=>t.toLowerCase()));
   if(x.target_staff_id)return s.id===x.target_staff_id;
   if(x.target_tag){
     const target=x.target_tag.toLowerCase();
     const mpBossAccess={
       mppafos:"pafosboss",
       mpnicosia:"nicosiaboss",
       mpfamagusta:"famagustaboss",
       mplimasol:"limassolboss"
     };
     return tags.has(target)||(mpBossAccess[target]&&tags.has(mpBossAccess[target]));
   }
   return tags.has("staff")||tags.has("polit");
 });
 const staffopts=`<option value="">Unassigned</option>`+eligible.map(s=>`<option value="${s.id}" ${x.assigned_staff_id==s.id?"selected":""}>${E(s.name)} — ${E(s.function_title||"")}</option>`).join("");
 const statusopts=["new","assigned","waiting_citizen","waiting_internal","answered","closed"].map(s=>`<option value="${s}" ${x.status===s?"selected":""}>${E(s.replaceAll("_"," "))}</option>`).join("");
 const msgs=x.messages.map(m=>`<div class="msg ${m.sender_type==="staff"?"staff":""} ${m.kind==="note"?"note":""}"><div class="bubble"><div class="mh">${E(m.sender_name)} · ${m.kind==="note"?"INTERNAL NOTE · ":""}${new Date(m.created_at).toLocaleString()}</div>${E(m.body).replaceAll("\n","<br>")}</div></div>`).join("");
 $("#detail").innerHTML=`<div class="detail-head"><div class="detail-title"><div><h2>${E(x.citizen_name)}</h2><p title="${E(x.route_reason||x.visibility)}">#${x.id} · ${E(x.subject)} · ${E(x.visibility)}</p></div><button class="danger" id="close">${x.status==="closed"?"Reopen":"Close"}</button></div>
 <div class="selectors"><label>Status<select id="status-sel">${statusopts}</select></label><label>Route<input value="${E(x.visibility)}" disabled></label><label>Assigned to<select id="staff-sel">${staffopts}</select></label></div></div>
 <div class="ai"><b>✨ CaiPRUS summary</b><p>${E(x.summary||"No summary")}</p></div>
 <div class="thread">${msgs}</div>
 <div class="composer"><textarea id="reply">${E(x.draft_reply||"")}</textarea><div class="actions"><div><button class="light" id="note">Internal note</button><button class="light" id="draft">✨ CaiPRUS draft</button><button class="primary" id="send">Send reply</button></div></div></div>`;
 const replyBox=$("#reply");
 if(staffDrafts.has(id)) replyBox.value=staffDrafts.get(id);
 replyBox.oninput=()=>staffDrafts.set(id,replyBox.value);
 $("#status-sel").onchange=async e=>{await post(`/api/inquiries/${id}/status`,{status:e.target.value});await load()};
 $("#staff-sel").onchange=async e=>{await post(`/api/inquiries/${id}/assign`,{staff_id:e.target.value?+e.target.value:null});await load()};
 $("#close").onclick=async()=>{await post(`/api/inquiries/${id}/status`,{status:x.status==="closed"?"new":"closed"});await load()};
 $("#draft").onclick=async()=>{
   const b=$("#draft");
   b.disabled=true;b.textContent="Drafting…";
   try{
     const d=await post(`/api/inquiries/${id}/draft`,{});
     const box=$("#reply");
     box.value=d.draft_reply;
     box.scrollTop=0;
     staffDrafts.set(id,d.draft_reply);
     box.focus();
   }catch(e){
     alert("Draft could not be generated: "+(e.message||e));
   }finally{
     b.disabled=false;b.textContent="✨ CaiPRUS draft";
   }
 };
 $("#send").onclick=async()=>{
   const sendBtn=$("#send");
   const reply=$("#reply");
   const body=reply.value.trim();
   if(!body)return alert("Write or generate a reply.");

   sendBtn.disabled=true;
   sendBtn.textContent="Sending…";

   try{
     await post(`/api/inquiries/${id}/send`,{body});

     // A successful send must look successful immediately. Clear the local
     // composer first, then reload this thread so the sent message appears
     // in the conversation instead of remaining in the input box.
     staffDrafts.delete(id);
     reply.value="";

     await openItem(id,false);
     await load();

     showStaffToast(`✓ Reply sent to ${x.citizen_name}`);
   }catch(e){
     sendBtn.disabled=false;
     sendBtn.textContent="Send reply";
     alert("Reply was not sent: "+(e.message||e));
   }
 };
 $("#note").onclick=async()=>{let body=prompt("Internal note (citizen will not see this):");if(body){await post(`/api/inquiries/${id}/note`,{body});await load()}};
}
async function post(url,p){p.viewer=viewer();return api(url,{method:"POST",body:JSON.stringify(p)})}

const GR_STATUS={
 new:"Νέο",assigned:"Ανατέθηκε",waiting_citizen:"Αναμονή από εσάς",
 waiting_internal:"Σε επεξεργασία",answered:"Απαντήθηκε",closed:"Κλειστό"
};

function openCitizenNew(){
 $("#citizen-subject").value="";
 $("#citizen-body").value="";
 $("#citizen-new-modal").classList.remove("hidden");
 setTimeout(()=>$("#citizen-subject").focus(),50);
}
function closeCitizenNew(){$("#citizen-new-modal").classList.add("hidden")}

async function bootCitizen(){
 $("#auth-gate").classList.add("hidden");
 $("#citizen-app").classList.remove("hidden");
 $("#citizen-welcome").textContent=`Καλώς ήρθες, ${me.member.name}.`;
 $("#citizen-new").onclick=openCitizenNew;
 $("#citizen-empty-new").onclick=openCitizenNew;
 $("#citizen-new-x").onclick=closeCitizenNew;
 $("#citizen-refresh").onclick=loadCitizenMailbox;
 $("#citizen-send-new").onclick=sendCitizenNew;
 await loadCitizenMailbox();
}

async function loadCitizenMailbox(){
 citizenRows=await api("/api/citizen/inquiries");
 if(!citizenRows.length){
   $("#citizen-empty").classList.remove("hidden");
   $("#citizen-mailbox").classList.add("hidden");
   return;
 }
 $("#citizen-empty").classList.add("hidden");
 $("#citizen-mailbox").classList.remove("hidden");
 $("#citizen-list").innerHTML=citizenRows.map(x=>`
   <button class="citizen-row ${x.id===citizenSelected?"active":""} ${x.unread_count>0?"unread":""}" data-id="${x.id}">
     <div><b>${x.unread_count>0?'<i class="citizen-unread-dot"></i> ':''}${E(x.subject)}</b><span>${E(GR_STATUS[x.status]||x.status)}</span></div>
     <p>${E(x.messages.at(-1)?.body||x.summary||"")}</p>
     <small>${new Date(x.updated_at).toLocaleString("el-GR")}</small>
   </button>`).join("");
 $$(".citizen-row").forEach(b=>b.onclick=()=>openCitizenInquiry(+b.dataset.id));
 if(citizenSelected && citizenRows.some(x=>x.id===citizenSelected))await openCitizenInquiry(citizenSelected,false);
}

async function openCitizenInquiry(id,refreshList=true){
 citizenSelected=id;
 const x=await api(`/api/citizen/inquiries/${id}`);
 if(refreshList)await loadCitizenMailbox();
 const msgs=x.messages.map(m=>`
   <div class="citizen-msg ${m.sender_type==="staff"?"from-office":"from-citizen"}">
     <div class="citizen-bubble">
       <div class="mh">${m.sender_type==="staff"?"Γραφείο":E(m.sender_name)} · ${new Date(m.created_at).toLocaleString("el-GR")}</div>
       ${E(m.body).replaceAll("\n","<br>")}
     </div>
   </div>`).join("");
 $("#citizen-detail").innerHTML=`
   <div class="citizen-thread-head">
     <div><h2>${E(x.subject)}</h2><p>#${x.id} · ${E(GR_STATUS[x.status]||x.status)}</p></div>
   </div>
   <div class="citizen-thread">${msgs}</div>
   ${x.status==="closed"?
     `<div class="citizen-closed">Η συνομιλία έχει κλείσει. Μπορείτε να στείλετε νέο μήνυμα αν χρειάζεστε επιπλέον βοήθεια.</div>`:
     `<div class="citizen-composer"><textarea id="citizen-reply" placeholder="Γράψτε την απάντησή σας…"></textarea><button id="citizen-send-reply" class="primary">Αποστολή απάντησης</button></div>`
   }`;
 const send=$("#citizen-send-reply");
 if(send)send.onclick=async()=>{
   const body=$("#citizen-reply").value.trim();
   if(!body)return alert("Γράψτε πρώτα το μήνυμά σας.");
   send.disabled=true;
   try{
     await api(`/api/citizen/inquiries/${id}/reply`,{method:"POST",body:JSON.stringify({body})});
     await loadCitizenMailbox();
   }catch(e){alert(e.message)}
   finally{send.disabled=false}
 };
}

async function sendCitizenNew(){
 const subject=$("#citizen-subject").value.trim();
 const body=$("#citizen-body").value.trim();
 if(!subject)return alert("Γράψτε το θέμα του μηνύματος.");
 if(!body)return alert("Γράψτε το μήνυμά σας.");
 const btn=$("#citizen-send-new");btn.disabled=true;btn.textContent="Αποστολή…";
 try{
   const x=await api("/api/citizen/inquiries",{method:"POST",body:JSON.stringify({subject,body})});
   closeCitizenNew();
   citizenSelected=x.id;
   await loadCitizenMailbox();
   await openCitizenInquiry(x.id,false);
 }catch(e){alert(e.message)}
 finally{btn.disabled=false;btn.textContent="Αποστολή"}
}

async function boot(){
 const auth=await authenticateWorkAdventure();
 if(!auth)return;
 if(auth.mode==="staff")await bootStaff();
 else await bootCitizen();
}
boot().catch(e=>{
 console.error("CaiPRUS boot failed:",e);
 showGate("Παρουσιάστηκε σφάλμα κατά την εκκίνηση του CaiPRUS.",e.message||String(e));
});


// ============================================================
// Close CaiPRUS when running as a WorkAdventure UIWebsite
// ============================================================

async function closeCaiPRUSPanel() {
    try {
        if (
            typeof WA !== "undefined" &&
            WA.iframeId &&
            WA.ui &&
            WA.ui.website
        ) {
            const website =
                await WA.ui.website.getById(WA.iframeId);

            if (website) {
                await website.close();
                return;
            }
        }

        // Fallback for modal mode.
        if (
            typeof WA !== "undefined" &&
            WA.ui &&
            WA.ui.modal
        ) {
            WA.ui.modal.closeModal();
        }

    } catch (e) {
        console.error("Failed to close CaiPRUS:", e);
    }
}

document.addEventListener("click", (event) => {
    const target = event.target;

    if (
        target instanceof HTMLElement &&
        target.id === "caiprus-panel-close"
    ) {
        closeCaiPRUSPanel();
    }
});
