// reports.js — Reports & Analytics Module

const Reports = {
  init() {
    const sel = document.getElementById('reportMonth');
    // Populate last 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const val = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (i === 0) opt.selected = true;
      sel.appendChild(opt);
    }
  },

  generateMonthly() {
    const month = document.getElementById('reportMonth').value;
    const payments = DB.get('payments', []).filter(p => p.month === month);
    const paid = payments.filter(p => p.status === 'paid');
    const pending = payments.filter(p => p.status === 'pending');
    const totalIncome = paid.reduce((s, p) => s + p.total, 0);
    const totalPending = pending.reduce((s, p) => s + p.total, 0);

    const monthLabel = new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const el = document.getElementById('reportOutput');
    el.innerHTML = `
      <div class="hos-card">
        <div class="hos-card-header">
          <h5 class="report-title"><i class="bi bi-calendar-month me-2 text-primary"></i>${monthLabel} — Income Report</h5>
          <button class="btn hos-btn-success btn-sm" onclick="Reports.exportMonthlyCSV('${month}')">
            <i class="bi bi-download me-1"></i>Export CSV
          </button>
        </div>
        <div class="row g-3 mb-4">
          <div class="col-md-3 col-6">
            <div class="stat-card">
              <div class="stat-icon" style="background:#e8faf0;color:#2ecc71"><i class="bi bi-cash-stack"></i></div>
              <div class="stat-info">
                <div class="stat-value" style="font-size:18px">${formatCurrency(totalIncome)}</div>
                <div class="stat-label">Total Collected</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="stat-card">
              <div class="stat-icon" style="background:#fff8e6;color:#f39c12"><i class="bi bi-hourglass"></i></div>
              <div class="stat-info">
                <div class="stat-value" style="font-size:18px">${formatCurrency(totalPending)}</div>
                <div class="stat-label">Pending Amount</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eef1fd;color:#2d5be3"><i class="bi bi-receipt"></i></div>
              <div class="stat-info">
                <div class="stat-value" style="font-size:18px">${paid.length}</div>
                <div class="stat-label">Bills Paid</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef0ee;color:#e74c3c"><i class="bi bi-exclamation-circle"></i></div>
              <div class="stat-info">
                <div class="stat-value" style="font-size:18px">${pending.length}</div>
                <div class="stat-label">Bills Pending</div>
              </div>
            </div>
          </div>
        </div>
        ${payments.length ? `
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Student</th><th>Room</th><th>Rent</th><th>Electricity</th><th>Total</th><th>Status</th><th>Paid On</th></tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td class="fw-600">${p.studentName}</td>
                    <td><span class="badge-room">Room ${p.roomNumber}</span></td>
                    <td>${formatCurrency(p.rent)}</td>
                    <td>${formatCurrency(p.elecCharge)}</td>
                    <td class="fw-700">${formatCurrency(p.total)}</td>
                    <td><span class="status-badge ${p.status}">${p.status}</span></td>
                    <td>${formatDate(p.paidAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><i class="bi bi-calendar-x"></i><p>No bills for this month</p></div>'}
      </div>
    `;
  },

  generateDues() {
    const pending = DB.get('payments', []).filter(p => p.status === 'pending');
    const total = pending.reduce((s, p) => s + p.total, 0);
    const el = document.getElementById('reportOutput');

    el.innerHTML = `
      <div class="hos-card">
        <div class="hos-card-header">
          <h5 class="report-title"><i class="bi bi-exclamation-triangle-fill me-2 text-warning"></i>Pending Dues Report</h5>
          <div style="font-size:14px;font-weight:700;color:var(--danger)">Total: ${formatCurrency(total)}</div>
        </div>
        ${pending.length ? `
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Student</th><th>Room</th><th>Month</th><th>Total Due</th><th>Bill Date</th></tr>
              </thead>
              <tbody>
                ${pending.map(p => `
                  <tr>
                    <td class="fw-600">${p.studentName}</td>
                    <td><span class="badge-room">Room ${p.roomNumber}</span></td>
                    <td>${Payments.formatMonth(p.month)}</td>
                    <td class="fw-700" style="color:var(--danger)">${formatCurrency(p.total)}</td>
                    <td>${formatDate(p.createdAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><i class="bi bi-check-circle-fill text-success"></i><p>No pending dues! All clear.</p></div>'}
      </div>
    `;
  },

  exportCSV() {
    const payments = DB.get('payments', []);
    if (!payments.length) { showToast('No data to export', 'warning'); return; }
    const headers = ['Student', 'Room', 'Month', 'Rent', 'Units', 'Electricity', 'Total', 'Status', 'Bill Date', 'Paid Date'];
    const rows = payments.map(p => [
      `"${p.studentName}"`, `"Room ${p.roomNumber}"`,
      `"${Payments.formatMonth(p.month)}"`,
      p.rent, p.units, p.elecCharge, p.total, p.status,
      `"${formatDate(p.createdAt)}"`, `"${formatDate(p.paidAt)}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this._download(csv, `Tannu_report_${new Date().toISOString().slice(0,10)}.csv`);
    showToast('CSV exported successfully!', 'success');
  },

  exportMonthlyCSV(month) {
    const payments = DB.get('payments', []).filter(p => p.month === month);
    if (!payments.length) { showToast('No data for this month', 'warning'); return; }
    const headers = ['Student', 'Room', 'Month', 'Rent', 'Units', 'Electricity', 'Total', 'Status'];
    const rows = payments.map(p => [
      `"${p.studentName}"`, `"Room ${p.roomNumber}"`,
      `"${Payments.formatMonth(p.month)}"`,
      p.rent, p.units, p.elecCharge, p.total, p.status
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this._download(csv, `Tannu_${month}.csv`);
    showToast('Monthly report exported!', 'success');
  },

  _download(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
};
