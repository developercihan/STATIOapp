let csrfToken = '';
let currentUser = null;

async function initSession() {
    try {
        const r = await fetch('/api/auth/me');
        if (!r.ok) { window.location.href = '/login.html'; return null; }
        const d = await r.json();
        csrfToken = d.csrfToken;
        currentUser = d.user;
        
        // Update Profile Elements
        const initial = document.getElementById('user-initial');
        const name = document.getElementById('user-display-name');
        const role = document.getElementById('user-display-role');
        
        if(initial) initial.textContent = currentUser.displayName.charAt(0).toUpperCase();
        if(name) name.textContent = currentUser.displayName.toUpperCase();
        if(role) role.textContent = currentUser.role.toUpperCase();

        return d.user;
    } catch(e) { window.location.href = '/login.html'; return null; }
}

window.toggleProfileMenu = function(e) {
    if(e) e.stopPropagation();
    document.getElementById('profile-dropdown').classList.toggle('active');
}

// Global click to close profile menu
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown');
    const trigger = document.querySelector('.profile-trigger');
    if (dropdown && dropdown.classList.contains('active') && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

async function logout() {
    await fetch('/api/auth/logout');
    window.location.href = '/login.html';
}

async function api(method, path, body) {
    const opts = { method, headers:{ 'Content-Type':'application/json', 'X-CSRF-Token': csrfToken } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    let data;
    try { data = await r.json(); } catch(e) { data = {}; }
    if (!r.ok) throw new Error(data.error || 'API Hatası');
    return data;
}

function showToast(msg, type='success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)';
    t.style.boxShadow = type === 'error' ? '0 0 15px rgba(255,51,102,0.3)' : '0 0 15px rgba(0,243,255,0.3)';
    t.innerHTML = `<b>${type==='error'?'UYARI:':'BİLGİ:'}</b> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(()=>t.remove(),300); }, 3000);
}

function getStatusBadge(status) {
    switch(status) {
        case 'YENI': return '<span class="badge badge-warning">YENİ SİNYAL</span>';
        case 'ATANDI': return '<span class="badge" style="background:var(--neon-cyan); color:#000;">HANGARA ATANDI</span>';
        case 'HAZIRLANIYOR': return '<span class="badge" style="background:#ff9800;">HAZIRLANIYOR</span>';
        case 'KARGODA': return '<span class="badge" style="background:#2196f3;">YOLA ÇIKTI</span>';
        case 'TESLIM_EDILDI': return '<span class="badge badge-success">MİSYON TAMAM</span>';
        case 'IPTAL_EDILDI': return '<span class="badge badge-danger">İPTAL EDİLDİ</span>';
        default: return `<span class="badge">${status}</span>`;
    }
}

async function loadOrders() {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Radar taranıyor...</td></tr>';
    
    try {
        const statusFilter = document.getElementById('filter-status').value;
        let url = '/api/orders';
        if(statusFilter) url += `?status=${statusFilter}`;
        
        const orders = await api('GET', url);
        
        tbody.innerHTML = '';
        if(orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">Radar temiz, sinyal yok.</td></tr>';
            return;
        }
        
        orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(o => {
            tbody.innerHTML += `
                <tr style="cursor:pointer;" onclick="if(event.target.tagName !== 'BUTTON') viewOrderDetails('${o.id}')">
                    <td style="font-family:var(--font-heading); color:var(--neon-cyan);">${o.id}</td>
                    <td>${o.distributorCode}</td>
                    <td>${o.companyCode}</td>
                    <td style="font-family:var(--font-heading);">${(o.totalAmount || 0).toFixed(2)} ₺</td>
                    <td>${getStatusBadge(o.status)}</td>
                    <td>${new Date(o.createdAt).toLocaleString('tr-TR')}</td>
                    <td>
                        <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="event.stopPropagation(); window.open('/api/orders/${o.id}/pdf')">Özet (PDF)</button>
                    </td>
                </tr>
            `;
        });
    } catch(e) {
        showToast(e.message, 'error');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--neon-red);">Radar arızası (Ağ Hatası).</td></tr>';
    }
}

window.viewOrderDetails = async function(id) {
    try {
        const order = await api('GET', `/api/orders/${id}`);
        document.getElementById('order-modal').classList.add('active');
        document.getElementById('modal-title').textContent = `SİPARİŞ DETAYLARI: ${order.id}`;
        
        let cargoInfo = '';
        if(order.status === 'KARGODA' && order.cargoDetail) {
            cargoInfo = `
                <div class="glass-card" style="margin-bottom:15px; padding:12px; border-color:var(--neon-cyan);">
                    <small style="color:var(--neon-cyan); display:block; margin-bottom:4px;">LOJİSTİK / KARGO BİLGİSİ</small>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b>${order.cargoDetail.company}</b>
                        <span style="color:var(--text-secondary);">Takip: <b style="color:#fff;">${order.cargoDetail.trackingCode}</b></span>
                    </div>
                </div>
            `;
        }

        document.getElementById('modal-body').innerHTML = `
            <div style="margin-bottom:15px; display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; font-size:0.85em;">
                <div class="glass-card" style="padding:10px; border-color:var(--neon-cyan);">
                    <small style="color:var(--text-secondary); display:block; margin-bottom:4px;">KURUM</small>
                    <b style="color:var(--neon-cyan);">${order.companyCode}</b>
                </div>
                <div class="glass-card" style="padding:10px; border-color:var(--neon-purple);">
                    <small style="color:var(--text-secondary); display:block; margin-bottom:4px;">TARİH</small>
                    <b>${new Date(order.createdAt).toLocaleString('tr-TR')}</b>
                </div>
                <div class="glass-card" style="padding:10px; border-color:var(--neon-pink);">
                    <small style="color:var(--text-secondary); display:block; margin-bottom:4px;">TİP</small>
                    <b>${order.orderType || 'SİPARİŞ'}</b>
                </div>
                <div class="glass-card" style="padding:10px; border-color:var(--neon-green);">
                    <small style="color:var(--text-secondary); display:block; margin-bottom:4px;">DURUM</small>
                    <b>${order.status}</b>
                </div>
            </div>

            ${cargoInfo}
            
            <div class="glass-card" style="margin-bottom:15px; padding:10px; border-color:var(--glass-border);">
                <small style="color:var(--text-secondary); display:block; margin-bottom:8px;">SİPARİŞ NOTLARI</small>
                <div style="padding:5px; color:var(--text-primary);">${order.notes || 'Sistem notu bulunamadı.'}</div>
            </div>

            <div style="border: 1px solid var(--glass-border); border-radius:8px; overflow:hidden;">
                <table class="data-table" style="margin:0; border-radius:0;">
                    <thead style="position:sticky; top:0; z-index:10; background:var(--bg-space-light);">
                        <tr>
                            <th style="padding:10px; font-size:0.75em;">KOD</th>
                            <th style="padding:10px; font-size:0.75em;">AD</th>
                            <th style="padding:10px; font-size:0.75em; text-align:right;">B.FİYAT (H)</th>
                            <th style="padding:10px; font-size:0.75em; text-align:right;">KDV%</th>
                            <th style="padding:10px; font-size:0.75em; text-align:right;">İSK%</th>
                            <th style="padding:10px; font-size:0.75em; text-align:center;">ADET</th>
                            <th style="padding:10px; font-size:0.75em; text-align:right;">TUTAR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(i => {
                            const pExcl = parseFloat(i.priceExclTax) || 0;
                            const tRate = parseFloat(i.taxRate) || 0;
                            const dRate = parseFloat(i.discountRate) || 0;
                            const q = parseInt(i.qty) || parseInt(i.miktar) || 0;
                            const rowTotal = pExcl * q * (1 - dRate/100) * (1 + tRate/100);
                            return `
                                <tr>
                                    <td style="padding:10px;"><div style="color:var(--neon-cyan); font-weight:600; font-size:0.85em;">${i.code}</div></td>
                                    <td style="padding:10px; font-size:0.85em; color:var(--text-secondary);">${i.name}</td>
                                    <td style="padding:10px; text-align:right; font-size:0.85em;">${pExcl.toFixed(2)} TL</td>
                                    <td style="padding:10px; text-align:right; font-size:0.85em;">%${tRate}</td>
                                    <td style="padding:10px; text-align:right; font-size:0.85em;">%${dRate}</td>
                                    <td style="padding:10px; text-align:center;"><b style="color:var(--neon-purple);">${q}</b></td>
                                    <td style="padding:10px; text-align:right; font-size:0.85em; font-weight:bold; color:var(--neon-green);">${rowTotal.toFixed(2)} TL</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="glass-card" style="margin-top:15px; padding:15px; border-color:var(--neon-purple);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em; color:var(--text-secondary);"><span>Ara Toplam (KDV Hariç):</span> <span>${(order.totalAmount || 0).toFixed(2)} TL</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em; color:var(--text-secondary);"><span>KDV Toplamı:</span> <span>${(order.totalTax || 0).toFixed(2)} TL</span></div>
                <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;">
                <div style="display:flex; justify-content:space-between; font-size:1.2em; font-weight:bold; color:var(--neon-green);"><span>Genel Toplam:</span> <span>${(order.finalAmount || 0).toFixed(2)} TL</span></div>
            </div>
        `;
    } catch(e) { showToast(e.message, 'error'); }
}

window.closeModal = function() {
    document.getElementById('order-modal').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await initSession();
    if(user) {
        loadOrders();
    }
});
