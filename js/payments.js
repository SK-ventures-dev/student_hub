// payments.js — Enhanced Billing with Partial Payments & Auto-fetch

const Payments = {
  _filter: 'all',
  _modal: null,
  _receiptModal: null,
  _partialModal: null,
  _currentRent: 0,
  _currentTotal: 0,

  init() {
    this._modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    this._receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    this._partialModal = new bootstrap.Modal(document.getElementById('partialPayModal'));
  },

  getPayments() { return DB.get('payments', []); },
  savePayments(p) { DB.set('payments', p); },

  render() {
    const query = (document.getElementById('paySearch')?.value || '').toLowerCase();
    let payments = this.getPayments();

    if (this._filter === 'paid') payments = payments.filter(p => p.status === 'paid');
    if (this._filter === 'pending') payments = payments.filter(p => p.status === 'pending');
    if (this._filter === 'partial') payments = payments.filter(p => p.status === 'partial');
    if (query) payments = payments.filter(p =>
      (p.studentName || '').toLowerCase().includes(query) ||
      (p.roomNumber || '').includes(query) ||
      (p.month || '').includes(query)
    );
    payments = payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const el = document.getElementById('paymentsList');
    if (!payments.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-wallet2"></i><p>No bills yet. Create your first bill!</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="hos-card p-0">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th><th>Room</th><th>Month</th>
                <th>Total Bill</th><th>Paid</th><th>Balance</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => {
                const balance = (p.total || 0) - (p.amountPaid || 0);
                const paidPct = p.total > 0 ? Math.min(Math.round(((p.amountPaid||0)/p.total)*100),100) : 0;
                return `
                  <tr>
                    <td>
                      <div class="fw-600">${p.studentName}</div>
                      ${p.notes ? `<div style="font-size:11px;color:var(--text-muted)">${p.notes.slice(0,35)}</div>` : ''}
                    </td>
                    <td><span class="badge-room">Room ${p.roomNumber}</span></td>
                    <td style="font-size:13px;">${this.formatMonth(p.month)}</td>
                    <td>
                      <div class="fw-700">${formatCurrency(p.total)}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${formatCurrency(p.rent)} + ${formatCurrency(p.elecCharge)}</div>
                    </td>
                    <td>
                      <div class="fw-600" style="color:var(--success)">${formatCurrency(p.amountPaid || 0)}</div>
                      <div class="rb-progress" style="width:80px;margin-top:4px;"><div class="rb-progress-fill" style="width:${paidPct}%;background:var(--success);"></div></div>
                      ${(p.paymentHistory?.length||0) > 1 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${p.paymentHistory.length} payments</div>` : ''}
                    </td>
                    <td><div class="fw-600" style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(balance)}</div></td>
                    <td><span class="status-badge ${p.status}">${p.status}</span></td>
                    <td>
                      <div class="d-flex gap-1 flex-wrap">
                        ${p.status !== 'paid' ? `
                          <button class="btn-icon" onclick="Payments.openPartialPayModal('${p.id}')" title="Add Payment" style="color:var(--success)"><i class="bi bi-plus-circle-fill"></i></button>
                          <button class="btn-icon" onclick="Payments.markPaid('${p.id}')" title="Mark Fully Paid" style="color:var(--primary)"><i class="bi bi-check-all"></i></button>` : ''}
                        <button class="btn-icon" onclick="Payments.viewReceipt('${p.id}')" title="Receipt"><i class="bi bi-receipt"></i></button>
                        <button class="btn-icon danger" onclick="Payments.delete('${p.id}')" title="Delete"><i class="bi bi-trash-fill"></i></button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  filter() { this.render(); },

  setFilter(f, btn) {
    this._filter = f;
    document.querySelectorAll('#page-payments .pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    this.render();
  },

  formatMonth(m) {
    if (!m) return '—';
    const [y, mo] = m.split('-');
    return new Date(y, mo-1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  },

  populateStudentSelect() {
    const sel = document.getElementById('billStudent');
    const students = Students.getActive();
    sel.innerHTML = students.length
      ? students.map(s => {
          const r = Rooms.getById(s.roomId);
          return `<option value="${s.id}" data-rent="${r?r.rent:0}" data-roomid="${r?r.id:''}" data-room="${r?r.number:''}">${s.name} — Room ${r?r.number:'?'}</option>`;
        }).join('')
      : '<option value="">No active students</option>';
    this.loadStudentInfo();
  },

  loadStudentInfo() {
    const sel = document.getElementById('billStudent');
    const opt = sel.options[sel.selectedIndex];
    this._currentRent = parseFloat(opt?.dataset.rent || 0);
    this.autoFetchReading();
  },

  autoFetchReading() {
    const sel = document.getElementById('billStudent');
    const opt = sel.options[sel.selectedIndex];
    const roomId = opt?.dataset.roomid;
    const month = document.getElementById('billMonth').value;
    const banner = document.getElementById('autoFetchBanner');
    const hintEl = document.getElementById('prevReadingHint');

    if (!roomId || !month) { this.calcBill(); return; }

    const currentReading = Electricity.getReadingForMonth(roomId, month);
    const prevReading = Electricity.getLastReading(roomId, month);

    if (currentReading && prevReading) {
      document.getElementById('prevMeter').value = prevReading.reading;
      document.getElementById('currMeter').value = currentReading.reading;
      banner.classList.remove('d-none');
      document.getElementById('autoFetchText').textContent = `Auto-filled: ${prevReading.reading} → ${currentReading.reading} units (from electricity records)`;
      if (hintEl) hintEl.textContent = `Prev: ${Electricity.formatMonth(prevReading.month)}`;
    } else if (prevReading) {
      document.getElementById('prevMeter').value = prevReading.reading;
      banner.classList.remove('d-none');
      document.getElementById('autoFetchText').textContent = `Previous reading loaded: ${prevReading.reading} units (${Electricity.formatMonth(prevReading.month)})`;
      if (hintEl) hintEl.textContent = `From ${Electricity.formatMonth(prevReading.month)}`;
    } else {
      banner.classList.add('d-none');
      if (hintEl) hintEl.textContent = '';
    }
    this.calcBill();
  },

  calcBill() {
    const prev = parseFloat(document.getElementById('prevMeter').value) || 0;
    const curr = parseFloat(document.getElementById('currMeter').value) || 0;
    const units = Math.max(curr - prev, 0);
    const elecCharge = units * 10;
    this._currentTotal = this._currentRent + elecCharge;

    document.getElementById('bs-rent').textContent = formatCurrency(this._currentRent);
    document.getElementById('bs-units-inline').textContent = units;
    document.getElementById('bs-elec').textContent = formatCurrency(elecCharge);
    document.getElementById('bs-total').textContent = formatCurrency(this._currentTotal);
    document.getElementById('unitsDisplay').textContent = units;
    this.calcPartial();
  },

  handlePaymentType() {
    const type = document.getElementById('paymentType').value;
    document.getElementById('partialAmountWrap').style.display = type === 'partial' ? 'block' : 'none';
    this.calcPartial();
  },

  calcPartial() {
    const type = document.getElementById('paymentType').value;
    const total = this._currentTotal;
    const rent = this._currentRent;
    const prev = parseFloat(document.getElementById('prevMeter').value) || 0;
    const curr = parseFloat(document.getElementById('currMeter').value) || 0;
    const elec = Math.max(curr - prev, 0) * 10;

    let paid = 0;
    if (type === 'full') paid = total;
    else if (type === 'rent_only') paid = rent;
    else if (type === 'electricity_only') paid = elec;
    else if (type === 'partial') paid = Math.min(parseFloat(document.getElementById('partialAmount').value) || 0, total);

    const balance = total - paid;
    const status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

    document.getElementById('bsPaid').textContent = formatCurrency(paid);
    document.getElementById('bsBalance').textContent = formatCurrency(balance);
    const statusEl = document.getElementById('bsStatus');
    statusEl.textContent = status;
    statusEl.className = `status-badge ${status}`;
  },

  openModal() {
    document.getElementById('prevMeter').value = '';
    document.getElementById('currMeter').value = '';
    document.getElementById('billMonth').value = currentMonth();
    document.getElementById('paymentType').value = 'full';
    document.getElementById('paymentDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('billNotes').value = '';
    document.getElementById('partialAmountWrap').style.display = 'none';
    document.getElementById('autoFetchBanner').classList.add('d-none');
    document.getElementById('prevReadingHint').textContent = '';
    document.getElementById('unitsDisplay').textContent = '0';
    this.populateStudentSelect();
    this._modal.show();
  },

  save() {
    const studentId = document.getElementById('billStudent').value;
    const month = document.getElementById('billMonth').value;
    const prev = parseFloat(document.getElementById('prevMeter').value) || 0;
    const curr = parseFloat(document.getElementById('currMeter').value) || 0;
    const type = document.getElementById('paymentType').value;
    const notes = document.getElementById('billNotes').value.trim();
    const payDate = document.getElementById('paymentDate').value || new Date().toISOString().slice(0,10);

    if (!studentId) { showToast('Please select a student', 'error'); return; }
    if (!month) { showToast('Please select a billing month', 'error'); return; }

    const student = Students.getById(studentId);
    const room = student ? Rooms.getById(student.roomId) : null;
    const units = Math.max(curr - prev, 0);
    const elecCharge = units * 10;
    const rent = room ? room.rent : 0;
    const total = rent + elecCharge;

    let amountPaid = 0;
    if (type === 'full') amountPaid = total;
    else if (type === 'rent_only') amountPaid = rent;
    else if (type === 'electricity_only') amountPaid = elecCharge;
    else if (type === 'partial') amountPaid = Math.min(parseFloat(document.getElementById('partialAmount').value)||0, total);

    const status = amountPaid >= total && total > 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';
    const paymentHistory = amountPaid > 0 ? [{ amount: amountPaid, date: payDate, note: notes || type.replace(/_/g,' '), type }] : [];

    const payment = {
      id: genId(), studentId, month,
      studentName: student?.name || '',
      roomId: room?.id || '', roomNumber: room?.number || '',
      prevMeter: prev, currMeter: curr, units, elecCharge, rent, total,
      amountPaid, status, notes, paymentHistory,
      createdAt: new Date().toISOString(),
      paidAt: status === 'paid' ? new Date().toISOString() : null,
    };

    const payments = this.getPayments();
    payments.push(payment);
    this.savePayments(payments);
    showToast(`Bill created for ${student?.name} [${status}]`, 'success');
    Dashboard.addActivity(`Bill for ${student?.name} (${this.formatMonth(month)}) — ${formatCurrency(total)} [${status}]`, 'payment');
    this._modal.hide();
    this.render();
    Dashboard.render();
  },

  openPartialPayModal(id) {
    const p = this.getPayments().find(x => x.id === id);
    if (!p) return;
    const balance = (p.total||0) - (p.amountPaid||0);
    document.getElementById('ppBillId').value = id;
    document.getElementById('ppAmount').value = '';
    document.getElementById('ppDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('ppNote').value = '';
    document.getElementById('ppPreview').classList.add('d-none');
    document.getElementById('ppBillInfo').innerHTML = `
      <div class="pp-label">Student / Room</div>
      <div class="pp-value">${p.studentName} — Room ${p.roomNumber}</div>
      <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap;">
        <div><div class="pp-label">Total Bill</div><div class="pp-value">${formatCurrency(p.total)}</div></div>
        <div><div class="pp-label">Already Paid</div><div class="pp-value" style="color:var(--success)">${formatCurrency(p.amountPaid||0)}</div></div>
        <div><div class="pp-label">Balance Due</div><div class="pp-value" style="color:var(--danger)">${formatCurrency(balance)}</div></div>
      </div>
    `;
    this._partialModal.show();
  },

  updatePartialPreview() {
    const id = document.getElementById('ppBillId').value;
    const p = this.getPayments().find(x => x.id === id);
    if (!p) return;
    const paying = parseFloat(document.getElementById('ppAmount').value) || 0;
    const balance = (p.total||0) - (p.amountPaid||0);
    const actualPay = Math.min(paying, balance);
    const remaining = Math.max(balance - actualPay, 0);
    const newPaid = (p.amountPaid||0) + actualPay;
    const newStatus = newPaid >= p.total ? 'paid' : newPaid > 0 ? 'partial' : 'pending';

    document.getElementById('ppPreview').classList.remove('d-none');
    document.getElementById('ppPayingNow').textContent = formatCurrency(actualPay);
    document.getElementById('ppRemaining').textContent = formatCurrency(remaining);
    const ns = document.getElementById('ppNewStatus');
    ns.textContent = newStatus;
    ns.className = `status-badge ${newStatus}`;
  },

  recordPartial() {
    const id = document.getElementById('ppBillId').value;
    const amount = parseFloat(document.getElementById('ppAmount').value);
    const date = document.getElementById('ppDate').value || new Date().toISOString().slice(0,10);
    const note = document.getElementById('ppNote').value.trim();

    if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }

    const payments = this.getPayments();
    const idx = payments.findIndex(p => p.id === id);
    if (idx === -1) return;
    const p = payments[idx];
    const balance = (p.total||0) - (p.amountPaid||0);
    const actualPay = Math.min(amount, balance);
    const newAmountPaid = (p.amountPaid||0) + actualPay;
    const newStatus = newAmountPaid >= p.total ? 'paid' : 'partial';

    payments[idx] = {
      ...p,
      amountPaid: newAmountPaid,
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date().toISOString() : p.paidAt,
      paymentHistory: [...(p.paymentHistory||[]), { amount: actualPay, date, note: note || 'Payment', type: 'partial' }]
    };
    this.savePayments(payments);
    showToast(`${formatCurrency(actualPay)} recorded for ${p.studentName}`, 'success');
    Dashboard.addActivity(`Partial payment ${formatCurrency(actualPay)} from ${p.studentName}`, 'payment');
    this._partialModal.hide();
    this.render();
    Dashboard.render();
  },

  markPaid(id) {
    const payments = this.getPayments();
    const idx = payments.findIndex(p => p.id === id);
    if (idx === -1) return;
    const p = payments[idx];
    const remaining = (p.total||0) - (p.amountPaid||0);
    payments[idx] = {
      ...p, amountPaid: p.total, status: 'paid',
      paidAt: new Date().toISOString(),
      paymentHistory: [...(p.paymentHistory||[]), ...(remaining > 0 ? [{ amount: remaining, date: new Date().toISOString().slice(0,10), note: 'Marked fully paid', type: 'full' }] : [])]
    };
    this.savePayments(payments);
    showToast('Marked as fully paid', 'success');
    Dashboard.addActivity(`Full payment from ${payments[idx].studentName}`, 'payment');
    this.render();
    Dashboard.render();
  },

  delete(id) {
    if (!confirm('Delete this bill?')) return;
    this.savePayments(this.getPayments().filter(p => p.id !== id));
    showToast('Bill deleted', 'success');
    this.render();
    Dashboard.render();
  },

  viewReceipt(id) {
    const p = this.getPayments().find(x => x.id === id);
    if (!p) return;
    const balance = (p.total||0) - (p.amountPaid||0);
    const student = Students.getById(p.studentId);

    document.getElementById('receiptContent').innerHTML = `
      <div class="receipt-wrap">
        <div class="receipt-header">
          <div class="receipt-title">Tannu</div>
          <div class="receipt-sub">Official Payment Receipt</div>
          <div class="receipt-sub" style="margin-top:4px;font-weight:600;">${this.formatMonth(p.month)}</div>
        </div>
        ${student?.photo ? `<div style="text-align:center;margin-bottom:12px;"><img src="${student.photo}" style="width:60px;height:72px;object-fit:cover;border-radius:8px;border:2px solid var(--border);"/></div>` : ''}
        <table class="receipt-table">
          <tr><td>Student Name</td><td>${p.studentName}</td></tr>
          ${student?.aadhaar ? `<tr><td>Aadhaar No.</td><td>${student.aadhaar}</td></tr>` : ''}
          <tr><td>Room Number</td><td>Room ${p.roomNumber}</td></tr>
          <tr><td>Billing Month</td><td>${this.formatMonth(p.month)}</td></tr>
          <tr><td>Room Rent</td><td>${formatCurrency(p.rent)}</td></tr>
          <tr><td>Prev Reading</td><td>${p.prevMeter} units</td></tr>
          <tr><td>Curr Reading</td><td>${p.currMeter} units</td></tr>
          <tr><td>Units Consumed</td><td>${p.units} units</td></tr>
          <tr><td>Electricity Charge</td><td>${formatCurrency(p.elecCharge)} (${p.units}×₹10)</td></tr>
          <tr><td>Bill Date</td><td>${formatDate(p.createdAt)}</td></tr>
        </table>
        ${(p.paymentHistory?.length) ? `
          <div style="margin:12px 0 6px;font-size:13px;font-weight:700;color:var(--text);">Payment History</div>
          <table class="receipt-table">
            <tr><td style="font-weight:700;">Date</td><td style="font-weight:700;">Amount</td><td style="font-weight:700;">Note</td></tr>
            ${p.paymentHistory.map(h=>`<tr><td>${formatDate(h.date)}</td><td>${formatCurrency(h.amount)}</td><td>${h.note||'—'}</td></tr>`).join('')}
          </table>
        ` : ''}
        <div class="receipt-total">
          <div style="font-size:13px;opacity:0.85;margin-bottom:4px;">Total Bill</div>
          <div class="amount">${formatCurrency(p.total)}</div>
          <div style="display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:13px;">
            <span>Paid: <strong>${formatCurrency(p.amountPaid||0)}</strong></span>
            ${balance > 0 ? `<span>Balance: <strong>${formatCurrency(balance)}</strong></span>` : ''}
          </div>
          <div style="margin-top:8px;"><span style="background:rgba(255,255,255,0.2);padding:3px 14px;border-radius:20px;font-size:12px;">${(p.status||'pending').toUpperCase()}</span></div>
        </div>
        ${p.notes ? `<div style="margin-top:12px;font-size:12px;color:var(--text-muted);text-align:center;">Note: ${p.notes}</div>` : ''}
        <div style="text-align:center;margin-top:14px;font-size:11px;color:var(--text-muted);">Generated by Tannu • ${new Date().toLocaleDateString('en-IN')}</div>
      </div>
    `;
    this._receiptModal.show();
  }
};
