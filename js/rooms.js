// rooms.js — Room Management Module

const Rooms = {
  _filter: 'all',
  _modal: null,

  init() {
    this._modal = new bootstrap.Modal(document.getElementById('roomModal'));
  },

  getRooms() { return DB.get('rooms', []); },
  saveRooms(rooms) { DB.set('rooms', rooms); },

  render() {
    const query = (document.getElementById('roomSearch')?.value || '').toLowerCase();
    let rooms = this.getRooms();

    if (query) rooms = rooms.filter(r => r.number.toString().toLowerCase().includes(query));
    if (this._filter === 'vacant') rooms = rooms.filter(r => r.status === 'vacant');
    if (this._filter === 'occupied') rooms = rooms.filter(r => r.status === 'occupied');

    const el = document.getElementById('roomsList');
    if (!rooms.length) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-door-closed"></i><p>No rooms found. Add your first room!</p></div>`;
      return;
    }

    el.innerHTML = rooms.map(r => `
      <div class="room-card ${r.status}" data-id="${r.id}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="room-number">Room ${r.number}</div>
            <div class="room-type"><i class="bi bi-person${r.type==='Double'?'s':r.type==='Triple'?'s-fill':''} me-1"></i>${r.type}</div>
          </div>
          <div class="room-status ${r.status}">
            <i class="bi bi-circle-fill" style="font-size:7px"></i>${r.status}
          </div>
        </div>
        <div class="room-rent">${formatCurrency(r.rent)}<small>/month</small></div>
        ${r.studentName ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px"><i class="bi bi-person-fill me-1"></i>${r.studentName}</div>` : ''}
        <div class="room-actions">
          <button class="btn-icon" onclick="Rooms.openModal('${r.id}')" title="Edit"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn-icon danger" onclick="Rooms.delete('${r.id}')" title="Delete"><i class="bi bi-trash-fill"></i></button>
        </div>
      </div>
    `).join('');
  },

  filter() { this.render(); },

  setFilter(f, btn) {
    this._filter = f;
    document.querySelectorAll('#page-rooms .pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    this.render();
  },

  openModal(id = null) {
    const form = {
      roomId: document.getElementById('roomId'),
      roomNo: document.getElementById('roomNo'),
      roomType: document.getElementById('roomType'),
      roomRent: document.getElementById('roomRent'),
      title: document.getElementById('roomModalTitle'),
    };
    if (id) {
      const room = this.getRooms().find(r => r.id === id);
      if (!room) return;
      form.roomId.value = room.id;
      form.roomNo.value = room.number;
      form.roomType.value = room.type;
      form.roomRent.value = room.rent;
      form.title.textContent = 'Edit Room';
    } else {
      form.roomId.value = '';
      form.roomNo.value = '';
      form.roomType.value = 'Single';
      form.roomRent.value = '';
      form.title.textContent = 'Add Room';
    }
    this._modal.show();
  },

  save() {
    const id = document.getElementById('roomId').value;
    const number = document.getElementById('roomNo').value.trim();
    const type = document.getElementById('roomType').value;
    const rent = parseFloat(document.getElementById('roomRent').value);

    if (!number) { showToast('Room number is required', 'error'); return; }
    if (isNaN(rent) || rent <= 0) { showToast('Please enter a valid rent amount', 'error'); return; }

    const rooms = this.getRooms();

    if (id) {
      const idx = rooms.findIndex(r => r.id === id);
      if (idx === -1) return;
      rooms[idx] = { ...rooms[idx], number, type, rent };
      showToast(`Room ${number} updated`, 'success');
      Dashboard.addActivity(`Room ${number} updated`, 'room');
    } else {
      if (rooms.find(r => r.number === number)) { showToast('Room number already exists', 'error'); return; }
      rooms.push({ id: genId(), number, type, rent, status: 'vacant', studentId: null, studentName: null });
      showToast(`Room ${number} added`, 'success');
      Dashboard.addActivity(`Room ${number} added (${type})`, 'room');
    }

    this.saveRooms(rooms);
    this._modal.hide();
    this.render();
    Dashboard.render();
  },

  delete(id) {
    const rooms = this.getRooms();
    const room = rooms.find(r => r.id === id);
    if (!room) return;
    if (room.status === 'occupied') { showToast('Cannot delete an occupied room. Checkout student first.', 'error'); return; }
    if (!confirm(`Delete Room ${room.number}? This cannot be undone.`)) return;
    this.saveRooms(rooms.filter(r => r.id !== id));
    showToast(`Room ${room.number} deleted`, 'success');
    Dashboard.addActivity(`Room ${room.number} deleted`, 'room');
    this.render();
    Dashboard.render();
  },

  setOccupied(roomId, studentId, studentName) {
    const rooms = this.getRooms();
    const idx = rooms.findIndex(r => r.id === roomId);
    if (idx === -1) return;
    rooms[idx].status = 'occupied';
    rooms[idx].studentId = studentId;
    rooms[idx].studentName = studentName;
    this.saveRooms(rooms);
  },

  setVacant(roomId) {
    const rooms = this.getRooms();
    const idx = rooms.findIndex(r => r.id === roomId);
    if (idx === -1) return;
    rooms[idx].status = 'vacant';
    rooms[idx].studentId = null;
    rooms[idx].studentName = null;
    this.saveRooms(rooms);
  },

  getVacant() {
    return this.getRooms().filter(r => r.status === 'vacant');
  },

  getById(id) {
    return this.getRooms().find(r => r.id === id);
  }
};
