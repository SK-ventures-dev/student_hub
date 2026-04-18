// roomBilling.js — Room-wise Billing Table Module

const RoomBilling = {
  _query: '',

  render() {
    const month = document.getElementById('rbMonth').value || currentMonth();
    this._query = (document.getElementById('rbSearch')?.value || '').toLowerCase();

    const rooms = Rooms.getRooms();
    const students = Students.getAll();
    const payments = Payments.getPayments().filter(p => p.month === month);

    const el = document.getElementById('roomBillingList');

    // Build room → students map (all students ever in that room for the month)
    // Also pull active students for current month
    const activeStudents = students.filter(s => !s.checkedOut);

    // Group active students by room
    const roomStudentMap = {};
    activeStudents.forEach(s => {
      if (!s.roomId) return;
      if (!roomStudentMap[s.roomId]) roomStudentMap[s.roomId] = [];
      roomStudentMap[s.roomId].push(s);
    });

    // Also include rooms that have payments this month even if vacant now
    payments.forEach(p => {
      if (!roomStudentMap[p.roomId] && p.roomId) {
        roomStudentMap[p.roomId] = roomStudentMap[p.roomId] || [];
        const s = students.find(x => x.id === p.studentId);
        if (s && !roomStudentMap[p.roomId].find(x => x.id === s.id)) {
          roomStudentMap[p.roomId].push(s);
        }
      }
    });

    const occupiedRoomIds = Object.keys(roomStudentMap);
    if (!occupiedRoomIds.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-table"></i><p>No room billing data for ${Payments.formatMonth(month)}</p></div>`;
      return;
    }

    // Filter by search
    let filteredRooms = rooms.filter(r => occupiedRoomIds.includes(r.id));
    if (this._query) {
      filteredRooms = filteredRooms.filter(r => {
        const hasRoomMatch = r.number.toLowerCase().includes(this._query);
        const hasStudentMatch = (roomStudentMap[r.id] || []).some(s => s.name.toLowerCase().includes(this._query));
        return hasRoomMatch || hasStudentMatch;
      });
    }

    if (!filteredRooms.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-search"></i><p>No results found for "${this._query}"</p></div>`;
      return;
    }

    // Summary totals
    let grandTotal = 0, grandPaid = 0, grandBalance = 0;

    const rows = filteredRooms.map(room => {
      const roomStudents = roomStudentMap[room.id] || [];
      const roomPayments = payments.filter(p => p.roomId === room.id);

      // Per-student rows
      const studentRows = roomStudents.map(s => {
        const sp = roomPayments.filter(p => p.studentId === s.id);
        const totalBill = sp.reduce((sum, p) => sum + (p.total || 0), 0);
        const totalPaid = sp.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
        const balance = totalBill - totalPaid;
        const rent = sp.reduce((sum, p) => sum + (p.rent || 0), 0);
        const elec = sp.reduce((sum, p) => sum + (p.elecCharge || 0), 0);

        // Overall status for this student this month
        let status = 'no-bill';
        if (sp.length > 0) {
          if (sp.every(p => p.status === 'paid')) status = 'paid';
          else if (sp.some(p => p.status === 'partial' || p.status === 'paid')) status = 'partial';
          else status = 'pending';
        }

        grandTotal += totalBill;
        grandPaid += totalPaid;
        grandBalance += balance;

        const paidPct = totalBill > 0 ? Math.min(Math.round((totalPaid/totalBill)*100), 100) : 0;

        return { s, sp, totalBill, totalPaid, balance, rent, elec, status, paidPct };
      });

      const roomTotalBill = studentRows.reduce((sum, r) => sum + r.totalBill, 0);
      const roomTotalPaid = studentRows.reduce((sum, r) => sum + r.totalPaid, 0);
      const roomBalance = roomTotalBill - roomTotalPaid;
      const roomPct = roomTotalBill > 0 ? Math.min(Math.round((roomTotalPaid/roomTotalBill)*100),100) : 0;

      const roomStatus = roomTotalBill === 0 ? 'no-bill'
        : roomTotalPaid >= roomTotalBill ? 'paid'
        : roomTotalPaid > 0 ? 'partial' : 'pending';

      return `
        <!-- Room header row -->
        <tr class="room-header-row">
          <td colspan="2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-door-closed-fill"></i>
              Room ${room.number}
              <span style="font-size:12px;font-weight:500;color:var(--primary);opacity:0.7;">${room.type}</span>
              <span class="badge-room" style="font-size:10px;margin-left:4px;">${formatCurrency(room.rent)}/mo</span>
            </div>
          </td>
          <td>
            <div style="font-size:12px;">${roomStudents.length} student${roomStudents.length !== 1 ? 's' : ''}</div>
          </td>
          <td class="fw-700" style="color:var(--primary);">${formatCurrency(roomTotalBill)}</td>
          <td>
            <div class="fw-600" style="color:var(--success)">${formatCurrency(roomTotalPaid)}</div>
            <div class="rb-progress" style="width:90px;">
              <div class="rb-progress-fill" style="width:${roomPct}%;background:${roomStatus==='paid'?'var(--success)':roomStatus==='partial'?'var(--info)':'var(--border)'};"></div>
            </div>
          </td>
          <td class="fw-700" style="color:${roomBalance>0?'var(--danger)':'var(--success)'};">${formatCurrency(roomBalance)}</td>
          <td><span class="status-badge ${roomStatus === 'no-bill' ? 'pending' : roomStatus}">${roomStatus === 'no-bill' ? 'no bill' : roomStatus}</span></td>
          <td>
            <button class="btn hos-btn-primary btn-sm py-0 px-2" style="font-size:12px;" onclick="navigate('payments');Payments.openModal();">
              <i class="bi bi-plus-lg"></i> Bill
            </button>
          </td>
        </tr>
        <!-- Student rows -->
        ${studentRows.map(({ s, sp, totalBill, totalPaid, balance, rent, elec, status, paidPct }) => `
          <tr>
            <td style="padding-left:28px;">
              <div class="d-flex align-items-center gap-2">
                ${s.photo
                  ? `<img src="${s.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--border);"/>`
                  : `<div class="student-avatar" style="width:28px;height:28px;font-size:11px;">${s.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>`}
                <div>
                  <div style="font-size:13px;font-weight:600;">${s.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${s.phone}</div>
                </div>
              </div>
            </td>
            <td style="font-size:12px;color:var(--text-muted);">${sp.length > 0 ? `${sp.length} bill${sp.length>1?'s':''}` : '<span style="color:var(--text-muted)">No bill</span>'}</td>
            <td>
              <div style="font-size:12px;">${formatCurrency(rent)} rent + ${formatCurrency(elec)} elec</div>
            </td>
            <td class="fw-600">${formatCurrency(totalBill)}</td>
            <td>
              <div style="color:var(--success);font-weight:600;">${formatCurrency(totalPaid)}</div>
              <div class="rb-progress" style="width:80px;">
                <div class="rb-progress-fill" style="width:${paidPct}%;background:var(--success);"></div>
              </div>
            </td>
            <td style="color:${balance>0?'var(--danger)':'var(--success)'};font-weight:600;">${formatCurrency(balance)}</td>
            <td>
              ${status === 'no-bill'
                ? `<span style="font-size:11px;color:var(--text-muted);">No bill</span>`
                : `<span class="status-badge ${status}">${status}</span>`}
            </td>
            <td>
              <div class="d-flex gap-1">
                ${sp.length > 0 && status !== 'paid' ? `
                  <button class="btn-icon" onclick="Payments.openPartialPayModal('${sp[sp.length-1].id}')" title="Add Payment" style="color:var(--success)">
                    <i class="bi bi-cash-coin"></i>
                  </button>` : ''}
                ${sp.length > 0 ? `
                  <button class="btn-icon" onclick="Payments.viewReceipt('${sp[sp.length-1].id}')" title="View Receipt">
                    <i class="bi bi-receipt"></i>
                  </button>` : ''}
              </div>
            </td>
          </tr>
        `).join('')}
      `;
    }).join('');

    el.innerHTML = `
      <!-- Summary bar -->
      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--primary-light);color:var(--primary)"><i class="bi bi-receipt"></i></div>
            <div class="stat-info"><div class="stat-value" style="font-size:16px;">${formatCurrency(grandTotal)}</div><div class="stat-label">Total Billed</div></div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--success-light);color:var(--success)"><i class="bi bi-check-circle-fill"></i></div>
            <div class="stat-info"><div class="stat-value" style="font-size:16px;">${formatCurrency(grandPaid)}</div><div class="stat-label">Total Collected</div></div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--danger-light);color:var(--danger)"><i class="bi bi-exclamation-circle-fill"></i></div>
            <div class="stat-info"><div class="stat-value" style="font-size:16px;">${formatCurrency(grandBalance)}</div><div class="stat-label">Outstanding</div></div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--warning-light);color:var(--warning)"><i class="bi bi-calendar-month"></i></div>
            <div class="stat-info"><div class="stat-value" style="font-size:14px;">${Payments.formatMonth(month)}</div><div class="stat-label">Current Period</div></div>
          </div>
        </div>
      </div>
      <div class="hos-card p-0">
        <div class="data-table-wrap">
          <table class="rb-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bills</th>
                <th>Breakdown</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  filter() { this.render(); },

  exportCSV() {
    const month = document.getElementById('rbMonth').value || currentMonth();
    const students = Students.getAll();
    const payments = Payments.getPayments().filter(p => p.month === month);
    const rooms = Rooms.getRooms();

    if (!payments.length) { showToast('No billing data to export', 'warning'); return; }

    const headers = ['Room No', 'Room Type', 'Student Name', 'Aadhaar', 'Phone', 'Month', 'Rent', 'Electricity', 'Total Bill', 'Amount Paid', 'Balance', 'Status'];
    const rows = payments.map(p => {
      const room = rooms.find(r => r.id === p.roomId);
      const student = students.find(s => s.id === p.studentId);
      const balance = (p.total||0) - (p.amountPaid||0);
      return [
        `"Room ${p.roomNumber}"`,
        `"${room?.type||''}"`,
        `"${p.studentName}"`,
        `"${student?.aadhaar||''}"`,
        `"${student?.phone||''}"`,
        `"${Payments.formatMonth(p.month)}"`,
        p.rent, p.elecCharge, p.total,
        p.amountPaid||0, balance, p.status
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `room_billing_${month}.csv`;
    a.click();
    showToast('Room billing CSV exported!', 'success');
  }
};
