(function () {
  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  const cfg = window.APP_CONFIG || {};
  const DEMO = cfg.demoMode !== false;
  const ADMIN_DEMO_KEY = 'rrbs_admin_demo_v4';
  const FORM_KEY = 'rrbs_demo_form_v2';
  const SYNC_CHANNEL = 'rrbs-resource-sync';
  const PORTAL_SESSION_KEY = 'rrbs_portal_session_v1';

  let supabase = null;
  let syncChannel = null;
  let rooms = [];
  let centerUseItems = [];
  let loanItems = [];
  const icons = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h10a2 2 0 0 1 2 2v14H6z"/><path d="M6 20h12"/><circle cx="14" cy="12" r="1"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="m3 7 9 4 9-4"/><path d="M3 7v10l9 4 9-4V7"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 13 4 4L19 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/></svg>',
    projector: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M8 17v2m8-2v2M7 12h.01M18 10l3-2v8l-3-2"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="11" rx="2"/><path d="M8 15v5M16 15v5M6 20h4M14 20h4"/></svg>',
    tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 17h.01"/></svg>',
    wheelchair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="18" r="4"/><circle cx="14" cy="5" r="2"/><path d="M14 7v5h4l2 6h-3l-1.5-4H11"/><path d="M9 18h8"/></svg>',
    bp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="10" height="8" rx="2"/><path d="M10 12v3a4 4 0 0 0 8 0v-3"/><path d="M6 8h6"/><path d="M18 6h2v4h-2"/></svg>',
    kit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18"/><path d="m5 5 14 14M19 5 5 19"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><circle cx="12" cy="16" r="2"/></svg>',
  };

  const state = {
    currentTab: 'home',
    page: 'home',
    roomMonthOffset: 0,
    itemMonthOffset: 0,
    query: '',
    queryResourceId: '',
    queryMonthOffset: 0,
    querySelectedDate: '',
    itemCategoryFilter: 'all',
    queryItemCategoryFilter: 'all',
    bookingPolicy: {active:false,mode:'fixed_month_day',scope:'month',fixed_day:1,days_before:7},
    roomFlow: defaultRoomFlow(),
    loanFlow: defaultLoanFlow(),
    confirmation: null,
    organizations: [],
    availability: [],
    publicBookings: [],
    busyPeriods: [],
    resourceBlocks: [],
    purposeOptions: [],
    loadingData: true,
    sourceError: '',
    portalAuthenticated: false,
    portalOrgId: '',
    portalOrgName: '',
    portalPassword: '',
  };

  init();

  async function init() {
    hydrateStored();
    hydratePortalSession();
    setupSyncListeners();
    await refreshFromSource(false);
    render();
  }

  function hydratePortalSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PORTAL_SESSION_KEY) || 'null');
      if (saved?.orgId && saved?.password) {
        state.portalOrgId = saved.orgId;
        state.portalPassword = saved.password;
        state.portalAuthenticated = true;
      }
    } catch (_) {}
  }

  function savePortalSession() {
    if (state.portalAuthenticated && state.portalOrgId && state.portalPassword) {
      sessionStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify({ orgId: state.portalOrgId, password: state.portalPassword }));
    }
  }

  function clearPortalSession() {
    sessionStorage.removeItem(PORTAL_SESSION_KEY);
    state.portalAuthenticated = false;
    state.portalOrgId = '';
    state.portalOrgName = '';
    state.portalPassword = '';
    state.page = 'home';
    state.currentTab = 'home';
    state.roomFlow = defaultRoomFlow();
    state.loanFlow = defaultLoanFlow();
    state.queryResourceId = '';
    state.querySelectedDate = '';
  }

  function defaultRoomFlow() {
    return {
      roomId: '',
      date: '',
      duration: '60',
      customMinutes: 90,
      startTime: '',
      needsItems: null,
      items: {},
      purpose: '',
      applicantName: '',
      phone: '',
      notes: '',
    };
  }

  function defaultLoanFlow() {
    return {
      startDate: '',
      returnDate: '',
      items: {},
      purpose: '',
      applicantName: '',
      phone: '',
      notes: '',
    };
  }

  function hydrateStored() {
    try {
      const saved = JSON.parse(localStorage.getItem(FORM_KEY) || '{}');
      if (saved.roomFlow) state.roomFlow = { ...defaultRoomFlow(), ...saved.roomFlow };
      if (saved.loanFlow) state.loanFlow = { ...defaultLoanFlow(), ...saved.loanFlow };
    } catch (e) {}
  }

  function persistForms() {
    localStorage.setItem(FORM_KEY, JSON.stringify({ roomFlow: state.roomFlow, loanFlow: state.loanFlow }));
  }

  function setupSyncListeners() {
    window.addEventListener('storage', async (event) => {
      if (DEMO && event.key === ADMIN_DEMO_KEY) await refreshFromSource(true);
    });
    if ('BroadcastChannel' in window) {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL);
      syncChannel.onmessage = async () => { await refreshFromSource(true); };
    }
    window.addEventListener('focus', () => refreshFromSource(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshFromSource(true);
    });
    if (!DEMO) {
      setInterval(() => {
        if (document.visibilityState === 'visible') refreshFromSource(true);
      }, 30000);
    }
  }

  function broadcastSync() {
    if (syncChannel) syncChannel.postMessage({ type: 'changed', at: Date.now() });
  }

  async function refreshFromSource(shouldRender = true) {
    state.loadingData = true;
    state.sourceError = '';
    try {
      if (DEMO) loadDemoSource();
      else await loadSupabaseSource();
      rebuildCatalog();
    } catch (error) {
      state.sourceError = readableError(error);
    } finally {
      state.loadingData = false;
      if (shouldRender) render();
    }
  }

  function demoSeed() {
    return {
      organizations: [
        { id: 'org-demo-1', name: '社區綜合服務中心', access_password: '1234', active: true, created_at: new Date().toISOString() },
        { id: 'org-demo-2', name: '樂齡活動中心', access_password: '1234', active: true, created_at: new Date().toISOString() },
      ],
      resources: [
        { id: 'room-demo-1', organization_id: 'org-demo-1', type: 'room', name: '活動室 1-2', location: '1/F', description: '適合小組及活動', capacity: 20, stock_quantity: 1, requires_room: false, image_url: null, active: true },
        { id: 'room-demo-2', organization_id: 'org-demo-1', type: 'room', name: '會議室', location: '2/F', description: '適合會議', capacity: 10, stock_quantity: 1, requires_room: false, image_url: null, active: true },
        { id: 'item-demo-1', organization_id: 'org-demo-1', type: 'item', name: '投影機', location: '中心內', description: '中心即日使用', capacity: 1, stock_quantity: 2, requires_room: true, image_url: null, active: true },
        { id: 'item-demo-2', organization_id: 'org-demo-1', type: 'item', name: '輪椅', location: '地下接待處', description: '可外借', capacity: 1, stock_quantity: 3, requires_room: false, image_url: null, active: true },
      ],
      availability: [
        { id: 'av-1', resource_id: 'room-demo-1', weekday: 1, specific_date: null, date_from: null, date_to: null, start_time: '09:00', end_time: '18:00', active: true },
        { id: 'av-2', resource_id: 'room-demo-2', weekday: 2, specific_date: null, date_from: null, date_to: null, start_time: '09:00', end_time: '17:00', active: true },
      ],
      bookings: [],
      resourceBlocks: [],
      purposeOptions: [
        { id: 'purpose-case', label: '個案', active: true, sort_order: 1 },
        { id: 'purpose-group', label: '小組', active: true, sort_order: 2 },
        { id: 'purpose-outing', label: '外出活動', active: true, sort_order: 3 },
      ],
    };
  }

  function loadDemoSource() {
    let data;
    try { data = JSON.parse(localStorage.getItem(ADMIN_DEMO_KEY) || 'null'); } catch (_) { data = null; }
    if (!data) {
      data = demoSeed();
      localStorage.setItem(ADMIN_DEMO_KEY, JSON.stringify(data));
    }
    if (Array.isArray(data.organizations)) {
      data.organizations.forEach(org => { if (!org.access_password) org.access_password = '1234'; });
    }
    state.organizations = (Array.isArray(data.organizations) ? data.organizations : []).filter(org => org.active !== false);
    if (!state.portalAuthenticated) {
      state._allResources = []; state.availability = []; state._allBookings = []; state.resourceBlocks = []; state.publicBookings = []; state.busyPeriods = [];
      state.purposeOptions = Array.isArray(data.purposeOptions) ? data.purposeOptions : demoSeed().purposeOptions;
      return;
    }
    const org = state.organizations.find(item => item.id === state.portalOrgId);
    if (!org || String(org.access_password || '1234') !== String(state.portalPassword || '')) {
      clearPortalSession();
      state._allResources = []; state.availability = []; state._allBookings = []; state.resourceBlocks = []; state.publicBookings = []; state.busyPeriods = [];
      return;
    }
    state.portalOrgName = org.name;
    const allResources = Array.isArray(data.resources) ? data.resources : [];
    const orgResources = allResources.filter(resource => resource.organization_id === state.portalOrgId);
    const ids = new Set(orgResources.map(resource => resource.id));
    state._allResources = orgResources;
    state.availability = (Array.isArray(data.availability) ? data.availability : []).filter(row => ids.has(row.resource_id));
    state._allBookings = (Array.isArray(data.bookings) ? data.bookings : []).filter(row => ids.has(row.resource_id));
    state.resourceBlocks = (Array.isArray(data.resourceBlocks) ? data.resourceBlocks : []).filter(row => ids.has(row.resource_id));
    state.purposeOptions = Array.isArray(data.purposeOptions) ? data.purposeOptions : demoSeed().purposeOptions;
    state.publicBookings = buildDemoPublicBookings(state._allBookings);
    state.busyPeriods = buildDemoBusyPeriods(state._allBookings);
  }

  function saveDemoSource() {
    let latest = null;
    try { latest = JSON.parse(localStorage.getItem(ADMIN_DEMO_KEY) || 'null'); } catch (_) {}
    latest = latest || demoSeed();
    const orgResourceIds = new Set((latest.resources || []).filter(r => r.organization_id === state.portalOrgId).map(r => r.id));
    const foreignBookings = (latest.bookings || []).filter(b => !orgResourceIds.has(b.resource_id));
    latest.bookings = [...foreignBookings, ...(state._allBookings || [])];
    localStorage.setItem(ADMIN_DEMO_KEY, JSON.stringify(latest));
    broadcastSync();
  }

  async function ensureSupabaseClient() {
    if (supabase) return supabase;
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('正式模式尚未設定 Supabase URL / Publishable Key');
    if (!window.supabase) throw new Error('Supabase 程式庫未能載入');
    supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    setupSupabaseRealtime();
    return supabase;
  }

  function setupSupabaseRealtime() {
    if (!supabase || state._realtimeReady) return;
    state._realtimeReady = true;
    supabase.channel('rrbs-public-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => refreshFromSource(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => refreshFromSource(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_availability' }, () => refreshFromSource(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_blocks' }, () => refreshFromSource(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => refreshFromSource(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purpose_options' }, () => refreshFromSource(true))
      .subscribe();
  }

  async function loadSupabaseSource() {
    const client = await ensureSupabaseClient();
    const orgs = await client.rpc('get_portal_organizations');
    if (orgs.error) throw orgs.error;
    state.organizations = orgs.data || [];
    const policyRes = await client.rpc('get_booking_policy');
    if (!policyRes.error && policyRes.data) state.bookingPolicy = policyRes.data;
    if (!state.portalAuthenticated) {
      state._allResources = []; state.availability = []; state.resourceBlocks = []; state.publicBookings = []; state.busyPeriods = []; state.purposeOptions = [];
      return;
    }
    const result = await client.rpc('get_organization_portal_data', {
      p_organization_id: state.portalOrgId,
      p_password: state.portalPassword,
    });
    if (result.error) {
      if (/INVALID_ORGANIZATION_PASSWORD|ORGANIZATION_NOT_AVAILABLE/i.test(result.error.message || '')) clearPortalSession();
      throw result.error;
    }
    const payload = result.data || {};
    state.portalOrgName = payload.organization?.name || state.organizations.find(o => o.id === state.portalOrgId)?.name || '';
    state._allResources = payload.resources || [];
    state.availability = payload.availability || [];
    state.resourceBlocks = payload.resource_blocks || [];
    state.purposeOptions = payload.purpose_options || [];
    state.publicBookings = (payload.public_bookings || []).map(row => ({
      resourceId: row.resource_id, title: row.resource_name, type: row.resource_type === 'item' ? 'loan' : 'room',
      date: row.booking_date, returnDate: row.loan_end_date || row.booking_date, status: row.status || 'approved', quantity: Number(row.quantity || 1),
    }));
    state.busyPeriods = (payload.busy_periods || []).map(row => ({
      resourceId: row.resource_id, date: row.booking_date, returnDate: row.loan_end_date || row.booking_date,
      startTime: shortTime(row.start_time), endTime: shortTime(row.end_time), quantity: Number(row.quantity || 1),
    }));
  }

  function rebuildCatalog() {
    const resources = (state._allResources || []).filter(resource => resource.active !== false && resource.organization_id === state.portalOrgId);
    rooms = resources.filter(resource => resource.type === 'room').map(resource => ({
      ...resource,
      capacity: Number(resource.capacity || 1),
      organizationName: organizationName(resource.organization_id),
    }));
    centerUseItems = resources.filter(resource => resource.type === 'item').map(toUiItem);
    loanItems = resources.filter(resource => resource.type === 'item' && !resource.requires_room).map(toUiItem);
    if (state.roomFlow.roomId && !rooms.some(room => room.id === state.roomFlow.roomId)) {
      state.roomFlow.roomId = '';
      state.roomFlow.date = '';
      state.roomFlow.duration = '60';
      state.roomFlow.customMinutes = 90;
      state.roomFlow.startTime = '';
      state.roomFlow.items = {};
    }
    const queryIds = new Set([...rooms, ...centerUseItems].map(resource => resource.id));
    if (state.queryResourceId && !queryIds.has(state.queryResourceId)) {
      state.queryResourceId = '';
      state.querySelectedDate = '';
      state.queryMonthOffset = 0;
    }
  }

  function toUiItem(resource) {
    return {
      ...resource,
      max: Math.max(1, Number(resource.stock_quantity || 1)),
      icon: iconForItem(resource.name),
      organizationName: organizationName(resource.organization_id),
      description: resource.description || (resource.requires_room ? '只可配合房間預約／中心內使用' : '可配合房間預約或單獨外借'),
    };
  }

  function iconForItem(name) {
    const text = String(name || '');
    if (/輪椅/.test(text)) return 'wheelchair';
    if (/血壓/.test(text)) return 'bp';
    if (/咪|麥克風/.test(text)) return 'mic';
    if (/白板/.test(text)) return 'board';
    if (/平板|tablet/i.test(text)) return 'tablet';
    if (/擴音|喇叭|speaker/i.test(text)) return 'speaker';
    if (/投影/.test(text)) return 'projector';
    return 'kit';
  }

  function organizationName(id) {
    return state.organizations.find(org => org.id === id)?.name || '';
  }

  function buildDemoPublicBookings(bookings) {
    const seen = new Set();
    return (bookings || [])
      .filter(booking => ['approved', 'completed', '已批准', '已歸還'].includes(booking.status))
      .map(booking => {
        const resource = (state._allResources || []).find(item => item.id === booking.resource_id);
        const type = resource?.type === 'item' ? 'loan' : (booking.type === 'loan' ? 'loan' : 'room');
        const row = {
          resourceId: booking.resource_id,
          title: resource?.name || booking.title || booking.roomName || '資源',
          type,
          date: booking.booking_date || booking.date,
          returnDate: booking.loan_end_date || booking.returnDate || booking.booking_date || booking.date,
          status: booking.status,
          quantity: Number(booking.quantity || 1),
        };
        const key = [row.resourceId, row.title, row.date, row.returnDate].join('|');
        if (seen.has(key)) return null;
        seen.add(key);
        return row;
      })
      .filter(Boolean);
  }

  function buildDemoBusyPeriods(bookings) {
    return (bookings || [])
      .filter(booking => ['approved', 'completed', '已批准', '已歸還'].includes(booking.status))
      .map(booking => ({
        resourceId: booking.resource_id,
        date: booking.booking_date || booking.date,
        returnDate: booking.loan_end_date || booking.returnDate || booking.booking_date || booking.date,
        startTime: shortTime(booking.start_time || '09:00'),
        endTime: shortTime(booking.end_time || '18:00'),
        quantity: Number(booking.quantity || 1),
      }));
  }

  function readableError(error) {
    const message = error?.message || error?.details || String(error || '資料同步失敗');
    if (/BOOKING_WINDOW_CLOSED/i.test(message)) return '所選日期尚未開放預約';
    if (/get_booking_policy/i.test(message) && /does not exist|schema cache|could not find/i.test(message)) return 'Supabase 尚未套用 v10.5 開放申請期限／物品分類 SQL';
    if (/get_portal_organizations|get_organization_portal_data|verify_organization_portal|submit_organization_/i.test(message) && /does not exist|schema cache|could not find/i.test(message)) return 'Supabase 尚未套用 v9 機構登入及資料隔離 SQL';
    if (/INVALID_ORGANIZATION_PASSWORD/i.test(message)) return '機構密碼不正確';
    if (/ORGANIZATION_NOT_AVAILABLE/i.test(message)) return '此機構目前未開放使用';
    if (/ORG_RESOURCE_MISMATCH/i.test(message)) return '所選資源不屬於目前登入機構';
    if (/RESOURCE_DATE_BLOCKED/i.test(message)) return '所選日期已由管理員設為不可借用，請重新選擇日期';
    if (/get_public_resource_busy_periods|admin_upsert_booking_record/i.test(message) && /does not exist|schema cache|could not find/i.test(message)) return 'Supabase 尚未套用 v7 預約流程／日曆管理 SQL';
    if (/resource_blocks/i.test(message) && /does not exist|schema cache|could not find/i.test(message)) return 'Supabase 尚未套用 v6 借用狀況日曆 SQL';
    if (/get_public_resource_bookings/i.test(message)) return 'Supabase 尚未套用前後台同步 SQL';
    if (/permission denied|row-level security/i.test(message)) return 'Supabase 讀取權限尚未套用同步 SQL';
    return message;
  }

  function render() {
    app.innerHTML = `
      <div class="app-shell">
        ${state.portalAuthenticated ? renderScreen() : renderAccessGate()}
      </div>
      ${state.portalAuthenticated ? renderNav() : ''}
    `;
    bindCommonEvents();
    persistForms();
  }

  function renderAccessGate() {
    const options = state.organizations.map(org => `<option value="${escapeAttr(org.id)}">${escapeHtml(org.name)}</option>`).join('');
    return `
      <div class="portal-gate">
        <div class="portal-gate-card card">
          <div class="brand portal-gate-brand"><div class="brand-logo">${icons.calendar}</div><div><div class="brand-title">房間及物品預約系統</div><div class="brand-subtitle">請先登入所屬機構</div></div></div>
          <div class="portal-gate-copy">為確保不同機構的房間、物品及借用資料互相分隔，請選擇所屬機構並輸入密碼。</div>
          ${state.sourceError ? `<div class="portal-gate-error">${escapeHtml(state.sourceError)}</div>` : ''}
          <form class="portal-login-form" data-portal-login>
            <label class="field-label">所屬機構 *</label>
            <select class="input" name="organization_id" required><option value="">請選擇機構</option>${options}</select>
            <label class="field-label">機構密碼 *</label>
            <input class="input" type="password" name="password" required autocomplete="current-password" placeholder="請輸入機構密碼">
            <button class="btn btn-primary btn-block" type="submit">進入預約系統</button>
          </form>
          <div class="portal-gate-note">如忘記密碼，請向所屬機構職員查詢。</div>
          <a class="desktop-admin-link portal-admin-link" href="admin.html">管理員登入</a>
        </div>
      </div>`;
  }

  async function loginPortal(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const orgId = String(fd.get('organization_id') || '');
    const password = String(fd.get('password') || '');
    if (!orgId || !password) return toast('請選擇機構並輸入密碼', 'error');
    try {
      if (DEMO) {
        let data = null; try { data = JSON.parse(localStorage.getItem(ADMIN_DEMO_KEY) || 'null'); } catch (_) {}
        data = data || demoSeed();
        const org = (data.organizations || []).find(o => o.id === orgId && o.active !== false);
        if (!org || String(org.access_password || '1234') !== password) throw new Error('INVALID_ORGANIZATION_PASSWORD');
      } else {
        const client = await ensureSupabaseClient();
        const result = await client.rpc('verify_organization_portal', { p_organization_id: orgId, p_password: password });
        if (result.error) throw result.error;
        if (!result.data) throw new Error('INVALID_ORGANIZATION_PASSWORD');
      }
      state.portalOrgId = orgId; state.portalPassword = password; state.portalAuthenticated = true;
      state.portalOrgName = state.organizations.find(o => o.id === orgId)?.name || '';
      savePortalSession();
      await refreshFromSource(false);
      state.page = 'home'; state.currentTab = 'home';
      render();
      toast(`已進入${state.portalOrgName ? '「' + state.portalOrgName + '」' : ''}`, 'success');
    } catch (error) {
      clearPortalSession();
      state.sourceError = readableError(error);
      render();
    }
  }

  function renderScreen() {
    if (state.page === 'reserveType') return renderReserveType();
    if (state.page === 'roomBooking') return renderRoomBooking();
    if (state.page === 'roomItems') return renderRoomItems();
    if (state.page === 'roomConfirm') return renderRoomConfirm();
    if (state.page === 'loanBooking') return renderLoanBooking();
    if (state.page === 'loanConfirm') return renderLoanConfirm();
    if (state.page === 'confirmation') return renderConfirmation();
    if (state.page === 'query') return renderQueryPage();
    if (state.page === 'my') return renderMyPage();
    return renderHome();
  }

  function renderHeader(title, subtitle, backTo) {
    return `
      <div class="app-header">
        <div class="brand">
          <div class="brand-logo">${icons.calendar}</div>
          <div>
            <div class="brand-title">${title}</div>
            <div class="brand-subtitle">${subtitle}</div>
          </div>
        </div>
        ${backTo ? `<button class="header-action" data-back="${backTo}">${icons.back}</button>` : `<div class="header-actions-wrap"><span class="portal-org-chip">${escapeHtml(state.portalOrgName || '')}</span><a class="desktop-admin-link" href="admin.html">管理員登入</a><button class="header-action portal-logout" data-portal-logout title="離開機構">登出</button></div>`}
      </div>
    `;
  }

  function renderHome() {
    return `
      ${renderHeader('房間及物品<br>預約系統', '簡單預約・善用資源・服務社區', null)}
      <section class="card hero-card">
        <div class="hero-scene">
          <div class="hero-tree"></div>
          <div class="hero-tree-right"></div>
          <div class="hero-building"></div>
          <div class="hero-wave"></div>
        </div>
        <div class="primary-actions">
          <button class="big-button primary" data-nav-page="reserveType">
            <span class="button-text">${icons.calendar}<span>預約</span></span>
            ${icons.arrow}
          </button>
          <button class="big-button secondary" data-nav-page="query">
            <span class="button-text">${icons.search}<span>查詢</span></span>
            ${icons.arrow}
          </button>
        </div>
        <div class="quote-box">善用每一份資源，讓社區生活更美好！</div>
      </section>
    `;
  }

  function renderReserveType() {
    return `
      ${renderHeader('選擇預約', '先選擇借用類別', 'home')}
      <div class="stack">
        <button class="choice-card" data-nav-page="roomBooking">
          <div class="choice-illustration">${icons.door}</div>
          <div class="choice-content">
            <h3>房間</h3>
            <p>預約活動室、會議室等場地</p>
          </div>
          <div class="choice-arrow">›</div>
        </button>
        <button class="choice-card green" data-nav-page="loanBooking">
          <div class="choice-illustration">${icons.box}</div>
          <div class="choice-content">
            <h3>外借物品</h3>
            <p>借用輪椅、活動器材等</p>
          </div>
          <div class="choice-arrow">›</div>
        </button>
      </div>
    `;
  }

  function renderRoomBooking() {
    const f = state.roomFlow;
    const selectedRoom = rooms.find(r => r.id === f.roomId);
    const durationMinutes = roomDurationMinutes(f);
    const startTimes = selectedRoom && f.date && durationMinutes ? getRoomStartTimes(selectedRoom.id, f.date, durationMinutes) : [];
    const endTime = f.startTime && durationMinutes ? addMinutesToTime(f.startTime, durationMinutes) : '';
    return `
      ${renderHeader('預約房間', '選擇房間、日期及預約時間', 'reserveType')}
      <section class="card step-card">
        ${renderStep(5, 1, ['房間', '日期', '預約時間', '開始時間', '同日物品'])}

        <div class="field-block">
          <div class="field-title"><span class="order">1</span>選擇房間</div>
          <div class="room-grid">
            ${rooms.map(room => `
              <button class="room-card ${f.roomId === room.id ? 'selected' : ''}" data-room-id="${room.id}">
                <div class="room-photo ${room.image_url ? 'has-image' : ''}">${room.image_url ? `<img src="${escapeAttr(room.image_url)}" alt="${escapeAttr(room.name)}">` : '<span class="resource-image-placeholder">房間圖片</span>'}</div>
                <div class="room-meta">
                  <h3>${escapeHtml(room.name)}</h3>
                  <p>可容納 ${room.capacity} 人${room.description ? `・${escapeHtml(room.description)}` : ''}</p>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">2</span>選擇日期</div>
          ${renderCalendar('room')}
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">3</span>預約時間</div>
          <div class="duration-options">
            ${[['30','半小時'],['60','1 小時'],['120','2 小時'],['other','其他']].map(([value,label])=>`<button type="button" class="duration-option ${String(f.duration)===value?'selected':''}" data-room-duration="${value}">${label}</button>`).join('')}
          </div>
          ${f.duration === 'other' ? `<div class="custom-duration-row"><label class="field-label">自訂時長（分鐘）</label><input class="input" type="number" min="30" max="480" step="30" data-room-custom-minutes value="${Number(f.customMinutes || 90)}"><div class="helper">以 30 分鐘為單位</div></div>` : ''}
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">4</span>開始時間</div>
          ${selectedRoom && f.date ? (startTimes.length ? `<select class="input" data-room-start-time><option value="">請選擇開始時間</option>${startTimes.map(time=>`<option value="${time}" ${f.startTime===time?'selected':''}>${time} - ${addMinutesToTime(time,durationMinutes)}</option>`).join('')}</select>${f.startTime&&endTime?`<div class="selected-time-summary">預約時段：<strong>${f.startTime} - ${endTime}</strong></div>`:''}` : '<div class="notice-box warning"><div class="notice-icon">i</div><div><strong>暫無可用開始時間</strong><span>請更改日期或預約時長。</span></div></div>') : '<div class="helper">請先選擇房間及日期</div>'}
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">5</span>需要同日借用物品嗎？</div>
          <div class="helper">可配合房間預約的物品會於下一步選擇</div>
          <div class="toggle-row" style="margin-top:12px;">
            <button class="toggle-button ${f.needsItems === true ? 'selected' : ''}" data-needs-items="yes">需要</button>
            <button class="toggle-button ${f.needsItems === false ? 'selected' : ''}" data-needs-items="no">不需要</button>
          </div>
        </div>

        <button class="btn btn-primary btn-block" data-room-next>下一步</button>
      </section>
    `;
  }

  function renderRoomItems() {
    const selectedItems = sumQuantities(state.roomFlow.items);
    return `
      ${renderHeader('選擇同日使用物品', '房間預約附加物品', 'roomBooking')}
      <section class="card step-card">
        ${renderStep(5, 5, ['房間', '日期', '預約時間', '開始時間', '同日物品'])}
        <div class="notice-box">
          <div class="notice-icon">i</div>
          <div>
            <strong>房間預約可一併選擇物品</strong>
            <span>所有可配合房間使用的物品都會在此顯示；如物品同時容許單獨外借，亦可在「外借物品」另外預約。</span>
          </div>
        </div>
        ${renderCategoryFilter(itemCategories(centerUseItems),state.itemCategoryFilter,'room')}
        <div class="item-grid">
          ${filterItemsByCategory(centerUseItems,state.itemCategoryFilter).length ? filterItemsByCategory(centerUseItems,state.itemCategoryFilter).map(item => renderItemCard(item, state.roomFlow.items[item.id] || 0, 'room-item')).join('') : '<div class="helper">此分類暫時沒有可配合房間使用的物品</div>'}
        </div>
        <div class="helper" style="margin:12px 0 18px;">已選 ${selectedItems} 件物品</div>
        <div class="inline-actions">
          <button class="btn btn-secondary" data-nav-page="roomBooking">上一步</button>
          <button class="btn btn-primary" data-nav-page="roomConfirm">確認資料</button>
        </div>
      </section>
    `;
  }

  function renderRoomConfirm() {
    const room = rooms.find(r => r.id === state.roomFlow.roomId);
    const items = selectedItemSummary(centerUseItems, state.roomFlow.items);
    const durationMinutes = roomDurationMinutes(state.roomFlow);
    const endTime = state.roomFlow.startTime ? addMinutesToTime(state.roomFlow.startTime, durationMinutes) : '';
    return `
      ${renderHeader('確認房間預約', '填寫申請者資料', state.roomFlow.needsItems ? 'roomItems' : 'roomBooking')}
      <section class="card step-card">
        <div class="summary-card">
          <div class="summary-row"><span>房間</span><strong>${room ? escapeHtml(room.name) : '-'}</strong></div>
          <div class="summary-row"><span>日期</span><strong>${formatDate(state.roomFlow.date)}</strong></div>
          <div class="summary-row"><span>預約時間</span><strong>${state.roomFlow.startTime && endTime ? `${state.roomFlow.startTime} - ${endTime}（${durationLabel(durationMinutes)}）` : '-'}</strong></div>
          <div class="summary-row"><span>同日物品</span><strong>${items.length ? items.map(x => `${escapeHtml(x.name)} × ${x.qty}`).join('、') : '不需要'}</strong></div>
        </div>
        <div class="form-grid" style="margin-top:16px;">
          <div><label class="field-label">申請者姓名 *</label><input class="input" data-field="room-name" value="${escapeAttr(state.roomFlow.applicantName)}" placeholder="請輸入姓名" /></div>
          <div><label class="field-label">電話 *</label><input class="input" data-field="room-phone" value="${escapeAttr(state.roomFlow.phone)}" placeholder="請輸入電話" /></div>
          <div class="full-width-field"><label class="field-label">用途 *</label>${renderPurposeButtons('roomFlow')}</div>
          <div class="full-width-field"><label class="field-label">備註</label><textarea class="textarea" data-field="room-notes" placeholder="如有特別安排可在此註明">${escapeHtml(state.roomFlow.notes)}</textarea></div>
        </div>
        <div class="inline-actions" style="margin-top:16px;">
          <button class="btn btn-secondary" data-nav-page="${state.roomFlow.needsItems ? 'roomItems' : 'roomBooking'}">上一步</button>
          <button class="btn btn-primary" data-submit="room">提交申請</button>
        </div>
      </section>
    `;
  }

  function renderLoanBooking() {
    const selectedCount = sumQuantities(state.loanFlow.items);
    const hasItems = selectedCount > 0;
    const categories = itemCategories(loanItems);
    const visibleItems = filterItemsByCategory(loanItems, state.itemCategoryFilter);
    return `
      ${renderHeader('預約外借物品', '先按分類選擇物品，再選擇可預約日期', 'reserveType')}
      <section class="card step-card">
        ${renderStep(3, hasItems ? 2 : 1, ['選擇物品', '選擇日期', '確認資料'])}

        <div class="field-block">
          <div class="field-title"><span class="order">1</span>選擇外借物品及數量</div>
          ${renderCategoryFilter(categories,state.itemCategoryFilter,'loan')}
          <div class="item-grid two-col">
            ${visibleItems.length ? visibleItems.map(item => renderItemCard(item, state.loanFlow.items[item.id] || 0, 'loan-item')).join('') : '<div class="helper">此分類暫時沒有可單獨外借物品</div>'}
          </div>
          <div class="helper" style="margin-top:10px;">已選 ${selectedCount} 件外借物品</div>
        </div>

        <div class="field-block ${hasItems ? '' : 'is-disabled-block'}">
          <div class="field-title"><span class="order">2</span>選擇可以預約的日期</div>
          <div class="notice-box warning">
            <div class="notice-icon">i</div>
            <div><strong>預設借用期限為 3 日</strong><span>選擇開始日期後，系統會自動帶出 3 日後的預設歸還日期；如有需要可自行修改。</span></div>
          </div>
          ${hasItems ? renderCalendar('loan') : '<div class="calendar-disabled-message">請先選擇至少一項物品，日曆才會顯示可預約日期。</div>'}
          ${state.loanFlow.startDate ? `<div class="form-grid" style="margin-top:14px;"><div><label class="field-label">借用開始日期</label><input class="input" type="date" data-loan-start value="${state.loanFlow.startDate}" readonly /></div><div><label class="field-label">歸還日期</label><input class="input" type="date" data-loan-return min="${state.loanFlow.startDate}" value="${state.loanFlow.returnDate}" /></div></div>` : ''}
        </div>
        <button class="btn btn-primary btn-block" data-loan-next ${!hasItems || !state.loanFlow.startDate ? 'disabled' : ''}>下一步</button>
      </section>
    `;
  }

  function renderPurposeButtons(flowKey) {
    const selected = state[flowKey].purpose || '';
    const options = (state.purposeOptions || []).filter(x => x.active !== false).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    if (!options.length) return '<div class="helper">管理員尚未設定用途選項</div>';
    return `<div class="purpose-options">${options.map(x=>`<button type="button" class="purpose-option ${selected===x.label?'selected':''}" data-purpose-select="${flowKey}:${escapeAttr(x.label)}">${escapeHtml(x.label)}</button>`).join('')}</div>`;
  }

  function renderLoanConfirm() {
    const items = selectedItemSummary(loanItems, state.loanFlow.items);
    return `
      ${renderHeader('確認外借申請', '填寫申請者資料', 'loanBooking')}
      <section class="card step-card">
        ${renderStep(3, 3, ['選擇物品', '選擇日期', '確認資料'])}
        <div class="summary-card">
          <div class="summary-row"><span>外借物品</span><strong>${items.length ? items.map(x => `${x.name} × ${x.qty}`).join('、') : '-'}</strong></div>
          <div class="summary-row"><span>借用開始</span><strong>${formatDate(state.loanFlow.startDate)}</strong></div>
          <div class="summary-row"><span>歸還日期</span><strong>${formatDate(state.loanFlow.returnDate)}</strong></div>
        </div>
        <div class="form-grid" style="margin-top:16px;">
          <div><label class="field-label">申請者姓名 *</label><input class="input" data-field="loan-name" value="${escapeAttr(state.loanFlow.applicantName)}" placeholder="請輸入姓名" /></div>
          <div><label class="field-label">電話 *</label><input class="input" data-field="loan-phone" value="${escapeAttr(state.loanFlow.phone)}" placeholder="請輸入電話" /></div>
          <div class="full-width-field"><label class="field-label">用途 *</label>${renderPurposeButtons('loanFlow')}</div>
          <div class="full-width-field"><label class="field-label">備註</label><textarea class="textarea" data-field="loan-notes" placeholder="如有特別安排可在此註明">${escapeHtml(state.loanFlow.notes)}</textarea></div>
        </div>
        <div class="inline-actions" style="margin-top:16px;">
          <button class="btn btn-secondary" data-nav-page="loanBooking">上一步</button>
          <button class="btn btn-primary" data-submit="loan">提交申請</button>
        </div>
      </section>
    `;
  }

  function renderQueryPage() {
    const resources = queryResources();
    const selected = resources.find(resource => resource.id === state.queryResourceId) || null;
    const roomResources = resources.filter(resource => resource.type === 'room');
    const itemResources = resources.filter(resource => resource.type === 'item');
    return `
      ${renderHeader('查詢借用情況', '選擇房間或物品查看月曆狀況', 'home')}
      <section class="card query-calendar-shell">
        <div class="section-title query-section-heading"><h2>1. 選擇查詢項目</h2><small>${resources.length} 項資源</small></div>
        ${resources.length ? `
          ${roomResources.length ? `<div class="query-resource-section"><div class="query-resource-label">房間</div><div class="query-resource-grid">${roomResources.map(renderQueryResourceCard).join('')}</div></div>` : ''}
          ${itemResources.length ? `<div class="query-resource-section"><div class="query-resource-label">物品</div>${renderCategoryFilter(itemCategories(itemResources),state.queryItemCategoryFilter,'query')}<div class="query-resource-grid">${filterItemsByCategory(itemResources,state.queryItemCategoryFilter).map(renderQueryResourceCard).join('')}</div></div>` : ''}
        ` : '<div class="empty-state">目前沒有可供查詢的房間或物品</div>'}
      </section>
      ${selected ? `
        <section class="card query-calendar-shell query-calendar-result">
          <div class="query-calendar-title-row">
            <div>
              <div class="query-resource-label">${selected.type === 'room' ? '房間' : '物品'}</div>
              <h2>${escapeHtml(selected.name)}</h2>
              <div class="helper">${escapeHtml(selected.organizationName || '')}${selected.location ? `・${escapeHtml(selected.location)}` : ''}</div>
            </div>
            <div class="query-calendar-legend">
              <span><i class="query-legend-dot green"></i>空位</span>
              <span><i class="query-legend-dot red"></i>已借用</span>
              <span><i class="query-legend-dot gray"></i>不可借用</span>
            </div>
          </div>
          ${renderPublicStatusCalendar(selected)}
          ${state.querySelectedDate ? renderPublicDateStatus(selected, state.querySelectedDate) : '<div class="query-calendar-hint">點擊日曆日期查看當日狀況</div>'}
        </section>
      ` : '<div class="card query-calendar-prompt">請先點選上方房間或物品</div>'}
    `;
  }

  function queryResources() {
    return [...rooms, ...centerUseItems].sort((a,b) => {
      if (a.type !== b.type) return a.type === 'room' ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
    });
  }

  function renderQueryResourceCard(resource) {
    const selected = state.queryResourceId === resource.id;
    const visual = resource.image_url
      ? `<div class="query-resource-thumb"><img src="${escapeAttr(resource.image_url)}" alt="${escapeAttr(resource.name)}"></div>`
      : `<div class="query-resource-thumb placeholder">${resource.type === 'room' ? icons.door : icons[resource.icon || 'kit']}</div>`;
    return `<button class="query-resource-card ${selected ? 'selected' : ''}" data-query-resource="${escapeAttr(resource.id)}">${visual}<div class="query-resource-copy"><strong>${escapeHtml(resource.name)}</strong><span>${resource.type==='item'&&resource.category?escapeHtml(resource.category)+' · ':''}${escapeHtml(resource.organizationName || '')}</span></div>${selected ? '<span class="query-selected-check">✓</span>' : ''}</button>`;
  }

  function renderPublicStatusCalendar(resource) {
    const base = new Date();
    const month = new Date(base.getFullYear(), base.getMonth() + state.queryMonthOffset, 1);
    const year = month.getFullYear();
    const monthNo = month.getMonth();
    const firstDay = new Date(year, monthNo, 1).getDay();
    const days = new Date(year, monthNo + 1, 0).getDate();
    const cells = [];
    for (let i=0; i<firstDay; i++) cells.push(null);
    for (let d=1; d<=days; d++) cells.push(new Date(year, monthNo, d));
    while (cells.length % 7) cells.push(null);
    const names = ['日','一','二','三','四','五','六'];
    return `<div class="query-status-calendar">
      <div class="query-status-calendar-head"><button class="query-calendar-nav" data-query-calendar-month="prev">‹</button><strong>${year}年${monthNo+1}月</strong><button class="query-calendar-nav" data-query-calendar-month="next">›</button></div>
      <div class="query-status-weekdays">${names.map(name => `<div>${name}</div>`).join('')}</div>
      <div class="query-status-grid">${cells.map(date => date ? renderPublicStatusDay(resource, toIsoDate(date), date.getDate()) : '<div class="query-status-day empty-cell"></div>').join('')}</div>
    </div>`;
  }

  function renderPublicStatusDay(resource, dateIso, dayNo) {
    const bookings = publicBookingsForResourceDate(resource.id, dateIso);
    const occupied = bookings.length > 0;
    const block = getPublicResourceBlock(resource.id, dateIso);
    const baseAvailable = publicCalendarDayBaseAvailable(resource, dateIso);
    const status = occupied ? 'red' : (block || !baseAvailable ? 'gray' : 'green');
    const label = occupied ? '已借用' : (block ? '不可借用' : (!baseAvailable ? '未開放' : '空位'));
    const selected = state.querySelectedDate === dateIso ? ' selected' : '';
    return `<button class="query-status-day ${status}${selected}" data-query-calendar-date="${dateIso}"><span class="query-day-number">${dayNo}</span><span class="query-day-state">${label}</span></button>`;
  }

  function publicBookingsForResourceDate(resourceId, dateIso) {
    return (state.publicBookings || []).filter(booking => booking.resourceId === resourceId && dateIso >= booking.date && dateIso <= (booking.returnDate || booking.date));
  }

  function getPublicResourceBlock(resourceId, dateIso) {
    return (state.resourceBlocks || []).find(block => block.resource_id === resourceId && String(block.block_date) === dateIso) || null;
  }

  function publicCalendarDayBaseAvailable(resource, dateIso) {
    if (dateIso < todayIso() && !publicBookingsForResourceDate(resource.id, dateIso).length) return false;
    const rules = (state.availability || []).filter(rule => rule.resource_id === resource.id && rule.active !== false);
    if (resource.type === 'item' && !rules.length) return true;
    const weekday = new Date(`${dateIso}T12:00:00`).getDay();
    return rules.some(rule => availabilityMatchesDate(rule, dateIso, weekday));
  }

  function renderPublicDateStatus(resource, dateIso) {
    const bookings = publicBookingsForResourceDate(resource.id, dateIso);
    const block = getPublicResourceBlock(resource.id, dateIso);
    const available = publicCalendarDayBaseAvailable(resource, dateIso);
    const status = bookings.length ? 'red' : (block || !available ? 'gray' : 'green');
    const heading = bookings.length ? '已借用' : (block ? '不可借用' : (!available ? '未開放' : '空位'));
    let details = '';
    if (bookings.length) {
      if (resource.type === 'room') {
        const periods = (state.busyPeriods || []).filter(period => period.resourceId === resource.id && dateIso >= period.date && dateIso <= (period.returnDate || period.date));
        const unique = [];
        const seen = new Set();
        periods.forEach(period => {
          const label = period.startTime && period.endTime ? `${period.startTime}–${period.endTime}` : '當日已有預約';
          if (!seen.has(label)) { seen.add(label); unique.push(label); }
        });
        details = unique.length ? `<div class="query-status-detail-list">${unique.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>` : '<div class="helper">當日已有房間預約</div>';
      } else {
        const rows = bookings.map(booking => {
          const range = booking.returnDate && booking.returnDate !== booking.date ? `${formatDate(booking.date)} 至 ${formatDate(booking.returnDate)}` : formatDate(booking.date);
          return `<span>${range}${Number(booking.quantity || 1) > 1 ? `・數量 ${Number(booking.quantity)}` : ''}</span>`;
        });
        details = `<div class="query-status-detail-list">${rows.join('')}</div>`;
      }
    } else if (block) {
      details = '<div class="helper">此日期已由管理員設定為不可借用。</div>';
    } else if (!available) {
      details = '<div class="helper">此日期未設定開放借用。</div>';
    } else {
      details = '<div class="helper">目前沒有已批准的借用紀錄。</div>';
    }
    return `<div class="query-date-status ${status}"><div><span class="query-date-label">${formatDate(dateIso)}</span><strong>${heading}</strong></div>${details}</div>`;
  }

  function renderMyPage() {
    const bookings = state.publicBookings || [];
    return `
      ${renderHeader('我的申請', '查看已提交之房間及物品申請', 'home')}
      <div class="section-title"><h2>全部申請</h2><small>${bookings.length} 筆</small></div>
      <div class="stack">
        ${bookings.length ? bookings.map(renderBookingCard).join('') : '<div class="card empty-state">暫未有任何申請</div>'}
      </div>
    `;
  }

  function renderConfirmation() {
    if (!state.confirmation) return renderHome();
    return `
      ${renderHeader('提交完成', '你的申請已送出', 'home')}
      <section class="card confirmation-card">
        <div class="confirmation-icon">${icons.check}</div>
        <h2>申請已成功提交</h2>
        <p>系統已收到你的${state.confirmation.type === 'room' ? '房間預約' : '外借物品'}申請，管理員審批後你可回到「查詢」頁面查看最新進度。</p>
        <div class="confirmation-number">申請編號：${state.confirmation.bookingNo}</div>
        <div class="inline-actions">
          <button class="btn btn-secondary" data-nav-page="query">立即查詢</button>
          <button class="btn btn-primary" data-nav-page="home">返回首頁</button>
        </div>
      </section>
    `;
  }

  function renderStep(total, active, labels) {
    return `
      <div class="stepper" style="--step-count:${total}">
        ${labels.map((label, index) => {
          const stepNo = index + 1;
          const cls = stepNo < active ? 'done' : stepNo === active ? 'active' : '';
          return `<div class="step ${cls}"><div class="step-dot">${stepNo < active ? '✓' : stepNo}</div><div>${label}</div></div>`;
        }).join('')}
      </div>
    `;
  }

  function renderCalendar(kind) {
    const offset = kind === 'room' ? state.roomMonthOffset : state.itemMonthOffset;
    const selected = kind === 'room' ? state.roomFlow.date : state.loanFlow.startDate;
    const base = monthFromOffset(offset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const lead = first.getDay();
    const daysInMonth = last.getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return `
      <div class="calendar-card">
        <div class="calendar-header">
          <button class="calendar-nav" data-calendar-nav="${kind}:prev">‹</button>
          <div class="calendar-title">${year}年${month + 1}月</div>
          <button class="calendar-nav" data-calendar-nav="${kind}:next">›</button>
        </div>
        <div class="calendar-weekdays"><div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div></div>
        <div class="calendar-grid">
          ${cells.map(date => renderDayCell(date, kind, selected)).join('')}
        </div>
      </div>
    `;
  }

  function renderDayCell(date, kind, selected) {
    if (!date) return '<div></div>';
    const iso = toIsoDate(date);
    const past = iso < todayIso();
    const roomUnavailable = kind === 'room' && (!state.roomFlow.roomId || !isRoomDateAvailable(state.roomFlow.roomId, iso));
    const loanUnavailable = kind === 'loan' && !isLoanStartDateAvailable(iso);
    const disabled = past || roomUnavailable || loanUnavailable;
    const isToday = iso === todayIso();
    const cls = ['day-cell', disabled ? 'disabled' : 'available', selected === iso ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" ${disabled ? 'disabled' : `data-select-date="${kind}:${iso}"`}>${date.getDate()}</button>`;
  }

  function itemCategories(items){
    return [...new Set((items||[]).map(x=>String(x.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
  }

  function filterItemsByCategory(items,category){
    if(!category||category==='all')return items||[];
    if(category==='uncategorized')return (items||[]).filter(x=>!String(x.category||'').trim());
    return (items||[]).filter(x=>String(x.category||'').trim()===category);
  }

  function renderCategoryFilter(categories,selected,kind){
    const hasUncategorized=(kind==='query'?queryResources():kind==='room'?centerUseItems:loanItems).some(x=>x.type==='item'&&!String(x.category||'').trim());
    const buttons=[`<button type="button" class="category-filter ${selected==='all'?'active':''}" data-category-filter="${kind}:all">全部</button>`]
      .concat(categories.map(c=>`<button type="button" class="category-filter ${selected===c?'active':''}" data-category-filter="${kind}:${escapeAttr(c)}">${escapeHtml(c)}</button>`));
    if(hasUncategorized)buttons.push(`<button type="button" class="category-filter ${selected==='uncategorized'?'active':''}" data-category-filter="${kind}:uncategorized">未分類</button>`);
    return `<div class="category-filter-row">${buttons.join('')}</div>`;
  }

  function bookingDateOpen(dateIso){
    if(!dateIso)return false;
    const p=state.bookingPolicy||{};
    if(!p.active)return dateIso>=todayIso();
    const target=new Date(dateIso+'T12:00:00');
    const today=new Date(todayIso()+'T12:00:00');
    if(target<today)return false;
    if(p.mode==='fixed_month_day'){
      let open=new Date(today.getFullYear(),today.getMonth(),Math.min(28,Math.max(1,Number(p.fixed_day||1))),12);
      if(today<open)open=new Date(today.getFullYear(),today.getMonth()-1,Math.min(28,Math.max(1,Number(p.fixed_day||1))),12);
      let limit=new Date(open);
      if(p.scope==='week')limit.setDate(limit.getDate()+7);
      else if(p.scope==='quarter')limit.setMonth(limit.getMonth()+3);
      else limit.setMonth(limit.getMonth()+1);
      return target<=limit;
    }
    let start;
    if(p.scope==='week'){
      const day=(target.getDay()+6)%7; start=new Date(target); start.setDate(target.getDate()-day);
    }else if(p.scope==='quarter'){
      start=new Date(target.getFullYear(),Math.floor(target.getMonth()/3)*3,1,12);
    }else start=new Date(target.getFullYear(),target.getMonth(),1,12);
    const open=new Date(start); open.setDate(open.getDate()-Math.max(0,Number(p.days_before||0)));
    return today>=open;
  }

  function renderItemCard(item, qty, prefix) {
    const selected = qty > 0;
    const modeText = item.requires_room ? '只可配合房間預約' : '可房間附加／可單獨外借';
    const visual = item.image_url ? `<div class="item-visual has-image"><img src="${escapeAttr(item.image_url)}" alt="${escapeAttr(item.name)}"></div>` : `<div class="item-visual">${icons[item.icon]}</div>`;
    return `
      <div class="item-card ${selected ? 'selected' : ''}">
        <div class="item-check"></div>
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
          ${visual}
          <div class="item-content"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || '')}</p>${item.category?`<span class="item-category-badge">${escapeHtml(item.category)}</span>`:''}<span class="item-mode-note">${modeText}</span></div>
        </div>
        <div class="quantity"><button class="qty-btn" data-item-qty="${prefix}:${item.id}:-1">－</button><div class="qty-value">${qty}</div><button class="qty-btn" data-item-qty="${prefix}:${item.id}:1">＋</button></div>
      </div>
    `;
  }

  function renderBookingCard(booking) {
    const badgeClass = booking.status === '待審批' ? 'pending' : booking.status === '已批准' ? 'approved' : booking.status === '已歸還' ? 'returned' : 'rejected';
    return `
      <div class="card list-card">
        <div class="list-top">
          <div class="code">${booking.bookingNo}</div>
          <div class="badge ${badgeClass}">${booking.status}</div>
        </div>
        <div class="meta-grid">
          <div><span>借用類別</span><strong>${booking.type === 'room' ? '房間' : '外借物品'}</strong></div>
          <div><span>項目</span><strong>${booking.title}</strong></div>
          <div><span>日期</span><strong>${formatDate(booking.date)}</strong></div>
          <div><span>詳情</span><strong>${booking.detail}</strong></div>
          <div><span>用途</span><strong>${booking.purpose}</strong></div>
          <div><span>申請人</span><strong>${booking.applicantName || '-'}</strong></div>
        </div>
      </div>
    `;
  }

  function bindCommonEvents() {
    const portalLogin = document.querySelector('[data-portal-login]');
    if (portalLogin) portalLogin.addEventListener('submit', loginPortal);
    document.querySelectorAll('[data-portal-logout]').forEach(btn => btn.addEventListener('click', async () => {
      clearPortalSession();
      await refreshFromSource(false);
      render();
    }));
    document.querySelectorAll('[data-nav-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = btn.dataset.navPage;
        state.currentTab = pageToTab(state.page);
        render();
      });
    });

    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = btn.dataset.back;
        state.currentTab = pageToTab(state.page);
        render();
      });
    });

    document.querySelectorAll('[data-category-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [kind, value] = btn.dataset.categoryFilter.split(':');
        if(kind==='query') state.queryItemCategoryFilter=value;
        else state.itemCategoryFilter=value;
        render();
      });
    });
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        state.currentTab = tab;
        state.page = tab === 'reserve' ? 'reserveType' : tab;
        render();
      });
    });

    document.querySelectorAll('[data-room-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.roomFlow.roomId = btn.dataset.roomId;
        state.roomFlow.date = '';
        state.roomFlow.startTime = '';
        state.roomFlow.items = {};
        render();
      });
    });

    document.querySelectorAll('[data-calendar-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [kind, dir] = btn.dataset.calendarNav.split(':');
        const key = kind === 'room' ? 'roomMonthOffset' : 'itemMonthOffset';
        state[key] += dir === 'next' ? 1 : -1;
        render();
      });
    });

    document.querySelectorAll('[data-select-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [kind, iso] = btn.dataset.selectDate.split(':');
        if (kind === 'room') {
          state.roomFlow.date = iso;
          state.roomFlow.startTime = '';
          state.roomFlow.items = {};
        } else {
          state.loanFlow.startDate = iso;
          state.loanFlow.returnDate = addDays(iso, 3);
        }
        render();
      });
    });

    document.querySelectorAll('[data-room-duration]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.roomFlow.duration = btn.dataset.roomDuration;
        state.roomFlow.startTime = '';
        persistForms();
        render();
      });
    });

    const customDuration = document.querySelector('[data-room-custom-minutes]');
    if (customDuration) customDuration.addEventListener('change', () => {
      const value = Math.max(30, Math.min(480, Math.round(Number(customDuration.value || 90) / 30) * 30));
      state.roomFlow.customMinutes = value;
      state.roomFlow.startTime = '';
      persistForms();
      render();
    });

    const roomStartTime = document.querySelector('[data-room-start-time]');
    if (roomStartTime) roomStartTime.addEventListener('change', () => {
      state.roomFlow.startTime = roomStartTime.value;
      persistForms();
      render();
    });

    document.querySelectorAll('[data-needs-items]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.roomFlow.needsItems = btn.dataset.needsItems === 'yes';
        if (!state.roomFlow.needsItems) state.roomFlow.items = {};
        render();
      });
    });

    document.querySelectorAll('[data-item-qty]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [prefix, id, deltaRaw] = btn.dataset.itemQty.split(':');
        const delta = Number(deltaRaw);
        const isRoom = prefix === 'room-item';
        const source = isRoom ? centerUseItems : loanItems;
        const item = source.find(x => x.id === id);
        const target = isRoom ? state.roomFlow.items : state.loanFlow.items;
        const next = Math.max(0, Math.min(item.max, (target[id] || 0) + delta));
        target[id] = next;
        if (next === 0) delete target[id];
        if (!isRoom) { state.loanFlow.startDate = ''; state.loanFlow.returnDate = ''; }
        render();
      });
    });

    const roomNext = document.querySelector('[data-room-next]');
    if (roomNext) roomNext.addEventListener('click', goRoomNext);

    document.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', handleFieldInput);
    });

    document.querySelectorAll('[data-query-resource]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.queryResourceId = btn.dataset.queryResource;
        state.queryMonthOffset = 0;
        state.querySelectedDate = '';
        render();
      });
    });

    document.querySelectorAll('[data-query-calendar-month]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.queryMonthOffset += btn.dataset.queryCalendarMonth === 'next' ? 1 : -1;
        state.querySelectedDate = '';
        render();
      });
    });

    document.querySelectorAll('[data-query-calendar-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.querySelectedDate = btn.dataset.queryCalendarDate;
        render();
      });
    });

    const queryInput = document.querySelector('[data-query-input]');
    if (queryInput) {
      queryInput.addEventListener('input', () => {
        state.query = queryInput.value;
      });
      queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          state.query = queryInput.value;
          render();
        }
      });
    }

    const searchBtn = document.querySelector('[data-search]');
    if (searchBtn) searchBtn.addEventListener('click', () => {
      const input = document.querySelector('[data-query-input]');
      state.query = input ? input.value : state.query;
      render();
    });

    const loanStart = document.querySelector('[data-loan-start]');
    if (loanStart) loanStart.addEventListener('input', () => {
      state.loanFlow.startDate = loanStart.value;
      if (!state.loanFlow.returnDate || state.loanFlow.returnDate <= state.loanFlow.startDate) {
        state.loanFlow.returnDate = addDays(state.loanFlow.startDate, 3);
      }
      render();
    });

    const loanReturn = document.querySelector('[data-loan-return]');
    if (loanReturn) loanReturn.addEventListener('input', () => {
      state.loanFlow.returnDate = loanReturn.value;
      persistForms();
    });

    const loanNext = document.querySelector('[data-loan-next]');
    if (loanNext) loanNext.addEventListener('click', () => {
      const items = itemRequestPayload(loanItems, state.loanFlow.items);
      if (!items.length) return toast('請先選擇至少一項外借物品', 'error');
      if (!state.loanFlow.startDate || !state.loanFlow.returnDate) return toast('請選擇可以預約的日期', 'error');
      state.page = 'loanConfirm'; state.currentTab = 'reserve'; render();
    });

    document.querySelectorAll('[data-purpose-select]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [flowKey, ...parts] = btn.dataset.purposeSelect.split(':');
        state[flowKey].purpose = parts.join(':'); persistForms(); render();
      });
    });

    const submitRoom = document.querySelector('[data-submit="room"]');
    if (submitRoom) submitRoom.addEventListener('click', submitRoomBooking);

    const submitLoan = document.querySelector('[data-submit="loan"]');
    if (submitLoan) submitLoan.addEventListener('click', submitLoanBooking);
  }

  function handleFieldInput(e) {
    const key = e.target.dataset.field;
    const value = e.target.value;
    const mapping = {
      'room-name': ['roomFlow', 'applicantName'],
      'room-phone': ['roomFlow', 'phone'],
      'room-notes': ['roomFlow', 'notes'],
      'loan-name': ['loanFlow', 'applicantName'],
      'loan-phone': ['loanFlow', 'phone'],
      'loan-notes': ['loanFlow', 'notes'],
    };
    if (!mapping[key]) return;
    const [obj, prop] = mapping[key];
    state[obj][prop] = value;
    persistForms();
  }

  function goRoomNext() {
    const f = state.roomFlow;
    const durationMinutes = roomDurationMinutes(f);
    if (!f.roomId) return toast('請先選擇房間', 'error');
    if (!f.date) return toast('請先選擇日期', 'error');
    if (!durationMinutes) return toast('請選擇有效的預約時間', 'error');
    if (!f.startTime) return toast('請選擇開始時間', 'error');
    if (!getRoomStartTimes(f.roomId, f.date, durationMinutes).includes(f.startTime)) return toast('所選開始時間已不可用，請重新選擇', 'error');
    if (f.needsItems === null) return toast('請選擇是否需要同日借用物品', 'error');
    state.page = f.needsItems ? 'roomItems' : 'roomConfirm';
    state.currentTab = 'reserve';
    render();
  }

  async function submitRoomBooking() {
    const f = state.roomFlow;
    if (!f.purpose.trim() || !f.applicantName.trim() || !f.phone.trim()) {
      return toast('請填寫用途、申請人姓名及聯絡電話', 'error');
    }
    const room = rooms.find(r => r.id === f.roomId);
    if (!room) return toast('所選房間已不存在，請重新選擇', 'error');
    try {
      let bookingNo;
      if (DEMO) bookingNo = createDemoRoomRequest(room, f);
      else bookingNo = await createSupabaseRoomRequest(room, f);
      state.confirmation = { type: 'room', bookingNo };
      state.roomFlow = defaultRoomFlow();
      state.page = 'confirmation';
      state.currentTab = 'query';
      persistForms();
      await refreshFromSource(false);
      render();
      toast('房間預約已提交', 'success');
    } catch (error) {
      toast('未能提交申請：' + readableError(error), 'error');
    }
  }

  function createDemoRoomRequest(room, f) {
    const groupRef = makeBookingNo('R');
    const now = new Date().toISOString();
    const bookings = state._allBookings || (state._allBookings = []);
    const durationMinutes = roomDurationMinutes(f);
    const endTime = addMinutesToTime(f.startTime, durationMinutes);
    const roomBookingId = localId('booking');
    bookings.unshift({
      id: roomBookingId,
      reference_no: `${groupRef}-1`,
      resource_id: room.id,
      booking_date: f.date,
      start_time: f.startTime,
      end_time: endTime,
      quantity: 1,
      attendees: 1,
      purpose: f.purpose.trim(),
      applicant_name: f.applicantName.trim(),
      phone: f.phone.trim(),
      applicant_note: f.notes.trim() || null,
      related_booking_id: null,
      loan_end_date: null,
      status: 'pending',
      created_at: now,
    });
    const selectedItems = itemRequestPayload(centerUseItems, f.items);
    selectedItems.forEach((item, index) => {
      bookings.unshift({
        id: localId('booking'),
        reference_no: `${groupRef}-I${index + 1}`,
        resource_id: item.resource_id,
        booking_date: f.date,
        start_time: f.startTime,
        end_time: endTime,
        quantity: item.quantity,
        attendees: 1,
        purpose: f.purpose.trim(),
        applicant_name: f.applicantName.trim(),
        phone: f.phone.trim(),
        applicant_note: f.notes.trim() || null,
        related_booking_id: roomBookingId,
        loan_end_date: null,
        status: 'pending',
        created_at: now,
      });
    });
    saveDemoSource();
    return groupRef;
  }

  async function createSupabaseRoomRequest(room, f) {
    const client = await ensureSupabaseClient();
    const durationMinutes = roomDurationMinutes(f);
    const endTime = addMinutesToTime(f.startTime, durationMinutes);
    const { data, error } = await client.rpc('submit_organization_room_request', {
      p_organization_id: state.portalOrgId,
      p_password: state.portalPassword,
      p_room_resource_id: room.id,
      p_booking_date: f.date,
      p_slots: [{ start_time: f.startTime, end_time: endTime }],
      p_items: itemRequestPayload(centerUseItems, f.items),
      p_purpose: f.purpose.trim(),
      p_applicant_name: f.applicantName.trim(),
      p_phone: f.phone.trim(),
      p_applicant_note: f.notes.trim() || null,
    });
    if (error) throw error;
    return data;
  }

  async function submitLoanBooking() {
    const f = state.loanFlow;
    if (!f.startDate || !f.returnDate) return toast('請選擇借用及歸還日期', 'error');
    if (f.returnDate < f.startDate) return toast('歸還日期不可早於借用開始日期', 'error');
    const items = itemRequestPayload(loanItems, f.items);
    if (!items.length) return toast('請至少選擇一項外借物品', 'error');
    if(!bookingDateOpen(f.startDate)||!bookingDateOpen(f.returnDate)) return toast('所選借用日期尚未開放預約','error');
    if (!f.purpose.trim() || !f.applicantName.trim() || !f.phone.trim()) {
      return toast('請填寫用途、申請人姓名及聯絡電話', 'error');
    }
    try {
      let bookingNo;
      if (DEMO) bookingNo = createDemoLoanRequest(f, items);
      else bookingNo = await createSupabaseLoanRequest(f, items);
      state.confirmation = { type: 'loan', bookingNo };
      state.loanFlow = defaultLoanFlow();
      state.page = 'confirmation';
      state.currentTab = 'query';
      persistForms();
      await refreshFromSource(false);
      render();
      toast('外借物品申請已提交', 'success');
    } catch (error) {
      toast('未能提交申請：' + readableError(error), 'error');
    }
  }

  function createDemoLoanRequest(f, items) {
    const groupRef = makeBookingNo('B');
    const now = new Date().toISOString();
    const bookings = state._allBookings || (state._allBookings = []);
    items.forEach((item, index) => {
      bookings.unshift({
        id: localId('booking'),
        reference_no: `${groupRef}-${index + 1}`,
        resource_id: item.resource_id,
        booking_date: f.startDate,
        loan_end_date: f.returnDate,
        start_time: '09:00',
        end_time: '18:00',
        quantity: item.quantity,
        attendees: 1,
        purpose: f.purpose.trim(),
        applicant_name: f.applicantName.trim(),
        phone: f.phone.trim(),
        applicant_note: f.notes.trim() || null,
        related_booking_id: null,
        status: 'pending',
        created_at: now,
      });
    });
    saveDemoSource();
    return groupRef;
  }

  async function createSupabaseLoanRequest(f, items) {
    const client = await ensureSupabaseClient();
    const { data, error } = await client.rpc('submit_organization_loan_request', {
      p_organization_id: state.portalOrgId,
      p_password: state.portalPassword,
      p_start_date: f.startDate,
      p_return_date: f.returnDate,
      p_items: items,
      p_purpose: f.purpose.trim(),
      p_applicant_name: f.applicantName.trim(),
      p_phone: f.phone.trim(),
      p_applicant_note: f.notes.trim() || null,
    });
    if (error) throw error;
    return data;
  }

  function itemRequestPayload(source, bag) {
    return source
      .map(item => ({ resource_id: item.id, quantity: Number(bag[item.id] || 0) }))
      .filter(item => item.quantity > 0);
  }

  function localId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function renderNav() {
    if (!state.portalAuthenticated) return '';
    const active = state.currentTab;
    return `
      <nav class="navbar">
        <button class="nav-item ${active === 'home' ? 'active' : ''}" data-tab="home">${icons.home}<span>首頁</span></button>
        <button class="nav-item ${active === 'reserve' ? 'active' : ''}" data-tab="reserve">${icons.calendar}<span>預約</span></button>
        <button class="nav-item ${active === 'query' ? 'active' : ''}" data-tab="query">${icons.search}<span>查詢</span></button>
      </nav>
    `;
  }

  function pageToTab(page) {
    if (['reserveType', 'roomBooking', 'roomItems', 'roomConfirm', 'loanBooking', 'loanConfirm'].includes(page)) return 'reserve';
    if (page === 'query') return 'query';
    if (page === 'my' || page === 'confirmation') return 'my';
    return 'home';
  }

  function getRoomAvailabilityWindows(roomId, dateIso) {
    if (!roomId || !dateIso || isResourceBlocked(roomId, dateIso)) return [];
    const weekday = new Date(`${dateIso}T12:00:00`).getDay();
    return state.availability
      .filter(rule => rule.resource_id === roomId && rule.active !== false)
      .filter(rule => availabilityMatchesDate(rule, dateIso, weekday))
      .map(rule => ({ start: shortTime(rule.start_time), end: shortTime(rule.end_time) }))
      .filter(window => window.start && window.end && window.end > window.start)
      .sort((a,b)=>a.start.localeCompare(b.start));
  }

  function roomDurationMinutes(flow) {
    if (!flow) return 0;
    if (flow.duration === 'other') {
      const value = Number(flow.customMinutes || 0);
      if (!Number.isFinite(value) || value < 30 || value > 480) return 0;
      return Math.round(value / 30) * 30;
    }
    const value = Number(flow.duration || 0);
    return [30,60,120].includes(value) ? value : 0;
  }

  function durationLabel(minutes) {
    if (minutes === 30) return '半小時';
    if (minutes === 60) return '1 小時';
    if (minutes === 120) return '2 小時';
    if (minutes % 60 === 0) return `${minutes/60} 小時`;
    if (minutes > 60) return `${Math.floor(minutes/60)} 小時 ${minutes%60} 分鐘`;
    return `${minutes} 分鐘`;
  }

  function timeToMinutes(time) {
    const [h,m] = String(time||'00:00').split(':').map(Number);
    return h*60+m;
  }

  function minutesToTime(minutes) {
    const value = Math.max(0, Math.min(24*60, minutes));
    const h = Math.floor(value/60), m=value%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function addMinutesToTime(time, minutes) {
    return minutesToTime(timeToMinutes(time)+Number(minutes||0));
  }

  function busyPeriodsForRoom(roomId, dateIso) {
    return (state.busyPeriods || []).filter(p => p.resourceId === roomId && p.date === dateIso && (p.returnDate || p.date) === dateIso);
  }

  function timeRangesOverlap(startA,endA,startB,endB) {
    return startA < endB && endA > startB;
  }

  function getRoomStartTimes(roomId, dateIso, durationMinutes) {
    if (!durationMinutes || durationMinutes < 30) return [];
    const windows = getRoomAvailabilityWindows(roomId,dateIso);
    const busy = busyPeriodsForRoom(roomId,dateIso);
    const options = new Set();
    for (const window of windows) {
      const startMin = timeToMinutes(window.start);
      const endMin = timeToMinutes(window.end);
      for (let cursor=startMin; cursor+durationMinutes<=endMin; cursor+=30) {
        const start=minutesToTime(cursor), end=minutesToTime(cursor+durationMinutes);
        const clashes = busy.some(period => timeRangesOverlap(start,end,period.startTime,period.endTime));
        if (!clashes) options.add(start);
      }
    }
    return [...options].sort();
  }

  function isRoomDateAvailable(roomId, dateIso) {
    return bookingDateOpen(dateIso) && !isResourceBlocked(roomId,dateIso) && getRoomStartTimes(roomId,dateIso,30).length > 0;
  }

  function availabilityMatchesDate(rule, dateIso, weekday) {
    if (rule.specific_date) return String(rule.specific_date) === dateIso;
    if (rule.weekday === null || rule.weekday === undefined || Number(rule.weekday) !== Number(weekday)) return false;
    if (rule.date_from && dateIso < String(rule.date_from)) return false;
    if (rule.date_to && dateIso > String(rule.date_to)) return false;
    return true;
  }

  function isLoanStartDateAvailable(dateIso) {
    if(!bookingDateOpen(dateIso)) return false;
    const selected = itemRequestPayload(loanItems, state.loanFlow.items);
    if (!selected.length || dateIso < todayIso()) return false;
    const returnDate = addDays(dateIso, 3);
    return selected.every(req => {
      const item = loanItems.find(x => x.id === req.resource_id); if (!item) return false;
      if (dateRangeHasBlock(item.id, dateIso, returnDate)) return false;
      const rules = (state.availability || []).filter(rule => rule.resource_id === item.id && rule.active !== false);
      if (rules.length) {
        const weekday = new Date(`${dateIso}T12:00:00`).getDay();
        if (!rules.some(rule => availabilityMatchesDate(rule, dateIso, weekday))) return false;
      }
      const used = (state.publicBookings || []).filter(b => b.resourceId === item.id && b.date <= returnDate && (b.returnDate || b.date) >= dateIso).reduce((sum,b)=>sum+Number(b.quantity||1),0);
      return req.quantity <= Math.max(0, Number(item.stock_quantity || item.max || 1) - used);
    });
  }

  function isResourceBlocked(resourceId, dateIso) {
    return (state.resourceBlocks || []).some(block => block.resource_id === resourceId && String(block.block_date) === dateIso);
  }

  function dateRangeHasBlock(resourceId, startDate, endDate) {
    let d = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    let guard = 0;
    while (d <= end && guard < 370) {
      if (isResourceBlocked(resourceId, toIsoDate(d))) return true;
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return false;
  }

  function shortTime(value) {
    return String(value || '').slice(0, 5);
  }

  function selectedItemSummary(source, bag) {
    return source
      .map(item => ({ name: item.name, qty: bag[item.id] || 0 }))
      .filter(item => item.qty > 0);
  }

  function sumQuantities(bag) {
    return Object.values(bag || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function toast(message, type) {
    const div = document.createElement('div');
    div.className = `toast ${type || ''}`;
    div.textContent = message;
    toastRoot.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transform = 'translateY(-4px)';
    }, 2400);
    setTimeout(() => div.remove(), 3000);
  }

  function makeBookingNo(prefix) {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 900) + 100);
    return `${prefix}${yyyy}${mm}${dd}${random}`;
  }

  function todayIso() {
    return toIsoDate(new Date());
  }

  function toIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function monthFromOffset(offset) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
  }

  function addDays(iso, days) {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const date = new Date(`${iso}T12:00:00`);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}（${weekdays[date.getDay()]}）`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }
})();
