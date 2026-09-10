(function(){
  'use strict';
  const app=document.getElementById('app');
  const toastRoot=document.getElementById('toast-root');
  const cfg=window.APP_CONFIG||{};
  const DEMO=cfg.demoMode!==false;
  const DEMO_KEY='rrbs_admin_demo_v4';
  const SYNC_CHANNEL='rrbs-resource-sync';
  let syncChannel=null;
  const state={tab:'organizations',organizations:[],resources:[],availability:[],bookings:[],resourceBlocks:[],purposeOptions:[],resourceType:'room',editingOrgId:null,editingResourceId:null,selectedResourceId:null,editingPurposeId:null,user:null,loading:false,error:'',calendarResourceId:null,calendarMonthOffset:0,calendarSelectedDate:null,editingCalendarBookingId:null,creatingCalendarBooking:false,telegramStatus:{configured:false,bot_token_set:false,chat_id_set:false,chat_id_masked:null},bookingPolicy:{active:false,mode:'fixed_month_day',scope:'month',fixed_day:20,days_before:14,open_time:'12:00:00'}};
  let supabase=null;

  const seed={
    organizations:[
      {id:'org-demo-1',name:'社區綜合服務中心',access_password:'1234',active:true,created_at:new Date().toISOString()},
      {id:'org-demo-2',name:'樂齡活動中心',access_password:'1234',active:true,created_at:new Date().toISOString()}
    ],
    resources:[
      {id:'room-demo-1',organization_id:'org-demo-1',type:'room',name:'活動室 1-2',location:'1/F',description:'適合小組及活動',capacity:20,stock_quantity:1,requires_room:false,image_url:null,active:true},
      {id:'room-demo-2',organization_id:'org-demo-1',type:'room',name:'會議室',location:'2/F',description:'適合會議',capacity:10,stock_quantity:1,requires_room:false,image_url:null,active:true},
      {id:'item-demo-1',organization_id:'org-demo-1',type:'item',name:'投影機',location:'中心內',description:'中心即日使用',capacity:1,stock_quantity:2,requires_room:true,image_url:null,active:true},
      {id:'item-demo-2',organization_id:'org-demo-1',type:'item',name:'輪椅',location:'地下接待處',description:'可外借',capacity:1,stock_quantity:3,requires_room:false,image_url:null,active:true}
    ],
    availability:[
      {id:'av-1',resource_id:'room-demo-1',weekday:1,specific_date:null,date_from:null,date_to:null,start_time:'09:00',end_time:'18:00',active:true},
      {id:'av-2',resource_id:'room-demo-2',weekday:2,specific_date:null,date_from:null,date_to:null,start_time:'09:00',end_time:'17:00',active:true}
    ],bookings:[],resourceBlocks:[],purposeOptions:[
      {id:'purpose-case',label:'個案',active:true,sort_order:1},
      {id:'purpose-group',label:'小組',active:true,sort_order:2},
      {id:'purpose-outing',label:'外出活動',active:true,sort_order:3}
    ]
  };

  init();

  async function init(){
    setupCrossPageSync();
    try{
      if(DEMO){ loadDemo(); state.user={email:'demo-admin@local'}; render(); return; }
      if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){ return renderConfigError(); }
      if(!window.supabase){ return renderFatal('Supabase library 未能載入，請重新整理頁面。'); }
      supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
      setupRealtime();
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){ renderLogin(); return; }
      const allowed=await verifyAdmin(session.user);
      if(!allowed){ await supabase.auth.signOut(); renderLogin('此帳戶沒有管理員權限。'); return; }
      state.user=session.user; await refreshAll(); render();
    }catch(err){renderFatal(errorMessage(err));}
  }


  function setupCrossPageSync(){
    window.addEventListener('storage',async event=>{
      if(DEMO&&event.key===DEMO_KEY){loadDemo();render();}
    });
    if('BroadcastChannel' in window){
      syncChannel=new BroadcastChannel(SYNC_CHANNEL);
      syncChannel.onmessage=async()=>{
        if(DEMO){loadDemo();render();}
        else if(supabase){await refreshAll();render();}
      };
    }
  }

  function setupRealtime(){
    if(!supabase||state._realtimeReady)return;
    state._realtimeReady=true;
    supabase.channel('rrbs-admin-sync')
      .on('postgres_changes',{event:'*',schema:'public',table:'organizations'},async()=>{await refreshAll();render();})
      .on('postgres_changes',{event:'*',schema:'public',table:'resources'},async()=>{await refreshAll();render();})
      .on('postgres_changes',{event:'*',schema:'public',table:'resource_availability'},async()=>{await refreshAll();render();})
      .on('postgres_changes',{event:'*',schema:'public',table:'bookings'},async()=>{await refreshAll();render();})
      .on('postgres_changes',{event:'*',schema:'public',table:'resource_blocks'},async()=>{await refreshAll();render();})
      .on('postgres_changes',{event:'*',schema:'public',table:'purpose_options'},async()=>{await refreshAll();render();})
      .subscribe();
  }

  function loadDemo(){
    try{
      const saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'null');
      const data=saved||seed;
      state.organizations=clone(data.organizations||[]);
      state.resources=clone(data.resources||[]);
      state.availability=clone(data.availability||[]);
      state.bookings=clone(data.bookings||[]);
      state.resourceBlocks=clone(data.resourceBlocks||data.resource_blocks||[]);
      state.purposeOptions=clone(data.purposeOptions||data.purpose_options||seed.purposeOptions); state.telegramStatus={configured:false,bot_token_set:false,chat_id_set:false,chat_id_masked:null};
      if(!saved) persistDemo();
    }catch(_){
      state.organizations=clone(seed.organizations); state.resources=clone(seed.resources); state.availability=clone(seed.availability); state.bookings=[]; state.resourceBlocks=[]; state.purposeOptions=clone(seed.purposeOptions); state.telegramStatus={configured:false,bot_token_set:false,chat_id_set:false,chat_id_masked:null}; persistDemo();
    }
  }
  function persistDemo(){ localStorage.setItem(DEMO_KEY,JSON.stringify({organizations:state.organizations,resources:state.resources,availability:state.availability,bookings:state.bookings,resourceBlocks:state.resourceBlocks,purposeOptions:state.purposeOptions})); if(syncChannel)syncChannel.postMessage({type:'changed',at:Date.now()}); }
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}

  async function verifyAdmin(user){
    const {data,error}=await supabase.from('profiles').select('role').eq('id',user.id).single();
    if(error) throw error;
    return data&&data.role==='admin';
  }
  async function refreshAll(){
    const [orgs,res,av,bks,blocks,purposes,policy]=await Promise.all([
      supabase.from('organizations').select('id,name,active,created_at,updated_at').order('name'),
      supabase.from('resources').select('*').order('type').order('name'),
      supabase.from('resource_availability').select('*').order('resource_id'),
      supabase.from('bookings').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('resource_blocks').select('*').order('block_date'),
      supabase.from('purpose_options').select('*').order('sort_order').order('label'),
      supabase.from('booking_policy').select('*').eq('singleton',true).maybeSingle()
    ]);
    for(const r of [orgs,res,av,bks,blocks,purposes,policy]) if(r.error) throw r.error;
    state.organizations=orgs.data||[]; state.resources=res.data||[]; state.availability=av.data||[]; state.bookings=bks.data||[]; state.resourceBlocks=blocks.data||[]; state.purposeOptions=purposes.data||[]; if(policy.data)state.bookingPolicy=policy.data;
    const tg=await supabase.rpc('admin_get_telegram_notification_status');
    if(!tg.error&&tg.data)state.telegramStatus=tg.data;
  }

  function render(){
    app.innerHTML=`<div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand"><div class="admin-brand-mark">R</div><div><h1>資源預約管理</h1><p>房間及物品預約系統</p></div></div>
        <div class="mode-note">${DEMO?'Demo Mode：修改會儲存在此瀏覽器':'Supabase 正式模式'}</div>
        <nav class="side-nav">
          ${navBtn('organizations','機構管理')}${navBtn('resources','房間／物品')}${navBtn('booking-policy','開放申請期限')}${navBtn('borrowing','借用狀況')}${navBtn('purposes','用途設定')}${navBtn('bookings','申請審批')}${navBtn('telegram','Telegram 通知')}${navBtn('dashboard','概覽')}
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
    if(state.tab==='booking-policy')return bookingPolicyView();
    if(state.tab==='borrowing')return borrowingStatusView();
    if(state.tab==='purposes')return purposeOptionsView();
    if(state.tab==='bookings')return bookingsView();
    if(state.tab==='telegram')return telegramView();
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
    return `${top('機構管理','管理機構及前台登入密碼；不同機構的資源與借用資料會分開顯示')}
      <div class="grid-two">
        <section class="panel"><div class="panel-head"><div><h3>機構列表</h3><p>共 ${state.organizations.length} 個機構</p></div><button class="btn btn-primary" data-new-org>＋ 新增機構</button></div>
          <div class="table-wrap"><table><thead><tr><th>機構名稱</th><th>前台密碼</th><th>狀態</th><th>房間／物品</th><th>操作</th></tr></thead><tbody>
          ${state.organizations.length?state.organizations.map(org=>`<tr><td><strong>${esc(org.name)}</strong></td><td><span class="tag blue">已設定</span></td><td><span class="tag ${org.active?'green':'gray'}">${org.active?'啟用':'停用'}</span></td><td>${state.resources.filter(r=>r.organization_id===org.id).length}</td><td><div class="row-actions"><button class="btn btn-secondary btn-small" data-edit-org="${org.id}">修改</button><button class="btn btn-danger btn-small" data-delete-org="${org.id}">刪除</button></div></td></tr>`).join(''):`<tr><td colspan="${state.resourceType==='item'?6:5}" class="empty">尚未建立機構</td></tr>`}
          </tbody></table></div>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>${edit?'修改機構':'新增機構'}</h3><p>${edit?'可同時更改前台登入密碼；留空即保留原密碼':'新機構必須設定前台登入密碼'}</p></div></div>
          <form data-org-form class="form-card">
            <div class="field"><span>機構名稱 *</span><input class="input" name="name" required maxlength="120" value="${attr(edit?.name||'')}" placeholder="例如：社區綜合服務中心"></div>
            <div class="field"><span>前台登入密碼 ${edit?'（留空＝不更改）':'*'}</span><input class="input" type="password" name="access_password" ${edit?'':'required'} minlength="4" maxlength="64" autocomplete="new-password" placeholder="至少 4 個字元"></div>
            <div class="mini" style="margin-top:8px">前台用戶需要先選擇機構並輸入此密碼，才可以預約或查詢該機構資料。</div>
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
          <div class="table-wrap"><table><thead><tr><th>名稱</th><th>機構</th><th>${state.resourceType==='room'?'容量':'庫存'}</th>${state.resourceType==='item'?'<th>分類</th>':''}<th>狀態</th><th>操作</th></tr></thead><tbody>
          ${filtered.length?filtered.map(r=>`<tr><td><div class="resource-name-cell">${r.image_url?`<img class="resource-thumb" src="${attr(r.image_url)}" alt="">`:'<div class="resource-thumb placeholder">無圖</div>'}<div><strong>${esc(r.name)}</strong><div class="mini">${esc(r.location||'')}</div></div></div></td><td>${esc(orgName(r.organization_id))}</td><td>${r.type==='room'?`${Number(r.capacity)||1} 人`:`${Number(r.stock_quantity)||1} 件`}</td>${r.type==='item'?`<td>${esc(r.category||'未分類')}</td>`:''}<td><span class="tag ${r.active?'green':'gray'}">${r.active?'啟用':'停用'}</span></td><td><div class="row-actions"><button class="btn btn-secondary btn-small" data-edit-resource="${r.id}">修改</button><button class="btn btn-secondary btn-small" data-availability="${r.id}">時段</button><button class="btn btn-danger btn-small" data-delete-resource="${r.id}">刪除</button></div></td></tr>`).join(''):`<tr><td colspan="${state.resourceType==='item'?6:5}" class="empty">尚未建立${state.resourceType==='room'?'房間':'物品'}</td></tr>`}
          </tbody></table></div>
        </section>
        <div>
          <section class="panel"><div class="panel-head"><div><h3>${edit?'修改':'新增'}${state.resourceType==='room'?'房間':'物品'}</h3><p>填寫基本資料後儲存</p></div></div>
            <form data-resource-form class="form-card">
              <div class="form-grid">
                <div class="field full"><span>所屬機構 *</span><select class="select" name="organization_id" required><option value="">請選擇</option>${orgOptions}</select></div>
                <div class="field full"><span>名稱 *</span><input class="input" name="name" required maxlength="120" value="${attr(edit?.name||'')}" placeholder="例如：活動室 1-2"></div>
                <div class="field"><span>位置</span><input class="input" name="location" value="${attr(edit?.location||'')}" placeholder="例如：1/F"></div>
                ${state.resourceType==='room'?`<div class="field"><span>可容納人數 *</span><input class="input" type="number" name="capacity" min="1" required value="${edit?.capacity||20}"></div>`:`<div class="field"><span>庫存數量 *</span><input class="input" type="number" name="stock_quantity" min="1" required value="${edit?.stock_quantity||1}"></div><div class="field"><span>物品分類</span><input class="input" name="category" maxlength="60" value="${attr(edit?.category||'')}" placeholder="例如：影音器材／輔助器材／運動用品"></div>`}
                <div class="field full"><span>圖片</span><div class="admin-image-box">${edit?.image_url?`<img data-resource-image-preview src="${attr(edit.image_url)}" alt="資源圖片">`:'<div data-resource-image-empty>尚未上載圖片</div>'}</div><input class="input" type="file" name="image" accept="image/jpeg,image/png,image/webp"><div class="mini">支援 JPG、PNG、WebP，建議 2MB 以下。</div></div><div class="field full"><span>描述</span><textarea class="textarea" name="description" placeholder="簡單描述用途或借用限制">${esc(edit?.description||'')}</textarea></div>
                ${state.resourceType==='item'?`<label class="checkline full"><input type="checkbox" name="requires_room" ${edit?.requires_room?'checked':''}> 此物品只可配合房間預約／中心內使用（不勾選＝可同房間預約及可單獨外借）</label>`:''}
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

  function bookingPolicyView(){
    const p=state.bookingPolicy||{};
    const preset=policyPresetValue(p);
    return `${top('開放申請時間','設定所有房間及物品何時開放預約')}
      <section class="panel">
        <div class="panel-head"><div><h3>預約開放規則</h3><p>先揀常用設定；只有特別安排先需要使用「自訂規則」。</p></div></div>
        <form data-booking-policy-form class="form-card">
          <label class="checkline"><input type="checkbox" name="active" ${p.active?'checked':''}> 啟用預約開放限制</label>
          <div class="form-grid policy-simple-grid" style="margin-top:14px">
            <div class="field full"><span>常用設定</span><select class="select" name="preset" data-policy-preset>
              <option value="monthly_next_month" ${preset==='monthly_next_month'?'selected':''}>每月指定日期及時間，開放下一個月</option>
              <option value="days14_next_month" ${preset==='days14_next_month'?'selected':''}>下一個月開始前 14 日，開放下一個月</option>
              <option value="days7_next_week" ${preset==='days7_next_week'?'selected':''}>下一星期開始前 7 日，開放下一星期</option>
              <option value="custom" ${preset==='custom'?'selected':''}>自訂規則</option>
            </select></div>
            <div class="field" data-policy-fixed-day><span>每月幾號開放</span><input class="input" type="number" name="fixed_day" min="1" max="28" value="${Number(p.fixed_day||20)}"></div>
            <div class="field"><span>開放時間</span><input class="input" type="time" name="open_time" value="${attr(shortTime(p.open_time||'12:00'))}" required></div>
          </div>
          <div class="policy-custom-box" data-policy-custom ${preset==='custom'?'':'style="display:none"'}>
            <div class="form-grid">
              <div class="field full"><span>自訂開放方式</span><select class="select" name="mode" data-policy-mode>
                <option value="fixed_month_day" ${p.mode==='fixed_month_day'?'selected':''}>每月指定日子／時間開放</option>
                <option value="days_before_period" ${p.mode==='days_before_period'?'selected':''}>目標期間開始前 N 日／指定時間開放</option>
              </select></div>
              <div class="field"><span>開放範圍</span><select class="select" name="scope" data-policy-scope>
                <option value="week" ${p.scope==='week'?'selected':''}>下一星期</option>
                <option value="month" ${p.scope==='month'?'selected':''}>下一個月</option>
                <option value="quarter" ${p.scope==='quarter'?'selected':''}>下一自然季度</option>
              </select></div>
              <div class="field" data-policy-days-before><span>提前幾多日</span><input class="input" type="number" name="days_before" min="0" max="365" value="${Number(p.days_before||14)}"></div>
            </div>
          </div>
          <div class="policy-preview" data-policy-preview>${bookingPolicyPreviewHtml(p)}</div>
          <div class="notice policy-help"><strong>點樣理解？</strong><br>
            例如設定「每月 20 號、12:00、開放下一個月」：到 9 月 20 日中午 12:00，系統先會開放 10 月 1–31 日嘅預約。
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">儲存設定</button></div>
        </form>
      </section>`;
  }

  function policyPresetValue(p){
    if(p.mode==='fixed_month_day'&&p.scope==='month')return 'monthly_next_month';
    if(p.mode==='days_before_period'&&p.scope==='month'&&Number(p.days_before)===14)return 'days14_next_month';
    if(p.mode==='days_before_period'&&p.scope==='week'&&Number(p.days_before)===7)return 'days7_next_week';
    return 'custom';
  }

  function policyPayloadFromForm(form){
    const fd=new FormData(form);
    const preset=String(fd.get('preset')||'custom');
    let mode=String(fd.get('mode')||'fixed_month_day');
    let scope=String(fd.get('scope')||'month');
    let fixedDay=Math.min(28,Math.max(1,Number(fd.get('fixed_day')||20)));
    let daysBefore=Math.min(365,Math.max(0,Number(fd.get('days_before')||14)));
    if(preset==='monthly_next_month'){mode='fixed_month_day';scope='month';}
    if(preset==='days14_next_month'){mode='days_before_period';scope='month';daysBefore=14;}
    if(preset==='days7_next_week'){mode='days_before_period';scope='week';daysBefore=7;}
    return {active:fd.get('active')==='on',mode,scope,fixed_day:fixedDay,days_before:daysBefore,open_time:String(fd.get('open_time')||'12:00'),updated_at:new Date().toISOString()};
  }

  function bookingPolicyPreviewHtml(p){
    const info=calculatePolicyPreview(p);
    if(!p.active)return '<strong>目前狀態：</strong>未啟用限制，用戶可按房間／物品可用情況隨時提交申請。';
    if(!info)return '<strong>設定預覽：</strong>請完成上方設定。';
    return `<strong>下一次開放：</strong>${esc(info.openLabel)}<br><strong>屆時開放：</strong>${esc(info.rangeLabel)}`;
  }

  function calculatePolicyPreview(p){
    try{
      const now=new Date();
      const hhmm=shortTime(p.open_time||'12:00');
      const [hh,mm]=hhmm.split(':').map(Number);
      let open,start,end;
      if(p.mode==='fixed_month_day'){
        open=new Date(now.getFullYear(),now.getMonth(),Math.min(28,Math.max(1,Number(p.fixed_day||20))),hh,mm,0,0);
        if(now>=open)open=new Date(now.getFullYear(),now.getMonth()+1,Math.min(28,Math.max(1,Number(p.fixed_day||20))),hh,mm,0,0);
        if(p.scope==='month'){start=new Date(open.getFullYear(),open.getMonth()+1,1);end=new Date(open.getFullYear(),open.getMonth()+2,0);}
        else if(p.scope==='quarter'){start=new Date(open.getFullYear(),open.getMonth()+1,1);end=new Date(open.getFullYear(),open.getMonth()+4,0);}
        else {start=new Date(open);start.setDate(start.getDate()+1);end=new Date(start);end.setDate(end.getDate()+6);}
      }else{
        const n=Math.max(0,Number(p.days_before||0));
        if(p.scope==='week'){
          const day=(now.getDay()+6)%7; start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-day+7);
          open=new Date(start);open.setDate(open.getDate()-n);open.setHours(hh,mm,0,0);
          if(now>=open){start.setDate(start.getDate()+7);open=new Date(start);open.setDate(open.getDate()-n);open.setHours(hh,mm,0,0);} end=new Date(start);end.setDate(end.getDate()+6);
        }else if(p.scope==='quarter'){
          const q=Math.floor(now.getMonth()/3);start=new Date(now.getFullYear(),(q+1)*3,1);open=new Date(start);open.setDate(open.getDate()-n);open.setHours(hh,mm,0,0);
          if(now>=open){start=new Date(start.getFullYear(),start.getMonth()+3,1);open=new Date(start);open.setDate(open.getDate()-n);open.setHours(hh,mm,0,0);} end=new Date(start.getFullYear(),start.getMonth()+3,0);
        }else{
          start=new Date(now.getFullYear(),now.getMonth()+1,1);open=new Date(start);open.setDate(open.getDate()-n);open.setHours(hh,mm,0,0);
          if(now>=open){start=new Date(now.getFullYear(),now.getMonth()+2,1);open=new Date(start);open.setDate(open.getDate()-n);open.setHours(hh,mm,0,0);} end=new Date(start.getFullYear(),start.getMonth()+1,0);
        }
      }
      const fmt=d=>`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
      return {openLabel:`${fmt(open)} ${String(open.getHours()).padStart(2,'0')}:${String(open.getMinutes()).padStart(2,'0')}`,rangeLabel:`${fmt(start)} 至 ${fmt(end)}`};
    }catch(_){return null;}
  }

  function purposeOptionsView(){
    const edit=state.purposeOptions.find(x=>x.id===state.editingPurposeId)||null;
    const sorted=[...state.purposeOptions].sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.label).localeCompare(String(b.label)));
    return `${top('用途設定','管理外借物品申請時顯示的用途快捷按鈕')}
      <div class="grid-two">
        <section class="panel"><div class="panel-head"><div><h3>用途選項</h3><p>前台只顯示啟用中的選項</p></div><button class="btn btn-primary" data-new-purpose>＋ 新增用途</button></div>
          <div class="table-wrap"><table><thead><tr><th>用途</th><th>排序</th><th>狀態</th><th>操作</th></tr></thead><tbody>
          ${sorted.length?sorted.map(x=>`<tr><td><strong>${esc(x.label)}</strong></td><td>${Number(x.sort_order)||0}</td><td><span class="tag ${x.active?'green':'gray'}">${x.active?'啟用':'停用'}</span></td><td><div class="row-actions"><button class="btn btn-secondary btn-small" data-edit-purpose="${x.id}">修改</button><button class="btn btn-danger btn-small" data-delete-purpose="${x.id}">刪除</button></div></td></tr>`).join(''):'<tr><td colspan="4" class="empty">尚未建立用途選項</td></tr>'}
          </tbody></table></div>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>${edit?'修改用途':'新增用途'}</h3><p>例如：個案、小組、外出活動</p></div></div>
          <form data-purpose-form class="form-card">
            <div class="form-grid"><div class="field full"><span>用途名稱 *</span><input class="input" name="label" required maxlength="50" value="${attr(edit?.label||'')}"></div><div class="field"><span>排序</span><input class="input" type="number" name="sort_order" min="0" value="${Number(edit?.sort_order??state.purposeOptions.length+1)}"></div><label class="checkline"><input type="checkbox" name="active" ${!edit||edit.active?'checked':''}> 啟用</label></div>
            <div class="form-actions">${edit?'<button type="button" class="btn btn-secondary" data-cancel-purpose>取消</button>':''}<button class="btn btn-primary" type="submit">${edit?'儲存修改':'新增用途'}</button></div>
          </form>
        </section>
      </div>`;
  }

  function borrowingStatusView(){
    const activeResources=state.resources.filter(r=>r.active!==false);
    if(!state.calendarResourceId || !state.resources.some(r=>r.id===state.calendarResourceId)) state.calendarResourceId=activeResources[0]?.id||state.resources[0]?.id||null;
    const resource=state.resources.find(r=>r.id===state.calendarResourceId)||null;
    const selectedDate=state.calendarSelectedDate;
    const dayBookings=resource&&selectedDate?calendarBookingsForDate(resource.id,selectedDate):[];
    const block=resource&&selectedDate?getResourceBlock(resource.id,selectedDate):null;
    const canBlock=resource&&selectedDate&&calendarDayBaseAvailable(resource,selectedDate)&&!dayBookings.some(isOccupyingBooking);
    const editBooking=state.bookings.find(b=>b.id===state.editingCalendarBookingId)||null;
    const showCreate=!!(resource&&selectedDate&&state.creatingCalendarBooking&&!block);
    return `${top('借用狀況','點擊日期可新增、檢視、修改或刪除預約')}
      <section class="panel borrowing-panel">
        <div class="borrowing-toolbar">
          <div class="field"><span>房間／物品</span><select class="select" data-calendar-resource>${state.resources.map(r=>`<option value="${r.id}" ${r.id===state.calendarResourceId?'selected':''}>${esc(r.type==='room'?'房間':'物品')}｜${esc(r.name)}${r.active?'':'（停用）'}</option>`).join('')}</select></div>
          <div class="calendar-legend"><span><i class="legend-dot green"></i>空位</span><span><i class="legend-dot red"></i>已借用</span><span><i class="legend-dot gray"></i>不可借用</span></div>
        </div>
        ${resource?renderBorrowingCalendar(resource):'<div class="empty">尚未建立房間或物品</div>'}
      </section>
      ${resource&&selectedDate?`<section class="panel calendar-detail-panel">
        <div class="panel-head"><div><h3>${esc(resource.name)}｜${esc(selectedDate)}</h3><p>${dayBookings.length?`當日有 ${dayBookings.length} 筆此資源的預約紀錄`:(block?'此日期已由管理員設為不可借用':'目前沒有預約紀錄')}</p></div>
          <div class="row-actions">
            ${!block?`<button class="btn btn-primary" data-calendar-new-booking>＋ 新增預約</button>`:''}
            ${block?`<button class="btn btn-secondary" data-unblock-date="${attr(block.id)}">解除不可借用</button>`:(canBlock?`<button class="btn btn-danger" data-block-date="${attr(selectedDate)}">☑ 設為不可借用</button>`:'')}
          </div>
        </div>
        ${block?`<div class="notice warn">灰色日期：${esc(block.note||'管理員已封鎖此日期，前台不可預約。')}</div>`:''}
        ${dayBookings.length?`<div class="calendar-booking-list">${dayBookings.map(b=>renderCalendarBookingRow(b)).join('')}</div>`:'<div class="empty compact">當日沒有預約紀錄；點擊「新增預約」可直接建立。</div>'}
        ${showCreate?renderCalendarBookingEditor(null,resource,selectedDate):''}
        ${editBooking?renderCalendarBookingEditor(editBooking,state.resources.find(r=>r.id===editBooking.resource_id)||resource,editBooking.booking_date):''}
      </section>`:''}`;
  }

  function renderBorrowingCalendar(resource){
    const base=new Date();
    const month=new Date(base.getFullYear(),base.getMonth()+state.calendarMonthOffset,1);
    const year=month.getFullYear(),monthNo=month.getMonth();
    const firstDay=new Date(year,monthNo,1).getDay();
    const days=new Date(year,monthNo+1,0).getDate();
    const cells=[]; for(let i=0;i<firstDay;i++)cells.push(null); for(let d=1;d<=days;d++)cells.push(new Date(year,monthNo,d)); while(cells.length%7)cells.push(null);
    const names=['日','一','二','三','四','五','六'];
    return `<div class="admin-calendar">
      <div class="admin-calendar-head"><button class="calendar-nav-btn" data-calendar-month="prev">‹</button><strong>${year}年${monthNo+1}月</strong><button class="calendar-nav-btn" data-calendar-month="next">›</button></div>
      <div class="admin-calendar-weekdays">${names.map(n=>`<div>${n}</div>`).join('')}</div>
      <div class="admin-calendar-grid">${cells.map(d=>d?renderBorrowingDay(resource,toIsoDate(d),d.getDate()):'<div class="admin-day empty-cell"></div>').join('')}</div>
    </div>`;
  }

  function renderBorrowingDay(resource,dateIso,dayNo){
    const bookings=calendarBookingsForDate(resource.id,dateIso);
    const occupied=bookings.some(isOccupyingBooking);
    const pending=bookings.some(b=>b.status==='pending');
    const block=getResourceBlock(resource.id,dateIso);
    const baseAvailable=calendarDayBaseAvailable(resource,dateIso);
    const status=occupied?'red':(block||!baseAvailable?'gray':'green');
    const selected=state.calendarSelectedDate===dateIso?' selected':'';
    const label=occupied?'已借用':(block?'不可借用':(!baseAvailable?'未開放':'空位'));
    return `<button class="admin-day ${status}${selected}" data-calendar-date="${dateIso}"><span class="day-number">${dayNo}</span><span class="day-state">${label}</span>${pending&&!occupied?'<span class="pending-dot" title="有待審批申請"></span>':''}</button>`;
  }

  function calendarBookingsForDate(resourceId,dateIso){
    return state.bookings.filter(b=>b.resource_id===resourceId && bookingTouchesDate(b,dateIso));
  }
  function bookingTouchesDate(b,dateIso){const start=String(b.booking_date||'');const end=String(b.loan_end_date||start);return !!start&&dateIso>=start&&dateIso<=end;}
  function isOccupyingBooking(b){return ['approved','completed'].includes(b.status);}
  function getResourceBlock(resourceId,dateIso){return state.resourceBlocks.find(x=>x.resource_id===resourceId&&String(x.block_date)===dateIso)||null;}
  function calendarDayBaseAvailable(resource,dateIso){
    if(dateIso<todayIso() && !calendarBookingsForDate(resource.id,dateIso).length)return false;
    const rules=state.availability.filter(a=>a.resource_id===resource.id&&a.active!==false);
    if(resource.type==='item' && !rules.length)return true;
    const weekday=new Date(`${dateIso}T12:00:00`).getDay();
    return rules.some(rule=>availabilityRuleMatches(rule,dateIso,weekday));
  }
  function availabilityRuleMatches(rule,dateIso,weekday){if(rule.specific_date)return String(rule.specific_date)===dateIso;if(rule.weekday===null||rule.weekday===undefined||Number(rule.weekday)!==Number(weekday))return false;if(rule.date_from&&dateIso<String(rule.date_from))return false;if(rule.date_to&&dateIso>String(rule.date_to))return false;return true;}

  function relatedItemBookings(roomBookingId){
    return state.bookings.filter(x=>x.related_booking_id===roomBookingId && state.resources.find(r=>r.id===x.resource_id)?.type==='item');
  }
  function parentRoomBooking(itemBooking){
    if(!itemBooking?.related_booking_id)return null;
    const parent=state.bookings.find(x=>x.id===itemBooking.related_booking_id);
    return parent&&state.resources.find(r=>r.id===parent.resource_id)?.type==='room'?parent:null;
  }
  function roomAttachableItems(room){
    if(!room||room.type!=='room')return[];
    return state.resources.filter(r=>r.type==='item'&&r.active!==false&&r.organization_id===room.organization_id);
  }

  function renderCalendarBookingRow(b){
    const resource=state.resources.find(r=>r.id===b.resource_id);
    const range=b.loan_end_date&&b.loan_end_date!==b.booking_date?`${b.booking_date} 至 ${b.loan_end_date}`:b.booking_date;
    const related=resource?.type==='room'?relatedItemBookings(b.id):[];
    const parent=resource?.type==='item'?parentRoomBooking(b):null;
    const relationship=related.length
      ? `<div class="calendar-related-line"><strong>同日物品：</strong>${related.map(x=>`${esc(resourceName(x.resource_id))} × ${Number(x.quantity||1)}`).join('、')}</div>`
      : (parent?`<div class="calendar-related-line"><strong>配合房間：</strong>${esc(resourceName(parent.resource_id))}｜${shortTime(parent.start_time)}–${shortTime(parent.end_time)}</div>`:'');
    return `<div class="calendar-booking-row"><div><strong>${esc(resourceName(b.resource_id))}</strong><div class="mini">${esc(range||'')}｜${shortTime(b.start_time)}–${shortTime(b.end_time)}｜數量 ${Number(b.quantity||1)}</div><div class="mini">${esc(b.applicant_name||'')} ${b.phone?`｜${esc(b.phone)}`:''}｜${esc(b.purpose||'')}</div>${relationship}</div><div class="row-actions"><span class="tag ${b.status==='approved'?'green':b.status==='pending'?'':'gray'}">${statusLabel(b.status)}</span><button class="btn btn-secondary btn-small" data-calendar-edit-booking="${b.id}">檢視／修改</button><button class="btn btn-danger btn-small" data-calendar-delete-booking="${b.id}">刪除</button></div></div>`;
  }

  function renderCalendarBookingEditor(b,resource,dateIso){
    const isNew=!b;
    const selectedResource=resource||state.resources.find(r=>r.id===state.calendarResourceId)||null;
    if(!selectedResource)return'';
    const date=b?.booking_date||dateIso||state.calendarSelectedDate||todayIso();
    const related= b&&selectedResource.type==='room'?relatedItemBookings(b.id):[];
    const attachedQty={}; related.forEach(x=>attachedQty[x.resource_id]=(attachedQty[x.resource_id]||0)+Number(x.quantity||1));
    const items=roomAttachableItems(selectedResource);
    const purposes=state.purposeOptions.filter(x=>x.active!==false).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    const defaultPurpose=b?.purpose||purposes[0]?.label||'個案';
    const parentForItem=b&&selectedResource.type==='item'?parentRoomBooking(b):null;
    const loanEnd=selectedResource.type==='item'?(parentForItem?date:(b?.loan_end_date||addDays(date,3))):'';
    return `<div class="calendar-edit-card"><div class="panel-head"><div><h3>${isNew?'新增預約':'修改預約'}</h3><p>${isNew?`${esc(selectedResource.name)}｜${esc(date)}`:esc(b.reference_no||'')}</p></div><button class="btn btn-secondary btn-small" data-cancel-calendar-edit>關閉</button></div>
      ${b&&parentRoomBooking(b)?`<div class="notice">此物品紀錄由房間「${esc(resourceName(parentRoomBooking(b).resource_id))}」一併預約；修改此紀錄只會更改物品本身。</div>`:''}
      <form data-calendar-booking-form class="form-card">
        <input type="hidden" name="booking_id" value="${attr(b?.id||'')}">
        <input type="hidden" name="resource_id" value="${attr(selectedResource.id)}">
        <div class="form-grid">
          <div class="field full"><span>房間／物品</span><div class="input readonly-field">${esc(selectedResource.type==='room'?'房間':'物品')}｜${esc(selectedResource.name)}</div></div>
          <div class="field"><span>借用開始日期</span><input class="input" type="date" name="booking_date" required value="${attr(date)}"></div>
          ${selectedResource.type==='item'?(parentForItem?`<div class="field"><span>歸還日期</span><input type="hidden" name="loan_end_date" value="${attr(date)}"><div class="input readonly-field">同日（配合房間）</div></div>`:`<div class="field"><span>歸還日期</span><input class="input" type="date" name="loan_end_date" min="${attr(date)}" value="${attr(loanEnd)}"></div>`):'<div class="field"><span>類別</span><div class="input readonly-field">房間（即日）</div></div>'}
          <div class="field"><span>開始時間</span><input class="input" type="time" name="start_time" required value="${attr(shortTime(b?.start_time)||(selectedResource.type==='room'?'09:00':'09:00'))}"></div>
          <div class="field"><span>結束時間</span><input class="input" type="time" name="end_time" required value="${attr(shortTime(b?.end_time)||(selectedResource.type==='room'?'10:00':'18:00'))}"></div>
          <div class="field"><span>數量</span><input class="input" type="number" name="quantity" min="1" max="${Number(selectedResource.type==='item'?selectedResource.stock_quantity||99:1)}" value="${Number(b?.quantity||1)}"></div>
          <div class="field"><span>狀態</span><select class="select" name="status">${['pending','approved','rejected','completed','cancelled'].map(x=>`<option value="${x}" ${x===(b?.status||'approved')?'selected':''}>${statusLabel(x)}</option>`).join('')}</select></div>
          <div class="field"><span>申請人</span><input class="input" name="applicant_name" required value="${attr(b?.applicant_name||'')}"></div>
          <div class="field"><span>電話</span><input class="input" name="phone" required value="${attr(b?.phone||'')}"></div>
          <div class="field full"><span>用途</span><select class="select" name="purpose" required>${purposes.map(x=>`<option value="${attr(x.label)}" ${x.label===defaultPurpose?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
          <div class="field full"><span>備註</span><textarea class="textarea" name="applicant_note">${esc(b?.applicant_note||'')}</textarea></div>
          ${selectedResource.type==='room'&&items.length?`<div class="field full"><span>同日借用物品</span><div class="related-items-grid">${items.map(item=>`<label class="related-item-control"><span>${esc(item.name)}</span><input class="input" type="number" min="0" max="${Number(item.stock_quantity||1)}" name="related_item_${item.id}" value="${Number(attachedQty[item.id]||0)}"></label>`).join('')}</div><div class="mini">儲存房間預約時，所選物品會同步出現在物品日曆。</div></div>`:''}
        </div>
        <div class="form-actions"><button type="button" class="btn btn-secondary" data-cancel-calendar-edit>取消</button><button class="btn btn-primary" type="submit">${isNew?'新增預約':'儲存修改'}</button></div>
      </form>
    </div>`;
  }

  function bookingsView(){
    const rows=state.bookings;
    return `${top('申請審批','查看及更新房間／物品預約狀態')}
      <section class="panel"><div class="panel-head"><div><h3>最近申請</h3><p>最多顯示最近 100 筆</p></div></div><div class="table-wrap"><table><thead><tr><th>編號</th><th>資源</th><th>日期</th><th>時段</th><th>申請人</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${esc(b.reference_no||'—')}</td><td>${esc(resourceName(b.resource_id))}</td><td>${esc(b.loan_end_date&&b.loan_end_date!==b.booking_date?`${b.booking_date} 至 ${b.loan_end_date}`:(b.booking_date||''))}</td><td>${shortTime(b.start_time)}–${shortTime(b.end_time)}</td><td>${esc(b.applicant_name||'')}</td><td><span class="tag ${b.status==='approved'?'green':b.status==='pending'?'':'gray'}">${statusLabel(b.status)}</span></td><td><div class="row-actions">${b.status==='pending'?`<button class="btn btn-primary btn-small" data-booking-status="${b.id}:approved">批准</button><button class="btn btn-danger btn-small" data-booking-status="${b.id}:rejected">拒絕</button>`:''}${b.status==='approved'?`<button class="btn btn-secondary btn-small" data-booking-status="${b.id}:completed">完成</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">暫未有申請</td></tr>'}</tbody></table></div></section>`;
  }


  function telegramView(){
    const st=state.telegramStatus||{};
    const configured=!!st.configured;
    return `${top('Telegram 通知','新申請提交後，自動將申請內容發送到指定 Telegram 對話')}
      <div class="grid-two">
        <section class="panel">
          <div class="panel-head"><div><h3>通知狀態</h3><p>Bot Token 及 Chat ID 會加密儲存在 Supabase Vault</p></div></div>
          <div class="form-card">
            <div class="notice">目前狀態：<strong>${configured?'已啟用':'尚未設定'}</strong></div>
            <div class="mini" style="margin-top:12px">Bot Token：${st.bot_token_set?'已設定':'未設定'}</div>
            <div class="mini">Chat ID：${st.chat_id_set?esc(st.chat_id_masked||'已設定'):'未設定'}</div>
            <div class="form-actions"><button class="btn btn-secondary" data-telegram-test ${configured?'':'disabled'}>發送測試通知</button></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Telegram Bot 設定</h3><p>重新儲存會取代現有設定</p></div></div>
          <form class="form-card" data-telegram-form>
            <div class="field"><span>Bot Token *</span><input class="input" type="password" name="bot_token" required autocomplete="new-password" placeholder="例如：123456789:AA..."></div>
            <div class="field"><span>Chat ID *</span><input class="input" name="chat_id" required placeholder="例如：123456789 或 -100..."></div>
            <div class="mini" style="margin-top:8px">Bot Token 不會寫入前端檔案，只會由管理員登入後直接送到 Supabase Vault。</div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">儲存 Telegram 設定</button></div>
          </form>
        </section>
      </div>`;
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
    on('[data-new-purpose]','click',()=>{state.editingPurposeId=null;render();});
    qsa('[data-edit-purpose]').forEach(b=>b.onclick=()=>{state.editingPurposeId=b.dataset.editPurpose;render();});
    on('[data-cancel-purpose]','click',()=>{state.editingPurposeId=null;render();});
    on('[data-purpose-form]','submit',savePurpose);
    qsa('[data-delete-purpose]').forEach(b=>b.onclick=()=>deletePurpose(b.dataset.deletePurpose));
    const imageInput=qs('[data-resource-form] input[name=image]'); if(imageInput) imageInput.onchange=previewResourceImage;
    qsa('[data-booking-status]').forEach(b=>b.onclick=()=>{const [id,status]=b.dataset.bookingStatus.split(':');updateBooking(id,status);});
    on('[data-calendar-resource]','change',e=>{state.calendarResourceId=e.target.value;state.calendarSelectedDate=null;state.editingCalendarBookingId=null;state.creatingCalendarBooking=false;render();});
    qsa('[data-calendar-month]').forEach(b=>b.onclick=()=>{state.calendarMonthOffset+=b.dataset.calendarMonth==='next'?1:-1;state.calendarSelectedDate=null;state.editingCalendarBookingId=null;state.creatingCalendarBooking=false;render();});
    qsa('[data-calendar-date]').forEach(b=>b.onclick=()=>{
      state.calendarSelectedDate=b.dataset.calendarDate;
      state.editingCalendarBookingId=null;
      const resource=state.resources.find(r=>r.id===state.calendarResourceId);
      const blocked=resource?getResourceBlock(resource.id,state.calendarSelectedDate):null;
      const existing=resource?calendarBookingsForDate(resource.id,state.calendarSelectedDate):[];
      state.creatingCalendarBooking=!!(resource&&!blocked&&!existing.length);
      render();
    });
    on('[data-calendar-new-booking]','click',()=>{state.editingCalendarBookingId=null;state.creatingCalendarBooking=true;render();});
    qsa('[data-calendar-edit-booking]').forEach(b=>b.onclick=()=>{state.creatingCalendarBooking=false;state.editingCalendarBookingId=b.dataset.calendarEditBooking;render();});
    qsa('[data-cancel-calendar-edit]').forEach(b=>b.onclick=()=>{state.editingCalendarBookingId=null;state.creatingCalendarBooking=false;render();});
    on('[data-calendar-booking-form]','submit',saveCalendarBooking);
    qsa('[data-calendar-delete-booking]').forEach(b=>b.onclick=()=>deleteCalendarBooking(b.dataset.calendarDeleteBooking));
    qsa('[data-block-date]').forEach(b=>b.onclick=()=>blockCalendarDate(b.dataset.blockDate));
    qsa('[data-unblock-date]').forEach(b=>b.onclick=()=>unblockCalendarDate(b.dataset.unblockDate));
    on('[data-booking-policy-form]','submit',saveBookingPolicy);
    bindBookingPolicyControls();
    on('[data-telegram-form]','submit',saveTelegramSettings);
    on('[data-telegram-test]','click',testTelegramNotification);
    on('[data-signout]','click',async()=>{if(supabase)await supabase.auth.signOut();location.reload();});
  }

  function bindBookingPolicyControls(){
    const form=qs('[data-booking-policy-form]'); if(!form)return;
    const refresh=()=>{
      const preset=String(form.querySelector('[name="preset"]')?.value||'custom');
      const modeEl=form.querySelector('[name="mode"]'),scopeEl=form.querySelector('[name="scope"]'),daysEl=form.querySelector('[name="days_before"]');
      if(preset==='monthly_next_month'){if(modeEl)modeEl.value='fixed_month_day';if(scopeEl)scopeEl.value='month';}
      if(preset==='days14_next_month'){if(modeEl)modeEl.value='days_before_period';if(scopeEl)scopeEl.value='month';if(daysEl)daysEl.value='14';}
      if(preset==='days7_next_week'){if(modeEl)modeEl.value='days_before_period';if(scopeEl)scopeEl.value='week';if(daysEl)daysEl.value='7';}
      const custom=form.querySelector('[data-policy-custom]'); if(custom)custom.style.display=preset==='custom'?'':'none';
      const fixed=form.querySelector('[data-policy-fixed-day]'); if(fixed)fixed.style.display=(preset==='monthly_next_month'||(preset==='custom'&&String(modeEl?.value)==='fixed_month_day'))?'':'none';
      const days=form.querySelector('[data-policy-days-before]'); if(days)days.style.display=(preset==='custom'&&String(modeEl?.value)==='days_before_period')?'':'none';
      const preview=form.querySelector('[data-policy-preview]'); if(preview)preview.innerHTML=bookingPolicyPreviewHtml(policyPayloadFromForm(form));
    };
    form.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refresh));
    form.querySelectorAll('select').forEach(el=>el.addEventListener('change',refresh));
    refresh();
  }

  async function saveBookingPolicy(e){
    e.preventDefault();
    const payload=policyPayloadFromForm(e.currentTarget);
    try{
      if(DEMO){state.bookingPolicy={singleton:true,...payload};toast('開放申請期限已儲存（Demo）','success');render();return;}
      const r=await supabase.from('booking_policy').update(payload).eq('singleton',true).select().single();
      if(r.error)throw r.error;
      state.bookingPolicy=r.data||{...state.bookingPolicy,...payload};
      toast('開放申請期限已儲存','success');render();
    }catch(err){toast('未能儲存開放期限：'+errorMessage(err),'error');}
  }

  async function saveTelegramSettings(e){
    e.preventDefault();
    if(DEMO)return toast('Demo Mode 不會連接 Telegram；請使用 Supabase LIVE 模式。','error');
    const fd=new FormData(e.currentTarget);
    const botToken=String(fd.get('bot_token')||'').trim();
    const chatId=String(fd.get('chat_id')||'').trim();
    if(!botToken||!chatId)return toast('請輸入 Bot Token 及 Chat ID','error');
    try{
      const r=await supabase.rpc('admin_set_telegram_notification',{p_bot_token:botToken,p_chat_id:chatId});
      if(r.error)throw r.error;
      const st=await supabase.rpc('admin_get_telegram_notification_status');
      if(st.error)throw st.error;
      state.telegramStatus=st.data||state.telegramStatus;
      toast('Telegram 設定已安全儲存','success');render();
    }catch(err){toast('未能儲存 Telegram 設定：'+errorMessage(err),'error');}
  }

  async function testTelegramNotification(){
    if(DEMO)return toast('Demo Mode 不會連接 Telegram。','error');
    try{
      const r=await supabase.rpc('admin_test_telegram_notification');
      if(r.error)throw r.error;
      toast('測試通知已送出，請檢查 Telegram','success');
    }catch(err){toast('測試通知失敗：'+errorMessage(err),'error');}
  }

  async function saveOrg(e){
    e.preventDefault(); const fd=new FormData(e.currentTarget); const name=String(fd.get('name')||'').trim(); const active=fd.get('active')==='on'; const accessPassword=String(fd.get('access_password')||'');
    if(!name)return toast('請輸入機構名稱','error');
    if(!state.editingOrgId && accessPassword.length<4)return toast('請設定至少 4 個字元的前台登入密碼','error');
    if(accessPassword && accessPassword.length<4)return toast('前台登入密碼至少需要 4 個字元','error');
    try{
      if(DEMO){
        const duplicate=state.organizations.some(o=>o.name.toLowerCase()===name.toLowerCase()&&o.id!==state.editingOrgId); if(duplicate)throw new Error('機構名稱已存在');
        if(state.editingOrgId){const o=state.organizations.find(x=>x.id===state.editingOrgId);Object.assign(o,{name,active});if(accessPassword)o.access_password=accessPassword;}
        else state.organizations.push({id:uid('org'),name,access_password:accessPassword,active,created_at:new Date().toISOString()}); persistDemo();
      }else{
        const payload={name,active};
        const r=state.editingOrgId?await supabase.from('organizations').update(payload).eq('id',state.editingOrgId).select('id,name,active,created_at,updated_at').single():await supabase.from('organizations').insert(payload).select('id,name,active,created_at,updated_at').single();
        if(r.error)throw r.error;
        if(accessPassword){const pw=await supabase.rpc('admin_set_organization_portal_password',{p_organization_id:r.data.id,p_password:accessPassword});if(pw.error)throw pw.error;}
        await refreshAll();
      }
      state.editingOrgId=null; toast('機構及前台登入設定已儲存','success'); render();
    }catch(err){toast(errorMessage(err),'error');}
  }

  async function deleteOrg(id){
    const org=state.organizations.find(x=>x.id===id); if(!org)return;
    const related=state.resources.filter(r=>r.organization_id===id); const hasBookings=state.bookings.some(b=>related.some(r=>r.id===b.resource_id));
    if(hasBookings)return toast('此機構已有借用紀錄，不能直接刪除；請改為停用。','error');
    if(!confirm(`確定刪除「${org.name}」？機構下的房間、物品及時段亦會一併刪除。`))return;
    try{
      if(DEMO){const ids=new Set(related.map(r=>r.id));state.organizations=state.organizations.filter(o=>o.id!==id);state.resources=state.resources.filter(r=>r.organization_id!==id);state.availability=state.availability.filter(a=>!ids.has(a.resource_id));state.resourceBlocks=state.resourceBlocks.filter(b=>!ids.has(b.resource_id));persistDemo();}
      else{const r=await supabase.from('organizations').delete().eq('id',id);if(r.error)throw r.error;await refreshAll();}
      state.editingOrgId=null;toast('機構已刪除','success');render();
    }catch(err){toast('未能刪除機構：'+errorMessage(err),'error');}
  }

  async function savePurpose(e){
    e.preventDefault(); const fd=new FormData(e.currentTarget); const label=String(fd.get('label')||'').trim(); const sort_order=Math.max(0,Number(fd.get('sort_order')||0)); const active=fd.get('active')==='on'; if(!label)return toast('請輸入用途名稱','error');
    try{
      if(DEMO){const dup=state.purposeOptions.some(x=>x.label.toLowerCase()===label.toLowerCase()&&x.id!==state.editingPurposeId);if(dup)throw new Error('用途名稱已存在');if(state.editingPurposeId){Object.assign(state.purposeOptions.find(x=>x.id===state.editingPurposeId),{label,sort_order,active});}else state.purposeOptions.push({id:uid('purpose'),label,sort_order,active});persistDemo();}
      else{const payload={label,sort_order,active};const r=state.editingPurposeId?await supabase.from('purpose_options').update(payload).eq('id',state.editingPurposeId):await supabase.from('purpose_options').insert(payload);if(r.error)throw r.error;await refreshAll();}
      state.editingPurposeId=null;toast('用途選項已儲存','success');render();
    }catch(err){toast(errorMessage(err),'error');}
  }
  async function deletePurpose(id){const item=state.purposeOptions.find(x=>x.id===id);if(!item)return;if(!confirm(`確定刪除用途「${item.label}」？`))return;try{if(DEMO){state.purposeOptions=state.purposeOptions.filter(x=>x.id!==id);persistDemo();}else{const r=await supabase.from('purpose_options').delete().eq('id',id);if(r.error)throw r.error;await refreshAll();}state.editingPurposeId=null;toast('用途選項已刪除','success');render();}catch(err){toast(errorMessage(err),'error');}}

  async function saveResource(e){
    e.preventDefault(); const form=e.currentTarget; const fd=new FormData(form); const organization_id=String(fd.get('organization_id')||''); const name=String(fd.get('name')||'').trim();
    if(!organization_id)return toast('請選擇所屬機構','error'); if(!name)return toast('請輸入名稱','error');
    const type=state.resourceType; const existing=state.resources.find(x=>x.id===state.editingResourceId)||null;
    const payload={organization_id,type,name,location:String(fd.get('location')||'').trim()||null,description:String(fd.get('description')||'').trim()||null,capacity:type==='room'?Math.max(1,Number(fd.get('capacity')||1)):1,stock_quantity:type==='item'?Math.max(1,Number(fd.get('stock_quantity')||1)):1,requires_room:type==='item'&&fd.get('requires_room')==='on',category:type==='item'?(String(fd.get('category')||'').trim()||null):null,image_url:existing?.image_url||null,active:fd.get('active')==='on'};
    const imageFile=fd.get('image');
    try{
      if(imageFile instanceof File && imageFile.size>0){
        if(imageFile.size>(DEMO?1200*1024:5*1024*1024)) throw new Error(DEMO?'Demo Mode 圖片請控制在 1.2MB 內':'圖片不可大於 5MB');
        if(!['image/jpeg','image/png','image/webp'].includes(imageFile.type)) throw new Error('圖片只支援 JPG、PNG 或 WebP');
        payload.image_url=DEMO?await fileToDataUrl(imageFile):await uploadResourceImage(imageFile,type);
      }
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

  function previewResourceImage(e){
    const file=e.target.files?.[0]; if(!file)return; const url=URL.createObjectURL(file); const box=qs('.admin-image-box'); if(box)box.innerHTML=`<img data-resource-image-preview src="${url}" alt="預覽">`;
  }
  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('未能讀取圖片'));r.readAsDataURL(file);});}
  async function uploadResourceImage(file,type){
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg'; const path=`${type}/${Date.now()}-${Math.random().toString(36).slice(2,9)}.${ext}`;
    const up=await supabase.storage.from('resource-images').upload(path,file,{contentType:file.type,upsert:false}); if(up.error)throw up.error;
    return supabase.storage.from('resource-images').getPublicUrl(path).data.publicUrl;
  }

  async function deleteResource(id){
    const resource=state.resources.find(x=>x.id===id);if(!resource)return;
    if(state.bookings.some(b=>b.resource_id===id))return toast('此資源已有借用紀錄，不能直接刪除；請改為停用。','error');
    if(!confirm(`確定刪除「${resource.name}」？`))return;
    try{
      if(DEMO){state.resources=state.resources.filter(r=>r.id!==id);state.availability=state.availability.filter(a=>a.resource_id!==id);state.resourceBlocks=state.resourceBlocks.filter(b=>b.resource_id!==id);persistDemo();}
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
      if(DEMO){
        const b=state.bookings.find(x=>x.id===id);
        if(b){
          b.status=status;
          state.bookings.filter(x=>x.related_booking_id===id).forEach(child=>child.status=status);
        }
        persistDemo();
      }
      else{const r=await supabase.rpc('update_booking_group_status',{p_booking_id:id,p_status:status,p_admin_note:null});if(r.error)throw r.error;await refreshAll();}
      toast('申請狀態已更新','success');render();
    }catch(err){toast(errorMessage(err),'error');}
  }

  async function saveCalendarBooking(e){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const id=String(fd.get('booking_id')||'')||null;
    const existing=id?state.bookings.find(x=>x.id===id):null;
    const resource_id=String(fd.get('resource_id')||state.calendarResourceId||'');
    const resource=state.resources.find(r=>r.id===resource_id);
    const booking_date=String(fd.get('booking_date')||'');
    let loan_end_date=resource?.type==='item'?(String(fd.get('loan_end_date')||'')||booking_date):null;
    const start_time=String(fd.get('start_time')||'');
    const end_time=String(fd.get('end_time')||'');
    const quantity=Math.max(1,Number(fd.get('quantity')||1));
    const applicant_name=String(fd.get('applicant_name')||'').trim();
    const phone=String(fd.get('phone')||'').trim();
    const purpose=String(fd.get('purpose')||'').trim();
    const applicant_note=String(fd.get('applicant_note')||'').trim()||null;
    const status=String(fd.get('status')||'approved');
    if(!resource||!booking_date||!start_time||!end_time||end_time<=start_time)return toast('請填寫有效的資源、日期及時間','error');
    if(loan_end_date&&loan_end_date<booking_date)return toast('歸還日期不可早於借用日期','error');
    if(!applicant_name||!phone||!purpose)return toast('請填寫申請人、電話及用途','error');
    const effectiveEnd=loan_end_date||booking_date;
    if(!['rejected','cancelled'].includes(status)&&anyBlockedDate(resource_id,booking_date,effectiveEnd))return toast('所選日期包含管理員封鎖的不可借用日期，請先解除封鎖或改用其他日期。','error');
    const attachedItems=resource.type==='room'?roomAttachableItems(resource).map(item=>({resource_id:item.id,quantity:Math.max(0,Number(fd.get(`related_item_${item.id}`)||0))})).filter(x=>x.quantity>0):[];
    const payload={resource_id,booking_date,loan_end_date,start_time,end_time,quantity,applicant_name,phone,purpose,applicant_note,status};
    try{
      let savedId=id;
      if(DEMO){
        const now=new Date().toISOString();
        let main=existing;
        if(main){Object.assign(main,payload,{updated_at:now});}
        else{
          savedId=uid('booking');
          main={id:savedId,reference_no:`A${Date.now().toString().slice(-10)}`,user_id:null,related_booking_id:null,attendees:1,created_at:now,...payload};
          state.bookings.unshift(main);
        }
        if(resource.type==='room'){
          state.bookings=state.bookings.filter(x=>x.related_booking_id!==savedId);
          attachedItems.forEach((item,index)=>state.bookings.unshift({id:uid('booking'),reference_no:`${main.reference_no}-I${index+1}`,user_id:null,resource_id:item.resource_id,booking_date,start_time,end_time,loan_end_date:null,quantity:item.quantity,attendees:1,purpose,applicant_name,phone,applicant_note,related_booking_id:savedId,status,created_at:now,updated_at:now}));
        }
        persistDemo();
      }else{
        const r=await supabase.rpc('admin_upsert_booking_record',{p_booking_id:id,p_resource_id:resource_id,p_booking_date:booking_date,p_loan_end_date:loan_end_date,p_start_time:start_time,p_end_time:end_time,p_quantity:quantity,p_applicant_name:applicant_name,p_phone:phone,p_purpose:purpose,p_applicant_note:applicant_note,p_status:status,p_items:attachedItems});
        if(r.error)throw r.error;savedId=r.data;await refreshAll();
      }
      state.calendarResourceId=resource_id;state.calendarSelectedDate=booking_date;state.editingCalendarBookingId=null;state.creatingCalendarBooking=false;toast(id?'預約紀錄已修改':'預約已新增','success');render();
    }catch(err){toast((id?'未能修改紀錄：':'未能新增預約：')+errorMessage(err),'error');}
  }

  async function deleteCalendarBooking(id){
    const b=state.bookings.find(x=>x.id===id);if(!b)return;if(!confirm(`確定刪除此預約紀錄？
${resourceName(b.resource_id)}｜${b.booking_date}`))return;
    try{
      if(DEMO){
        const childIds=new Set(state.bookings.filter(x=>x.related_booking_id===id).map(x=>x.id));
        state.bookings=state.bookings.filter(x=>x.id!==id&&!childIds.has(x.id));
        persistDemo();
      }else{const r=await supabase.rpc('admin_delete_booking_record',{p_booking_id:id});if(r.error)throw r.error;await refreshAll();}
      if(state.editingCalendarBookingId===id)state.editingCalendarBookingId=null;state.creatingCalendarBooking=false;toast('預約紀錄已刪除','success');render();
    }catch(err){toast('未能刪除紀錄：'+errorMessage(err),'error');}
  }

  async function blockCalendarDate(dateIso){
    const resourceId=state.calendarResourceId;if(!resourceId||!dateIso)return;
    if(calendarBookingsForDate(resourceId,dateIso).some(isOccupyingBooking))return toast('此日期已有批准／完成的借用紀錄，不能設為不可借用。','error');
    if(getResourceBlock(resourceId,dateIso))return;
    try{
      const payload={resource_id:resourceId,block_date:dateIso,note:'管理員設定不可借用'};
      if(DEMO){state.resourceBlocks.push({id:uid('block'),...payload,created_at:new Date().toISOString()});persistDemo();}
      else{const r=await supabase.from('resource_blocks').insert(payload);if(r.error)throw r.error;await refreshAll();}
      toast('此日期已設為不可借用','success');render();
    }catch(err){toast('未能封鎖日期：'+errorMessage(err),'error');}
  }

  async function unblockCalendarDate(id){
    if(!id)return;try{
      if(DEMO){state.resourceBlocks=state.resourceBlocks.filter(x=>x.id!==id);persistDemo();}
      else{const r=await supabase.from('resource_blocks').delete().eq('id',id);if(r.error)throw r.error;await refreshAll();}
      toast('已解除不可借用','success');render();
    }catch(err){toast('未能解除封鎖：'+errorMessage(err),'error');}
  }

  function anyBlockedDate(resourceId,startDate,endDate){
    let d=new Date(`${startDate}T12:00:00`),end=new Date(`${endDate}T12:00:00`);let guard=0;
    while(d<=end&&guard<370){if(getResourceBlock(resourceId,toIsoDate(d)))return true;d.setDate(d.getDate()+1);guard++;}return false;
  }

  function renderLogin(message=''){
    const activationEmails=Array.isArray(cfg.adminActivationEmails)?cfg.adminActivationEmails.map(v=>String(v||'').trim().toLowerCase()).filter(Boolean):[String(cfg.adminActivationEmail||'').trim().toLowerCase()].filter(Boolean);
    app.innerHTML=`<div class="login-shell"><form class="login-card" data-login><h1>管理員登入</h1><p>使用 Supabase 管理員帳戶登入。首次啟用時請同時輸入一次性啟用碼。</p>${message?`<div class="error-box">${esc(message)}</div>`:''}<div class="field"><span>電郵</span><input class="input" type="email" name="email" required autocomplete="username" value="${attr((cfg.adminActivationEmails&&cfg.adminActivationEmails[0])||cfg.adminActivationEmail||'')}"></div><div class="field"><span>密碼</span><input class="input" type="password" name="password" required autocomplete="current-password"></div><div class="field"><span>首次啟用碼（一般登入可留空）</span><input class="input" type="password" name="activation_code" autocomplete="one-time-code" placeholder="首次建立／啟用管理員時輸入"></div><button class="btn btn-primary" type="submit">登入／首次啟用</button><p class="mini">啟用碼只使用一次，不會儲存在網站程式碼。登入入口只設於桌面管理員頁面。</p></form></div>`;
    qs('[data-login]').onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(e.currentTarget);
      const email=String(fd.get('email')||'').trim().toLowerCase();
      const password=String(fd.get('password')||'');
      const activationCode=String(fd.get('activation_code')||'').trim();
      if(!email||!password)return renderLogin('請輸入電郵及密碼。');

      let signIn=await supabase.auth.signInWithPassword({email,password});
      if(signIn.error){
        const signInMsg=String(signIn.error.message||'');
        const signInCode=String(signIn.error.code||'');
        if(/email.*not.*confirmed/i.test(signInMsg)||/email_not_confirmed/i.test(signInCode)){
          return renderLogin('此帳戶已建立，但電郵尚未確認。請不要再次首次啟用；完成確認後直接登入即可。');
        }
        if(!activationCode)return renderLogin('登入失敗。現有管理員請檢查電郵／密碼；只有全新管理員帳戶才需要輸入一次性啟用碼。');
        if(activationEmails.length&&!activationEmails.includes(email))return renderLogin('此電郵不在首次管理員啟用名單內。');

        const attemptKey='rrbs-admin-signup-attempt:'+email;
        const lastAttempt=Number(sessionStorage.getItem(attemptKey)||0);
        if(lastAttempt && Date.now()-lastAttempt<5*60*1000){
          return renderLogin('已提交過首次帳戶建立要求，為避免觸發 Supabase Email Rate Limit，暫時不會重複提交。現有管理員帳戶請直接登入。');
        }
        sessionStorage.setItem(attemptKey,String(Date.now()));
        const signUp=await supabase.auth.signUp({email,password});
        if(signUp.error){
          const m=String(signUp.error.message||'');
          if(/rate limit|email rate limit|over_email_send_rate_limit/i.test(m)||/rate_limit/i.test(String(signUp.error.code||''))){
            return renderLogin('Supabase 暫時限制確認電郵發送，因此未能建立新管理員帳戶。此限制不影響已存在的管理員登入。');
          }
          return renderLogin('首次啟用失敗：'+m);
        }
        if(!signUp.data.session){
          const retry=await supabase.auth.signInWithPassword({email,password});
          if(retry.error){
            return renderLogin('管理員帳戶建立要求已提交，但未取得登入 session。請勿重複按首次啟用；現有管理員可直接登入。');
          }
          signIn=retry;
        }else{
          signIn={data:{user:signUp.data.user,session:signUp.data.session},error:null};
        }
      }

      const user=signIn.data?.user;
      if(!user)return renderLogin('登入失敗，請重試。');
      let ok=await verifyAdmin(user);
      if(!ok&&activationCode){
        const claim=await supabase.rpc('claim_admin_role',{p_activation_code:activationCode});
        if(claim.error||claim.data!==true){await supabase.auth.signOut();return renderLogin('一次性啟用碼不正確、已使用或帳戶不符合啟用條件。');}
        ok=await verifyAdmin(user);
      }
      if(!ok){await supabase.auth.signOut();return renderLogin('此帳戶尚未啟用管理員權限。首次啟用請輸入一次性啟用碼。');}
      state.user=user;await refreshAll();render();
    };
  }
  function renderConfigError(){renderFatal('目前已設定為正式模式，但 config.js 尚未填入 Supabase URL 或 Publishable Key。');}
  function renderFatal(message){app.innerHTML=`<div class="login-shell"><div class="login-card"><h1>管理員後台未能載入</h1><div class="error-box">${esc(message)}</div><a class="btn btn-secondary" href="index.html" style="display:block;text-align:center;text-decoration:none">返回前台</a></div></div>`;}

  function orgName(id){return state.organizations.find(x=>x.id===id)?.name||'—';}
  function resourceName(id){return state.resources.find(x=>x.id===id)?.name||'—';}
  function shortTime(v){return String(v||'').slice(0,5);}
  function toIsoDate(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
  function addDays(iso,days){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+Number(days||0));return toIsoDate(d);}
  function todayIso(){return toIsoDate(new Date());}
  function statusLabel(s){return ({pending:'待審批',approved:'已批准',rejected:'已拒絕',completed:'已完成',cancelled:'已取消'})[s]||s||'—';}
  function errorMessage(err){if(!err)return'未知錯誤';if(typeof err==='string')return err;const m=err.message||err.error_description||err.details||'操作失敗';if(/admin_set_organization_portal_password/i.test(m)&&/does not exist|could not find|schema cache/i.test(m))return'Supabase 尚未套用 v9 機構登入及資料隔離 SQL。';if(/RESOURCE_DATE_BLOCKED/i.test(m))return'所選日期已設為不可借用，請先解除封鎖。';if(/admin_upsert_booking_record|get_public_resource_busy_periods|update_booking_group_status/i.test(m)&&/does not exist|could not find|schema cache/i.test(m))return'Supabase 尚未套用 v7 日曆新增／修改預約 SQL。';if(/resource_blocks|admin_update_booking_record|admin_delete_booking_record/i.test(m)&&/does not exist|could not find|schema cache/i.test(m))return'Supabase 尚未套用 v6 借用狀況日曆 SQL。';if(/row-level security|permission denied/i.test(m))return'資料庫權限不足。請確認登入帳戶在 profiles 表中的 role 為 admin，並執行管理權限 SQL。';if(/BOOKING_WINDOW_CLOSED/i.test(m))return'所選日期尚未開放預約，請選擇已開放日期。';if(/booking_policy|get_booking_policy/i.test(m)&&/does not exist|could not find|schema cache/i.test(m))return'Supabase 尚未套用 v10.5 開放申請期限／物品分類 SQL。';if(/TELEGRAM_NOT_CONFIGURED/i.test(m))return'尚未設定 Telegram Bot Token／Chat ID。';if(/BOT_TOKEN_REQUIRED|CHAT_ID_REQUIRED/i.test(m))return'請輸入有效的 Bot Token 及 Chat ID。';if(/admin_set_telegram_notification|admin_get_telegram_notification_status|admin_test_telegram_notification/i.test(m)&&/does not exist|could not find|schema cache/i.test(m))return'Supabase 尚未套用 v10.4 Telegram 通知 SQL。';if(/duplicate|unique/i.test(m))return'名稱已存在，請使用另一個名稱。';return m;}
  function toast(msg,type=''){const d=document.createElement('div');d.className=`toast ${type}`;d.textContent=msg;toastRoot.appendChild(d);setTimeout(()=>d.remove(),3300);}
  function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function attr(s){return esc(s).replace(/"/g,'&quot;');}
  function qs(sel){return document.querySelector(sel)} function qsa(sel){return [...document.querySelectorAll(sel)]} function on(sel,event,fn){const el=qs(sel);if(el)el.addEventListener(event,fn)}
})();
