// students.js — Enhanced Student Module with Aadhaar, Photo, ID Proof

const Students = {
  _modal: null,
  _idData: null,
  _photoData: null,

  init() {
    this._modal = new bootstrap.Modal(document.getElementById('studentModal'));
  },

  getStudents() { return DB.get('students', []); },
  saveStudents(s) { DB.set('students', s); },

  render() {
    const query = (document.getElementById('studentSearch')?.value || '').toLowerCase();
    let students = this.getStudents();
    if (query) students = students.filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.phone || '').includes(query) ||
      (s.aadhaar || '').replace(/\s/g,'').includes(query.replace(/\s/g,''))
    );

    const el = document.getElementById('studentsList');
    if (!students.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-people"></i><p>No students yet. Add your first student!</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="hos-card p-0">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Aadhaar</th>
                <th>Room</th>
                <th>Phone</th>
                <th>Check-in</th>
                <th>Status</th>
                <th>Documents</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => {
                const room = Rooms.getById(s.roomId);
                const initials = s.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                const aadhaarDisplay = s.aadhaar ? s.aadhaar.replace(/(\d{4})\s?(\d{4})\s?(\d{4})/, 'XXXX XXXX $3') : '—';
                return `
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-3">
                        ${s.photo
                          ? `<img src="${s.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border);flex-shrink:0;" />`
                          : `<div class="student-avatar">${initials}</div>`
                        }
                        <div>
                          <div class="fw-600">${s.name}</div>
                          <div style="font-size:12px;color:var(--text-muted)">${s.address ? s.address.slice(0,28)+'…' : ''}</div>
                          ${s.notes ? `<div style="font-size:11px;color:var(--primary)">${s.notes.slice(0,20)}</div>` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      ${s.aadhaar ? `
                        <div style="font-family:monospace;font-size:12px;color:var(--text)">${aadhaarDisplay}</div>
                        <div style="font-size:10px;color:var(--success)"><i class="bi bi-shield-check-fill me-1"></i>Verified</div>
                      ` : '<span style="color:var(--text-muted);font-size:12px;">—</span>'}
                    </td>
                    <td><span class="badge-room">${room ? 'Room '+room.number : '—'}</span></td>
                    <td style="font-size:13px;">${s.phone}</td>
                    <td style="font-size:13px;">${formatDate(s.checkin)}</td>
                    <td>
                      <span class="status-badge ${s.checkedOut ? 'pending' : 'paid'}">
                        ${s.checkedOut ? 'Checked Out' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div class="d-flex gap-1">
                        ${s.photo ? `<button class="btn-icon" onclick="Students.viewPhoto('${s.id}')" title="View Photo"><i class="bi bi-person-bounding-box"></i></button>` : ''}
                        ${s.idProof ? `<button class="btn-icon" onclick="Students.viewId('${s.id}')" title="View ID (${s.idType||'ID'})"><i class="bi bi-card-image"></i></button>` : ''}
                        ${!s.photo && !s.idProof ? '<span style="font-size:11px;color:var(--text-muted)">None</span>' : ''}
                      </div>
                    </td>
                    <td>
                      <div class="d-flex gap-1">
                        <button class="btn-icon" onclick="Students.openModal('${s.id}')" title="Edit"><i class="bi bi-pencil-fill"></i></button>
                        ${!s.checkedOut ? `<button class="btn-icon" onclick="Students.checkout('${s.id}')" title="Checkout" style="color:#f39c12"><i class="bi bi-box-arrow-right"></i></button>` : ''}
                        <button class="btn-icon danger" onclick="Students.delete('${s.id}')" title="Delete"><i class="bi bi-trash-fill"></i></button>
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

  formatAadhaar(input) {
    // Auto-format as XXXX XXXX XXXX
    let val = input.value.replace(/\D/g, '').slice(0, 12);
    val = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    input.value = val;
    this.validateAadhaar(val.replace(/\s/g, ''));
  },

  validateAadhaar(digits) {
    const statusEl = document.getElementById('aadhaarStatus');
    const iconEl = document.getElementById('aadhaarIcon');
    if (!digits) {
      statusEl.textContent = '';
      statusEl.className = 'aadhaar-status';
      iconEl.className = 'aadhaar-icon';
      return false;
    }
    if (digits.length === 12 && /^\d{12}$/.test(digits)) {
      statusEl.textContent = '✓ Valid Aadhaar number';
      statusEl.className = 'aadhaar-status valid';
      iconEl.className = 'aadhaar-icon valid';
      return true;
    } else {
      statusEl.textContent = `${digits.length}/12 digits`;
      statusEl.className = 'aadhaar-status invalid';
      iconEl.className = 'aadhaar-icon invalid';
      return false;
    }
  },

  previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 500000) { showToast('Photo should be less than 500KB', 'warning'); }
    const reader = new FileReader();
    reader.onload = (e) => {
      this._photoData = e.target.result;
      const preview = document.getElementById('photoPreview');
      const placeholder = document.getElementById('photoPlaceholder');
      preview.src = e.target.result;
      preview.classList.remove('d-none');
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  },

  previewId(event) {
    const file = event.target.files[0];
    if (!file) return;
    const wrap = document.getElementById('idPreviewWrap');
    const preview = document.getElementById('idPreview');
    const fileName = document.getElementById('idFileName');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this._idData = e.target.result;
        preview.src = e.target.result;
        preview.style.display = 'block';
        wrap.classList.remove('d-none');
        if (fileName) fileName.textContent = file.name;
      };
      reader.readAsDataURL(file);
    } else {
      // PDF — store as base64 but no image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this._idData = e.target.result;
        preview.style.display = 'none';
        wrap.classList.remove('d-none');
        if (fileName) fileName.textContent = `📄 ${file.name}`;
      };
      reader.readAsDataURL(file);
    }
  },

  populateRoomSelect(selectedRoomId = null, studentId = null) {
    const sel = document.getElementById('studentRoom');
    // Get all rooms (for editing, show current room too)
    const allRooms = Rooms.getRooms();
    let options = allRooms.filter(r => {
      if (r.status === 'vacant') return true;
      if (studentId) {
        const s = this.getStudents().find(x => x.id === studentId);
        return s && s.roomId === r.id; // current room of this student
      }
      return false;
    });

    sel.innerHTML = options.length
      ? options.map(r => `<option value="${r.id}" ${r.id === selectedRoomId ? 'selected' : ''}>Room ${r.number} — ${r.type} (${formatCurrency(r.rent)}/mo) ${r.status === 'occupied' ? '★ Current' : '● Vacant'}</option>`).join('')
      : '<option value="">No rooms available</option>';
  },

  openModal(id = null) {
    this._idData = null;
    this._photoData = null;

    // Reset photo
    const photoPreview = document.getElementById('photoPreview');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    photoPreview.classList.add('d-none');
    photoPreview.src = '';
    photoPlaceholder.style.display = 'flex';
    document.getElementById('studentPhoto').value = '';

    // Reset ID
    document.getElementById('idPreviewWrap').classList.add('d-none');
    document.getElementById('idPreview').src = '';
    document.getElementById('idFileName').textContent = '';
    document.getElementById('studentIdProof').value = '';

    // Reset Aadhaar
    document.getElementById('aadhaarStatus').textContent = '';
    document.getElementById('aadhaarStatus').className = 'aadhaar-status';
    document.getElementById('aadhaarIcon').className = 'aadhaar-icon';

    if (id) {
      const s = this.getStudents().find(x => x.id === id);
      if (!s) return;
      document.getElementById('studentId').value = s.id;
      document.getElementById('studentName').value = s.name;
      document.getElementById('studentPhone').value = s.phone;
      document.getElementById('studentEmergency').value = s.emergency || '';
      document.getElementById('studentAddress').value = s.address || '';
      document.getElementById('studentAadhaar').value = s.aadhaar || '';
      document.getElementById('studentIdType').value = s.idType || 'Aadhaar';
      document.getElementById('studentNotes').value = s.notes || '';
      document.getElementById('studentCheckin').value = s.checkin || '';
      document.getElementById('studentCheckout').value = s.checkout || '';
      document.getElementById('studentDeposit').value = s.deposit || '';
      document.getElementById('studentModalTitle').textContent = 'Edit Student';
      this.populateRoomSelect(s.roomId, id);

      if (s.aadhaar) this.validateAadhaar(s.aadhaar.replace(/\s/g,''));

      if (s.photo) {
        this._photoData = s.photo;
        photoPreview.src = s.photo;
        photoPreview.classList.remove('d-none');
        photoPlaceholder.style.display = 'none';
      }
      if (s.idProof) {
        this._idData = s.idProof;
        const wrap = document.getElementById('idPreviewWrap');
        const preview = document.getElementById('idPreview');
        wrap.classList.remove('d-none');
        if (s.idProof.startsWith('data:image')) {
          preview.src = s.idProof;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
          document.getElementById('idFileName').textContent = '📄 ID Document uploaded';
        }
      }
    } else {
      document.getElementById('studentId').value = '';
      document.getElementById('studentName').value = '';
      document.getElementById('studentPhone').value = '';
      document.getElementById('studentEmergency').value = '';
      document.getElementById('studentAddress').value = '';
      document.getElementById('studentAadhaar').value = '';
      document.getElementById('studentIdType').value = 'Aadhaar';
      document.getElementById('studentNotes').value = '';
      document.getElementById('studentCheckin').value = new Date().toISOString().slice(0, 10);
      document.getElementById('studentCheckout').value = '';
      document.getElementById('studentDeposit').value = '';
      document.getElementById('studentModalTitle').textContent = 'Add Student';
      this.populateRoomSelect();
    }
    this._modal.show();
  },

  save() {
    const id = document.getElementById('studentId').value;
    const name = document.getElementById('studentName').value.trim();
    const phone = document.getElementById('studentPhone').value.trim();
    const emergency = document.getElementById('studentEmergency').value.trim();
    const address = document.getElementById('studentAddress').value.trim();
    const aadhaar = document.getElementById('studentAadhaar').value.trim();
    const idType = document.getElementById('studentIdType').value;
    const notes = document.getElementById('studentNotes').value.trim();
    const roomId = document.getElementById('studentRoom').value;
    const checkin = document.getElementById('studentCheckin').value;
    const checkout = document.getElementById('studentCheckout').value;
    const deposit = parseFloat(document.getElementById('studentDeposit').value) || 0;

    if (!name) { showToast('Student name is required', 'error'); return; }
    if (!phone) { showToast('Phone number is required', 'error'); return; }
    if (!roomId) { showToast('Please assign a room', 'error'); return; }
    if (!checkin) { showToast('Check-in date is required', 'error'); return; }

    // Aadhaar validation (optional but if entered must be 12 digits)
    if (aadhaar) {
      const digits = aadhaar.replace(/\s/g, '');
      if (digits.length !== 12 || !/^\d{12}$/.test(digits)) {
        showToast('Aadhaar must be exactly 12 digits', 'error'); return;
      }
    }

    const students = this.getStudents();

    const studentData = { name, phone, emergency, address, aadhaar, idType, notes, roomId, checkin, checkout, deposit,
      photo: this._photoData, idProof: this._idData, checkedOut: false };

    if (id) {
      const idx = students.findIndex(s => s.id === id);
      if (idx === -1) return;
      const old = students[idx];
      if (old.roomId && old.roomId !== roomId) Rooms.setVacant(old.roomId);
      students[idx] = { ...old, ...studentData };
      Rooms.setOccupied(roomId, id, name);
      showToast(`${name} updated`, 'success');
      Dashboard.addActivity(`Student ${name} updated`, 'student');
    } else {
      const newStudent = { id: genId(), ...studentData };
      students.push(newStudent);
      Rooms.setOccupied(roomId, newStudent.id, name);
      showToast(`${name} added`, 'success');
      Dashboard.addActivity(`${name} checked in`, 'student');
    }

    this.saveStudents(students);
    this._modal.hide();
    this.render();
    Dashboard.render();
  },

  checkout(id) {
    const students = this.getStudents();
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) return;
    if (!confirm(`Checkout ${students[idx].name}? Room will become vacant.`)) return;
    const s = students[idx];
    students[idx] = { ...s, checkedOut: true, checkout: new Date().toISOString().slice(0, 10) };
    if (s.roomId) Rooms.setVacant(s.roomId);
    this.saveStudents(students);
    showToast(`${s.name} checked out`, 'success');
    Dashboard.addActivity(`${s.name} checked out`, 'student');
    this.render();
    Dashboard.render();
  },

  delete(id) {
    const students = this.getStudents();
    const s = students.find(x => x.id === id);
    if (!s) return;
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    if (!s.checkedOut && s.roomId) Rooms.setVacant(s.roomId);
    this.saveStudents(students.filter(x => x.id !== id));
    showToast(`${s.name} deleted`, 'success');
    this.render();
    Dashboard.render();
  },

  viewPhoto(id) {
    const s = this.getStudents().find(x => x.id === id);
    if (!s || !s.photo) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${s.name} — Photo</title></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${s.photo}" style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 4px 30px rgba(0,0,0,0.5);"/></body></html>`);
  },

  viewId(id) {
    const s = this.getStudents().find(x => x.id === id);
    if (!s || !s.idProof) return;
    const w = window.open('', '_blank');
    if (s.idProof.startsWith('data:image')) {
      w.document.write(`<html><head><title>${s.name} — ${s.idType||'ID'}</title></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${s.idProof}" style="max-width:90vw;max-height:90vh;border-radius:8px;"/></body></html>`);
    } else {
      // PDF
      w.document.write(`<html><body style="margin:0;"><embed src="${s.idProof}" type="application/pdf" width="100%" height="100%" style="min-height:100vh;"/></body></html>`);
    }
  },

  getAll() { return this.getStudents(); },
  getActive() { return this.getStudents().filter(s => !s.checkedOut); },
  getById(id) { return this.getStudents().find(s => s.id === id); }
};
