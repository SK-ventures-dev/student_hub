// dashboard.js — Dashboard stats & widgets

const Dashboard = {
  render() {
    const rooms = DB.get('rooms', []);
    const students = DB.get('students', []);
    const payments = DB.get('payments', []);
    const month = currentMonth();

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const vacantRooms = totalRooms - occupiedRooms;
    const totalStudents = students.filter(s => !s.checkedOut).length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const monthIncome = payments
      .filter(p => p.month === month && p.status === 'paid')
      .reduce((sum, p) => sum + (p.total || 0), 0);

    const cards = [
      { label: 'Total Rooms', value: totalRooms, icon: 'bi-door-closed-fill', color: '#2d5be3', bg: '#eef1fd' },
      { label: 'Occupied Rooms', value: occupiedRooms, icon: 'bi-house-fill', color: '#e74c3c', bg: '#fef0ee' },
      { label: 'Vacant Rooms', value: vacantRooms, icon: 'bi-door-open-fill', color: '#2ecc71', bg: '#e8faf0' },
      { label: 'Total Students', value: totalStudents, icon: 'bi-people-fill', color: '#9b59b6', bg: '#f3eafd' },
      { label: 'Pending Bills', value: pendingPayments, icon: 'bi-exclamation-circle-fill', color: '#f39c12', bg: '#fff8e6' },
      { label: `${new Date().toLocaleString('en-IN',{month:'short'})} Income`, value: formatCurrency(monthIncome), icon: 'bi-graph-up-arrow', color: '#2ecc71', bg: '#e8faf0', big: true },
    ];

    const cardContainer = document.getElementById('dashboardCards');
    cardContainer.innerHTML = cards.map(c => `
      <div class="col-6 col-md-4 col-xl-2">
        <div class="stat-card" style="background:var(--surface)">
          <div class="stat-icon" style="background:${c.bg};color:${c.color}">
            <i class="bi ${c.icon}"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="font-size:${c.big?'20px':'28px'}">${c.value}</div>
            <div class="stat-label">${c.label}</div>
          </div>
        </div>
      </div>
    `).join('');

    this.renderActivity();
    this.renderOccupancy(occupiedRooms, vacantRooms, totalRooms);
  },

  renderActivity() {
    const activities = DB.get('activity', []);
    const el = document.getElementById('recentActivity');
    if (!activities.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-activity"></i><p>No recent activity</p></div>`;
      return;
    }
    const icons = {
      room: { icon: 'bi-door-closed-fill', color: '#2d5be3', bg: '#eef1fd' },
      student: { icon: 'bi-person-fill', color: '#9b59b6', bg: '#f3eafd' },
      payment: { icon: 'bi-wallet2', color: '#2ecc71', bg: '#e8faf0' },
      complaint: { icon: 'bi-tools', color: '#f39c12', bg: '#fff8e6' },
    };
    el.innerHTML = activities.slice(0, 8).map(a => {
      const ic = icons[a.type] || icons.room;
      return `<div class="activity-item">
        <div class="activity-dot" style="background:${ic.bg};color:${ic.color}">
          <i class="bi ${ic.icon}"></i>
        </div>
        <div class="activity-text">
          <div class="activity-main">${a.text}</div>
          <div class="activity-time">${formatDate(a.date)}</div>
        </div>
      </div>`;
    }).join('');
  },

  renderOccupancy(occupied, vacant, total) {
    const el = document.getElementById('occupancyChart');
    const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const months = DB.get('payments', []);
    // Monthly income by month
    const incomeMap = {};
    months.filter(p => p.status === 'paid').forEach(p => {
      incomeMap[p.month] = (incomeMap[p.month] || 0) + (p.total || 0);
    });
    const last6 = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0,7);
      const label = d.toLocaleString('en-IN', { month: 'short' });
      last6.push({ label, value: incomeMap[key] || 0 });
    }
    const maxVal = Math.max(...last6.map(x => x.value), 1);

    el.innerHTML = `
      <div class="occ-bar-wrap">
        <div class="occ-label">
          <span>Occupancy Rate</span>
          <span class="fw-700">${pct}%</span>
        </div>
        <div class="occ-bar">
          <div class="occ-fill" style="width:${pct}%;background:var(--primary)"></div>
        </div>
      </div>
      <div class="occ-bar-wrap">
        <div class="occ-label">
          <span>Occupied</span><span>${occupied}</span>
        </div>
        <div class="occ-bar">
          <div class="occ-fill" style="width:${total>0?(occupied/total*100):0}%;background:#e74c3c"></div>
        </div>
      </div>
      <div class="occ-bar-wrap">
        <div class="occ-label">
          <span>Vacant</span><span>${vacant}</span>
        </div>
        <div class="occ-bar">
          <div class="occ-fill" style="width:${total>0?(vacant/total*100):0}%;background:#2ecc71"></div>
        </div>
      </div>
      <div style="margin-top:20px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px;letter-spacing:0.5px;text-transform:uppercase">6-Month Income</div>
        <div style="display:flex;align-items:flex-end;gap:6px;height:70px">
          ${last6.map(m => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div title="${formatCurrency(m.value)}" style="width:100%;background:var(--primary);opacity:0.8;border-radius:4px 4px 0 0;height:${maxVal>0?Math.round((m.value/maxVal)*50)+4:4}px;min-height:4px;transition:height 0.4s ease"></div>
              <div style="font-size:10px;color:var(--text-muted)">${m.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  addActivity(text, type = 'room') {
    const activities = DB.get('activity', []);
    activities.unshift({ text, type, date: new Date().toISOString() });
    DB.set('activity', activities.slice(0, 30));
  }
};
