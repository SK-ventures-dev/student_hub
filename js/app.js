// ═══════════════════════════════════════════════════
// app.js — Modified for Supabase integration
// CHANGE: App.boot() is new — handles setup wizard vs direct launch
// Everything else identical to original app.js
// ═══════════════════════════════════════════════════

// ====== AUTH ======
const Auth = {
  login() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const stored = DB.get('adminCredentials', { user: 'admin', pass: 'admin123' });
    if (user === stored.user && pass === stored.pass) {
      DB.set('session', { loggedIn: true, time: Date.now() });
      document.getElementById('loginScreen').classList.add('d-none');
      document.getElementById('mainApp').classList.remove('d-none');
      App.init();
    } else {
      showToast('Invalid credentials. Try admin / admin123', 'error');
    }
  },
  logout() {
    DB.remove('session');
    document.getElementById('mainApp').classList.add('d-none');
    document.getElementById('loginScreen').classList.remove('d-none');
  },
  check() {
    const s = DB.get('session');
    if (s && s.loggedIn) {
      document.getElementById('loginScreen').classList.add('d-none');
      document.getElementById('mainApp').classList.remove('d-none');
      return true;
    }
    return false;
  }
};

// ====== COMPLAINTS ======
const Complaints = {
  _filter: 'all',
  _modal: null,

  init() { this._modal = new bootstrap.Modal(document.getElementById('complaintModal')); },
  getComplaints() { return DB.get('complaints', []); },
  saveComplaints(c) { DB.set('complaints', c); },

  render() {
    let items = this.getComplaints();
    if (this._filter === 'pending') items = items.filter(c => c.status === 'pending');
    if (this._filter === 'resolved') items = items.filter(c => c.status === 'resolved');
    items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const el = document.getElementById('complaintsList');
    if (!items.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-tools"></i><p>No service requests yet</p></div>`; return; }
    const catIcons = { Plumbing: 'bi-droplet-fill', Electrical: 'bi-lightning-fill', Cleaning: 'bi-brush-fill', Furniture: 'bi-aspect-ratio-fill', Internet: 'bi-wifi', Other: 'bi-three-dots' };
    el.innerHTML = `<div class="hos-card p-0"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Student / Room</th><th>Category</th><th>Description</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${items.map(c => `<tr><td><div class="fw-600">${c.studentName}</div><div style="font-size:12px;color:var(--text-muted)">Room ${c.roomNumber}</div></td><td><span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;"><i class="bi ${catIcons[c.category]||'bi-tools'}"></i>${c.category}</span></td><td style="max-width:200px;font-size:13px;">${c.description}</td><td><span class="status-badge ${c.status}">${c.status}</span></td><td style="font-size:13px;">${formatDate(c.createdAt)}</td><td><div class="d-flex gap-1">${c.status === 'pending' ? `<button class="btn-icon" onclick="Complaints.resolve('${c.id}')" title="Mark Resolved" style="color:var(--success)"><i class="bi bi-check-lg"></i></button>` : ''}<button class="btn-icon danger" onclick="Complaints.delete('${c.id}')" title="Delete"><i class="bi bi-trash-fill"></i></button></div></td></tr>`).join('')}</tbody></table></div></div>`;
  },

  setFilter(f, btn) { this._filter = f; document.querySelectorAll('#page-complaints .pill').forEach(p => p.classList.remove('active')); btn.classList.add('active'); this.render(); },

  openModal() {
    const sel = document.getElementById('complaintStudent');
    const students = Students.getActive();
    sel.innerHTML = students.length ? students.map(s => { const r = Rooms.getById(s.roomId); return `<option value="${s.id}" data-room="${r?r.number:''}">${s.name} — Room ${r?r.number:'?'}</option>`; }).join('') : '<option value="">No active students</option>';
    document.getElementById('complaintDesc').value = '';
    document.getElementById('complaintCategory').value = 'Plumbing';
    this._modal.show();
  },

  save() {
    const sel = document.getElementById('complaintStudent');
    const studentId = sel.value;
    const opt = sel.options[sel.selectedIndex];
    const category = document.getElementById('complaintCategory').value;
    const description = document.getElementById('complaintDesc').value.trim();
    if (!studentId) { showToast('Please select a student', 'error'); return; }
    if (!description) { showToast('Please describe the issue', 'error'); return; }
    const student = Students.getById(studentId);
    const room = student ? Rooms.getById(student.roomId) : null;
    const complaint = { id: genId(), studentId, studentName: student?.name||'', roomNumber: room?.number||opt?.dataset.room||'', category, description, status: 'pending', createdAt: new Date().toISOString() };
    const complaints = this.getComplaints();
    complaints.push(complaint);
    this.saveComplaints(complaints);
    showToast('Service request submitted', 'success');
    Dashboard.addActivity(`${category} request from ${student?.name}`, 'complaint');
    this._modal.hide();
    this.render();
  },

  resolve(id) {
    const complaints = this.getComplaints();
    const idx = complaints.findIndex(c => c.id === id);
    if (idx === -1) return;
    complaints[idx].status = 'resolved';
    complaints[idx].resolvedAt = new Date().toISOString();
    this.saveComplaints(complaints);
    showToast('Request marked as resolved', 'success');
    Dashboard.addActivity(`${complaints[idx].category} request resolved`, 'complaint');
    this.render();
  },

  delete(id) {
    if (!confirm('Delete this service request?')) return;
    this.saveComplaints(this.getComplaints().filter(c => c.id !== id));
    showToast('Request deleted', 'success');
    this.render();
  }
};

// ====== NAVIGATION ======
function navigate(page) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const titles = { dashboard: 'Dashboard', rooms: 'Room Management', students: 'Students', electricity: 'Electricity Meter', payments: 'Billing & Payments', roomBilling: 'Room-wise Billing', complaints: 'Service Requests', reports: 'Reports' };
  document.getElementById('pageHeading').textContent = titles[page] || page;
  switch(page) {
    case 'dashboard': Dashboard.render(); break;
    case 'rooms': Rooms.render(); break;
    case 'students': Students.render(); break;
    case 'electricity': Electricity.render(); break;
    case 'payments': Payments.render(); break;
    case 'roomBilling': RoomBilling.render(); break;
    case 'complaints': Complaints.render(); break;
  }
  if (window.innerWidth < 992) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }
  return false;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeIcon').className = isDark ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
  DB.set('darkMode', !isDark);
}

