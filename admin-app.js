(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const appEl = $('#app');
  const modalRoot = $('#modal-root');
  const toastRoot = $('#toast-root');
  const cfg = window.APP_CONFIG || {};

  const DAY_NAMES = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const STATUS_LABELS = {
    pending: '待審批', approved: '已批准', rejected: '已拒絕', completed: '已完成', cancelled: '已取消'
  };

  const state = {
    adapter: null,
    mode: cfg.demoMode ? 'demo' : 'supabase',
    session: null,
    user: null,
    profile: null,
    orgs: [],
    resources: [],
    rules: [],
    bookings: [],
    page: 'booking',
    selectedOrgId: '',
    resourceType: 'room',
    bookingDraft: {
      orgId: '', resourceId: '', date: '', startTime: '', endTime: '', purpose: '', applicantName: '', phone: '', quantity: 1, attendees: 1, relatedBookingId: ''
    },
    remaining: null,
    filters: { status: 'all', type: 'all', q: '' },
    loading: false,
    authTab: 'signin',
    realtimeChannel: null,
  };

  function esc(v = '') {
    return String(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function isoToday() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }
  function formatDate(v) {
    if (!v) return '—';
    const d = new Date(`${v}T00:00:00`);
    return new Intl.DateTimeFormat('zh-HK',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(d);
  }
  function shortDate(v) {
    if (!v) return '—';
    return v.replaceAll('-','/');
  }
  function fmtTime(v) { return v ? String(v).slice(0,5) : '—'; }
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function nowIso() { return new Date().toISOString(); }
  function getOrg(id) { return state.orgs.find(x => x.id === id); }
  function getResource(id) { return state.resources.find(x => x.id === id); }
  function bookingResource(b) { return b.resources || getResource(b.resource_id) || {}; }
  function bookingRef(b) { return b?.reference_no || b?.id || '—'; }
  function bookingOrg(b) {
    const r = bookingResource(b);
    return r.organizations || getOrg(r.organization_id) || {};
  }
  function isAdmin() { return state.profile?.role === 'admin'; }
  function statusBadge(status) { return `<span class="badge ${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`; }
  function typePill(type) { return `<span class="type-pill ${type === 'item' ? 'item' : ''}">${type === 'room' ? '房間' : '物品'}</span>`; }

  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
    resource: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 20V8h8v12M8 12h8M12 8v12"/>',
    box: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.19.37.5.72.9.93.31.16.66.24 1.01.25H21v4h-.1A1.7 1.7 0 0 0 19.4 15z"/>',
    building: '<path d="M4 21V5l8-3 8 3v16M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2M10 21v-3h4v3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66L20 14M20 8v6h-6"/>',
  };
  function icon(name, cls='') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
  }

  function toast(message, type='success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  function closeModal() { modalRoot.innerHTML = ''; }
  function modal(title, body, footer='', wide=false) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal="1">
      <section class="modal ${wide ? 'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" onclick="event.stopPropagation()">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="close-btn" data-close-modal="1" aria-label="關閉">×</button></div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </section>
    </div>`;
  }

  class DemoAdapter {
    constructor() {
      const org1 = 'org-community';
      const org2 = 'org-centre';
      this.profile = { id:'demo-admin', role:'admin', full_name:'示範管理員', phone:'9123 4567' };
      this.orgs = [
        {id:org1,name:'市民活動中心',active:true,created_at:nowIso()},
        {id:org2,name:'社區服務中心',active:true,created_at:nowIso()},
      ];
      this.resources = [
        {id:'room-a',organization_id:org1,type:'room',name:'會議室 A',location:'1樓',capacity:20,stock_quantity:1,requires_room:false,active:true,description:'適合部門會議及小組活動'},
        {id:'room-multi',organization_id:org1,type:'room',name:'多功能活動室',location:'2樓',capacity:50,stock_quantity:1,requires_room:false,active:true,description:'適合工作坊及社區活動'},
        {id:'room-b',organization_id:org2,type:'room',name:'討論室 B',location:'3樓',capacity:12,stock_quantity:1,requires_room:false,active:true,description:'小型會議空間'},
        {id:'item-projector',organization_id:org1,type:'item',name:'投影機',location:'器材室',capacity:1,stock_quantity:5,requires_room:false,active:true,description:'HDMI 投影機'},
        {id:'item-mic',organization_id:org1,type:'item',name:'無線麥克風',location:'器材室',capacity:1,stock_quantity:10,requires_room:false,active:true,description:'無線手持咪'},
        {id:'item-table',organization_id:org1,type:'item',name:'活動桌',location:'儲物室',capacity:1,stock_quantity:20,requires_room:false,active:true,description:'摺疊活動桌'},
      ];
      this.rules = [];
      for (const r of this.resources) {
        for (let dow=1; dow<=6; dow++) {
          ['09:00','10:00','11:00','14:00','15:00','16:00'].forEach(start => {
            const [h,m] = start.split(':').map(Number);
            const end = `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            this.rules.push({id:uid(),resource_id:r.id,specific_date:null,weekday:dow,date_from:null,date_to:null,start_time:start,end_time:end,active:true});
          });
        }
      }
      const future = (plus) => { const d=new Date(); d.setDate(d.getDate()+plus); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
      this.bookings = [
        {id:'demo-booking-001',reference_no:'R-DEMO-001',user_id:'demo-user',resource_id:'room-a',booking_date:future(2),start_time:'09:00',end_time:'10:00',quantity:1,attendees:8,purpose:'部門會議',applicant_name:'陳大文',phone:'9123 4567',status:'pending',admin_note:null,created_at:nowIso()},
        {id:'demo-booking-002',reference_no:'R-DEMO-002',user_id:'demo-user',resource_id:'item-projector',booking_date:future(3),start_time:'10:00',end_time:'11:00',quantity:1,attendees:1,purpose:'活動拍攝',applicant_name:'陳大文',phone:'9123 4567',status:'approved',admin_note:'已預留器材',created_at:nowIso()},
        {id:'demo-booking-003',reference_no:'R-DEMO-003',user_id:'other-user',resource_id:'room-multi',booking_date:future(5),start_time:'14:00',end_time:'15:00',quantity:1,attendees:35,purpose:'社區活動',applicant_name:'李小姐',phone:'9000 0000',status:'approved',admin_note:null,created_at:nowIso()},
        {id:'demo-booking-004',reference_no:'R-DEMO-004',user_id:'demo-user',resource_id:'item-mic',booking_date:future(-2),start_time:'09:00',end_time:'10:00',quantity:2,attendees:1,purpose:'分享會',applicant_name:'陳大文',phone:'9123 4567',status:'completed',admin_note:null,created_at:nowIso()},
      ];
    }
    async init() { return {session:{user:{id:this.profile.id,email:'demo@example.com'}}, user:{id:this.profile.id,email:'demo@example.com'}, profile:this.profile}; }
    async signIn() { return this.init(); }
    async signUp() { return {message:'示範模式毋須註冊'}; }
    async signOut() { return; }
    async switchRole(role) {
      this.profile = {...this.profile, id: role === 'admin' ? 'demo-admin' : 'demo-user', role, full_name: role === 'admin' ? '示範管理員' : '陳大文'};
      return this.init();
    }
    async loadAll(profile) {
      return {
        orgs: structuredClone(this.orgs),
        resources: structuredClone(this.resources),
        rules: structuredClone(this.rules),
        bookings: structuredClone(profile.role === 'admin' ? this.bookings : this.bookings.filter(b => b.user_id === profile.id))
      };
    }
    async createOrganization(data) { const row={id:uid(),active:true,created_at:nowIso(),...data}; this.orgs.push(row); return row; }
    async updateOrganization(data) { const i=this.orgs.findIndex(x=>x.id===data.id); if(i<0) throw new Error('找不到機構'); this.orgs[i]={...this.orgs[i],...data}; return this.orgs[i]; }
    async deleteOrganization(id) { const resourceIds=this.resources.filter(x=>x.organization_id===id).map(x=>x.id); if(this.bookings.some(b=>resourceIds.includes(b.resource_id))) throw new Error('此機構已有借用紀錄，為保障歷史資料，請先停用相關資源而不要刪除。'); this.rules=this.rules.filter(x=>!resourceIds.includes(x.resource_id)); this.resources=this.resources.filter(x=>x.organization_id!==id); this.orgs=this.orgs.filter(x=>x.id!==id); }
    async upsertResource(data) {
      if (data.id) { const i=this.resources.findIndex(x=>x.id===data.id); this.resources[i]={...this.resources[i],...data}; return this.resources[i]; }
      const row={id:uid(),created_at:nowIso(),...data}; this.resources.push(row); return row;
    }
    async deleteResource(id) { if(this.bookings.some(b=>b.resource_id===id)) throw new Error('此資源已有借用紀錄，為保障歷史資料，請改為停用資源。'); this.rules=this.rules.filter(x=>x.resource_id!==id); this.resources=this.resources.filter(x=>x.id!==id); }
    async createRule(data) { const row={id:uid(),active:true,...data}; this.rules.push(row); return row; }
    async deleteRule(id) { this.rules=this.rules.filter(x=>x.id!==id); }
    async getRemaining(resourceId,date,start,end) {
      const r=this.resources.find(x=>x.id===resourceId); if(!r) return 0;
      const overlaps=this.bookings.filter(b=>b.resource_id===resourceId&&b.booking_date===date&&b.status==='approved'&&b.start_time<end&&b.end_time>start);
      if(r.type==='room') return overlaps.length ? 0 : r.capacity;
      return Math.max(0,r.stock_quantity-overlaps.reduce((s,b)=>s+(b.quantity||1),0));
    }
    async submitBooking(data) {
      const r=this.resources.find(x=>x.id===data.resource_id);
      const remaining=await this.getRemaining(data.resource_id,data.booking_date,data.start_time,data.end_time);
      if(r.type==='room' && remaining===0) throw new Error('所選房間時段已被批准使用，請選擇其他時段。');
      if(r.type==='item' && data.quantity>remaining) throw new Error(`剩餘數量只有 ${remaining}。`);
      const ref=`R${Date.now().toString().slice(-10)}`; const row={id:uid(),reference_no:ref,user_id:this.profile.id,status:'pending',admin_note:null,created_at:nowIso(),...data};
      this.bookings.unshift(row); return row;
    }
    async updateBookingStatus(id,status,note='') { const b=this.bookings.find(x=>x.id===id); if(!b)throw new Error('找不到申請'); b.status=status;b.admin_note=note;b.reviewed_at=nowIso();return b; }
    async cancelBooking(id) { const b=this.bookings.find(x=>x.id===id&&x.user_id===this.profile.id);if(!b)throw new Error('找不到申請');if(b.status!=='pending')throw new Error('只有待審批申請可以取消');b.status='cancelled';return b; }
    subscribe() { return null; }
  }

  class SupabaseAdapter {
    constructor(client) { this.client=client; }
    async init() {
      const {data:{session},error}=await this.client.auth.getSession(); if(error)throw error;
      if(!session) return {session:null,user:null,profile:null};
      const {data:{user},error:uErr}=await this.client.auth.getUser(); if(uErr)throw uErr;
      if(!user) return {session:null,user:null,profile:null};
      const {data:profile,error:pErr}=await this.client.from('profiles').select('id,role,full_name,phone').eq('id',user.id).single();
      if(pErr) throw pErr;
      return {session,user,profile};
    }
    async signIn(email,password) { const {error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;return this.init(); }
    async signUp(email,password,fullName,phone) { const {data,error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:new URL('./',location.href).href,data:{full_name:fullName,phone}}});if(error)throw error;return data; }
    async signOut() { const {error}=await this.client.auth.signOut();if(error)throw error; }
    async loadAll(profile) {
      const [orgRes,resRes,ruleRes,bookRes]=await Promise.all([
        this.client.from('organizations').select('*').order('name'),
        this.client.from('resources').select('*, organizations(id,name)').order('type').order('name'),
        this.client.from('resource_availability').select('*').eq('active',true).order('start_time'),
        this.client.from('bookings').select('*, resources(*, organizations(id,name))').order('created_at',{ascending:false})
      ]);
      for(const result of [orgRes,resRes,ruleRes,bookRes]) if(result.error) throw result.error;
      return {orgs:orgRes.data||[],resources:resRes.data||[],rules:ruleRes.data||[],bookings:bookRes.data||[]};
    }
    async createOrganization(data) { const {data:row,error}=await this.client.from('organizations').insert(data).select().single();if(error)throw error;return row; }
    async updateOrganization(data) { const {id,...changes}=data; const {data:row,error}=await this.client.from('organizations').update(changes).eq('id',id).select().single(); if(error)throw error; return row; }
    async deleteOrganization(id) { const {error}=await this.client.from('organizations').delete().eq('id',id); if(error)throw error; }
    async upsertResource(data) {
      if(data.id){const {id,...changes}=data;const {data:row,error}=await this.client.from('resources').update(changes).eq('id',id).select().single();if(error)throw error;return row;}
      const {data:row,error}=await this.client.from('resources').insert(data).select().single();if(error)throw error;return row;
    }
    async deleteResource(id) { const {error}=await this.client.from('resources').delete().eq('id',id); if(error)throw error; }
    async createRule(data) { const {data:row,error}=await this.client.from('resource_availability').insert(data).select().single();if(error)throw error;return row; }
    async deleteRule(id) { const {error}=await this.client.from('resource_availability').delete().eq('id',id);if(error)throw error; }
    async getRemaining(resourceId,date,start,end) {
      const {data,error}=await this.client.rpc('get_resource_remaining',{p_resource_id:resourceId,p_booking_date:date,p_start_time:start,p_end_time:end});
      if(error)throw error; return Number(data ?? 0);
    }
    async submitBooking(data) {
      const {data:bookingId,error}=await this.client.rpc('submit_booking',{
        p_resource_id:data.resource_id,p_booking_date:data.booking_date,p_start_time:data.start_time,p_end_time:data.end_time,
        p_quantity:data.quantity||1,p_attendees:data.attendees||1,p_purpose:data.purpose,p_applicant_name:data.applicant_name,p_phone:data.phone,p_related_booking_id:data.related_booking_id||null
      });
      if(error)throw error; return {reference_no:bookingId};
    }
    async updateBookingStatus(id,status,note='') { const {error}=await this.client.rpc('update_booking_status',{p_booking_id:id,p_status:status,p_admin_note:note||null});if(error)throw error; }
    async cancelBooking(id) { const {error}=await this.client.rpc('cancel_booking',{p_booking_id:id});if(error)throw error; }
    subscribe(onChange) {
      return this.client.channel('reservation-live')
        .on('postgres_changes',{event:'*',schema:'public',table:'organizations'},onChange)
        .on('postgres_changes',{event:'*',schema:'public',table:'resources'},onChange)
        .on('postgres_changes',{event:'*',schema:'public',table:'resource_availability'},onChange)
        .on('postgres_changes',{event:'*',schema:'public',table:'bookings'},onChange)
        .subscribe();
    }
  }

  function loadSupabaseSdk() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.min.js';
      script.async=true;
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error('Supabase SDK 未能載入。請檢查網絡或 CDN。'));
      document.head.appendChild(script);
    });
  }

  async function setupAdapter() {
    if (state.mode === 'demo') {
      state.adapter = new DemoAdapter();
      return;
    }
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('未設定 Supabase URL / Publishable Key。請先修改 config.js。');
    await loadSupabaseSdk();
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    state.adapter = new SupabaseAdapter(client);
  }

  async function refreshData({render=true}={}) {
    if (!state.profile) return;
    state.loading=true;
    try {
      const data=await state.adapter.loadAll(state.profile);
      state.orgs=data.orgs; state.resources=data.resources; state.rules=data.rules; state.bookings=data.bookings;
      if(!state.selectedOrgId || !state.orgs.some(o=>o.id===state.selectedOrgId)) state.selectedOrgId=state.orgs[0]?.id||'';
      if(!state.bookingDraft.orgId || !state.orgs.some(o=>o.id===state.bookingDraft.orgId)) state.bookingDraft.orgId=state.orgs[0]?.id||'';
      if(render) renderApp();
    } catch(e) { console.error(e); toast(cleanError(e),'error'); }
    finally { state.loading=false; }
  }

  let refreshTimer=null;
  function scheduleRealtimeRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>refreshData(),280);
  }

  function cleanError(e) {
    const msg=e?.message||String(e);
    const map={
      AUTH_REQUIRED:'請重新登入後再試。', ADMIN_REQUIRED:'此操作只限管理員。', PAST_DATE_NOT_ALLOWED:'不可預約過去日期。',
      INVALID_TIME_RANGE:'時段設定不正確。', INVALID_QUANTITY:'人數或數量必須最少為 1。', MISSING_REQUIRED_FIELDS:'請完成所有必填資料。',
      RESOURCE_NOT_AVAILABLE:'此資源目前不可預約。', SLOT_NOT_AVAILABLE:'此日期／時段並非可預約時段。', ROOM_CAPACITY_EXCEEDED:'預計人數超過房間名額。',
      ROOM_ALREADY_BOOKED:'所選房間時段已被批准使用，請選擇其他時段。', ITEM_STOCK_EXCEEDED:'所選時段的物品剩餘數量不足。',
      RELATED_ROOM_REQUIRED:'此物品必須配合房間申請。', INVALID_RELATED_ROOM:'找不到符合日期及時段的相關房間申請。',
      RELATED_ROOM_MUST_BE_APPROVED:'請先批准相關房間申請，才可批准此物品借用。', BOOKING_NOT_FOUND:'找不到這項申請。',
      ONLY_PENDING_CAN_BE_REVIEWED:'只有待審批申請可以批准或拒絕。', ONLY_APPROVED_CAN_BE_COMPLETED:'只有已批准申請可以標記完成。',
      ONLY_OWN_PENDING_CAN_BE_CANCELLED:'只有自己的待審批申請可以取消。', INVALID_STATUS:'申請狀態不正確。'
    };
    for(const [key,value] of Object.entries(map)) if(msg.includes(key)) return value;
    return msg.replace('new row violates row-level security policy for table','權限不足：').replace('duplicate key value violates unique constraint','資料重複：');
  }

  function renderSetupError(message) {
    appEl.innerHTML=`<div class="auth-shell">
      <div class="auth-brand"><div class="brand-lockup"><div class="brand-mark"><img src="assets/app-icon.svg" alt=""></div><h1>房間及物品<br>預約系統</h1><p>共享資源・更高效率・讓預約更簡單</p></div></div>
      <main class="auth-panel"><div class="auth-card"><h2>需要完成設定</h2><p class="lead">${esc(message)}</p>
        <div class="info-box"><span class="info-dot">i</span><div>將 <strong>config.example.js</strong> 複製內容到 <strong>config.js</strong>，填入 Supabase Project URL 及 Publishable Key，並設定 <strong>demoMode: false</strong>。</div></div>
        <button class="btn btn-primary btn-block" style="margin-top:16px" data-enable-demo="1">先以示範模式預覽</button>
      </div></main></div>`;
  }

  function authView() {
    const signin=state.authTab==='signin';
    return `<div class="auth-shell">
      <section class="auth-brand">
        <div class="brand-lockup">
          <div class="brand-mark"><img src="assets/app-icon.svg" alt=""></div>
          <h1>房間及物品<br>預約系統</h1>
          <p>一個平台管理空間、器材、時段、名額與申請進度，手機及電腦資料即時同步。</p>
          <div class="auth-points"><div class="auth-point">✓ 房間及物品獨立預約</div><div class="auth-point">✓ 管理員審批及資源設定</div><div class="auth-point">✓ 即時狀態追蹤</div><div class="auth-point">✓ Supabase Realtime 同步</div></div>
        </div>
      </section>
      <main class="auth-panel">
        <form class="auth-card" id="auth-form">
          <h2>${signin?'登入系統':'建立帳戶'}</h2>
          <p class="lead">${signin?'使用你的機構帳戶繼續':'註冊後即可提交預約申請'}</p>
          <div class="auth-tabs"><button type="button" class="${signin?'active':''}" data-auth-tab="signin">登入</button><button type="button" class="${!signin?'active':''}" data-auth-tab="signup">註冊</button></div>
          <div class="form-stack">
            ${!signin?`<div class="field"><label>姓名</label><input class="input" name="fullName" required autocomplete="name"></div><div class="field"><label>聯絡電話</label><input class="input" name="phone" autocomplete="tel"></div>`:''}
            <div class="field"><label>電郵</label><input class="input" type="email" name="email" required autocomplete="email"></div>
            <div class="field"><label>密碼</label><input class="input" type="password" name="password" minlength="6" required autocomplete="${signin?'current-password':'new-password'}"></div>
            <button class="btn btn-primary btn-block" type="submit">${signin?'登入':'建立帳戶'}</button>
          </div>
          <div class="demo-note">管理員權限不會由用戶自行選擇；請在 Supabase SQL 將指定帳戶提升為 admin。</div>
        </form>
      </main>
    </div>`;
  }

  function navItems() {
    return isAdmin() ? [
      ['dashboard','home','總覽'],['resources','resource','資源管理'],['approvals','check','申請審批']
    ] : [
      ['booking','calendar','提交預約'],['my-bookings','search','狀態查詢']
    ];
  }
  function pageMeta() {
    const map={dashboard:['管理員總覽','掌握資源及預約使用情況'],resources:['機構設定／資源管理','設定房間、物品、名額及可預約時段'],approvals:['預約申請審批','批核、拒絕及完成申請'],booking:['預約申請','選擇房間或物品，提交借用申請'], 'my-bookings':['申請狀態查詢','隨時查看你的借用進度']};
    return map[state.page]||['預約系統',''];
  }

  function shellView(content) {
    const [title,sub]=pageMeta();
    const nav=navItems();
    const displayName=state.profile?.full_name||state.user?.email||'用戶';
    const first=displayName.slice(0,1).toUpperCase();
    return `${state.mode==='demo'?`<div class="demo-banner">目前為示範模式・資料只保存在本頁 <button class="demo-switch" data-demo-switch="${isAdmin()?'user':'admin'}">切換至${isAdmin()?'用戶':'管理員'}畫面</button></div>`:''}
      <div class="app-shell">
        <aside class="sidebar">
          <div class="side-brand"><img src="assets/app-icon.svg" alt=""><div><strong>資源預約</strong><span>Booking System</span></div></div>
          <nav class="side-nav"><div class="nav-section">主要功能</div>${nav.map(([id,ico,label])=>`<button class="nav-btn ${state.page===id?'active':''}" data-nav="${id}">${icon(ico,'nav-ico')}<span class="nav-label">${label}</span></button>`).join('')}</nav>
          <div class="side-footer">${state.mode==='demo'?'Demo Mode':'Cloud Sync'}<br>Supabase + Realtime</div>
        </aside>
        <div class="main-shell">
          <header class="topbar">
            <div class="top-title"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
            <div class="top-actions">
              <button class="icon-btn" data-refresh="1" title="重新整理">${icon('refresh','nav-ico')}</button>
              <div class="user-chip"><div class="avatar">${esc(first)}</div><div class="user-meta"><strong>${esc(displayName)}</strong><span>${isAdmin()?'管理員':'一般用戶'}</span></div></div>
              <button class="icon-btn" data-logout="1" title="登出">${icon('logout','nav-ico')}</button>
            </div>
          </header>
          <main class="page">${content}</main>
        </div>
      </div>
      <nav class="mobile-bottom-nav">${nav.slice(0,3).map(([id,ico,label])=>`<button data-nav="${id}" class="${state.page===id?'active':''}">${icon(ico)}<span>${label}</span></button>`).join('')}</nav>`;
  }

  function statCard(iconName,value,label,tone='') { return `<div class="stat-card"><div class="stat-icon ${tone}">${icon(iconName,'nav-ico')}</div><div><strong>${value}</strong><span>${label}</span></div></div>`; }

  function dashboardView() {
    const activeRes=state.resources.filter(r=>r.active);
    const pending=state.bookings.filter(b=>b.status==='pending');
    const today=isoToday();
    const upcoming=state.bookings.filter(b=>b.booking_date>=today&&['pending','approved'].includes(b.status)).slice(0,6);
    const selectedOrg=getOrg(state.selectedOrgId);
    return `<div class="banner"><div><h2>歡迎回來，${esc(state.profile?.full_name||'管理員')}</h2><p>今日可以由這裡快速掌握資源、待審批申請及即將進行的借用。</p></div><div class="banner-stat"><strong>${pending.length}</strong><span>項待審批申請</span></div></div>
      <div class="stats">
        ${statCard('resource',activeRes.filter(r=>r.type==='room').length,'啟用房間')}
        ${statCard('box',activeRes.filter(r=>r.type==='item').length,'啟用物品','teal')}
        ${statCard('clock',pending.length,'待審批','orange')}
        ${statCard('check',state.bookings.filter(b=>b.status==='approved').length,'已批准','green')}
      </div>
      <div class="grid-half">
        <section class="panel"><div class="panel-head"><div class="panel-title"><div class="stat-icon">${icon('calendar','nav-ico')}</div><div><h3>近期申請</h3><p>最新及即將使用的資源</p></div></div><button class="btn btn-light btn-sm" data-nav="approvals">查看全部</button></div>
          <div class="panel-body">${upcoming.length?upcoming.map(b=>miniBooking(b)).join(''):`<div class="empty"><strong>暫未有近期申請</strong><span>新申請會顯示在這裡。</span></div>`}</div></section>
        <section class="panel"><div class="panel-head"><div class="panel-title"><div class="stat-icon teal">${icon('building','nav-ico')}</div><div><h3>資源概況</h3><p>${esc(selectedOrg?.name||'全部機構')}</p></div></div><button class="btn btn-light btn-sm" data-nav="resources">管理資源</button></div>
          <div class="panel-body">${activeRes.slice(0,7).map(r=>`<div class="summary-row"><span>${typePill(r.type)} ${esc(r.name)}</span><strong>${r.type==='room'?`${r.capacity} 人`:`${r.stock_quantity} 件`}</strong></div>`).join('')}</div></section>
      </div>`;
  }
  function miniBooking(b) {
    const r=bookingResource(b);
    return `<div class="summary-row"><div><strong style="display:block;text-align:left;max-width:none">${esc(r.name||'資源')}</strong><span>${esc(bookingRef(b))}・${shortDate(b.booking_date)}・${fmtTime(b.start_time)}–${fmtTime(b.end_time)}</span></div>${statusBadge(b.status)}</div>`;
  }

  function orgOptions(selected, includeAll=false) {
    return `${includeAll?'<option value="">全部機構</option>':''}${state.orgs.map(o=>`<option value="${o.id}" ${o.id===selected?'selected':''}>${esc(o.name)}</option>`).join('')}`;
  }
  function rulesForResource(resourceId) { return state.rules.filter(x=>x.resource_id===resourceId&&x.active); }
  function ruleSummary(resourceId) {
    const rules=rulesForResource(resourceId); if(!rules.length)return '未設定時段';
    const specific=rules.filter(r=>r.specific_date).length;
    const recurring=rules.length-specific;
    return `${rules.length} 個時段${specific?`・${specific} 個指定日期`:recurring?'・循環時段':''}`;
  }

  function resourcesView() {
    const rows=state.resources.filter(r=>(!state.selectedOrgId||r.organization_id===state.selectedOrgId)&&r.type===state.resourceType);
    const selectedOrg=getOrg(state.selectedOrgId);
    const selectedOrgResources=state.resources.filter(r=>r.organization_id===state.selectedOrgId);
    const canAddResource=Boolean(state.selectedOrgId);
    return `<div class="page-head"><div><h2>管理機構資源</h2><p>新增、修改或刪除機構，並管理旗下房間、物品、名額及時段。</p></div><div class="page-actions"><button class="btn btn-light" data-add-org="1">${icon('building','nav-ico')}新增機構</button><button class="btn btn-primary" data-add-resource="1" ${canAddResource?'':'disabled'}>${icon('plus','nav-ico')}新增${state.resourceType==='room'?'房間':'物品'}</button></div></div>
      <section class="panel org-manager-panel">
        <div class="panel-head"><div class="panel-title"><div class="stat-icon teal">${icon('building','nav-ico')}</div><div><h3>機構管理</h3><p>先選擇機構，再管理名稱、狀態及旗下資源</p></div></div><span class="badge active">${state.orgs.length} 個機構</span></div>
        <div class="panel-body">
          <div class="org-management-grid">
            <div class="field"><label>目前機構</label><select class="select" id="admin-org-select">${orgOptions(state.selectedOrgId)}</select></div>
            <div class="org-current-card">
              ${selectedOrg?`<div><span>機構名稱</span><strong>${esc(selectedOrg.name)}</strong><small>${selectedOrgResources.length} 項資源 · ${selectedOrg.active?'啟用中':'已停用'}</small></div><div class="actions"><button class="btn btn-light btn-sm" data-edit-org="${selectedOrg.id}">${icon('edit','nav-ico')}修改</button><button class="btn btn-danger btn-sm" data-delete-org="${selectedOrg.id}">${icon('trash','nav-ico')}刪除</button></div>`:`<div><strong>尚未建立機構</strong><small>請先按「新增機構」。</small></div>`}
            </div>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div class="panel-title"><div class="stat-icon">${icon('settings','nav-ico')}</div><div><h3>房間／物品管理</h3><p>${selectedOrg?`目前：${esc(selectedOrg.name)}`:'請先建立機構'}</p></div></div></div>
        <div class="panel-body">
          <div class="toolbar"><div class="toolbar-left"><div class="segmented"><button data-resource-type="room" class="${state.resourceType==='room'?'active':''}">${icon('resource','nav-ico')} 房間管理</button><button data-resource-type="item" class="${state.resourceType==='item'?'active':''}">${icon('box','nav-ico')} 物品管理</button></div></div><div class="toolbar-right"><button class="btn btn-primary" data-add-resource="1" ${canAddResource?'':'disabled'}>${icon('plus','nav-ico')}新增${state.resourceType==='room'?'房間':'物品'}</button></div></div>
          <div class="table-wrap"><table><thead><tr><th>資源</th><th>${state.resourceType==='room'?'名額':'數量'}</th><th>可用日期／時段</th><th>借用方式</th><th>狀態</th><th>操作</th></tr></thead><tbody>
            ${rows.length?rows.map(r=>`<tr><td><div class="resource-name"><span class="resource-icon ${r.type==='item'?'item':''}">${icon(r.type==='room'?'resource':'box','nav-ico')}</span><div>${esc(r.name)}<span class="cell-sub">${esc(r.location||'未設定位置')}</span></div></div></td><td><strong>${r.type==='room'?`${r.capacity} 人`:`${r.stock_quantity} 件`}</strong></td><td>${esc(ruleSummary(r.id))}</td><td>${r.type==='item'?(r.requires_room?'需配合房間預約':'可獨立借用'):'整個房間預約'}</td><td><span class="badge ${r.active?'active':'inactive'}">${r.active?'啟用':'停用'}</span></td><td><div class="actions"><button class="btn btn-light btn-sm" data-edit-resource="${r.id}">${icon('edit','nav-ico')}編輯</button><button class="btn btn-secondary btn-sm" data-rules="${r.id}">${icon('clock','nav-ico')}設定時段</button><button class="btn btn-danger btn-sm" data-delete-resource="${r.id}">${icon('trash','nav-ico')}刪除</button></div></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty"><strong>未有${state.resourceType==='room'?'房間':'物品'}</strong><span>${selectedOrg?'按「新增」建立第一個資源。':'請先建立機構。'}</span></div></td></tr>`}
          </tbody></table></div>
        </div>
      </section>`;
  }

  function approvalsView() {
    const list=filteredBookings(state.bookings);
    return `<div class="page-head"><div><h2>申請審批</h2><p>批准前系統會再次檢查房間衝突或物品剩餘數量。</p></div></div>
      <section class="panel"><div class="panel-head"><div class="panel-title"><div class="stat-icon orange">${icon('check','nav-ico')}</div><div><h3>申請記錄</h3><p>共 ${list.length} 項符合條件</p></div></div></div>
      <div class="panel-body"><div class="filter-grid" style="margin-bottom:14px">
        <div class="field"><label>關鍵字</label><div class="searchbox">${icon('search')}<input class="input" id="filter-q" value="${esc(state.filters.q)}" placeholder="申請人／用途／資源"></div></div>
        <div class="field"><label>狀態</label><select class="select" id="filter-status"><option value="all">全部</option>${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${state.filters.status===k?'selected':''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>種類</label><select class="select" id="filter-type"><option value="all">全部</option><option value="room" ${state.filters.type==='room'?'selected':''}>房間</option><option value="item" ${state.filters.type==='item'?'selected':''}>物品</option></select></div>
        <button class="btn btn-light" data-clear-filters="1">重設</button>
      </div>
      ${bookingTable(list,true)}</div></section>`;
  }

  function filteredBookings(bookings) {
    const q=state.filters.q.trim().toLowerCase();
    return bookings.filter(b=>{
      const r=bookingResource(b);
      return (state.filters.status==='all'||b.status===state.filters.status) && (state.filters.type==='all'||r.type===state.filters.type) && (!q||[bookingRef(b),b.applicant_name,b.purpose,r.name].some(v=>String(v||'').toLowerCase().includes(q)));
    });
  }
  function bookingTable(list, admin=false) {
    if(!list.length)return `<div class="empty"><div class="empty-illustration">${icon('search','nav-ico')}</div><strong>找不到申請</strong><span>調整搜尋條件後再試。</span></div>`;
    return `<div class="table-wrap"><table><thead><tr><th>申請編號</th><th>資源</th><th>日期／時段</th><th>用途</th>${admin?'<th>申請人</th>':''}<th>狀態</th><th>操作</th></tr></thead><tbody>${list.map(b=>{
      const r=bookingResource(b);return `<tr><td><strong>${esc(bookingRef(b))}</strong><span class="cell-sub">${typePill(r.type)}</span></td><td>${esc(r.name||'—')}<span class="cell-sub">${esc(bookingOrg(b).name||'')}</span></td><td>${shortDate(b.booking_date)}<span class="cell-sub">${fmtTime(b.start_time)}–${fmtTime(b.end_time)}</span></td><td>${esc(b.purpose)}</td>${admin?`<td>${esc(b.applicant_name)}<span class="cell-sub">${esc(b.phone||'')}</span></td>`:''}<td>${statusBadge(b.status)}</td><td><div class="actions"><button class="btn btn-light btn-sm" data-booking-detail="${b.id}">查看詳情</button>${admin&&b.status==='pending'?`<button class="btn btn-success btn-sm" data-booking-action="approve" data-booking-id="${b.id}">批准</button><button class="btn btn-danger btn-sm" data-booking-action="reject" data-booking-id="${b.id}">拒絕</button>`:''}${admin&&b.status==='approved'?`<button class="btn btn-secondary btn-sm" data-booking-action="complete" data-booking-id="${b.id}">完成</button>`:''}${!admin&&b.status==='pending'?`<button class="btn btn-danger btn-sm" data-booking-action="cancel" data-booking-id="${b.id}">取消</button>`:''}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function availableResourcesForDraft() {
    return state.resources.filter(r=>r.active&&r.organization_id===state.bookingDraft.orgId&&r.type===state.resourceType);
  }
  function rulesForDate(resourceId,date) {
    if(!resourceId||!date)return [];
    const d=new Date(`${date}T00:00:00`), dow=d.getDay();
    return state.rules.filter(rule=>rule.active&&rule.resource_id===resourceId&&(
      rule.specific_date===date || (rule.specific_date==null && Number(rule.weekday)===dow && (!rule.date_from||date>=rule.date_from)&&(!rule.date_to||date<=rule.date_to))
    )).sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
  }
  function relatedRoomOptions() {
    const d=state.bookingDraft;
    return state.bookings.filter(b=>['pending','approved'].includes(b.status)&&b.booking_date===d.date&&bookingResource(b).type==='room'&&bookingResource(b).organization_id===d.orgId&&b.start_time<=d.startTime&&b.end_time>=d.endTime);
  }

  function bookingView() {
    const d=state.bookingDraft;
    const resources=availableResourcesForDraft();
    const resource=getResource(d.resourceId);
    const slots=rulesForDate(d.resourceId,d.date);
    const selectedSlot=slots.find(s=>fmtTime(s.start_time)===fmtTime(d.startTime)&&fmtTime(s.end_time)===fmtTime(d.endTime));
    const summaryOrg=getOrg(d.orgId);
    const related=resource?.type==='item'&&resource.requires_room?relatedRoomOptions():[];
    return `<div class="page-head"><div><h2>提交預約申請</h2><p>房間與物品可分開借用；選擇可用日期及時段後提交。</p></div></div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><div class="panel-title"><div class="stat-icon">${icon('calendar','nav-ico')}</div><div><h3>預約申請</h3><p>填寫資料後送交管理員審批</p></div></div></div>
          <div class="panel-body"><div class="form-stack">
            <div class="field"><label>借用種類</label><div class="segmented"><button data-booking-type="room" class="${state.resourceType==='room'?'active':''}">${icon('resource','nav-ico')} 房間</button><button data-booking-type="item" class="${state.resourceType==='item'?'active':''}">${icon('box','nav-ico')} 物品</button></div></div>
            <div class="field-row"><div class="field"><label>機構 <span class="req">*</span></label><select class="select" id="booking-org">${orgOptions(d.orgId)}</select></div><div class="field"><label>選擇${state.resourceType==='room'?'房間':'物品'} <span class="req">*</span></label><select class="select" id="booking-resource"><option value="">請選擇</option>${resources.map(r=>`<option value="${r.id}" ${r.id===d.resourceId?'selected':''}>${esc(r.name)}${r.type==='room'?`（最多 ${r.capacity} 人）`:`（共 ${r.stock_quantity} 件）`}</option>`).join('')}</select></div></div>
            <div class="field"><label>日期 <span class="req">*</span></label><input class="input" id="booking-date" type="date" min="${isoToday()}" value="${esc(d.date)}"></div>
            <div class="field"><label>可預約時段 <span class="req">*</span></label><div class="slot-grid">${slots.length?slots.map(s=>{const active=selectedSlot?.id===s.id;return `<button class="slot ${active?'active':''}" data-slot-start="${fmtTime(s.start_time)}" data-slot-end="${fmtTime(s.end_time)}">${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}</button>`}).join(''):`<div class="empty-slots">${d.date&&d.resourceId?'此日期未設定可預約時段。':'請先選擇資源及日期。'}</div>`}</div></div>
            ${resource?`<div class="field-row">${resource.type==='room'?`<div class="field"><label>預計人數 <span class="req">*</span></label><input class="input" id="booking-attendees" type="number" min="1" max="${resource.capacity}" value="${Number(d.attendees)||1}"><small>房間名額：最多 ${resource.capacity} 人</small></div>`:`<div class="field"><label>借用數量 <span class="req">*</span></label><input class="input" id="booking-quantity" type="number" min="1" max="${resource.stock_quantity}" value="${Number(d.quantity)||1}"><small>${state.remaining===null?`總數量：${resource.stock_quantity}`:`目前可批准：${state.remaining} 件`}</small></div>`}<div class="field"><label>資源位置</label><input class="input" value="${esc(resource.location||'未設定')}" disabled></div></div>`:''}
            ${resource?.type==='item'&&resource.requires_room?`<div class="field"><label>相關房間申請 <span class="req">*</span></label><select class="select" id="booking-related"><option value="">請選擇同日同時段的房間申請</option>${related.map(b=>`<option value="${b.id}" ${d.relatedBookingId===b.id?'selected':''}>${esc(bookingResource(b).name)}・${bookingRef(b)}</option>`).join('')}</select><small>此物品被設定為需要配合房間借用。</small></div>`:''}
            <div class="field"><label>用途 <span class="req">*</span></label><textarea class="textarea" id="booking-purpose" placeholder="例如：部門會議、工作坊、社區活動">${esc(d.purpose)}</textarea></div>
            <div class="field-row"><div class="field"><label>申請人姓名 <span class="req">*</span></label><input class="input" id="booking-name" value="${esc(d.applicantName)}"></div><div class="field"><label>聯絡電話 <span class="req">*</span></label><input class="input" id="booking-phone" value="${esc(d.phone)}"></div></div>
            <div class="info-box"><span class="info-dot">i</span><div>物品可獨立借用，不一定與房間一同借用。只有被管理員特別設定為「需配合房間」的物品才需要選擇相關房間申請。</div></div>
            <button class="btn btn-primary btn-block" data-submit-booking="1" ${!(resource&&d.date&&d.startTime&&d.purpose&&d.applicantName&&d.phone)?'disabled':''}>${icon('check','nav-ico')} 提交申請</button>
          </div></div>
        </section>
        <aside class="panel summary-card"><div class="panel-head"><div class="panel-title"><div class="stat-icon teal">${icon('file','nav-ico')}</div><div><h3>申請摘要</h3><p>提交前核對資料</p></div></div></div><div class="panel-body"><div class="summary-list">
          ${summaryRow('借用種類',state.resourceType==='room'?'房間':'物品')}${summaryRow('機構',summaryOrg?.name||'—')}${summaryRow('資源',resource?.name||'—')}${summaryRow('日期',d.date?formatDate(d.date):'—')}${summaryRow('時段',d.startTime?`${d.startTime} – ${d.endTime}`:'—')}${summaryRow(resource?.type==='room'?'人數':'數量',resource?(resource.type==='room'?`${d.attendees||1} 人`:`${d.quantity||1} 件`):'—')}${summaryRow('用途',d.purpose||'—')}${summaryRow('申請人',d.applicantName||'—')}
        </div></div></aside>
      </div>`;
  }
  function summaryRow(label,value){return `<div class="summary-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}

  function myBookingsView() {
    const list=filteredBookings(state.bookings);
    return `<div class="page-head"><div><h2>申請狀態查詢</h2><p>查看房間及物品借用進度、審批結果及管理員備註。</p></div><button class="btn btn-primary" data-nav="booking">${icon('plus','nav-ico')}新增申請</button></div>
      <section class="panel"><div class="panel-head"><div class="panel-title"><div class="stat-icon teal">${icon('search','nav-ico')}</div><div><h3>申請記錄</h3><p>共 ${list.length} 項記錄</p></div></div></div><div class="panel-body">
      <div class="filter-grid" style="margin-bottom:14px"><div class="field"><label>關鍵字</label><div class="searchbox">${icon('search')}<input class="input" id="filter-q" value="${esc(state.filters.q)}" placeholder="申請編號／用途／資源"></div></div><div class="field"><label>狀態</label><select class="select" id="filter-status"><option value="all">全部</option>${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${state.filters.status===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>種類</label><select class="select" id="filter-type"><option value="all">全部</option><option value="room" ${state.filters.type==='room'?'selected':''}>房間</option><option value="item" ${state.filters.type==='item'?'selected':''}>物品</option></select></div><button class="btn btn-light" data-clear-filters="1">重設</button></div>
      ${bookingTable(list,false)}</div></section>`;
  }

  function renderApp() {
    if(!state.profile) { appEl.innerHTML=authView(); return; }
    if(isAdmin() && !['dashboard','resources','approvals'].includes(state.page)) state.page='dashboard';
    if(!isAdmin() && !['booking','my-bookings'].includes(state.page)) state.page='booking';
    const view={dashboard:dashboardView,resources:resourcesView,approvals:approvalsView,booking:bookingView,'my-bookings':myBookingsView}[state.page] || bookingView;
    appEl.innerHTML=shellView(view());
  }

  function openOrgModal(id=null) {
    const org=id?getOrg(id):null;
    modal(org?'修改機構':'新增機構',`<form id="org-form" class="form-stack"><input type="hidden" name="id" value="${esc(org?.id||'')}"><div class="field"><label>機構名稱 <span class="req">*</span></label><input class="input" name="name" required value="${esc(org?.name||'')}" placeholder="例如：市民活動中心"></div><label class="checkbox-line"><input type="checkbox" name="active" ${org?.active===false?'':'checked'}><span><strong>啟用機構</strong><br><small>停用後一般用戶不會看到此機構及旗下資源。</small></span></label></form>`, `<button class="btn btn-light" data-close-modal="1">取消</button><button class="btn btn-primary" type="submit" form="org-form">${org?'儲存更改':'建立機構'}</button>`);
  }
  function openResourceModal(id=null) {
    const r=id?getResource(id):null;
    const type=r?.type||state.resourceType;
    modal(r?'編輯資源':`新增${type==='room'?'房間':'物品'}`,`<form id="resource-form" class="form-stack">
      <input type="hidden" name="id" value="${esc(r?.id||'')}">
      <div class="field-row"><div class="field"><label>機構 <span class="req">*</span></label><select class="select" name="organization_id" required>${orgOptions(r?.organization_id||state.selectedOrgId)}</select></div><div class="field"><label>種類</label><select class="select" name="type" ${r?'disabled':''}><option value="room" ${type==='room'?'selected':''}>房間</option><option value="item" ${type==='item'?'selected':''}>物品</option></select></div></div>
      <div class="field"><label>名稱 <span class="req">*</span></label><input class="input" name="name" required value="${esc(r?.name||'')}"></div>
      <div class="field-row"><div class="field"><label>位置</label><input class="input" name="location" value="${esc(r?.location||'')}"></div><div class="field"><label>${type==='room'?'名額（人）':'總數量（件）'} <span class="req">*</span></label><input class="input" name="amount" type="number" min="1" required value="${type==='room'?(r?.capacity||20):(r?.stock_quantity||1)}"></div></div>
      <div class="field"><label>描述</label><textarea class="textarea" name="description">${esc(r?.description||'')}</textarea></div>
      ${type==='item'?`<label class="checkbox-line"><input type="checkbox" name="requires_room" ${r?.requires_room?'checked':''}><span><strong>此物品需要配合房間申請</strong><br><small>不勾選即代表物品可以完全獨立借用。</small></span></label>`:''}
      <label class="checkbox-line"><input type="checkbox" name="active" ${r?.active===false?'':'checked'}><span><strong>啟用資源</strong><br><small>停用後一般用戶不會看到此資源。</small></span></label>
    </form>`, `<button class="btn btn-light" data-close-modal="1">取消</button><button class="btn btn-primary" type="submit" form="resource-form">儲存</button>`);
  }

  function openRulesModal(resourceId) {
    const r=getResource(resourceId);if(!r)return;
    const rules=rulesForResource(resourceId);
    modal(`設定時段・${r.name}`,`<div class="rule-list">${rules.length?rules.map(rule=>`<div class="rule-row"><div class="rule-meta"><div class="resource-icon">${icon('clock','nav-ico')}</div><div><div class="rule-date">${rule.specific_date?formatDate(rule.specific_date):(DAY_NAMES[Number(rule.weekday)]||'循環')}</div><div class="rule-time">${fmtTime(rule.start_time)} – ${fmtTime(rule.end_time)}${rule.date_from||rule.date_to?`・${rule.date_from||'不限'} 至 ${rule.date_to||'不限'}`:''}</div></div></div><button class="btn btn-danger btn-sm" data-delete-rule="${rule.id}" data-resource-id="${resourceId}">${icon('trash','nav-ico')}</button></div>`).join(''):`<div class="empty-slots">尚未設定任何可預約時段。</div>`}</div>
      <form id="rule-form" class="form-stack"><input type="hidden" name="resource_id" value="${resourceId}">
        <div class="form-section"><div class="form-section-title">新增可預約時段</div>
          <div class="field-row"><div class="field"><label>日期模式</label><select class="select" name="mode" id="rule-mode"><option value="weekday">每週循環</option><option value="date">指定日期</option></select></div><div class="field" id="weekday-field"><label>星期</label><select class="select" name="weekday">${DAY_NAMES.map((n,i)=>`<option value="${i}" ${i===1?'selected':''}>${n}</option>`).join('')}</select></div><div class="field" id="date-field" style="display:none"><label>指定日期</label><input class="input" type="date" name="specific_date" min="${isoToday()}"></div></div>
          <div class="field-row" id="date-range-fields"><div class="field"><label>循環開始日期（可留空）</label><input class="input" type="date" name="date_from"></div><div class="field"><label>循環結束日期（可留空）</label><input class="input" type="date" name="date_to"></div></div>
          <div class="field-row"><div class="field"><label>開始時間</label><input class="input" type="time" name="start_time" value="09:00" required></div><div class="field"><label>結束時間</label><input class="input" type="time" name="end_time" value="10:00" required></div></div>
        </div>
      </form>`, `<button class="btn btn-light" data-close-modal="1">完成</button><button class="btn btn-primary" type="submit" form="rule-form">${icon('plus','nav-ico')}新增時段</button>`, true);
  }

  function openBookingDetail(id) {
    const b=state.bookings.find(x=>x.id===id);if(!b)return;
    const r=bookingResource(b),org=bookingOrg(b);
    modal(`申請詳情・${bookingRef(b)}`,`<div class="detail-grid">
      ${detailItem('借用種類',r.type==='room'?'房間':'物品')}${detailItem('機構',org.name||'—')}${detailItem('資源',r.name||'—')}${detailItem('狀態',STATUS_LABELS[b.status]||b.status)}${detailItem('日期',formatDate(b.booking_date))}${detailItem('時段',`${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}`)}${detailItem(r.type==='room'?'人數':'數量',r.type==='room'?`${b.attendees||1} 人`:`${b.quantity||1} 件`)}${detailItem('申請人',b.applicant_name)}${detailItem('聯絡電話',b.phone||'—')}${detailItem('用途',b.purpose)}
    </div>${b.admin_note?`<div class="note-box"><strong>管理員備註</strong><br>${esc(b.admin_note)}</div>`:''}`, `<button class="btn btn-primary" data-close-modal="1">關閉</button>`);
  }
  function detailItem(label,value){return `<div class="detail-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}

  function openReviewModal(id,action) {
    const b=state.bookings.find(x=>x.id===id);if(!b)return;
    const labels={approve:['批准申請','approved','批准'],reject:['拒絕申請','rejected','拒絕'],complete:['標記完成','completed','完成']};
    const [title,status,verb]=labels[action];
    modal(title,`<form id="review-form" class="form-stack"><input type="hidden" name="booking_id" value="${id}"><input type="hidden" name="status" value="${status}"><div class="info-box"><span class="info-dot">i</span><div>你即將<strong>${verb}</strong>「${esc(bookingResource(b).name)}」於 ${formatDate(b.booking_date)} ${fmtTime(b.start_time)}–${fmtTime(b.end_time)} 的申請。</div></div><div class="field"><label>管理員備註（可選）</label><textarea class="textarea" name="note" placeholder="例如：已預留器材／請到接待處取匙"></textarea></div></form>`, `<button class="btn btn-light" data-close-modal="1">取消</button><button class="btn ${status==='rejected'?'btn-danger':status==='approved'?'btn-success':'btn-primary'}" type="submit" form="review-form">確認${verb}</button>`);
  }

  function syncBookingDraftFromInputs() {
    const d=state.bookingDraft;
    const val=(id)=>$(id)?.value;
    if($('#booking-org')) d.orgId=val('#booking-org');
    if($('#booking-resource')) d.resourceId=val('#booking-resource');
    if($('#booking-date')) d.date=val('#booking-date');
    if($('#booking-purpose')) d.purpose=val('#booking-purpose');
    if($('#booking-name')) d.applicantName=val('#booking-name');
    if($('#booking-phone')) d.phone=val('#booking-phone');
    if($('#booking-quantity')) d.quantity=Math.max(1,Number(val('#booking-quantity')||1));
    if($('#booking-attendees')) d.attendees=Math.max(1,Number(val('#booking-attendees')||1));
    if($('#booking-related')) d.relatedBookingId=val('#booking-related');
  }

  async function selectSlot(start,end) {
    syncBookingDraftFromInputs();
    state.bookingDraft.startTime=start;state.bookingDraft.endTime=end;state.remaining=null;
    const d=state.bookingDraft;
    if(d.resourceId&&d.date){
      try{state.remaining=await state.adapter.getRemaining(d.resourceId,d.date,start,end);}catch(e){toast(cleanError(e),'error');}
    }
    renderApp();
  }

  async function submitBooking() {
    syncBookingDraftFromInputs();
    const d=state.bookingDraft,r=getResource(d.resourceId);
    if(!r||!d.date||!d.startTime||!d.endTime||!d.purpose.trim()||!d.applicantName.trim()||!d.phone.trim()) return toast('請完成所有必填資料。','error');
    if(r.type==='room'&&d.attendees>r.capacity)return toast(`人數不可超過房間名額 ${r.capacity}。`,'error');
    if(r.type==='item'&&d.quantity>r.stock_quantity)return toast(`借用數量不可超過總數量 ${r.stock_quantity}。`,'error');
    if(r.type==='item'&&r.requires_room&&!d.relatedBookingId)return toast('此物品需要選擇相關房間申請。','error');
    try{
      const row=await state.adapter.submitBooking({resource_id:r.id,booking_date:d.date,start_time:d.startTime,end_time:d.endTime,quantity:r.type==='item'?d.quantity:1,attendees:r.type==='room'?d.attendees:1,purpose:d.purpose.trim(),applicant_name:d.applicantName.trim(),phone:d.phone.trim(),related_booking_id:d.relatedBookingId||null});
      toast(`申請已提交${row?.reference_no?`：${row.reference_no}`:''}`);
      state.bookingDraft={orgId:d.orgId,resourceId:'',date:'',startTime:'',endTime:'',purpose:'',applicantName:state.profile?.full_name||'',phone:state.profile?.phone||'',quantity:1,attendees:1,relatedBookingId:''};
      state.remaining=null; await refreshData({render:false}); state.page='my-bookings';renderApp();
    }catch(e){toast(cleanError(e),'error');}
  }

  async function handleBookingAction(id,action) {
    if(action==='cancel'){
      if(!confirm('確定取消這項待審批申請？'))return;
      try{await state.adapter.cancelBooking(id);toast('申請已取消');await refreshData();}catch(e){toast(cleanError(e),'error');}
      return;
    }
    openReviewModal(id,action);
  }

  function resetBookingResource() {
    state.bookingDraft.resourceId='';state.bookingDraft.startTime='';state.bookingDraft.endTime='';state.bookingDraft.relatedBookingId='';state.remaining=null;
  }

  async function onClick(e) {
    const target=e.target.closest('button,[data-nav],[data-close-modal]'); if(!target)return;
    if(target.dataset.closeModal){closeModal();return;}
    if(target.dataset.enableDemo){state.mode='demo';state.adapter=new DemoAdapter();const init=await state.adapter.init();Object.assign(state,init);await postLogin();return;}
    if(target.dataset.nav){state.page=target.dataset.nav;renderApp();return;}
    if(target.dataset.refresh){await refreshData();toast('資料已重新整理','info');return;}
    if(target.dataset.logout){await state.adapter.signOut(); if(state.mode==='demo'){const init=await state.adapter.init();Object.assign(state,init);await postLogin();} else {state.session=state.user=state.profile=null;renderApp();}return;}
    if(target.dataset.demoSwitch){const init=await state.adapter.switchRole(target.dataset.demoSwitch);Object.assign(state,init);state.filters={status:'all',type:'all',q:''};await postLogin();return;}
    if(target.dataset.authTab){state.authTab=target.dataset.authTab;renderApp();return;}
    if(target.dataset.resourceType){state.resourceType=target.dataset.resourceType;renderApp();return;}
    if(target.dataset.bookingType){syncBookingDraftFromInputs();state.resourceType=target.dataset.bookingType;resetBookingResource();renderApp();return;}
    if(target.dataset.addOrg){openOrgModal();return;}
    if(target.dataset.editOrg){openOrgModal(target.dataset.editOrg);return;}
    if(target.dataset.deleteOrg){if(confirm('確定刪除此機構？如機構已有借用紀錄，系統會拒絕刪除以保障歷史資料。')){try{await state.adapter.deleteOrganization(target.dataset.deleteOrg);toast('機構已刪除');await refreshData();}catch(e){toast(cleanError(e),'error');}}return;}
    if(target.dataset.addResource){if(!state.selectedOrgId)return toast('請先建立或選擇機構。','error');openResourceModal();return;}
    if(target.dataset.editResource){openResourceModal(target.dataset.editResource);return;}
    if(target.dataset.deleteResource){if(confirm('確定刪除此資源？如已有借用紀錄，系統會拒絕刪除。')){try{await state.adapter.deleteResource(target.dataset.deleteResource);toast('資源已刪除');await refreshData();}catch(e){toast(cleanError(e),'error');}}return;}
    if(target.dataset.rules){openRulesModal(target.dataset.rules);return;}
    if(target.dataset.deleteRule){if(confirm('確定刪除此可預約時段？')){try{await state.adapter.deleteRule(target.dataset.deleteRule);await refreshData({render:false});openRulesModal(target.dataset.resourceId);toast('時段已刪除');}catch(e){toast(cleanError(e),'error');}}return;}
    if(target.dataset.slotStart){await selectSlot(target.dataset.slotStart,target.dataset.slotEnd);return;}
    if(target.dataset.submitBooking){await submitBooking();return;}
    if(target.dataset.bookingDetail){openBookingDetail(target.dataset.bookingDetail);return;}
    if(target.dataset.bookingAction){await handleBookingAction(target.dataset.bookingId,target.dataset.bookingAction);return;}
    if(target.dataset.clearFilters){state.filters={status:'all',type:'all',q:''};renderApp();return;}
  }

  async function onSubmit(e) {
    const form=e.target;if(!(form instanceof HTMLFormElement))return;
    e.preventDefault();
    const fd=Object.fromEntries(new FormData(form).entries());
    try{
      if(form.id==='auth-form'){
        if(state.authTab==='signin'){const init=await state.adapter.signIn(fd.email,fd.password);Object.assign(state,init);await postLogin();toast('登入成功');}
        else {const data=await state.adapter.signUp(fd.email,fd.password,fd.fullName,fd.phone||'');toast(data?.session?'帳戶已建立':'帳戶已建立，請按電郵確認連結後登入','info');state.authTab='signin';renderApp();}
      }
      if(form.id==='org-form'){const name=String(fd.name||'').trim(); if(!name) throw new Error('請輸入機構名稱。'); const payload={id:fd.id||undefined,name,active:form.querySelector('[name="active"]')?.checked!==false}; if(payload.id){await state.adapter.updateOrganization(payload);toast('機構資料已更新');}else{const row=await state.adapter.createOrganization({name,active:payload.active});state.selectedOrgId=row.id;toast('機構已建立');} closeModal();await refreshData();}
      if(form.id==='resource-form'){
        const type=form.querySelector('[name="type"]')?.value || state.resourceType;
        const organizationId=String(fd.organization_id||'').trim();
        const name=String(fd.name||'').trim();
        const amount=Number(fd.amount);
        if(!organizationId) throw new Error('請先選擇機構。');
        if(!name) throw new Error(`請輸入${type==='room'?'房間':'物品'}名稱。`);
        if(!Number.isInteger(amount)||amount<1) throw new Error(type==='room'?'房間名額必須至少為 1 人。':'物品數量必須至少為 1 件。');
        const payload={id:fd.id||undefined,organization_id:organizationId,type,name,location:String(fd.location||'').trim(),description:String(fd.description||'').trim(),capacity:type==='room'?amount:1,stock_quantity:type==='item'?amount:1,requires_room:type==='item'?Boolean(form.querySelector('[name="requires_room"]')?.checked):false,active:Boolean(form.querySelector('[name="active"]')?.checked)};
        await state.adapter.upsertResource(payload);closeModal();toast(`${type==='room'?'房間':'物品'}設定已儲存`);await refreshData();
      }
      if(form.id==='rule-form'){
        if(fd.start_time>=fd.end_time) throw new Error('結束時間必須晚於開始時間。');
        const mode=fd.mode;
        await state.adapter.createRule({resource_id:fd.resource_id,specific_date:mode==='date'?fd.specific_date:null,weekday:mode==='weekday'?Number(fd.weekday):null,date_from:mode==='weekday'?(fd.date_from||null):null,date_to:mode==='weekday'?(fd.date_to||null):null,start_time:fd.start_time,end_time:fd.end_time,active:true});
        await refreshData({render:false});openRulesModal(fd.resource_id);toast('可預約時段已新增');
      }
      if(form.id==='review-form'){
        await state.adapter.updateBookingStatus(fd.booking_id,fd.status,String(fd.note||'').trim());closeModal();toast('申請狀態已更新');await refreshData();
      }
    }catch(err){toast(cleanError(err),'error');}
  }

  function onChange(e) {
    const t=e.target;
    if(t.id==='admin-org-select'){state.selectedOrgId=t.value;renderApp();return;}
    if(t.id==='booking-org'){syncBookingDraftFromInputs();state.bookingDraft.orgId=t.value;resetBookingResource();renderApp();return;}
    if(t.id==='booking-resource'){syncBookingDraftFromInputs();state.bookingDraft.resourceId=t.value;state.bookingDraft.startTime='';state.bookingDraft.endTime='';state.bookingDraft.relatedBookingId='';state.remaining=null;renderApp();return;}
    if(t.id==='booking-date'){syncBookingDraftFromInputs();state.bookingDraft.date=t.value;state.bookingDraft.startTime='';state.bookingDraft.endTime='';state.bookingDraft.relatedBookingId='';state.remaining=null;renderApp();return;}
    if(['booking-attendees','booking-quantity','booking-related'].includes(t.id)){syncBookingDraftFromInputs();renderApp();return;}
    if(t.id==='filter-status'){state.filters.status=t.value;renderApp();return;}
    if(t.id==='filter-type'){state.filters.type=t.value;renderApp();return;}
    if(t.id==='rule-mode'){
      const isDate=t.value==='date'; $('#weekday-field')?.style.setProperty('display',isDate?'none':'flex'); $('#date-field')?.style.setProperty('display',isDate?'flex':'none'); $('#date-range-fields')?.style.setProperty('display',isDate?'none':'grid');
      return;
    }
  }
  let qTimer;
  function onInput(e) {
    if(e.target.id==='filter-q'){clearTimeout(qTimer);state.filters.q=e.target.value;qTimer=setTimeout(renderApp,160);return;}
    if(['booking-purpose','booking-name','booking-phone'].includes(e.target.id)){syncBookingDraftFromInputs();const btn=$('[data-submit-booking]');if(btn){const d=state.bookingDraft;btn.disabled=!(d.resourceId&&d.date&&d.startTime&&d.purpose&&d.applicantName&&d.phone);} const summary=$('.summary-card'); if(summary){/* keep typing smooth; full summary refresh happens on next state change */} }
  }

  async function postLogin() {
    if(!state.profile)return renderApp();
    state.page=isAdmin()?'dashboard':'booking';
    state.resourceType='room';
    state.bookingDraft.applicantName=state.profile.full_name||'';
    state.bookingDraft.phone=state.profile.phone||'';
    await refreshData({render:false});
    if(state.mode==='supabase'){
      try { if(state.realtimeChannel) await state.adapter.client?.removeChannel?.(state.realtimeChannel); } catch {}
      state.realtimeChannel=state.adapter.subscribe(scheduleRealtimeRefresh);
    }
    renderApp();
  }

  async function boot() {
    document.addEventListener('click',onClick);
    document.addEventListener('submit',onSubmit);
    document.addEventListener('change',onChange);
    document.addEventListener('input',onInput);
    try{
      await setupAdapter();
      const init=await state.adapter.init();Object.assign(state,init);
      if(state.profile) await postLogin(); else renderApp();
      if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }catch(e){console.error(e);renderSetupError(cleanError(e));}
  }

  boot();
})();
