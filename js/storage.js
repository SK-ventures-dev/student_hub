// ═══════════════════════════════════════════════════
// SUPABASE SETUP WIZARD
// ═══════════════════════════════════════════════════
const SupaSetup = {
  _url: '', _key: '',

  async test() {
    const url = document.getElementById('sbUrl').value.trim();
    const key = document.getElementById('sbKey').value.trim();
    if (!url || !key) { this._status('setupStatus1', 'URL aur Key dono daalo', 'err'); return; }
    const btn = document.getElementById('testBtn');
    btn.disabled = true; btn.textContent = '⏳ Testing…';
    this._status('setupStatus1', 'Supabase se connect ho raha hai…', 'info');
    try {
      const client = supabase.createClient(url, key);
      const { error } = await client.from('rooms').select('id').limit(1);
      if (error && error.code !== '42P01' && !error.message.includes('does not exist')) throw error;
      this._url = url; this._key = key;
      localStorage.setItem('sb_url', url);
      localStorage.setItem('sb_key', key);
      this._status('setupStatus1', '✓ Supabase se connected! Step 2 unlock ho gaya.', 'ok');
      // Unlock step 2
      document.getElementById('setupStep2').style.opacity = '1';
      document.getElementById('setupStep2').style.pointerEvents = 'auto';
    } catch(e) {
      this._status('setupStatus1', '✗ Connect nahi hua: ' + e.message, 'err');
    }
    btn.disabled = false; btn.textContent = '🔌 Test Connection';
  },

  async verify() {
    if (!this._url) { this._status('setupStatus2', 'Pehle Step 1 complete karo', 'err'); return; }
    const btn = document.getElementById('verifyBtn');
    btn.disabled = true; btn.textContent = '⏳ Checking…';
    this._status('setupStatus2', 'Tables check ho rahi hain…', 'info');
    try {
      const client = supabase.createClient(this._url, this._key);
      const tables = ['rooms','students','payments','elec_readings','complaints','activity_log'];
      const missing = [];
      for (const t of tables) {
        const { error } = await client.from(t).select('id').limit(1);
        if (error && (error.code === '42P01' || error.message.includes('does not exist'))) missing.push(t);
      }
      if (missing.length === 0) {
        this._status('setupStatus2', '✓ Sab 6 tables mil gayi! Step 3 unlock ho gaya.', 'ok');
        document.getElementById('setupStep3').style.opacity = '1';
        document.getElementById('setupStep3').style.pointerEvents = 'auto';
        document.getElementById('launchBtn').disabled = false;
      } else {
        this._status('setupStatus2', '✗ Ye tables nahi mili: ' + missing.join(', ') + ' — Upar wala SQL run karo pehle.', 'err');
      }
    } catch(e) { this._status('setupStatus2', 'Error: ' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '✅ Tables Already Created — Verify';
  },

  async launch() {
    const btn = document.getElementById('launchBtn');
    btn.disabled = true; btn.textContent = '⏳ Loading data…';
    SupaSync.init(this._url, this._key);
    await SupaSync.pullAll();
    document.getElementById('setupOverlay').style.display = 'none';
    App.boot();
  },

  skip() {
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
    document.getElementById('setupOverlay').style.display = 'none';
    App.boot();
  },

  copySQL() {
    const sql = document.getElementById('sqlBlock').textContent;
    navigator.clipboard.writeText(sql)
      .then(() => showToast('SQL copied to clipboard!', 'success'))
      .catch(() => { showToast('Copy failed — select manually', 'warning'); });
  },

  _status(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg; el.className = 'setup-status ' + type; el.style.display = 'block';
  }
};

// ═══════════════════════════════════════════════════
// SUPABASE SYNC ENGINE
// ═══════════════════════════════════════════════════
const SupaSync = {
  client: null,
  connected: false,

  // Map: localStorage key → supabase table
  TABLES: {
    rooms: 'rooms',
    students: 'students',
    payments: 'payments',
    elecReadings: 'elec_readings',
    complaints: 'complaints',
    activity: 'activity_log'
  },

  init(url, key) {
    try {
      this.client = supabase.createClient(url, key);
      this.connected = true;
      this._updateBar('synced', '☁️ Supabase Connected — All data syncing');
    } catch(e) {
      this.connected = false;
    }
  },

  _updateBar(state, text) {
    const bar = document.getElementById('syncBar');
    const dot = document.getElementById('syncDot');
    const lbl = document.getElementById('syncText');
    if (!bar) return;
    bar.style.display = 'flex';
    bar.className = 'sync-bar' + (state === 'offline' ? ' offline' : state === 'syncing' ? ' syncing' : '');
    dot.className = 'sync-dot' + (state === 'syncing' ? ' syncing' : '');
    lbl.textContent = text;
  },

  // Push a key's array data to Supabase as individual rows
  async push(key) {
    if (!this.client || !this.connected) return;
    const table = this.TABLES[key];
    if (!table) return;
    const data = DB.get(key, []);
    if (!Array.isArray(data) || !data.length) return;
    this._updateBar('syncing', '↑ Syncing ' + key + '…');
    try {
      const rows = data.map(item => ({
        id: item.id,
        data: item,
        updated_at: new Date().toISOString()
      }));
      const { error } = await this.client.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      this._updateBar('synced', '☁️ Synced ✓');
    } catch(e) {
      console.warn('SupaSync.push failed:', key, e.message);
      this._updateBar('offline', '⚠️ Sync error — Offline mode mein kaam kar raha hai');
    }
  },

  // Pull all data from Supabase on startup
  async pullAll() {
    if (!this.client || !this.connected) return false;
    this._updateBar('syncing', '↓ Cloud se data load ho raha hai…');
    let pulled = 0;
    for (const [key, table] of Object.entries(this.TABLES)) {
      try {
        const { data, error } = await this.client.from(table).select('data').order('updated_at', { ascending: false });
        if (error) throw error;
        if (data && data.length) {
          DB.setLocal(key, data.map(r => r.data));
          pulled++;
        }
      } catch(e) {
        console.warn('Pull failed:', key, e.message);
      }
    }
    if (pulled > 0) {
      this._updateBar('synced', '☁️ Cloud se ' + pulled + ' tables sync ho gayi ✓');
      return true;
    } else {
      this._updateBar('offline', '📱 Offline mode — LocalStorage data use ho raha hai');
      return false;
    }
  },

  // Delete a row from Supabase
  async deleteRow(key, id) {
    if (!this.client || !this.connected) return;
    const table = this.TABLES[key];
    if (!table) return;
    try {
      await this.client.from(table).delete().eq('id', id);
    } catch(e) {
      console.warn('Delete failed:', key, id, e.message);
    }
  },

  // Force sync all tables - called from sync button
  async forceSync() {
    if (!this.connected) { showToast('Supabase connected nahi hai', 'error'); return; }
    showToast('Sab data sync ho raha hai…', 'info');
    for (const key of Object.keys(this.TABLES)) {
      await this.push(key);
    }
    showToast('✓ Sab data sync ho gaya!', 'success');
  }
};


// ═══════════════════════════════════════════════════
//   — Modified for Supabase (LocalStorage + Cloud)
// ONLY CHANGE: DB.set() now auto-pushes to Supabase
//              DB.setLocal() sets without cloud push (for pullAll)
// ═══════════════════════════════════════════════════

const DB = {
  PREFIX: 'Tannu_',

  // Read from LocalStorage (instant)
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(this.PREFIX + key);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },

  // Write to LocalStorage + push to Supabase (background)
  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      // Auto-push to Supabase in background (non-blocking)
      if (typeof SupaSync !== 'undefined' && SupaSync.connected) {
        SupaSync.push(key);
      }
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  },

  // Write to LocalStorage ONLY — used by SupaSync.pullAll() to avoid circular push
  setLocal(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
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

// Utility functions
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

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

function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
