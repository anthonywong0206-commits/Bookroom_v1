(function () {
  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  const cfg = window.APP_CONFIG || {};
  const DEMO = cfg.demoMode !== false;
  const ADMIN_DEMO_KEY = 'rrbs_admin_demo_v4';
  const FORM_KEY = 'rrbs_demo_form_v2';
  const SYNC_CHANNEL = 'rrbs-resource-sync';

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
    roomFlow: defaultRoomFlow(),
    loanFlow: defaultLoanFlow(),
    confirmation: null,
    organizations: [],
    availability: [],
    publicBookings: [],
    purposeOptions: [],
    loadingData: true,
    sourceError: '',
  };

  init();

  async function init() {
    hydrateStored();
    setupSyncListeners();
    await refreshFromSource(false);
    render();
  }

  function defaultRoomFlow() {
    return {
      roomId: '',
      date: '',
      slots: [],
      needsItems: null,
      items: {},
      purpose: '',
      applicantName: '',
      phone: '',
      organization: '',
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
        { id: 'org-demo-1', name: '社區綜合服務中心', active: true, created_at: new Date().toISOString() },
        { id: 'org-demo-2', name: '樂齡活動中心', active: true, created_at: new Date().toISOString() },
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
    state.organizations = Array.isArray(data.organizations) ? data.organizations : [];
    state._allResources = Array.isArray(data.resources) ? data.resources : [];
    state.availability = Array.isArray(data.availability) ? data.availability : [];
    state._allBookings = Array.isArray(data.bookings) ? data.bookings : [];
    state.purposeOptions = Array.isArray(data.purposeOptions) ? data.purposeOptions : demoSeed().purposeOptions;
    state.publicBookings = buildDemoPublicBookings(state._allBookings);
  }

  function saveDemoSource() {
    let latest = null;
    try { latest = JSON.parse(localStorage.getItem(ADMIN_DEMO_KEY) || 'null'); } catch (_) {}
    const current = {
      organizations: latest?.organizations || state.organizations,
      resources: latest?.resources || state._allResources || [],
      availability: latest?.availability || state.availability,
      bookings: state._allBookings || latest?.bookings || [],
      purposeOptions: latest?.purposeOptions || state.purposeOptions || demoSeed().purposeOptions,
    };
    state.organizations = current.organizations;
    state._allResources = current.resources;
    state.availability = current.availability;
    state.purposeOptions = current.purposeOptions;
    localStorage.setItem(ADMIN_DEMO_KEY, JSON.stringify(current));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purpose_options' }, () => refreshFromSource(true))
      .subscribe();
  }

  async function loadSupabaseSource() {
    const client = await ensureSupabaseClient();
    const [orgs, resourcesResult, availabilityResult, publicResult, purposeResult] = await Promise.all([
      client.from('organizations').select('*').eq('active', true).order('name'),
      client.from('resources').select('*').eq('active', true).order('type').order('name'),
      client.from('resource_availability').select('*').eq('active', true).order('resource_id'),
      client.rpc('get_public_resource_bookings'),
      client.from('purpose_options').select('*').eq('active', true).order('sort_order').order('label'),
    ]);
    for (const result of [orgs, resourcesResult, availabilityResult, publicResult, purposeResult]) {
      if (result.error) throw result.error;
    }
    state.organizations = orgs.data || [];
    state._allResources = resourcesResult.data || [];
    state.availability = availabilityResult.data || [];
    state.purposeOptions = purposeResult.data || [];
    state.publicBookings = (publicResult.data || []).map(row => ({
      resourceId: row.resource_id,
      title: row.resource_name,
      type: row.resource_type === 'item' ? 'loan' : 'room',
      date: row.booking_date,
      returnDate: row.loan_end_date || row.booking_date,
      status: row.status || 'approved',
      quantity: Number(row.quantity || 1),
    }));
  }

  function rebuildCatalog() {
    const activeOrgIds = new Set(state.organizations.filter(org => org.active !== false).map(org => org.id));
    const resources = (state._allResources || []).filter(resource => resource.active !== false && activeOrgIds.has(resource.organization_id));
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
      state.roomFlow.slots = [];
      state.roomFlow.items = {};
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

  function readableError(error) {
    const message = error?.message || error?.details || String(error || '資料同步失敗');
    if (/get_public_resource_bookings/i.test(message)) return 'Supabase 尚未套用前後台同步 SQL';
    if (/permission denied|row-level security/i.test(message)) return 'Supabase 讀取權限尚未套用同步 SQL';
    return message;
  }

  function render() {
    app.innerHTML = `
      <div class="app-shell">
        ${renderScreen()}
      </div>
      ${renderNav()}
    `;
    bindCommonEvents();
    persistForms();
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
        ${backTo ? `<button class="header-action" data-back="${backTo}">${icons.back}</button>` : `<div class="header-actions-wrap"><a class="desktop-admin-link" href="admin.html">管理員登入</a><button class="header-action">${icons.bell}</button></div>`}
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
    const slots = selectedRoom && f.date ? getRoomSlots(selectedRoom.id, f.date) : [];
    return `
      ${renderHeader('預約房間', '按步驟完成申請', 'reserveType')}
      <section class="card step-card">
        ${renderStep(4, 1, ['選擇房間', '選擇日期', '選擇時段', '同日物品'])}

        <div class="field-block">
          <div class="field-title"><span class="order">1</span>選擇房間</div>
          <div class="room-grid">
            ${rooms.map(room => `
              <button class="room-card ${f.roomId === room.id ? 'selected' : ''}" data-room-id="${room.id}">
                <div class="room-photo ${room.image_url ? 'has-image' : ''}">${room.image_url ? `<img src="${escapeAttr(room.image_url)}" alt="${escapeAttr(room.name)}">` : '<span class="resource-image-placeholder">房間圖片</span>'}</div>
                <div class="room-meta">
                  <h3>${room.name}</h3>
                  <p>可容納 ${room.capacity} 人・${room.description}</p>
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
          <div class="field-title"><span class="order">3</span>選擇借用時段</div>
          <div class="helper">可選多個時段</div>
          <div class="slot-wrap" style="margin-top:12px;">
            ${slots.length ? slots.map(slot => `
              <button class="slot-pill ${f.slots.includes(slot) ? 'selected' : ''}" data-room-slot="${slot}">${slot}</button>
            `).join('') : '<div class="helper">請先選擇房間及日期</div>'}
          </div>
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">4</span>需要同日借用物品嗎？</div>
          <div class="helper">物品只可即日在中心使用</div>
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
        ${renderStep(4, 4, ['選擇房間', '選擇日期', '選擇時段', '同日物品'])}
        <div class="notice-box">
          <div class="notice-icon">i</div>
          <div>
            <strong>房間預約可一併選擇物品</strong>
            <span>已勾選「只可配合房間」的物品只可在此流程預約；其他物品亦可另外單獨外借。</span>
          </div>
        </div>
        <div class="item-grid">
          ${centerUseItems.map(item => renderItemCard(item, state.roomFlow.items[item.id] || 0, 'room-item')).join('')}
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
    return `
      ${renderHeader('確認房間預約', '填寫申請資料', state.roomFlow.needsItems ? 'roomItems' : 'roomBooking')}
      <section class="card step-card">
        <div class="summary-card">
          <div class="summary-row"><span>房間</span><strong>${room ? room.name : '-'}</strong></div>
          <div class="summary-row"><span>日期</span><strong>${formatDate(state.roomFlow.date)}</strong></div>
          <div class="summary-row"><span>時段</span><strong>${state.roomFlow.slots.join('、') || '-'}</strong></div>
          <div class="summary-row"><span>同日物品</span><strong>${items.length ? items.map(x => `${x.name} × ${x.qty}`).join('、') : '不需要'}</strong></div>
        </div>
        <div class="field-block" style="margin-top:16px;">
          <label class="field-label">用途 *</label>
          <textarea class="textarea" data-field="room-purpose" placeholder="例如：小組活動、會議、講座">${escapeHtml(state.roomFlow.purpose)}</textarea>
        </div>
        <div class="form-grid">
          <div>
            <label class="field-label">申請人姓名 *</label>
            <input class="input" data-field="room-name" value="${escapeAttr(state.roomFlow.applicantName)}" placeholder="請輸入姓名" />
          </div>
          <div>
            <label class="field-label">聯絡電話 *</label>
            <input class="input" data-field="room-phone" value="${escapeAttr(state.roomFlow.phone)}" placeholder="請輸入電話" />
          </div>
          <div>
            <label class="field-label">所屬單位</label>
            <input class="input" data-field="room-organization" value="${escapeAttr(state.roomFlow.organization)}" placeholder="例如：中心／機構名稱" />
          </div>
          <div>
            <label class="field-label">備註</label>
            <textarea class="textarea" data-field="room-notes" placeholder="如有特別安排可在此註明">${escapeHtml(state.roomFlow.notes)}</textarea>
          </div>
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
    return `
      ${renderHeader('預約外借物品', '先選擇物品，再選擇可預約日期', 'reserveType')}
      <section class="card step-card">
        ${renderStep(3, hasItems ? 2 : 1, ['選擇物品', '選擇日期', '確認資料'])}

        <div class="field-block">
          <div class="field-title"><span class="order">1</span>選擇外借物品及數量</div>
          <div class="item-grid two-col">
            ${loanItems.length ? loanItems.map(item => renderItemCard(item, state.loanFlow.items[item.id] || 0, 'loan-item')).join('') : '<div class="helper">目前沒有可單獨外借的物品</div>'}
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
    const q = state.query.trim().toLowerCase();
    const bookings = state.publicBookings || [];
    const filtered = !q ? bookings : bookings.filter(item =>
      [item.title, item.roomName, ...(item.loanItems || []).map(x => x.name)].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
    return `
      ${renderHeader('查詢借用情況', '查看已借出的房間及物品', 'home')}
      <section class="card query-card">
        <div class="search-row">
          <input class="input" data-query-input value="${escapeAttr(state.query)}" placeholder="輸入房間／物品名稱" />
          <button class="btn btn-primary" data-search>搜尋</button>
        </div>
      </section>
      <div class="section-title"><h2>借用情況</h2><small>${filtered.length} 項</small></div>
      <div class="stack">
        ${filtered.length ? filtered.map(renderPublicBookingCard).join('') : '<div class="card empty-state">目前沒有相關借用記錄</div>'}
      </div>
    `;
  }

  function renderPublicBookingCard(booking) {
    const isLoan = booking.type === 'loan';
    const resourceTitle = booking.title || booking.roomName || '資源';
    const dateText = isLoan && booking.returnDate && booking.returnDate !== booking.date
      ? `${formatDate(booking.date)} 至 ${formatDate(booking.returnDate)}`
      : formatDate(booking.date);
    return `
      <div class="card list-card public-loan-card">
        <div class="public-resource-type">${isLoan ? '外借物品' : '房間'}</div>
        <div class="public-resource-name">${escapeHtml(resourceTitle)}</div>
        <div class="public-resource-date"><span>借用日期</span><strong>${dateText}</strong></div>
      </div>
    `;
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
      <div class="stepper ${total === 3 ? 'three' : ''}">
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

  function renderItemCard(item, qty, prefix) {
    const selected = qty > 0;
    const modeText = item.requires_room ? '只可配合房間預約' : '可房間附加／可單獨外借';
    const visual = item.image_url ? `<div class="item-visual has-image"><img src="${escapeAttr(item.image_url)}" alt="${escapeAttr(item.name)}"></div>` : `<div class="item-visual">${icons[item.icon]}</div>`;
    return `
      <div class="item-card ${selected ? 'selected' : ''}">
        <div class="item-check"></div>
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
          ${visual}
          <div class="item-content"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || '')}</p><span class="item-mode-note">${modeText}</span></div>
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
        state.roomFlow.slots = [];
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
          state.roomFlow.slots = [];
        } else {
          state.loanFlow.startDate = iso;
          state.loanFlow.returnDate = addDays(iso, 3);
        }
        render();
      });
    });

    document.querySelectorAll('[data-room-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.roomSlot;
        const idx = state.roomFlow.slots.indexOf(slot);
        if (idx >= 0) state.roomFlow.slots.splice(idx, 1);
        else state.roomFlow.slots.push(slot);
        render();
      });
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
      'room-purpose': ['roomFlow', 'purpose'],
      'room-name': ['roomFlow', 'applicantName'],
      'room-phone': ['roomFlow', 'phone'],
      'room-organization': ['roomFlow', 'organization'],
      'room-notes': ['roomFlow', 'notes'],
      'loan-purpose': ['loanFlow', 'purpose'],
      'loan-name': ['loanFlow', 'applicantName'],
      'loan-phone': ['loanFlow', 'phone'],
      'loan-notes': ['loanFlow', 'notes'],
    };
    const [obj, prop] = mapping[key];
    state[obj][prop] = value;
    persistForms();
  }

  function goRoomNext() {
    if (!state.roomFlow.roomId) return toast('請先選擇房間', 'error');
    if (!state.roomFlow.date) return toast('請先選擇日期', 'error');
    if (!state.roomFlow.slots.length) return toast('請先選擇至少一個時段', 'error');
    if (state.roomFlow.needsItems === null) return toast('請選擇是否需要同日借用物品', 'error');
    state.page = state.roomFlow.needsItems ? 'roomItems' : 'roomConfirm';
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
    const createdRoomIds = [];
    const bookings = state._allBookings || (state._allBookings = []);
    f.slots.forEach((slot, index) => {
      const times = parseSlot(slot);
      const id = localId('booking');
      createdRoomIds.push(id);
      bookings.unshift({
        id,
        reference_no: `${groupRef}-${index + 1}`,
        resource_id: room.id,
        booking_date: f.date,
        start_time: times.start,
        end_time: times.end,
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
    });
    const selectedItems = itemRequestPayload(centerUseItems, f.items);
    if (selectedItems.length) {
      const times = overallSlotRange(f.slots);
      selectedItems.forEach((item, index) => {
        bookings.unshift({
          id: localId('booking'),
          reference_no: `${groupRef}-I${index + 1}`,
          resource_id: item.resource_id,
          booking_date: f.date,
          start_time: times.start,
          end_time: times.end,
          quantity: item.quantity,
          attendees: 1,
          purpose: f.purpose.trim(),
          applicant_name: f.applicantName.trim(),
          phone: f.phone.trim(),
          related_booking_id: createdRoomIds[0] || null,
          loan_end_date: null,
          status: 'pending',
          created_at: now,
        });
      });
    }
    saveDemoSource();
    return groupRef;
  }

  async function createSupabaseRoomRequest(room, f) {
    const client = await ensureSupabaseClient();
    const { data, error } = await client.rpc('submit_public_room_request', {
      p_room_resource_id: room.id,
      p_booking_date: f.date,
      p_slots: f.slots.map(slot => {
        const parsed = parseSlot(slot);
        return { start_time: parsed.start, end_time: parsed.end };
      }),
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
    const { data, error } = await client.rpc('submit_public_loan_request', {
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

  function parseSlot(slot) {
    const parts = String(slot).split('-').map(part => part.trim());
    return { start: parts[0] || '09:00', end: parts[1] || '10:00' };
  }

  function overallSlotRange(slots) {
    const parsed = slots.map(parseSlot);
    const starts = parsed.map(item => item.start).sort();
    const ends = parsed.map(item => item.end).sort();
    return { start: starts[0] || '09:00', end: ends[ends.length - 1] || '10:00' };
  }

  function localId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function renderNav() {
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

  function getRoomSlots(roomId, dateIso) {
    if (!roomId || !dateIso) return [];
    const weekday = new Date(`${dateIso}T12:00:00`).getDay();
    return state.availability
      .filter(rule => rule.resource_id === roomId && rule.active !== false)
      .filter(rule => availabilityMatchesDate(rule, dateIso, weekday))
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
      .map(rule => `${shortTime(rule.start_time)} - ${shortTime(rule.end_time)}`);
  }

  function isRoomDateAvailable(roomId, dateIso) {
    return getRoomSlots(roomId, dateIso).length > 0;
  }

  function availabilityMatchesDate(rule, dateIso, weekday) {
    if (rule.specific_date) return String(rule.specific_date) === dateIso;
    if (rule.weekday === null || rule.weekday === undefined || Number(rule.weekday) !== Number(weekday)) return false;
    if (rule.date_from && dateIso < String(rule.date_from)) return false;
    if (rule.date_to && dateIso > String(rule.date_to)) return false;
    return true;
  }

  function isLoanStartDateAvailable(dateIso) {
    const selected = itemRequestPayload(loanItems, state.loanFlow.items);
    if (!selected.length || dateIso < todayIso()) return false;
    const returnDate = addDays(dateIso, 3);
    return selected.every(req => {
      const item = loanItems.find(x => x.id === req.resource_id); if (!item) return false;
      const rules = (state.availability || []).filter(rule => rule.resource_id === item.id && rule.active !== false);
      if (rules.length) {
        const weekday = new Date(`${dateIso}T12:00:00`).getDay();
        if (!rules.some(rule => availabilityMatchesDate(rule, dateIso, weekday))) return false;
      }
      const used = (state.publicBookings || []).filter(b => b.resourceId === item.id && b.date <= returnDate && (b.returnDate || b.date) >= dateIso).reduce((sum,b)=>sum+Number(b.quantity||1),0);
      return req.quantity <= Math.max(0, Number(item.stock_quantity || item.max || 1) - used);
    });
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
