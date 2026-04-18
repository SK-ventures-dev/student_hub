// electricity.js — Room-wise Meter Reading History & Auto-fetch Module

const Electricity = {
  _modal: null,
  _filter: '',

  init() {
    this._modal = new bootstrap.Modal(document.getElementById('electricityModal'));
  },

  getReadings() { return DB.get('elecReadings', []); },
  saveReadings(r) { DB.set('elecReadings', r); },

  // Get the latest reading for a room before a given month
  getLastReading(roomId, beforeMonth) {
    const readings = this.getReadings()
      .filter(r => r.roomId === roomId && r.month < beforeMonth)
      .sort((a, b) => b.month.localeCompare(a.month));
    return readings[0] || null;
  },

  // Get reading for exact month/room
  getReadingForMonth(roomId, month) {
    return this.getReadings().find(r => r.roomId === roomId && r.month === month) || null;
  },

  // Get all readings for a room sorted newest first
  getRoomHistory(roomId) {
    return this.getReadings()
      .filter(r => r.roomId === roomId)
      .sort((a, b) => b.month.localeCompare(a.month));
  },

  filter() {
    this._filter = (document.getElementById('elecSearch')?.value || '').toLowerCase();
    this.render();
  },

  render() {
    const rooms = Rooms.getRooms();
    const el = document.getElementById('electricityList');

    let filteredRooms = rooms;
    if (this._filter) {
      filteredRooms = rooms.filter(r => r.number.toLowerCase().includes(this._filter));
    }

    if (!filteredRooms.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-lightning-charge"></i><p>No rooms found.</p></div>`;
      return;
    }

    el.innerHTML = filteredRooms.map(room => {
      const history = this.getRoomHistory(room.id);
      const latest = history[0];
      const prev = history[1];

      const unitsThisMonth = (latest && prev) ? Math.max(latest.reading - prev.reading, 0) : null;
      const elecCharge = unitsThisMonth !== null ? unitsThisMonth * 10 : null;

      return `
        <div class="elec-room-card">
          <div class="elec-room-header">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon" style="background:var(--warning-light);color:var(--warning);width:40px;height:40px;font-size:18px;">
                <i class="bi bi-lightning-charge-fill"></i>
              </div>
              <div>
                <div class="elec-room-title">Room ${room.number}</div>
                <div style="font-size:12px;color:var(--text-muted)">${room.type} • ${room.status === 'occupied' ? room.studentName || 'Occupied' : 'Vacant'}</div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              ${latest ? `
                <div style="text-align:right;">
                  <div style="font-size:11px;color:var(--text-muted)">Last Reading</div>
                  <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--warning)">${latest.reading} <span style="font-size:12px;font-weight:400;color:var(--text-muted)">units</span></div>
                  <div style="font-size:11px;color:var(--text-muted)">${this.formatMonth(latest.month)}</div>
                </div>
              ` : `<span style="font-size:12px;color:var(--text-muted)">No readings yet</span>`}
              <button class="btn hos-btn-primary btn-sm" onclick="Electricity.openModal('${room.id}')">
                <i class="bi bi-plus-lg me-1"></i>Record
              </button>
            </div>
          </div>

          ${unitsThisMonth !== null ? `
            <div class="d-flex gap-3 mb-3" style="padding:10px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
              <div style="flex:1;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600;">UNITS THIS PERIOD</div>
                <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--warning)">${unitsThisMonth}</div>
              </div>
              <div style="flex:1;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600;">ELECTRICITY CHARGE</div>
                <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--danger)">${formatCurrency(elecCharge)}</div>
              </div>
              <div style="flex:1;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600;">PREV READING</div>
                <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--text-muted)">${prev.reading}</div>
              </div>
            </div>
          ` : ''}

          ${history.length ? `
            <div style="overflow-x:auto;">
              <table class="elec-history-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Reading</th>
                    <th>Units Used</th>
                    <th>Charge</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${history.slice(0, 6).map((r, i) => {
                    const prevR = history[i + 1];
                    const units = prevR ? Math.max(r.reading - prevR.reading, 0) : null;
                    return `
                      <tr>
                        <td><strong>${this.formatMonth(r.month)}</strong></td>
                        <td><span style="font-family:var(--font-head);font-weight:700;">${r.reading}</span></td>
                        <td>${units !== null ? `<span style="color:var(--warning);font-weight:600;">${units} units</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                        <td>${units !== null ? formatCurrency(units * 10) : '—'}</td>
                        <td style="color:var(--text-muted)">${r.notes || '—'}</td>
                        <td>
                          <button class="btn-icon danger" onclick="Electricity.deleteReading('${r.id}')" title="Delete">
                            <i class="bi bi-trash-fill"></i>
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;"><i class="bi bi-clipboard-data me-2"></i>No readings recorded yet</div>`}
        </div>
      `;
    }).join('');
  },

  formatMonth(m) {
    if (!m) return '—';
    const [y, mo] = m.split('-');
    return new Date(y, mo - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  },

  openModal(roomId = null) {
    // Populate rooms
    const rooms = Rooms.getRooms();
    const sel = document.getElementById('elecRoom');
    sel.innerHTML = rooms.map(r => `<option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>Room ${r.number} — ${r.type}</option>`).join('');
    document.getElementById('elecMonth').value = currentMonth();
    document.getElementById('elecReading').value = '';
    document.getElementById('elecNotes').value = '';
    document.getElementById('elecCalcResult').classList.add('d-none');
    this.loadLastReading();
    this._modal.show();
  },

  loadLastReading() {
    const roomId = document.getElementById('elecRoom').value;
    const month = document.getElementById('elecMonth').value;
    const prev = this.getLastReading(roomId, month);
    const prevInfo = document.getElementById('elecPrevInfo');

    if (prev) {
      prevInfo.classList.remove('d-none');
      prevInfo.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;color:var(--info);font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Previous Reading</div>
            <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--info)">${prev.reading} <span style="font-size:12px;font-weight:400;color:var(--text-muted)">units</span></div>
            <div style="font-size:11px;color:var(--text-muted)">${this.formatMonth(prev.month)}</div>
          </div>
          <div style="text-align:right;">
            <i class="bi bi-info-circle-fill" style="color:var(--info);font-size:20px;"></i>
          </div>
        </div>
      `;
    } else {
      prevInfo.classList.remove('d-none');
      prevInfo.innerHTML = `<div style="color:var(--text-muted);font-size:12px;"><i class="bi bi-info-circle me-1"></i>No previous reading found — this will be the first entry for this room.</div>`;
    }
    this.calcUnits();
  },

  calcUnits() {
    const roomId = document.getElementById('elecRoom').value;
    const month = document.getElementById('elecMonth').value;
    const current = parseFloat(document.getElementById('elecReading').value);
    const resultEl = document.getElementById('elecCalcResult');

    if (!current || isNaN(current)) { resultEl.classList.add('d-none'); return; }

    const prev = this.getLastReading(roomId, month);
    if (!prev) { resultEl.classList.add('d-none'); return; }

    const units = Math.max(current - prev.reading, 0);
    const charge = units * 10;

    resultEl.classList.remove('d-none');
    resultEl.innerHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;">Units Consumed</div>
          <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--success)">${units}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;">Electricity Charge</div>
          <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--success)">${formatCurrency(charge)}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">From</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-muted)">${prev.reading} → ${current}</div>
        </div>
      </div>
    `;
  },

  save() {
    const roomId = document.getElementById('elecRoom').value;
    const month = document.getElementById('elecMonth').value;
    const reading = parseFloat(document.getElementById('elecReading').value);
    const notes = document.getElementById('elecNotes').value.trim();

    if (!roomId) { showToast('Please select a room', 'error'); return; }
    if (!month) { showToast('Please select a month', 'error'); return; }
    if (isNaN(reading) || reading < 0) { showToast('Please enter a valid meter reading', 'error'); return; }

    // Check for duplicate
    const existing = this.getReadingForMonth(roomId, month);
    if (existing) {
      if (!confirm(`A reading already exists for this room in ${this.formatMonth(month)}. Overwrite?`)) return;
      const readings = this.getReadings().filter(r => !(r.roomId === roomId && r.month === month));
      readings.push({ id: genId(), roomId, month, reading, notes, recordedAt: new Date().toISOString() });
      this.saveReadings(readings);
    } else {
      const readings = this.getReadings();
      readings.push({ id: genId(), roomId, month, reading, notes, recordedAt: new Date().toISOString() });
      this.saveReadings(readings);
    }

    const room = Rooms.getById(roomId);
    showToast(`Reading saved for Room ${room?.number}`, 'success');
    Dashboard.addActivity(`Meter reading recorded: Room ${room?.number} → ${reading} units`, 'room');
    this._modal.hide();
    this.render();
  },

  deleteReading(id) {
    if (!confirm('Delete this reading?')) return;
    this.saveReadings(this.getReadings().filter(r => r.id !== id));
    showToast('Reading deleted', 'success');
    this.render();
  }
};
