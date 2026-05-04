let csrfToken = '';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session & Security
    try {
        const me = await (await fetch('/api/auth/me')).json();
        csrfToken = me.csrfToken;
        if (me.user.role !== 'superadmin') { window.location.href = '/login.html'; return; }
    } catch(e) { window.location.href = '/login.html'; return; }

    // 2. Initial Load
    refreshDashboard();

    // 3. Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const section = item.dataset.section;
            if(!section) return;
            e.preventDefault();
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            ['dashboardSection','tenantsSection','usersSection','masterdataSection'].forEach(s => {
                const el = document.getElementById(s);
                if(el) el.style.display = 'none';
            });
            
            const target = document.getElementById(section + 'Section');
            if(target) target.style.display = 'block';

            if (section === 'dashboard') refreshDashboard();
            if (section === 'tenants') loadTenants();
            if (section === 'users') loadAllUsers();
            if (section === 'masterdata') loadMasterData();
        });
    });
});

async function createTenant(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('t-name').value,
        officialName: document.getElementById('t-officialName').value,
        taxOffice: document.getElementById('t-taxOffice').value,
        taxNumber: document.getElementById('t-taxNumber').value,
        address: document.getElementById('t-address').value,
        phone: document.getElementById('t-phone').value,
        ownerEmail: document.getElementById('t-email').value,
        ownerUsername: document.getElementById('t-username').value,
        ownerPassword: document.getElementById('t-password').value
    };

    try {
        const res = await fetch('/api/superadmin/add-tenant', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'X-CSRF-Token': csrfToken 
            },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if(res.ok) {
            alert('Mağaza başarıyla kuruldu!');
            closeModal('addTenantModal');
            loadTenants();
            refreshDashboard();
        } else {
            alert(result.error || 'Hata oluştu');
        }
    } catch(err) { alert('Sistem hatası'); }
}

async function refreshDashboard() {
    try {
        const dashboardRes = await fetch('/api/superadmin/dashboard');
        if (!dashboardRes.ok) throw new Error('Dashboard verisi alınamadı');
        const res = await dashboardRes.json();

        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        
        setVal('stat-tenants', res.totalTenants || 0);
        setVal('stat-pending', res.pendingTenants || 0);
        setVal('stat-orders', res.totalOrders || 0);
        setVal('stat-revenue', '₺' + (res.totalRevenue || 0).toLocaleString('tr-TR'));
        setVal('stat-my-profit', '₺' + (res.subscriptionRevenue || 0).toLocaleString('tr-TR'));
        
        if(res.tenantStats) renderDashboardTenants(res.tenantStats);
        
        try {
            const topRes = await (await fetch('/api/superadmin/analytics/top-products')).json();
            renderTopProducts(topRes);
        } catch(e) {}

        try {
            const accRes = await (await fetch('/api/superadmin/analytics/accounting')).json();
            renderAccounting(accRes);
        } catch(e) {}

        const subtitle = document.getElementById('dashboardSubtitle');
        if(subtitle) subtitle.textContent = `${res.totalTenants} mağaza, ${res.totalOrders} sipariş aktif.`;

    } catch(e) { 
        console.error('Dashboard Error:', e);
        showNotif('Dashboard yüklenemedi: ' + e.message, 'error');
    }
}

function renderDashboardTenants(tenants) {
    const tbody = document.getElementById('dashboardTenantBody');
    if(!tbody) return;
    tbody.innerHTML = tenants.map(t => `
        <tr>
            <td style="font-weight:800; color:var(--gold);">${t.id}</td>
            <td style="font-weight:600;">${t.name}</td>
            <td><span class="status-badge" style="background:rgba(212,175,55,0.1); color:var(--gold);">${t.category || 'Genel'}</span></td>
            <td><span class="status-badge ${t.status==='active'?'status-active':'status-suspended'}">${t.status==='active'?'Aktif':'Askıda'}</span></td>
            <td style="font-weight:700;">₺${(t.revenue || 0).toLocaleString('tr-TR')}</td>
            <td style="text-align:right;">
                ${t.status === 'pending_approval' ? 
                    `<button class="action-btn" style="border-color:var(--accent-green); color:var(--accent-green);" onclick="approveTenant('${t.id}')">✅ Onayla</button>` : 
                    `<button class="action-btn" onclick="manageTenant('${t.id}')">🚀 Yönet</button>`
                }
            </td>
        </tr>
    `).join('');
}

function renderTopProducts(products) {
    const tbody = document.getElementById('topProductsBody');
    if(!tbody) return;
    tbody.innerHTML = products.map(p => `
        <tr>
            <td style="font-weight:600;">${p.name}</td>
            <td style="text-align:right; font-weight:800; color:var(--gold);">${p.qty} Adet</td>
        </tr>
    `).join('');
}

function renderAccounting(data) {
    const tbody = document.getElementById('accountingBody');
    if(!tbody || !data.tenantBalances) return;
    tbody.innerHTML = data.tenantBalances.map(t => `
        <tr>
            <td style="font-weight:600;">${t.name}</td>
            <td style="text-align:right; font-weight:800; color:var(--accent-green);">₺${t.balance.toLocaleString('tr-TR')}</td>
        </tr>
    `).join('');
}

