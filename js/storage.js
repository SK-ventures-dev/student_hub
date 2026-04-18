// storage.js — LocalStorage abstraction layer

const DB = {
  PREFIX: 'Tannu_',

  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(this.PREFIX + key);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  all() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this.PREFIX)) {
        const cleanKey = k.replace(this.PREFIX, '');
        try { data[cleanKey] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    }
    return data;
  },

  clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this.PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
};

// Backup & Restore
const Backup = {
  exportData() {
    const data = DB.all();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Tannu_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast('Backup exported successfully!', 'success');
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        Object.entries(data).forEach(([k, v]) => DB.set(k, v));
        showToast('Data restored successfully!', 'success');
        setTimeout(() => location.reload(), 800);
      } catch {
        showToast('Invalid backup file!', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
};

// ID generator
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Toast notification
function showToast(msg, type = 'info') {
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
  const colors = { success: '#2ecc71', error: '#e74c3c', warning: '#f39c12', info: '#3498db' };
  const div = document.createElement('div');
  div.className = `hos-toast ${type}`;
  div.innerHTML = `<i class="bi ${icons[type]} hos-toast-icon" style="color:${colors[type]}"></i><span class="hos-toast-msg">${msg}</span>`;
  const container = document.getElementById('toastContainer');
  container.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }, 3000);
}

// Format currency
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

// Format date
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Get current month as YYYY-MM
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
