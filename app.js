(function () {
  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  const STORAGE_KEY = 'rrbs_demo_bookings_v2';
  const FORM_KEY = 'rrbs_demo_form_v2';

  const rooms = [
    { id: 'room-a12', name: '活動室 1-2', capacity: 20, description: '適合小組、講座及手工活動', location: '1/F' },
    { id: 'room-meeting', name: '會議室', capacity: 10, description: '適合會議、小組面談', location: '2/F' },
    { id: 'room-a3', name: '活動室 3', capacity: 30, description: '適合大型活動及訓練', location: '1/F' },
  ];

  const centerUseItems = [
    { id: 'projector', name: '投影機', description: '中心內同日使用', max: 2, icon: 'projector' },
    { id: 'mic', name: '手提咪', description: '中心內同日使用', max: 4, icon: 'mic' },
    { id: 'board', name: '白板', description: '中心內同日使用', max: 2, icon: 'board' },
    { id: 'tablet', name: '平板電腦', description: '中心內同日使用', max: 6, icon: 'tablet' },
  ];

  const loanItems = [
    { id: 'wheelchair', name: '輪椅', description: '外借物品', max: 3, icon: 'wheelchair' },
    { id: 'bp', name: '血壓計', description: '外借物品', max: 8, icon: 'bp' },
    { id: 'activity-kit', name: '活動器材', description: '外借物品', max: 6, icon: 'kit' },
    { id: 'speaker', name: '擴音器', description: '外借物品', max: 4, icon: 'speaker' },
  ];

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
  };

  init();

  function init() {
    hydrateStored();
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
    const start = addDays(todayIso(), 1);
    return {
      startDate: start,
      returnDate: addDays(start, 7),
      items: {},
      purpose: '',
      applicantName: '',
      phone: '',
      organization: '',
      notes: '',
    };
  }

  function hydrateStored() {
    try {
      const saved = JSON.parse(localStorage.getItem(FORM_KEY) || '{}');
      if (saved.roomFlow) state.roomFlow = { ...defaultRoomFlow(), ...saved.roomFlow };
      if (saved.loanFlow) state.loanFlow = { ...defaultLoanFlow(), ...saved.loanFlow };
    } catch (e) {}

    const existing = getBookings();
    if (!existing.length) {
      const seeds = [
        {
          bookingNo: 'R20260415001',
          type: 'room',
          title: '會議室',
          status: '待審批',
          date: '2026-04-15',
          detail: '09:00 - 11:00',
          purpose: '義工會議',
          createdAt: new Date().toISOString(),
          applicantName: '陳大文',
          phone: '91234567',
          roomName: '會議室',
          roomSlots: ['09:00 - 11:00'],
          centerItems: [],
        },
        {
          bookingNo: 'B20260412003',
          type: 'loan',
          title: '投影機',
          status: '已批准',
          date: '2026-04-12',
          detail: '借用至 2026-04-19',
          purpose: '活動分享',
          createdAt: new Date().toISOString(),
          applicantName: '李小美',
          phone: '92345678',
          loanItems: [{ name: '投影機', qty: 1 }],
          startDate: '2026-04-12',
          returnDate: '2026-04-19',
        },
        {
          bookingNo: 'B20260408002',
          type: 'loan',
          title: '輪椅',
          status: '已歸還',
          date: '2026-04-08',
          detail: '借用至 2026-04-15',
          purpose: '暫借家用',
          createdAt: new Date().toISOString(),
          applicantName: '王先生',
          phone: '93456789',
          loanItems: [{ name: '輪椅', qty: 1 }],
          startDate: '2026-04-08',
          returnDate: '2026-04-15',
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
    }
  }

  function persistForms() {
    localStorage.setItem(FORM_KEY, JSON.stringify({ roomFlow: state.roomFlow, loanFlow: state.loanFlow }));
  }

  function getBookings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBooking(booking) {
    const list = getBookings();
    list.unshift(booking);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
                <div class="room-photo"></div>
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
            <strong>物品只可即日在中心使用</strong>
            <span>請選擇所需物品及數量，不可攜出中心。</span>
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
    return `
      ${renderHeader('預約外借物品', '借用開始日期預設一星期', 'reserveType')}
      <section class="card step-card">
        ${renderStep(3, 1, ['選擇日期', '選擇物品', '確認資料'])}

        <div class="field-block">
          <div class="field-title"><span class="order">1</span>選擇借用開始日期</div>
          ${renderCalendar('loan')}
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">2</span>借用及歸還日期</div>
          <div class="notice-box warning">
            <div class="notice-icon">i</div>
            <div>
              <strong>預設借用期為一星期</strong>
              <span>系統會自動計算歸還日期，你亦可自行修改。</span>
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label class="field-label">借用開始日期</label>
              <input class="input" type="date" data-loan-start value="${state.loanFlow.startDate}" />
            </div>
            <div>
              <label class="field-label">歸還日期</label>
              <input class="input" type="date" data-loan-return value="${state.loanFlow.returnDate}" />
            </div>
          </div>
        </div>

        <div class="field-block">
          <div class="field-title"><span class="order">3</span>選擇外借物品及數量</div>
          <div class="item-grid two-col">
            ${loanItems.map(item => renderItemCard(item, state.loanFlow.items[item.id] || 0, 'loan-item')).join('')}
          </div>
          <div class="helper" style="margin-top:10px;">已選 ${selectedCount} 件外借物品</div>
        </div>

        <button class="btn btn-primary btn-block" data-nav-page="loanConfirm">下一步</button>
      </section>
    `;
  }

  function renderLoanConfirm() {
    const items = selectedItemSummary(loanItems, state.loanFlow.items);
    return `
      ${renderHeader('確認外借申請', '填寫借用資料', 'loanBooking')}
      <section class="card step-card">
        <div class="summary-card">
          <div class="summary-row"><span>借用開始</span><strong>${formatDate(state.loanFlow.startDate)}</strong></div>
          <div class="summary-row"><span>歸還日期</span><strong>${formatDate(state.loanFlow.returnDate)}</strong></div>
          <div class="summary-row"><span>外借物品</span><strong>${items.length ? items.map(x => `${x.name} × ${x.qty}`).join('、') : '-'}</strong></div>
        </div>
        <div class="field-block" style="margin-top:16px;">
          <label class="field-label">用途 *</label>
          <textarea class="textarea" data-field="loan-purpose" placeholder="例如：探訪、健康監察、社區活動">${escapeHtml(state.loanFlow.purpose)}</textarea>
        </div>
        <div class="form-grid">
          <div>
            <label class="field-label">申請人姓名 *</label>
            <input class="input" data-field="loan-name" value="${escapeAttr(state.loanFlow.applicantName)}" placeholder="請輸入姓名" />
          </div>
          <div>
            <label class="field-label">聯絡電話 *</label>
            <input class="input" data-field="loan-phone" value="${escapeAttr(state.loanFlow.phone)}" placeholder="請輸入電話" />
          </div>
          <div>
            <label class="field-label">所屬單位</label>
            <input class="input" data-field="loan-organization" value="${escapeAttr(state.loanFlow.organization)}" placeholder="例如：中心／機構名稱" />
          </div>
          <div>
            <label class="field-label">備註</label>
            <textarea class="textarea" data-field="loan-notes" placeholder="例如：需要提早領取時間">${escapeHtml(state.loanFlow.notes)}</textarea>
          </div>
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
    const bookings = getBookings().filter(item => ['已批准', '已歸還', 'approved', 'completed'].includes(item.status));
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
    const bookings = getBookings();
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
    const disabled = iso < todayIso();
    const isToday = iso === todayIso();
    const cls = ['day-cell', disabled ? 'disabled' : 'available', selected === iso ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" ${disabled ? 'disabled' : `data-select-date="${kind}:${iso}"`}>${date.getDate()}</button>`;
  }

  function renderItemCard(item, qty, prefix) {
    const selected = qty > 0;
    return `
      <div class="item-card ${selected ? 'selected' : ''}">
        <div class="item-check"></div>
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
          <div class="item-visual">${icons[item.icon]}</div>
          <div class="item-content">
            <h3>${item.name}</h3>
            <p>${item.description}</p>
          </div>
        </div>
        <div class="quantity">
          <button class="qty-btn" data-item-qty="${prefix}:${item.id}:-1">－</button>
          <div class="qty-value">${qty}</div>
          <button class="qty-btn" data-item-qty="${prefix}:${item.id}:1">＋</button>
        </div>
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
          if (!state.loanFlow.returnDate || state.loanFlow.returnDate <= iso) {
            state.loanFlow.returnDate = addDays(iso, 7);
          }
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
        state.loanFlow.returnDate = addDays(state.loanFlow.startDate, 7);
      }
      render();
    });

    const loanReturn = document.querySelector('[data-loan-return]');
    if (loanReturn) loanReturn.addEventListener('input', () => {
      state.loanFlow.returnDate = loanReturn.value;
      persistForms();
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
      'loan-organization': ['loanFlow', 'organization'],
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

  function submitRoomBooking() {
    const f = state.roomFlow;
    if (!f.purpose.trim() || !f.applicantName.trim() || !f.phone.trim()) {
      return toast('請填寫用途、申請人姓名及聯絡電話', 'error');
    }
    const room = rooms.find(r => r.id === f.roomId);
    const bookingNo = makeBookingNo('R');
    const booking = {
      bookingNo,
      type: 'room',
      title: room ? room.name : '房間',
      roomName: room ? room.name : '',
      status: '待審批',
      date: f.date,
      detail: f.slots.join('、'),
      purpose: f.purpose.trim(),
      applicantName: f.applicantName.trim(),
      phone: f.phone.trim(),
      organization: f.organization.trim(),
      notes: f.notes.trim(),
      roomSlots: [...f.slots],
      centerItems: selectedItemSummary(centerUseItems, f.items),
      createdAt: new Date().toISOString(),
    };
    saveBooking(booking);
    state.confirmation = { type: 'room', bookingNo };
    state.roomFlow = defaultRoomFlow();
    state.page = 'confirmation';
    state.currentTab = 'query';
    persistForms();
    render();
    toast('房間預約已提交', 'success');
  }

  function submitLoanBooking() {
    const f = state.loanFlow;
    if (!f.startDate || !f.returnDate) return toast('請選擇借用及歸還日期', 'error');
    if (f.returnDate < f.startDate) return toast('歸還日期不可早於借用開始日期', 'error');
    const items = selectedItemSummary(loanItems, f.items);
    if (!items.length) return toast('請至少選擇一項外借物品', 'error');
    if (!f.purpose.trim() || !f.applicantName.trim() || !f.phone.trim()) {
      return toast('請填寫用途、申請人姓名及聯絡電話', 'error');
    }
    const bookingNo = makeBookingNo('B');
    const booking = {
      bookingNo,
      type: 'loan',
      title: items.map(x => x.name).join('、'),
      status: '待審批',
      date: f.startDate,
      detail: `借用至 ${f.returnDate}`,
      purpose: f.purpose.trim(),
      applicantName: f.applicantName.trim(),
      phone: f.phone.trim(),
      organization: f.organization.trim(),
      notes: f.notes.trim(),
      loanItems: items,
      startDate: f.startDate,
      returnDate: f.returnDate,
      createdAt: new Date().toISOString(),
    };
    saveBooking(booking);
    state.confirmation = { type: 'loan', bookingNo };
    state.loanFlow = defaultLoanFlow();
    state.page = 'confirmation';
    state.currentTab = 'query';
    persistForms();
    render();
    toast('外借物品申請已提交', 'success');
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
    const weekday = new Date(`${dateIso}T12:00:00`).getDay();
    const base = roomId === 'room-meeting'
      ? ['09:30 - 11:00', '11:00 - 12:30', '14:00 - 15:30', '15:30 - 17:00']
      : roomId === 'room-a3'
        ? ['09:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00']
        : ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00'];
    if (weekday === 0) return ['14:00 - 16:00'];
    if (weekday === 6) return base.filter((_, idx) => idx < 3);
    return base;
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