async function loadTenants() {
    const tenants = await (await fetch('/api/superadmin/tenants')).json();
    const tbody = document.getElementById('tenantBody');
    if(!tbody) return;
    
    tbody.innerHTML = tenants.map(t => `
        <tr>
            <td style="font-weight:800; color:var(--gold);">${t.id}</td>
            <td style="font-weight:600;">${t.name}</td>
            <td><span class="status-badge" style="background:rgba(212,175,55,0.1); color:var(--gold);">${t.category || 'Genel'}</span></td>
            <td><span style="font-size:0.8rem; font-weight:700; text-transform:uppercase;">${t.plan || 'basic'}</span></td>
            <td><span class="status-badge ${t.status==='active'?'status-active':(t.status==='pending_approval'?'status-pending':'status-suspended')}">${t.status==='active'?'Aktif':(t.status==='pending_approval'?'Bekliyor':'Askıda')}</span></td>
            <td style="text-align:right;">
                ${t.status === 'pending_approval' ? 
                    `<button class="action-btn" style="border-color:var(--accent-green); color:var(--accent-green);" onclick="approveTenant('${t.id}')">✅ Onayla</button>` : 
                    `<button class="action-btn" onclick="openEditTenantModal('${t.id}')">⚙️ Düzenle</button>`
                }
                <button class="action-btn" style="border-color:var(--gold);" onclick="manageTenant('${t.id}')">🚀 Yönet</button>
            </td>
        </tr>
    `).join('');
}

async function openEditTenantModal(tenantId) {
    const tenants = await (await fetch('/api/superadmin/tenants')).json();
    const t = tenants.find(x => x.id === tenantId);
    if (!t) return;

    document.getElementById('editTenantId').value = t.id;
    document.getElementById('e-name').value = t.name || '';
    document.getElementById('e-officialName').value = t.officialName || '';
    document.getElementById('e-taxOffice').value = t.taxOffice || '';
    document.getElementById('e-taxNumber').value = t.taxNumber || '';
    document.getElementById('e-address').value = t.address || '';
    document.getElementById('e-phone').value = t.phone || '';
    document.getElementById('editTenantCategory').value = t.category || 'Kırtasiye';
    document.getElementById('editTenantPlan').value = t.plan || 'basic';
    document.getElementById('e-extendDays').value = 0;

    openModal('editTenantModal');
}

async function updateTenant(e) {
    e.preventDefault();
    const data = {
        tenantId: document.getElementById('editTenantId').value,
        name: document.getElementById('e-name').value,
        officialName: document.getElementById('e-officialName').value,
        taxOffice: document.getElementById('e-taxOffice').value,
        taxNumber: document.getElementById('e-taxNumber').value,
        address: document.getElementById('e-address').value,
        phone: document.getElementById('e-phone').value,
        category: document.getElementById('editTenantCategory').value,
        plan: document.getElementById('editTenantPlan').value,
        extendDays: parseInt(document.getElementById('e-extendDays').value) || 0
    };

    try {
        const res = await fetch('/api/superadmin/update-tenant', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken 
            },
            body: JSON.stringify(data)
        });
        if(res.ok) {
            showNotif('✅ Mağaza başarıyla güncellendi');
            closeModal('editTenantModal');
            loadTenants();
            refreshDashboard();
        } else {
            showNotif('❌ Güncelleme başarısız', 'error');
        }
    } catch(err) {
        showNotif('❌ Sistem hatası', 'error');
    }
}

async function apiFetch(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bilinmeyen hata');
    return data;
}

async function manageTenant(id) {
    const res = await apiFetch('POST', `/api/superadmin/switch-tenant/${id}`, {});
    if (res.tenantId) window.location.href = '/admin.html';
}

async function approveTenant(tenantId) {
    if(!confirm('Bu mağazayı onaylamak ve aktifleştirmek istediğinize emin misiniz?')) return;
    try {
        const res = await apiFetch('POST', '/api/superadmin/approve-tenant', { tenantId });
        showNotif('✅ ' + res.message);
        loadTenants();
        refreshDashboard();
    } catch(err) {
        showNotif('❌ Onay hatası: ' + err.message, 'error');
    }
}

function showNotif(msg, type='success') {
    const n = document.createElement('div');
    n.style.cssText = `position:fixed;top:20px;right:20px;z-index:9999;padding:16px 24px;border-radius:12px;font-weight:700;background:#17171c;border:1px solid ${type==='error'?'#f43f5e':'#d4af37'};color:#fff;box-shadow:0 10px 40px rgba(0,0,0,0.5);`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity='0'; setTimeout(()=>n.remove(),300); }, 3000);
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex'; 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'none'; 
}

async function loadMasterData() {
    loadGlobalOrderedProducts();
    loadGlobalCompanies();
}