function checkRentReminder() {
  const day = new Date().getDate();
  if (day >= 1 && day <= 5) {
    const lastShown = DB.get('reminderShown');
    const thisMonth = currentMonth();
    if (lastShown !== thisMonth) {
      const pending = DB.get('payments', []).filter(p => (p.status === 'pending' || p.status === 'partial') && p.month === thisMonth);
      if (pending.length > 0) {
        document.getElementById('reminderText').textContent = `${pending.length} student${pending.length>1?'s have':' has'} pending or partial rent for this month.`;
        const modal = new bootstrap.Modal(document.getElementById('reminderModal'));
        setTimeout(() => modal.show(), 1500);
        DB.set('reminderShown', thisMonth);
      }
    }
  }
}

// ====== SEED DEMO DATA ======
function seedDemoData() {
  if (DB.get('seeded_v2')) return;
  const rooms = [
    { id: genId(), number: '101', type: 'Single', rent: 4500, status: 'vacant', studentId: null, studentName: null },
    { id: genId(), number: '102', type: 'Double', rent: 6000, status: 'vacant', studentId: null, studentName: null },
    { id: genId(), number: '201', type: 'Triple', rent: 7500, status: 'vacant', studentId: null, studentName: null },
    { id: genId(), number: '202', type: 'Single', rent: 4500, status: 'vacant', studentId: null, studentName: null },
    { id: genId(), number: '301', type: 'Double', rent: 6500, status: 'vacant', studentId: null, studentName: null },
    { id: genId(), number: '401', type: 'Single', rent: 5000, status: 'vacant', studentId: null, studentName: null },
  ];
  DB.set('rooms', rooms);
  const s1id = genId(), s2id = genId(), s3id = genId(), s4id = genId();
  const students = [
    { id: s1id, name: 'Arjun Sharma', phone: '9876543210', emergency: '9876500000', address: 'Mumbai, Maharashtra', aadhaar: '1234 5678 9012', idType: 'Aadhaar', notes: '', roomId: rooms[0].id, checkin: '2025-01-15', checkout: '', deposit: 5000, photo: null, idProof: null, checkedOut: false },
    { id: s2id, name: 'Priya Patel', phone: '9123456780', emergency: '9123400000', address: 'Ahmedabad, Gujarat', aadhaar: '9876 5432 1098', idType: 'Aadhaar', notes: 'Vegetarian meals', roomId: rooms[1].id, checkin: '2025-02-01', checkout: '', deposit: 6000, photo: null, idProof: null, checkedOut: false },
    { id: s3id, name: 'Ravi Kumar', phone: '8765432190', emergency: '8765400000', address: 'Bengaluru, Karnataka', aadhaar: '5555 6666 7777', idType: 'PAN', notes: '', roomId: rooms[2].id, checkin: '2025-03-10', checkout: '', deposit: 7500, photo: null, idProof: null, checkedOut: false },
    { id: s4id, name: 'Sneha Reddy', phone: '7654321098', emergency: '7654300000', address: 'Hyderabad, Telangana', aadhaar: '1111 2222 3333', idType: 'Aadhaar', notes: '', roomId: rooms[1].id, checkin: '2025-02-15', checkout: '', deposit: 3000, photo: null, idProof: null, checkedOut: false },
  ];
  DB.set('students', students);
  rooms[0].status = 'occupied'; rooms[0].studentId = s1id; rooms[0].studentName = 'Arjun Sharma';
  rooms[1].status = 'occupied'; rooms[1].studentId = s2id; rooms[1].studentName = 'Priya Patel, Sneha Reddy';
  rooms[2].status = 'occupied'; rooms[2].studentId = s3id; rooms[2].studentName = 'Ravi Kumar';
  DB.set('rooms', rooms);
  const month = currentMonth();
  const prevMonth = (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
  DB.set('elecReadings', [
    { id: genId(), roomId: rooms[0].id, month: prevMonth, reading: 1100, notes: '', recordedAt: new Date().toISOString() },
    { id: genId(), roomId: rooms[0].id, month: month, reading: 1145, notes: '', recordedAt: new Date().toISOString() },
    { id: genId(), roomId: rooms[1].id, month: prevMonth, reading: 2200, notes: '', recordedAt: new Date().toISOString() },
    { id: genId(), roomId: rooms[1].id, month: month, reading: 2265, notes: '', recordedAt: new Date().toISOString() },
    { id: genId(), roomId: rooms[2].id, month: prevMonth, reading: 500, notes: '', recordedAt: new Date().toISOString() },
    { id: genId(), roomId: rooms[2].id, month: month, reading: 540, notes: '', recordedAt: new Date().toISOString() },
  ]);
  DB.set('payments', [
    { id: genId(), studentId: s1id, month, studentName: 'Arjun Sharma', roomId: rooms[0].id, roomNumber: '101', prevMeter: 1100, currMeter: 1145, units: 45, elecCharge: 450, rent: 4500, total: 4950, amountPaid: 4950, status: 'paid', notes: 'Paid via UPI', paymentHistory: [{ amount: 4950, date: new Date().toISOString().slice(0,10), note: 'Full payment UPI', type: 'full' }], createdAt: new Date().toISOString(), paidAt: new Date().toISOString() },
    { id: genId(), studentId: s2id, month, studentName: 'Priya Patel', roomId: rooms[1].id, roomNumber: '102', prevMeter: 2200, currMeter: 2265, units: 65, elecCharge: 650, rent: 6000, total: 6650, amountPaid: 3000, status: 'partial', notes: 'Partial payment cash', paymentHistory: [{ amount: 3000, date: new Date().toISOString().slice(0,10), note: 'Partial cash', type: 'partial' }], createdAt: new Date().toISOString(), paidAt: null },
    { id: genId(), studentId: s3id, month, studentName: 'Ravi Kumar', roomId: rooms[2].id, roomNumber: '201', prevMeter: 500, currMeter: 540, units: 40, elecCharge: 400, rent: 7500, total: 7900, amountPaid: 0, status: 'pending', notes: '', paymentHistory: [], createdAt: new Date().toISOString(), paidAt: null },
  ]);
  DB.set('complaints', [
    { id: genId(), studentId: s2id, studentName: 'Priya Patel', roomNumber: '102', category: 'Plumbing', description: 'Tap leaking in bathroom', status: 'pending', createdAt: new Date().toISOString() },
    { id: genId(), studentId: s1id, studentName: 'Arjun Sharma', roomNumber: '101', category: 'Electrical', description: 'Fan running slow', status: 'resolved', createdAt: new Date(Date.now()-86400000*2).toISOString(), resolvedAt: new Date().toISOString() },
  ]);
  DB.set('activity', [
    { id: genId(), text: 'Arjun Sharma checked in to Room 101', type: 'student', date: new Date(Date.now()-86400000*5).toISOString() },
    { id: genId(), text: 'Electricity readings recorded for all rooms', type: 'room', date: new Date(Date.now()-86400000*2).toISOString() },
    { id: genId(), text: 'Bill for Arjun Sharma — ₹4,950 (Paid)', type: 'payment', date: new Date(Date.now()-86400000).toISOString() },
    { id: genId(), text: 'Partial payment ₹3,000 from Priya Patel', type: 'payment', date: new Date().toISOString() },
  ]);
  DB.set('seeded_v2', true);
}

// ====== APP INIT ======
const App = {
  // Called after setup wizard completes (Supabase or Local mode)
  boot() {
    if (Auth.check()) {
      App.init();
    } else {
      document.getElementById('loginScreen').classList.remove('d-none');
    }
  },

  init() {
    seedDemoData();
    Rooms.init();
    Students.init();
    Electricity.init();
    Payments.init();
    Complaints.init();
    Reports.init();

    if (DB.get('darkMode')) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('themeIcon').className = 'bi bi-sun-fill';
    }

    document.getElementById('pageDate').textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    const rbMonth = document.getElementById('rbMonth');
    if (rbMonth) rbMonth.value = currentMonth();

    navigate('dashboard');
    checkRentReminder();
  }
};

// ====== BOOT — Entry point ======
window.addEventListener('load', () => {
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !document.getElementById('loginScreen').classList.contains('d-none')) {
      Auth.login();
    }
  });

  // Check if credentials are saved from a previous session
  const savedUrl = localStorage.getItem('sb_url');
  const savedKey = localStorage.getItem('sb_key');

  if (savedUrl && savedKey) {
    // Auto-connect — skip setup wizard
    document.getElementById('sbUrl').value = savedUrl;
    document.getElementById('sbKey').value = savedKey;
    SupaSetup._url = savedUrl;
    SupaSetup._key = savedKey;
    SupaSync.init(savedUrl, savedKey);
    // Pull latest data from cloud then boot
    SupaSync.pullAll().then(() => {
      document.getElementById('setupOverlay').style.display = 'none';
      App.boot();
    });
  } else {
    // Show setup wizard (first time)
    document.getElementById('setupOverlay').style.display = 'flex';
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('mainApp').classList.add('d-none');
  }
});
