(function(){
  'use strict';
  const app=document.getElementById('app');
  const toastRoot=document.getElementById('toast-root');
  const cfg=window.APP_CONFIG||{};
  const DEMO=cfg.demoMode!==false;
  const DEMO_KEY='rrbs_admin_demo_v4';
  const state={tab:'organizations',organizations:[],resources:[],availability:[],bookings:[],resourceType:'room',editingOrgId:null,editingResourceId:null,selectedResourceId:null,user:null,loading:false,error:''};
  let supabase=null;

  const seed={
    organizations:[
      {id:'org-demo-1',name:'社區綜合服務中心',active:true,created_at:new Date().toISOString()},
      {id:'org-demo-2',name:'樂齡活動中心',active:true,created_at:new Date().toISOString()}
    ],
    resources:[
      {id:'room-demo-1',organization_id:'org-demo-1',type:'room',name:'活動室 1-2',location:'1/F',description:'適合小組及活動',capacity:20,stock_quantity:1,requires_room:false,active:true},
      {id:'room-demo-2',organization_id:'org-demo-1',type:'room',name:'會議室',location:'2/F',description:'適合會議',capacity:10,stock_quantity:1,requires_room:false,active:true},
      {id:'item-demo-1',organization_id:'org-demo-1',type:'item',name:'投影機',location:'中心內',description:'中心即日使用',capacity:1,stock_quantity:2,requires_room:true,active:true},
      {id:'item-demo-2',organization_id:'org-demo-1',type:'item',name:'輪椅',location:'地下接待處',description:'可外借',capacity:1,stock_quantity:3,requires_room:false,active:true}
    ],
    availability:[
      {id:'av-1',resource_id:'room-demo-1',weekday:1,specific_date:null,date_from:null,date_to:null,start_time:'09:00',end_time:'18:00',active:true},
      {id:'av-2',resource_id:'room-demo-2',weekday:2,specific_date:null,date_from:null,date_to:null,start_time:'09:00',end_time:'17:00',active:true}
    ],bookings:[]
  };

  init();

  async function init(){
    try{
      if(DEMO){ loadDemo(); state.user={email:'demo-admin@local'}; render(); return; }
      if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){ return renderConfigError(); }
      if(!window.supabase){ return renderFatal('Supabase library 未能載入，請重新整理頁面。'); }
      supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){ renderLogin(); return; }
      const allowed=await verifyAdmin(session.user);
      if(!allowed){ await supabase.auth.signOut(); renderLogin('此帳戶沒有管理員權限。'); return; }
      state.user=session.user; await refreshAll(); render();
    }catch(err){renderFatal(errorMessage(err));}
  }

  function loadDemo(){
    try{
      const saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'null');
      const data=saved||seed;
      state.organizations=clone(data.organizations||[]);
      state.resources=clone(data.resources||[]);
      state.availability=clone(data.availability||[]);
      state.bookings=clone(data.bookings||[]);
      if(!saved) persistDemo();
    }catch(_){
      state.organizations=clone(seed.organizations); state.resources=clone(seed.resources); state.availability=clone(seed.availability); state.bookings=[]; persistDemo();
    }
  }
  function persistDemo(){ localStorage.setItem(DEMO_KEY,JSON.stringify({organizations:state.organizations,resources:state.resources,availability:state.availability,bookings:state.bookings})); }
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}

  async function verifyAdmin(user){
    const {data,error}=await supabase.from('profiles').select('role').eq('id',user.id).single();
    if(error) throw error;
    return data&&data.role==='admin';
  }
  async function refreshAll(){
    const [orgs,res,av,bks]=await Promise.all([
      supabase.from('organizations').select('*').order('name'),
      supabase.from('resources').select('*').order('type').order('name'),
      supabase.from('resource_availability').select('*').order('resource_id'),
      supabase.from('bookings').select('*').order('created_at',{ascending:false}).limit(100)
    ]);
    for(const r of [orgs,res,av,bks]) if(r.error) throw r.error;
    state.organizations=orgs.data||[]; state.resources=res.data||[]; state.availability=av.data||[]; state.bookings=bks.data||[];
  }

  function render(){
    app.innerHTML=`<div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand"><div class="admin-brand-mark">R</div><div><h1>資源預約管理</h1><p>房間及物品預約系統</p></div></div>
        <div class="mode-note">${DEMO?'Demo Mode：修改會儲存在此瀏覽器':'Supabase 正式模式'}</div>
        <nav class="side-nav">
          ${navBtn('organizations','機構管理')}${navBtn('resources','房間／物品')}${navBtn('bookings','申請審批')}${navBtn('dashboard','概覽')}
        </nav>
        <div class="sidebar-bottom"><a href="index.html">返回前台</a>${!DEMO?'<button data-signout>登出</button>':''}</div>
      </aside>
      <main class="admin-main">${renderMain()}</main>
    </div>`;
    bind();
  }
  function navBtn(id,label){return `<button class="${state.tab===id?'active':''}" data-tab="${id}">${label}</button>`;}
  function renderMain(){
    if(state.tab==='organizations')return organizationsView();
    if(state.tab==='resources')return resourcesView();
    if(state.tab==='bookings')return bookingsView();
    return dashboardView();
  }
  function top(title,desc,extra=''){return `<div class="topbar"><div><h2>${title}</h2><p>${desc}</p></div><div class="top-actions"><span class="chip">${DEMO?'DEMO':'LIVE'}</span>${extra}</div></div>`;}

  function dashboardView(){
    return `${top('管理概覽','查看目前機構、房間、物品及申請數量')}
      <div class="stats"><div class="stat"><span>機構</span><strong>${state.organizations.length}</strong></div><div class="stat"><span>房間</span><strong>${state.resources.filter(x=>x.type==='room').length}</strong></div><div class="stat"><span>物品</span><strong>${state.resources.filter(x=>x.type==='item').length}</strong></div><div class="stat"><span>待審批</span><strong>${state.bookings.filter(x=>x.status==='pending').length}</strong></div></div>
      <section class="panel"><div class="panel-head"><div><h3>系統狀態</h3><p>管理功能已啟用</p></div></div><div class="notice">你可以從左側進入「機構管理」或「房間／物品」新增及修改資料。</div></section>`;
  }

  function organizationsView(){
    const edit=state.organizations.find(x=>x.id===state.editingOrgId)||null;
    return `${top('機構管理','新增、更改或刪除可使用本系統的機構')}
      <div class="grid-two">
        <section class="panel"><div class="panel-head"><div><h3>機構列表</h3><p>共 ${state.organizations.length} 個機構</p></div><button class="btn btn-primary" data-new-org>＋ 新增機構</button></div>
          <div class="table-wrap"><table><thead><tr><th>機構名稱</th><th>狀態</th><th>房間／物品</th><th>操作</th></tr></thead><tbody>
          ${state.organizations.length?state.organizations.map(org=>`<tr><td><strong>${esc(org.name)}</strong></td><td><span class="tag ${org.active?'green':'gray'}">${org.active?'啟用':'停用'}</span></td><td>${state.resources.filter(r=>r.organization_id===org.id).length}</td><td><div class="row-actions"><button class="btn btn-secondary btn-small" data-edit-org="${org.id}">修改</button><button class="btn btn-danger btn-small" data-delete-org="${org.id}">刪除</button></div></td></tr>`).join(''):`<tr><td colspan="4" class="empty">尚未建立機構</td></tr>`}
          </tbody></table></div>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>${edit?'修改機構':'新增機構'}</h3><p>${edit?'更新機構名稱或啟用狀態':'建立新的機構'}</p></div></div>
          <form data-org-form class="form-card">
            <div class="field"><span>機構名稱 *</span><input class="input" name="name" required maxlength="120" value="${attr(edit?.name||'')}" placeholder="例如：社區綜合服務中心"></div>
            <label class="checkline" style="margin-top:12px"><input type="checkbox" name="active" ${!edit||edit.active?'checked':''}> 啟用此機構</label>
            <div class="form-actions">${edit?'<button type="button" class="btn btn-secondary" data-cancel-org>取消</button>':''}<button class="btn btn-primary" type="submit">${edit?'儲存修改':'新增機構'}</button></div>
          </form>
        </section>
      </div>`;
  }

  function resourcesView(){
    const orgOptions=state.organizations.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('');
    const filtered=state.resources.filter(r=>r.type===state.resourceType);
    const edit=state.resources.find(x=>x.id===state.editingResourceId)||null;
    const selected=state.resources.find(x=>x.id===state.selectedResourceId)||edit||null;
    return `${top('房間／物品管理','新增、修改、刪除資源及設定可用時段')}
      ${!state.organizations.length?'<div class="error-box">請先建立至少一個機構，才可新增房間或物品。</div>':''}
      <div class="resource-tabs"><button class="${state.resourceType==='room'?'active':''}" data-resource-tab="room">房間</button><button class="${state.resourceType==='item'?'active':''}" data-resource-tab="item">物品</button></div>
      <div class="grid-two">
        <section class="panel"><div class="panel-head"><div><h3>${state.resourceType==='room'?'房間列表':'物品列表'}</h3><p>共 ${filtered.length} 項</p></div><button class="btn btn-primary" data-new-resource ${!state.organizations.length?'disabled':''}>＋ 新增${state.resourceType==='room'?'房間':'物品'}</button></div>
          <div class="table-wrap"><table><thead><tr><th>名稱</th><th>機構</th><th>${state.resourceType==='room'?'容量':'庫存'}</th><th>狀態</th><th>操作</th></tr></thead><tbody>
          ${filtered.length?filtered.map(r=>`<tr><td><strong>${esc(r.name)}</strong><div class="mini">${esc(r.location||'')}</div></td><td>${esc(orgName(r.organization_id))}</td><td>${r.type==='room'?`${Number(r.capacity)||1} 人`:`${Number(r.stock_quantity)||1} 件`}</td><td><span class="tag ${r.active?'green':'gray'}">${r.active?'啟用':'停用'}</span></td><td><div class="row-actions"><button class="btn btn-secondary btn-small" data-edit-resource="${r.id}">修改</button><button class="btn btn-secondary btn-small" data-availability="${r.id}">時段</button><button class="btn btn-danger btn-small" data-delete-resource="${r.id}">刪除</button></div></td></tr>`).join(''):`<tr><td colspan="5" class="empty">尚未建立${state.resourceType==='room'?'房間':'物品'}</td></tr>`}
          </tbody></table></div>
        </section>
        <div>
          <section class="panel"><div class="panel-head"><div><h3>${edit?'修改':'新增'}${state.resourceType==='room'?'房間':'物品'}</h3><p>填寫基本資料後儲存</p></div></div>
            <form data-resource-form class="form-card">
              <div class="form-grid">
                <div class="field full"><span>所屬機構 *</span><select class="select" name="organization_id" required><option value="">請選擇</option>${orgOptions}</select></div>
                <div class="field full"><span>名稱 *</span><input class="input" name="name" required maxlength="120" value="${attr(edit?.name||'')}" placeholder="例如：活動室 1-2"></div>
                <div class="field"><span>位置</span><input class="input" name="location" value="${attr(edit?.location||'')}" placeholder="例如：1/F"></div>
                ${state.resourceType==='room'?`<div class="field"><span>可容納人數 *</span><input class="input" type="number" name="capacity" min="1" required value="${edit?.capacity||20}"></div>`:`<div class="field"><span>庫存數量 *</span><input class="input" type="number" name="stock_quantity" min="1" required value="${edit?.stock_quantity||1}"></div>`}
                <div class="field full"><span>描述</span><textarea class="textarea" name="description" placeholder="簡單描述用途或借用限制">${esc(edit?.description||'')}</textarea></div>
                ${state.resourceType==='item'?`<label class="checkline full"><input type="checkbox" name="requires_room" ${edit?.requires_room?'checked':''}> 此物品只可配合房間預約／中心內使用</label>`:''}
                <label class="checkline full"><input type="checkbox" name="active" ${!edit||edit.active?'checked':''}> 啟用此資源</label>
              </div>
              <div class="form-actions">${edit?'<button type="button" class="btn btn-secondary" data-cancel-resource>取消</button>':''}<button class="btn btn-primary" type="submit" ${!state.organizations.length?'disabled':''}>${edit?'儲存修改':'新增資源'}</button></div>
            </form>
          </section>
          ${selected?availabilityPanel(selected):''}
        </div>
      </div>`;
  }

  function availabilityPanel(resource){
    const list=state.availability.filter(a=>a.resource_id===resource.id);
    const weekdayNames=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
    return `<section class="panel"><div class="panel-head"><div><h3>${esc(resource.name)}：可用時段</h3><p>新增每星期固定時段或指定日期時段</p></div></div>
      <form data-av-form class="form-card">
        <div class="form-grid"><div class="field"><span>模式</span><select class="select" name="mode"><option value="weekday">每星期</option><option value="date">指定日期</option></select></div><div class="field" data-av-weekday><span>星期</span><select class="select" name="weekday">${weekdayNames.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select></div><div class="field" data-av-date style="display:none"><span>指定日期</span><input class="input" type="date" name="specific_date"></div><div class="field"><span>開始時間</span><input class="input" type="time" name="start_time" required value="09:00"></div><div class="field"><span>結束時間</span><input class="input" type="time" name="end_time" required value="17:00"></div></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">新增時段</button></div>
      </form>
      <div class="availability-list" style="margin-top:12px">${list.length?list.map(a=>`<div class="availability-row"><span>${a.specific_date?esc(a.specific_date):weekdayNames[Number(a.weekday)]}</span><span>${shortTime(a.start_time)}–${shortTime(a.end_time)}</span><span><span class="tag ${a.active?'green':'gray'}">${a.active?'啟用':'停用'}</span></span><button class="btn btn-danger btn-small" data-delete-av="${a.id}">刪除</button></div>`).join(''):'<div class="empty">尚未設定可用時段</div>'}</div>
      </section>`;
  }

  function bookingsView(){
    const rows=state.bookings;
    return `${top('申請審批','查看及更新房間／物品預約狀態')}
      <section class="panel"><div class="panel-head"><div><h3>最近申請</h3><p>最多顯示最近 100 筆</p></div></div><div class="table-wrap"><table><thead><tr><th>編號</th><th>資源</th><th>日期</th><th>時段</th><th>申請人</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${esc(b.reference_no||'—')}</td><td>${esc(resourceName(b.resource_id))}</td><td>${esc(b.booking_date||'')}</td><td>${shortTime(b.start_time)}–${shortTime(b.end_time)}</td><td>${esc(b.applicant_name||'')}</td><td><span class="tag ${b.status==='approved'?'green':b.status==='pending'?'':'gray'}">${statusLabel(b.status)}</span></td><td><div class="row-actions">${b.status==='pending'?`<button class="btn btn-primary btn-small" data-booking-status="${b.id}:approved">批准</button><button class="btn btn-danger btn-small" data-booking-status="${b.id}:rejected">拒絕</button>`:''}${b.status==='approved'?`<button class="btn btn-secondary btn-small" data-booking-status="${b.id}:completed">完成</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">暫未有申請</td></tr>'}</tbody></table></div></section>`;
  }

  function bind(){
    qsa('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.editingOrgId=null;state.editingResourceId=null;render();});
    on('[data-new-org]','click',()=>{state.editingOrgId=null;render();setTimeout(()=>qs('[data-org-form] input[name=name]')?.focus(),0)});
    qsa('[data-edit-org]').forEach(b=>b.onclick=()=>{state.editingOrgId=b.dataset.editOrg;render();});
    on('[data-cancel-org]','click',()=>{state.editingOrgId=null;render();});
    on('[data-org-form]','submit',saveOrg);
    qsa('[data-delete-org]').forEach(b=>b.onclick=()=>deleteOrg(b.dataset.deleteOrg));

    qsa('[data-resource-tab]').forEach(b=>b.onclick=()=>{state.resourceType=b.dataset.resourceTab;state.editingResourceId=null;state.selectedResourceId=null;render();});
    on('[data-new-resource]','click',()=>{state.editingResourceId=null;state.selectedResourceId=null;render();});
    qsa('[data-edit-resource]').forEach(b=>b.onclick=()=>{const r=state.resources.find(x=>x.id===b.dataset.editResource);if(r){state.resourceType=r.type;state.editingResourceId=r.id;state.selectedResourceId=r.id;render();}});
    on('[data-cancel-resource]','click',()=>{state.editingResourceId=null;render();});
    on('[data-resource-form]','submit',saveResource);
    const rf=qs('[data-resource-form]'); if(rf&&state.editingResourceId){const r=state.resources.find(x=>x.id===state.editingResourceId); if(r) rf.organization_id.value=r.organization_id;}
    qsa('[data-delete-resource]').forEach(b=>b.onclick=()=>deleteResource(b.dataset.deleteResource));
    qsa('[data-availability]').forEach(b=>b.onclick=()=>{state.selectedResourceId=b.dataset.availability;state.editingResourceId=null;render();});
    const avForm=qs('[data-av-form]'); if(avForm){avForm.mode.onchange=()=>{qs('[data-av-weekday]').style.display=avForm.mode.value==='weekday'?'grid':'none';qs('[data-av-date]').style.display=avForm.mode.value==='date'?'grid':'none';}; avForm.onsubmit=saveAvailability;}
    qsa('[data-delete-av]').forEach(b=>b.onclick=()=>deleteAvailability(b.dataset.deleteAv));
    qsa('[data-booking-status]').forEach(b=>b.onclick=()=>{const [id,status]=b.dataset.bookingStatus.split(':');updateBooking(id,status);});
    on('[data-signout]','click',async()=>{if(supabase)await supabase.auth.signOut();location.reload();});
  }

  async function saveOrg(e){
    e.preventDefault(); const fd=new FormData(e.currentTarget); const name=String(fd.get('name')||'').trim(); const active=fd.get('active')==='on';
    if(!name)return toast('請輸入機構名稱','error');
    try{
      if(DEMO){
        const duplicate=state.organizations.some(o=>o.name.toLowerCase()===name.toLowerCase()&&o.id!==state.editingOrgId); if(duplicate)throw new Error('機構名稱已存在');
        if(state.editingOrgId){const o=state.organizations.find(x=>x.id===state.editingOrgId);Object.assign(o,{name,active});}
        else state.organizations.push({id:uid('org'),name,active,created_at:new Date().toISOString()}); persistDemo();
      }else{
        const payload={name,active};
        const r=state.editingOrgId?await supabase.from('organizations').update(payload).eq('id',state.editingOrgId).select().single():await supabase.from('organizations').insert(payload).select().single();
        if(r.error)throw r.error; await refreshAll();
      }
      state.editingOrgId=null; toast('機構已儲存','success'); render();
    }catch(err){toast(errorMessage(err),'error');}
  }

  async function deleteOrg(id){
    const org=state.organizations.find(x=>x.id===id); if(!org)return;
    const related=state.resources.filter(r=>r.organization_id===id); const hasBookings=state.bookings.some(b=>related.some(r=>r.id===b.resource_id));
    if(hasBookings)return toast('此機構已有借用紀錄，不能直接刪除；請改為停用。','error');
    if(!confirm(`確定刪除「${org.name}」？機構下的房間、物品及時段亦會一併刪除。`))return;
    try{
      if(DEMO){const ids=new Set(related.map(r=>r.id));state.organizations=state.organizations.filter(o=>o.id!==id);state.resources=state.resources.filter(r=>r.organization_id!==id);state.availability=state.availability.filter(a=>!ids.has(a.resource_id));persistDemo();}
      else{const r=await supabase.from('organizations').delete().eq('id',id);if(r.error)throw r.error;await refreshAll();}
      state.editingOrgId=null;toast('機構已刪除','success');render();
    }catch(err){toast('未能刪除機構：'+errorMessage(err),'error');}
  }

  async function saveResource(e){
    e.preventDefault(); const fd=new FormData(e.currentTarget); const organization_id=String(fd.get('organization_id')||''); const name=String(fd.get('name')||'').trim();
    if(!organization_id)return toast('請選擇所屬機構','error'); if(!name)return toast('請輸入名稱','error');
    const type=state.resourceType; const payload={organization_id,type,name,location:String(fd.get('location')||'').trim()||null,description:String(fd.get('description')||'').trim()||null,capacity:type==='room'?Math.max(1,Number(fd.get('capacity')||1)):1,stock_quantity:type==='item'?Math.max(1,Number(fd.get('stock_quantity')||1)):1,requires_room:type==='item'&&fd.get('requires_room')==='on',active:fd.get('active')==='on'};
    try{
      if(DEMO){
        const dup=state.resources.some(r=>r.organization_id===organization_id&&r.type===type&&r.name.toLowerCase()===name.toLowerCase()&&r.id!==state.editingResourceId); if(dup)throw new Error('同一機構已有相同名稱的資源');
        if(state.editingResourceId){const r=state.resources.find(x=>x.id===state.editingResourceId);Object.assign(r,payload);state.selectedResourceId=r.id;}
        else{const r={id:uid(type),...payload,created_at:new Date().toISOString()};state.resources.push(r);state.selectedResourceId=r.id;} persistDemo();
      }else{
        const r=state.editingResourceId?await supabase.from('resources').update(payload).eq('id',state.editingResourceId).select().single():await supabase.from('resources').insert(payload).select().single();
        if(r.error)throw r.error;state.selectedResourceId=r.data.id;await refreshAll();
      }
      state.editingResourceId=null;toast(`${type==='room'?'房間':'物品'}已儲存`,'success');render();
    }catch(err){toast('未能儲存：'+errorMessage(err),'error');}
  }

  async function deleteResource(id){
    const resource=state.resources.find(x=>x.id===id);if(!resource)return;
    if(state.bookings.some(b=>b.resource_id===id))return toast('此資源已有借用紀錄，不能直接刪除；請改為停用。','error');
    if(!confirm(`確定刪除「${resource.name}」？`))return;
    try{
      if(DEMO){state.resources=state.resources.filter(r=>r.id!==id);state.availability=state.availability.filter(a=>a.resource_id!==id);persistDemo();}
      else{const r=await supabase.from('resources').delete().eq('id',id);if(r.error)throw r.error;await refreshAll();}
      state.editingResourceId=null;if(state.selectedResourceId===id)state.selectedResourceId=null;toast('資源已刪除','success');render();
    }catch(err){toast('未能刪除：'+errorMessage(err),'error');}
  }

  async function saveAvailability(e){
    e.preventDefault(); if(!state.selectedResourceId)return; const fd=new FormData(e.currentTarget);const mode=String(fd.get('mode'));const start_time=String(fd.get('start_time'));const end_time=String(fd.get('end_time'));
    if(!start_time||!end_time||end_time<=start_time)return toast('請輸入有效開始及結束時間','error');
    const payload={resource_id:state.selectedResourceId,specific_date:mode==='date'?String(fd.get('specific_date')||'')||null:null,weekday:mode==='weekday'?Number(fd.get('weekday')):null,date_from:null,date_to:null,start_time,end_time,active:true};
    if(mode==='date'&&!payload.specific_date)return toast('請選擇指定日期','error');
    try{if(DEMO){state.availability.push({id:uid('av'),...payload});persistDemo();}else{const r=await supabase.from('resource_availability').insert(payload);if(r.error)throw r.error;await refreshAll();}toast('可用時段已新增','success');render();}catch(err){toast(errorMessage(err),'error');}
  }
  async function deleteAvailability(id){
    if(!confirm('確定刪除此時段？'))return;
    try{if(DEMO){state.availability=state.availability.filter(a=>a.id!==id);persistDemo();}else{const r=await supabase.from('resource_availability').delete().eq('id',id);if(r.error)throw r.error;await refreshAll();}toast('時段已刪除','success');render();}catch(err){toast(errorMessage(err),'error');}
  }
  async function updateBooking(id,status){
    try{
      if(DEMO){const b=state.bookings.find(x=>x.id===id);if(b)b.status=status;persistDemo();}
      else{const r=await supabase.rpc('update_booking_status',{p_booking_id:id,p_status:status,p_admin_note:null});if(r.error)throw r.error;await refreshAll();}
      toast('申請狀態已更新','success');render();
    }catch(err){toast(errorMessage(err),'error');}
  }

  function renderLogin(message=''){
    app.innerHTML=`<div class="login-shell"><form class="login-card" data-login><h1>管理員登入</h1><p>使用已設定為 admin 的 Supabase 帳戶登入。</p>${message?`<div class="error-box">${esc(message)}</div>`:''}<div class="field"><span>電郵</span><input class="input" type="email" name="email" required autocomplete="username"></div><div class="field"><span>密碼</span><input class="input" type="password" name="password" required autocomplete="current-password"></div><button class="btn btn-primary" type="submit">登入</button><p class="mini">登入入口只設於桌面管理員頁面。</p></form></div>`;
    qs('[data-login]').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const {data,error}=await supabase.auth.signInWithPassword({email:String(fd.get('email')),password:String(fd.get('password'))});if(error)return renderLogin(error.message);const ok=await verifyAdmin(data.user);if(!ok){await supabase.auth.signOut();return renderLogin('此帳戶沒有管理員權限。');}state.user=data.user;await refreshAll();render();};
  }
  function renderConfigError(){renderFatal('目前已設定為正式模式，但 config.js 尚未填入 Supabase URL 或 Publishable Key。');}
  function renderFatal(message){app.innerHTML=`<div class="login-shell"><div class="login-card"><h1>管理員後台未能載入</h1><div class="error-box">${esc(message)}</div><a class="btn btn-secondary" href="index.html" style="display:block;text-align:center;text-decoration:none">返回前台</a></div></div>`;}

  function orgName(id){return state.organizations.find(x=>x.id===id)?.name||'—';}
  function resourceName(id){return state.resources.find(x=>x.id===id)?.name||'—';}
  function shortTime(v){return String(v||'').slice(0,5);}
  function statusLabel(s){return ({pending:'待審批',approved:'已批准',rejected:'已拒絕',completed:'已完成',cancelled:'已取消'})[s]||s||'—';}
  function errorMessage(err){if(!err)return'未知錯誤';if(typeof err==='string')return err;const m=err.message||err.error_description||err.details||'操作失敗';if(/row-level security|permission denied/i.test(m))return'資料庫權限不足。請確認登入帳戶在 profiles 表中的 role 為 admin，並執行 admin CRUD 修復 SQL。';if(/duplicate|unique/i.test(m))return'名稱已存在，請使用另一個名稱。';return m;}
  function toast(msg,type=''){const d=document.createElement('div');d.className=`toast ${type}`;d.textContent=msg;toastRoot.appendChild(d);setTimeout(()=>d.remove(),3300);}
  function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function attr(s){return esc(s).replace(/"/g,'&quot;');}
  function qs(sel){return document.querySelector(sel)} function qsa(sel){return [...document.querySelectorAll(sel)]} function on(sel,event,fn){const el=qs(sel);if(el)el.addEventListener(event,fn)}
})();