async function loadGlobalOrderedProducts() {
    const res = await fetch('/api/superadmin/global-ordered-products');
    const products = await res.json();
    const tbody = document.getElementById('masterProductsBody');
    if(!tbody) return;
    tbody.innerHTML = products.map(p => `
        <tr onclick="showProductDetail('${p.tenantName}', '${p.code}', '${p.name}')" style="cursor:pointer;">
            <td style="color:var(--gold); font-weight:700;">${p.tenantName}</td>
            <td style="font-size:0.85rem; font-weight:700; color:var(--accent-blue);">${new Date(p.date || Date.now()).toLocaleDateString('tr-TR')}</td>
            <td style="font-weight:600;">${p.name}</td>
            <td style="text-align:right; font-weight:800; color:var(--gold); font-size:1rem;">${p.qty} Adet</td>
        </tr>
    `).join('');
}

async function loadGlobalCompanies() {
    const res = await fetch('/api/superadmin/global-companies');
    const comps = await res.json();
    const tbody = document.getElementById('masterCompaniesBody');
    if(!tbody) return;
    tbody.innerHTML = comps.map(c => `
        <tr onclick='showCompanyDetail(${JSON.stringify(c).replace(/'/g, "&apos;")})' style="cursor:pointer;">
            <td style="color:var(--gold); font-weight:700; font-size:0.75rem;">${c.tenantName}</td>
            <td style="font-weight:600;">${c.name}</td>
            <td style="font-size:0.85rem;">${c.phone || '-'}</td>
            <td style="font-size:0.75rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.address || '-'}">${c.address || '-'}</td>
            <td style="font-size:0.85rem;">${c.email || '-'}</td>
            <td style="font-size:0.85rem; font-weight:700;">${c.taxNumber || '-'}</td>
            <td style="text-align:right; font-weight:800; color:var(--accent-green);">%${c.discountRate || 0}</td>
        </tr>
    `).join('');
}

async function showProductDetail(tenantId, code, name) {
    const detailTitle = document.getElementById('detailTitle');
    const detailContent = document.getElementById('detailContent');
    detailTitle.textContent = "📦 Ürün Analizi";
    detailContent.innerHTML = `
        <div style="background:rgba(212,175,55,0.05); padding:1rem; border-radius:12px; margin-bottom:1rem;">
            <p><strong>Ürün:</strong> ${name}</p>
            <p><strong>Kod:</strong> ${code}</p>
            <p><strong>Mağaza:</strong> ${tenantId}</p>
        </div>
    `;
    openModal('detailModal');
}

async function showCompanyDetail(c) {
    const detailTitle = document.getElementById('detailTitle');
    const detailContent = document.getElementById('detailContent');
    detailTitle.textContent = "🏢 Kurumsal Cari Detayı";
    detailContent.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; background:rgba(212,175,55,0.05); padding:1rem; border-radius:12px;">
            <p><strong>Cari Kod:</strong> ${c.code}</p>
            <p><strong>Mağaza:</strong> ${c.tenantName}</p>
            <p style="grid-column: span 2;"><strong>Ticari Unvan:</strong> ${c.name}</p>
            <p><strong>Vergi Dairesi:</strong> ${c.taxOffice || '-'}</p>
            <p><strong>Vergi No:</strong> ${c.taxNumber || '-'}</p>
            <p style="grid-column: span 2;"><strong>Adres:</strong> ${c.address || '-'}</p>
            <p><strong>Tel:</strong> ${c.phone || '-'}</p>
            <p><strong>E-Posta:</strong> ${c.email || '-'}</p>
            <p><strong>İskonto:</strong> %${c.discountRate || 0}</p>
        </div>
    `;
    openModal('detailModal');
}

function switchMasterData(view, btn) {
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('masterProductsView').style.display = view === 'products' ? 'block' : 'none';
    document.getElementById('masterCompaniesView').style.display = view === 'companies' ? 'block' : 'none';
}

function handleMasterSearch(val) {
    filterTable('masterProductsBody', val);
    filterTable('masterCompaniesBody', val);
}

async function loadAllUsers() {
    const users = await (await fetch('/api/superadmin/users')).json();
    const tbody = document.getElementById('usersBody');
    if(!tbody) return;
    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="font-weight:600;">${u.username}</td>
            <td>${u.displayName}</td>
            <td style="font-weight:700; color:var(--gold);">${u.tenantId || 'SİSTEM'}</td>
            <td style="text-transform:uppercase; font-size:0.75rem;">${u.role}</td>
            <td><span class="status-badge ${u.isActive ? 'status-active' : 'status-suspended'}">${u.isActive ? 'Aktif' : 'Pasif'}</span></td>
        </tr>
    `).join('');
}

function filterTable(id, val) {
    const tbody = document.getElementById(id);
    if(!tbody) return;
    const rows = tbody.getElementsByTagName('tr');
    val = val.toLowerCase();
    for(let i=0; i<rows.length; i++) {
        rows[i].style.display = rows[i].innerText.toLowerCase().includes(val) ? '' : 'none';
    }
}
