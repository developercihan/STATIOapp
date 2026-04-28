console.log('KIRTASIYE_OS_ADMIN_V2_LOADED');
let csrfToken = '';
let currentUser = null;

async function initSession() {
    try {
        const r = await fetch('/api/auth/me');
        if (!r.ok) { window.location.href = '/login.html'; return null; }
        const d = await r.json();
        csrfToken = d.csrfToken;
        currentUser = d.user;
        if(currentUser.role !== 'admin' && currentUser.role !== 'superadmin' && currentUser.role !== 'warehouse') {
            window.location.href = '/404.html';
        }
        
        // Update Profile Elements
        const initial = document.getElementById('user-initial');
        const name = document.getElementById('user-display-name');
        const role = document.getElementById('user-display-role');
        
        if(initial) initial.textContent = currentUser.displayName.charAt(0).toUpperCase();
        if(name) name.textContent = currentUser.displayName.toUpperCase();
        if(role) role.textContent = currentUser.role.toUpperCase();

        // Super Admin için gizli geri dönüş bağlantısı
        if(currentUser.role === 'superadmin') {
            const dropdown = document.getElementById('profile-dropdown');
            if (dropdown) {
                const sysLink = document.createElement('a');
                sysLink.href = '/superadmin.html';
                sysLink.style.cssText = 'border-top:1px solid rgba(255,255,255,0.05); color:var(--text-dim); font-size:0.8rem;';
                sysLink.textContent = 'Sistem Yönetimi';
                dropdown.appendChild(sysLink);
            }
        }

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

async function adminApi(method, path, body) {
    const opts = { method, headers:{ 'Content-Type':'application/json', 'X-CSRF-Token': csrfToken } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    let data;
    try { data = await r.json(); } catch(e) { data = {}; }
    if (!r.ok) throw new Error(data.error || 'İşlem Başarısız');
    return data;
}

function showToast(msg, type='success') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    // Limit active toasts to 5
    if (container.children.length >= 5) {
        container.children[0].remove();
    }

    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)';
    t.innerHTML = `<b>${type==='error'?'HATA:':'BİLGİ:'}</b> ${msg}`;
    container.appendChild(t);

    // Reduced duration from 3s to 1.5s
    setTimeout(() => { 
        t.style.opacity = '0'; 
        t.style.transform = 'translateX(20px)';
        setTimeout(()=>t.remove(), 300); 
    }, 1500); 
}

window.formatCurrency = function(val) {
    return (new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)) + ' ₺';
}

// --- LIGHTBOX / ZOOM ---
window.openLightbox = function(src) {
    let lb = document.getElementById('lightbox-overlay');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'lightbox-overlay';
        lb.className = 'lightbox-overlay';
        lb.innerHTML = `
            <button class="lightbox-close" onclick="this.parentElement.classList.remove('active')">KAPAT</button>
            <img class="lightbox-content" id="lightbox-img" onclick="this.classList.toggle('zoomed')">
        `;
        document.body.appendChild(lb);
    }
    const img = document.getElementById('lightbox-img');
    img.src = src;
    img.classList.remove('zoomed');
    lb.classList.add('active');
}

function switchTab(event) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    const targetId = event.currentTarget.getAttribute('data-target');
    const content = document.getElementById('main-content');
    content.innerHTML = `<div style="text-align:center; padding: 50px;"><h2>VERİLER ALINIYOR...</h2><div class="glow-pulse" style="width:40px; height:40px; border:2px solid var(--neon-cyan); border-radius:50%; margin: 20px auto; border-top-color:transparent; animation: rotate 1s linear infinite;"></div></div>`;
    
    if(targetId === 'dashboard') renderDashboardTab();
    else if(targetId === 'orders') renderOrdersTab();
    else if(targetId === 'products') renderProductsTab();
    else if(targetId === 'distributors') renderDistributorsTab();
    else if(targetId === 'companies') renderCompaniesTab();
    else if(targetId === 'users') renderUsersTab();
    else if(targetId === 'xml') renderXmlTab();
    else if(targetId === 'warehouses') renderWarehousesTab();
    else if(targetId === 'receivables') renderReceivablesTab();
    else if(targetId === 'cash') renderCashTab();
    else if(targetId === 'subscription') renderSubscriptionTab();
    else if(targetId === 'backup') renderBackupTab();
    else renderDashboardTab(); // Default
}

// --- DASHBOARD ---
async function renderDashboardTab() {
    try {
        const stats = await adminApi('GET', '/api/stats/dashboard');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand">📊 Yönetici Paneli & Analiz</h2>
                <div style="font-size:0.8em; color:var(--text-secondary);">Son Güncelleme: ${new Date().toLocaleTimeString()}</div>
            </div>

            <div class="stats-grid">
                <div class="stat-card glass-card" onclick="showAllOrdersStats('SIPARIS')" style="cursor:pointer;">
                    <div class="stat-label">Toplam Satış</div>
                    <div class="stat-value">${stats.totalSalesAmount.toLocaleString('tr-TR')} TL</div>
                </div>
                <div class="stat-card glass-card" onclick="showAllOrdersStats('SIPARIS')" style="cursor:pointer;">
                    <div class="stat-label">Toplam Sipariş</div>
                    <div class="stat-value">${stats.totalOrders}</div>
                </div>
                <div class="stat-card glass-card" onclick="showAllOrdersStats('NUMUNE')" style="cursor:pointer;">
                    <div class="stat-label">Gönderilen Numune</div>
                    <div class="stat-value">${stats.totalSamples}</div>
                </div>
                <div class="stat-card glass-card" onclick="showSoldProductsStats()" style="cursor:pointer;">
                    <div class="stat-label">Satılan Ürün Adedi</div>
                    <div class="stat-value">${stats.totalItemsSold}</div>
                </div>
            </div>

            <div class="chart-container glass-card">
                <h3 class="brand" style="font-size:1.1em; margin-bottom:20px;">📈 Günlük Satış Trendi</h3>
                <canvas id="salesChart" style="max-height:300px;"></canvas>
            </div>

            <div class="dashboard-row">
                <div class="glass-card">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:15px;">🏆 En Çok Satan 10 Ürün</h3>
                    <table class="data-table" style="font-size:0.9em;">
                        <thead><tr><th>Ürün</th><th style="text-align:right;">Adet</th></tr></thead>
                        <tbody>
                            ${stats.topProducts.map(p => `<tr onclick="showProductStatsDetail('${p.code}', '${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;"><td>${p.name}</td><td style="text-align:right; font-weight:bold; color:var(--neon-cyan);">${p.qty}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="glass-card">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:15px;">💰 En Çok Satış Yapılan Cariler</h3>
                    <table class="data-table" style="font-size:0.9em;">
                        <thead><tr><th>Kurum</th><th style="text-align:right;">Tutar</th></tr></thead>
                        <tbody>
                            ${stats.topCompanies.map(c => `<tr onclick="showCompanyStatsDetail('${c.code}', '${c.name.replace(/'/g, "\\'")}')" style="cursor:pointer;"><td>${c.name}</td><td style="text-align:right; font-weight:bold; color:var(--neon-green);">${c.amount.toLocaleString('tr-TR')} TL</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dashboard-row" style="margin-top:20px;">
                <div class="glass-card" style="border-color:var(--neon-red);">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:15px; color:var(--neon-red);">⚠️ Kritik Stok Uyarıları</h3>
                    <table class="data-table" style="font-size:0.9em;">
                        <thead><tr><th>Ürün</th><th>Mevcut</th><th style="text-align:right;">Min.</th></tr></thead>
                        <tbody>
                            ${stats.criticalStock.map(p => `<tr>
                                <td>${p.name}</td>
                                <td style="font-weight:bold; color:var(--neon-red);">${p.stock}</td>
                                <td style="text-align:right; opacity:0.7;">${p.minStock}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    ${stats.criticalStock.length === 0 ? '<p style="text-align:center; padding:10px; opacity:0.6;">Kritik stokta ürün yok.</p>' : ''}
                </div>
                <div class="glass-card">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:15px;">🎁 En Çok Numune Alan Kurumlar</h3>
                    <table class="data-table" style="font-size:0.9em;">
                        <thead><tr><th>Kurum</th><th style="text-align:right;">Numune Sayısı</th></tr></thead>
                        <tbody>
                            ${stats.topSampleCompanies.map(c => `<tr onclick="showCompanyStatsDetail('${c.code}', '${c.name.replace(/'/g, "\\'")}')" style="cursor:pointer;"><td>${c.name}</td><td style="text-align:right; font-weight:bold; color:var(--neon-purple);">${c.count}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
                <div class="glass-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; margin-top:20px;">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:15px;">Hızlı Özet</h3>
                    <p style="color:var(--text-secondary); max-width:300px;">
                        Sistemde kayıtlı ${stats.totalOrders} sipariş üzerinden yapılan analiz sonuçlarıdır. 
                        Tüm veriler gerçek zamanlı olarak güncellenmektedir.
                    </p>
                    <button class="btn" style="margin-top:20px; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="renderDashboardTab()">🔄 Verileri Yenile</button>
                </div>
        `;
        
        document.getElementById('main-content').innerHTML = html;

        // Initialize Chart
        setTimeout(() => {
            const ctx = document.getElementById('salesChart').getContext('2d');
            const dates = Object.keys(stats.salesTrend).sort();
            const values = dates.map(d => stats.salesTrend[d]);

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Günlük Satış (TL)',
                        data: values,
                        borderColor: '#00f3ff',
                        backgroundColor: 'rgba(0, 243, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                        x: { grid: { display: false }, ticks: { color: '#fff' } }
                    }
                }
            });
        }, 100);

    } catch(e) { 
        console.error(e);
        showToast('İstatistikler yüklenemedi: ' + e.message, 'error'); 
    }
}

window.showProductStatsDetail = async function(code, name) {
    try {
        const details = await adminApi('GET', `/api/stats/product/${code}`);
        window.resetModalBtn('KAPAT', 'btn', true);
        document.getElementById('modal-save-btn').onclick = closeModal;
        document.getElementById('modal-title').textContent = `Ürün Analizi: ${name}`;
        
        let html = `
            <div class="full-width glass-card" style="padding:15px; border-color:var(--neon-cyan);">
                <h4 class="brand" style="font-size:0.9em; margin-bottom:10px;">📦 Bu Ürünü Satın Alanlar</h4>
                <table class="data-table" style="font-size:0.85em;">
                    <thead><tr><th>Tarih</th><th>Müşteri</th><th>Adet</th><th>Durum</th></tr></thead>
                    <tbody>
                        ${details.map(d => `<tr onclick="viewOrderDetails('${d.id}')" style="cursor:pointer;">
                            <td>${new Date(d.date).toLocaleDateString('tr-TR')}</td>
                            <td style="color:var(--neon-cyan);">${d.companyCode}</td>
                            <td style="font-weight:bold;">${d.qty}</td>
                            <td><span class="badge badge-primary" style="font-size:0.7em;">${d.status}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                ${details.length === 0 ? '<p style="text-align:center; padding:20px;">Satış kaydı bulunamadı.</p>' : ''}
            </div>
        `;
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

window.showCompanyStatsDetail = async function(code, name) {
    try {
        const details = await adminApi('GET', `/api/stats/company/${code}`);
        window.resetModalBtn('KAPAT', 'btn', true);
        document.getElementById('modal-save-btn').onclick = closeModal;
        document.getElementById('modal-title').textContent = `Cari Analizi: ${name}`;
        
        let html = `
            <div class="full-width glass-card" style="padding:15px; border-color:var(--neon-green);">
                <h4 class="brand" style="font-size:0.9em; margin-bottom:10px;">🧾 İşlem Geçmişi</h4>
                <table class="data-table" style="font-size:0.85em;">
                    <thead><tr><th>Tarih</th><th>ID</th><th>Tip</th><th>Tutar</th><th>Durum</th></tr></thead>
                    <tbody>
                        ${details.map(d => `<tr onclick="viewOrderDetails('${d.id}')" style="cursor:pointer;">
                            <td>${new Date(d.date).toLocaleDateString('tr-TR')}</td>
                            <td style="color:var(--neon-cyan); font-size:0.8em;">${d.id}</td>
                            <td><span class="badge ${d.orderType==='NUMUNE'?'badge-purple':'badge-warning'}" style="font-size:0.7em;">${d.orderType}</span></td>
                            <td style="font-weight:bold;">${d.orderType==='SIPARIS' ? (d.amount || 0).toLocaleString('tr-TR') + ' TL' : '-'}</td>
                            <td><span class="badge badge-primary" style="font-size:0.7em;">${d.status}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                ${details.length === 0 ? '<p style="text-align:center; padding:20px;">İşlem kaydı bulunamadı.</p>' : ''}
            </div>
        `;
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

window.showAllOrdersStats = async function(type) {
    try {
        const orders = await adminApi('GET', '/api/orders');
        const filtered = orders.filter(o => o.orderType === type);
        
        window.resetModalBtn('KAPAT', 'btn', true);
        document.getElementById('modal-save-btn').onclick = closeModal;
        document.getElementById('modal-title').textContent = type === 'SIPARIS' ? 'Tüm Satış Siparişleri' : 'Tüm Numune Gönderimleri';
        
        let html = `
            <div class="full-width glass-card" style="padding:15px; border-color:var(--neon-cyan);">
                <table class="data-table" style="font-size:0.85em;">
                    <thead><tr><th>Tarih</th><th>ID</th><th>Müşteri</th><th>Tutar</th><th>Durum</th></tr></thead>
                    <tbody>
                        ${filtered.map(o => `<tr onclick="viewOrderDetails('${o.id}')" style="cursor:pointer;">
                            <td>${new Date(o.createdAt).toLocaleDateString('tr-TR')}</td>
                            <td style="color:var(--neon-cyan); font-size:0.8em;">${o.id}</td>
                            <td>${o.companyCode}</td>
                            <td style="font-weight:bold;">${o.orderType==='SIPARIS' ? formatCurrency(o.finalAmount || 0) : '-'}</td>
                            <td><span class="badge badge-primary" style="font-size:0.7em;">${o.status}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                ${filtered.length === 0 ? '<p style="text-align:center; padding:20px;">Kayıt bulunamadı.</p>' : ''}
            </div>
        `;
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

window.showSoldProductsStats = async function() {
    try {
        const stats = await adminApi('GET', '/api/stats/dashboard');
        window.resetModalBtn('KAPAT', 'btn', true);
        document.getElementById('modal-save-btn').onclick = closeModal;
        document.getElementById('modal-title').textContent = 'Satılan Ürün Detayları';
        
        let html = `
            <div class="full-width glass-card" style="padding:15px; border-color:var(--neon-cyan);">
                <table class="data-table" style="font-size:0.85em;">
                    <thead><tr><th>Ürün Kodu</th><th>Ürün Adı</th><th style="text-align:right;">Toplam Satış Adedi</th></tr></thead>
                    <tbody>
                        ${stats.topProducts.map(p => `<tr onclick="showProductStatsDetail('${p.code}', '${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
                            <td style="color:var(--neon-cyan);">${p.code}</td>
                            <td>${p.name}</td>
                            <td style="text-align:right; font-weight:bold; color:var(--neon-green);">${p.qty}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

// --- PRODUCT MANAGEMENT ---
async function renderProductsTab() {
    try {
        const products = await adminApi('GET', '/api/products');
        let html = `
            <div class="action-bar">
                <h2 class="brand">Ürün Yönetimi</h2>
                <div style="display:flex; gap:10px;">
                    <button class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="window.location.href='/api/admin/export/products'">📊 Excel İndir</button>
                    <button class="btn btn-primary" onclick="openProductModal()">+ Yeni Ürün Ekle</button>
                </div>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>GÖRSEL</th><th>KOD</th><th>AD</th><th>BİRİM FİYAT</th><th>KDV</th><th>STOK</th><th>İŞLEMLER</th></tr></thead>
                    <tbody>
        `;
        products.forEach(p => {
            const pExcl = parseFloat(p.priceExclTax) || 0;
            const tRate = parseFloat(p.taxRate) || 0;
            const pIncl = pExcl * (1 + tRate/100);
            
            const priceStr = formatCurrency(pIncl);
            const taxStr = p.taxRate ? `%${p.taxRate}` : '%20';
            const isLowStock = (p.stock || 0) < (p.minStock || 10);

            const imgCell = p.image
                ? '<td onclick="openLightbox(\'' + p.image + '\')" style="cursor:pointer;"><img src="' + p.image + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--neon-cyan);"></td>'
                : '<td><div style="width:40px;height:40px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:0.6em;color:var(--text-secondary);">FOTO YOK</div></td>';
            const adSafe = p.ad.replace(/'/g, "\\'");
            const stockColor = isLowStock ? 'var(--neon-red)' : 'var(--neon-green)';

            html += '<tr>'
                + imgCell
                + '<td style="color:var(--neon-cyan);font-family:var(--font-heading);">' + p.kod + '</td>'
                + '<td>' + p.ad + '</td>'
                + '<td>' + priceStr + ' <span style="font-size:0.7em;color:var(--text-secondary);">(KDV Dahil)</span></td>'
                + '<td>' + taxStr + '</td>'
                + '<td style="font-weight:bold;color:' + stockColor + '">' + (p.stock || 0) + '</td>'
                + '<td>'
                + '<button class="btn" style="padding:5px 10px;font-size:0.8em;border-color:var(--neon-cyan);color:var(--neon-cyan);" onclick="openStockModal(\'' + p.kod + '\',\'' + adSafe + '\',' + (p.stock || 0) + ')">Stok</button>'
                + '<button class="btn" style="padding:5px 10px;font-size:0.8em;border-color:var(--neon-purple);color:var(--neon-purple);" onclick="openProductModal(\'' + p.kod + '\',\'' + adSafe + '\',\'' + (p.priceExclTax || 0) + '\',\'' + (p.taxRate || 20) + '\',' + (p.stock || 0) + ',' + (p.minStock || 10) + ',\'' + (p.image || '') + '\')">Düzenle</button>'
                + '<button class="btn" style="padding:5px 10px;font-size:0.8em;border-color:var(--neon-red);color:var(--neon-red);" onclick="deleteProduct(\'' + p.kod + '\')">Sil</button>'
                + '</td></tr>';
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.resetModalBtn = function(text = 'KAYDET', className = 'btn btn-primary', hideCancel = false) {
    const btn = document.getElementById('modal-save-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const pdfBtn = document.getElementById('modal-pdf-btn');
    
    if(pdfBtn) pdfBtn.style.display = 'none';
    if(cancelBtn) cancelBtn.style.display = hideCancel ? 'none' : 'block';
    if(!btn) return;
    
    btn.innerHTML = text;
    btn.className = className;
    btn.style.display = 'block';
}

window.openProductModal = function(kod='', ad='', priceExclTax='0', taxRate='20', stock=0, minStock=10, image='') {
    window.resetModalBtn();
    const isEdit = !!kod;
    document.getElementById('modal-title').textContent = isEdit ? 'Ürün Düzenle' : 'Yeni Ürün Kaydı';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:grid; grid-template-columns: 120px 1fr; gap:20px;">
            <div id="m-image-preview-wrapper" style="width:120px; height:120px; border:2px dashed rgba(255,255,255,0.1); border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; cursor:pointer;" onclick="document.getElementById('m-image-input').click()">
                <div id="m-image-container" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                    ${image ? '<img src="' + image + '" style="width:100%; height:100%; object-fit:cover;">' : '<span style="font-size:0.7em; text-align:center; opacity:0.5;">Resim Seç</span>'}
                </div>
            </div>
            <input type="file" id="m-image-input" style="display:none;" accept="image/*" onchange="previewProductImage(this)">
            <div>
                <div class="form-group">
                    <label>Ürün Kodu</label>
                    <input type="text" id="m-kod" value="${kod}" ${isEdit ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label>Ürün Adı</label>
                    <input type="text" id="m-ad" value="${ad}">
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>Birim Fiyat (KDV Hariç) TL</label>
            <input type="number" id="m-price" value="${priceExclTax}" min="0" step="0.01" oninput="calcProdIncl()">
        </div>
        <div class="form-group">
            <label>KDV Oranı (%)</label>
            <input type="number" id="m-tax" value="${taxRate}" min="0" max="100" step="1" oninput="calcProdIncl()">
        </div>
        <div class="form-group full-width">
            <label>Birim Fiyat (KDV Dahil) TL</label>
            <input type="number" id="m-price-incl" value="${(parseFloat(priceExclTax) * (1 + parseFloat(taxRate)/100)).toFixed(2)}" min="0" step="0.01" oninput="calcProdExcl()">
        </div>
        <div class="form-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
                <label>Mevcut Stok</label>
                <input type="number" id="m-stock" value="${stock}">
            </div>
            <div>
                <label>Kritik Stok Seviyesi</label>
                <input type="number" id="m-minstock" value="${minStock}">
            </div>
        </div>
    `;
    document.getElementById('modal-save-btn').onclick = () => saveProduct(isEdit);
    document.getElementById('admin-modal').classList.add('active');
}

window.previewProductImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('m-image-container').innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.openStockModal = function(code, name, current) {
    window.resetModalBtn('STOK GÜNCELLE');
    document.getElementById('modal-title').textContent = `Stok Yönetimi: ${name}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="glass-card" style="margin-bottom:15px; padding:10px; text-align:center;">
            <small style="opacity:0.6;">MEVCUT STOK</small>
            <div style="font-size:2em; font-weight:bold; color:var(--neon-cyan);">${current}</div>
        </div>
        <div class="form-group">
            <label>İşlem Türü</label>
            <select id="m-stock-type">
                <option value="add">Stok Ekle (+)</option>
                <option value="sub">Stok Çıkar (-)</option>
                <option value="set">Stok Sabitle (Yeni Değer)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Miktar / Yeni Değer</label>
            <input type="number" id="m-stock-amount" value="0">
        </div>
    `;
    document.getElementById('modal-save-btn').onclick = async () => {
        const type = document.getElementById('m-stock-type').value;
        let amount = parseInt(document.getElementById('m-stock-amount').value) || 0;
        
        const finalType = type === 'set' ? 'set' : 'add';
        const finalAmount = type === 'sub' ? -amount : amount;

        try {
            await adminApi('POST', '/api/admin/stock-adjust', { code, amount: finalAmount, type: finalType });
            showToast('Stok başarıyla güncellendi');
            closeModal();
            renderProductsTab();
        } catch(e) { showToast(e.message, 'error'); }
    };
    document.getElementById('admin-modal').classList.add('active');
}

window.calcProdIncl = function() {
    const px = parseFloat(document.getElementById('m-price').value) || 0;
    const t = parseFloat(document.getElementById('m-tax').value) || 0;
    document.getElementById('m-price-incl').value = (px * (1 + t/100)).toFixed(2);
}

window.calcProdExcl = function() {
    const pi = parseFloat(document.getElementById('m-price-incl').value) || 0;
    const t = parseFloat(document.getElementById('m-tax').value) || 0;
    document.getElementById('m-price').value = (pi / (1 + t/100)).toFixed(2);
}

async function saveProduct(isEdit) {
    const data = {
        kod: document.getElementById('m-kod').value,
        ad: document.getElementById('m-ad').value,
        priceExclTax: parseFloat(document.getElementById('m-price').value) || 0,
        taxRate: parseFloat(document.getElementById('m-tax').value) || 20,
        stock: parseInt(document.getElementById('m-stock').value) || 0,
        minStock: parseInt(document.getElementById('m-minstock').value) || 10
    };
    try {
        if(isEdit) await adminApi('PUT', `/api/admin/products/${data.kod}`, data);
        else await adminApi('POST', '/api/admin/add-product', data);
        
        // Handle Image Upload
        const imageInput = document.getElementById('m-image-input');
        if (imageInput && imageInput.files && imageInput.files[0]) {
            const formData = new FormData();
            formData.append('image', imageInput.files[0]);
            
            const uploadRes = await fetch(`/api/admin/products/${data.kod}/image`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken }, // Session handles auth, CSRF is needed
                body: formData
            });
            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(errData.error || 'Resim yüklenemedi');
            }
        }

        closeModal();
        renderProductsTab();
        showToast('Ürün başarıyla kaydedildi.');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteProduct = async function(kod) {
    showConfirm('Bu ürünü silmek istediğinize emin misiniz?', async () => {
        try {
            await adminApi('DELETE', `/api/admin/products/${kod}`);
            renderProductsTab();
            showToast('Ürün silindi.');
        } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- DISTRIBUTOR MANAGEMENT ---
async function renderDistributorsTab() {
    try {
        const dists = await adminApi('GET', '/api/distributors');
        let html = `
            <div class="action-bar">
                <h2 class="brand">Distribütörler</h2>
                <button class="btn btn-primary" onclick="openDistModal()">+ Yeni Distribütör</button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>KOD</th><th>AD</th><th>İŞLEMLER</th></tr></thead>
                    <tbody>
        `;
        dists.forEach(d => {
            html += `<tr>
                <td style="color:var(--neon-cyan);">${d.kod}</td>
                <td>${d.ad}</td>
                <td>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openDistModal('${d.kod}', '${d.ad.replace(/'/g, "\\'")}', '${d.phone || ''}', '${d.email || ''}')">Düzenle</button>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteDist('${d.kod}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openDistModal = function(kod='', ad='', phone='', email='') {
    window.resetModalBtn();
    const isEdit = !!kod;
    document.getElementById('modal-title').textContent = isEdit ? 'Distribütör Düzenle' : 'Yeni Distribütör';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Distribütör Kodu</label>
            <input type="text" id="m-kod" value="${kod}" ${isEdit ? 'disabled' : ''}>
        </div>
        <div class="form-group">
            <label>Distribütör Adı</label>
            <input type="text" id="m-ad" value="${ad}">
        </div>
        <div class="form-group">
            <label>Telefon</label>
            <input type="text" id="m-phone" value="${phone}" placeholder="Örn: 0555...">
        </div>
        <div class="form-group">
            <label>E-Posta</label>
            <input type="email" id="m-email" value="${email}" placeholder="ornek@statio.com">
        </div>
    `;
    document.getElementById('modal-save-btn').onclick = () => saveDist(isEdit);
    document.getElementById('admin-modal').classList.add('active');
}

async function saveDist(isEdit) {
    const data = { 
        kod: document.getElementById('m-kod').value, 
        ad: document.getElementById('m-ad').value,
        phone: document.getElementById('m-phone').value,
        email: document.getElementById('m-email').value
    };
    try {
        if(isEdit) await adminApi('PUT', `/api/admin/distributors/${data.kod}`, data);
        else await adminApi('POST', '/api/admin/add-distributor', data);
        closeModal(); renderDistributorsTab(); showToast('Kaydedildi');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteDist = async function(kod) {
    showConfirm('Distribütör silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/distributors/${kod}`); renderDistributorsTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- COMPANY (CUSTOMER) MANAGEMENT ---
async function renderCompaniesTab() {
    try {
        const comps = await adminApi('GET', '/api/companies');
        let html = `
            <div class="action-bar">
                <h2 class="brand">Cariler (Müşteri Yönetimi)</h2>
                <div style="display:flex; gap:10px;">
                    <button class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="window.location.href='/api/admin/export/companies'">📊 Excel İndir</button>
                    <button class="btn btn-primary" onclick="openCompModal()">+ Yeni Cari Ekle</button>
                </div>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>CARİ KOD</th><th>MÜŞTERİ ADI</th><th>İŞLEMLER</th></tr></thead>
                    <tbody>
        `;
        comps.forEach(c => {
            const adSafe = (c.ad || '').replace(/'/g, "\\'");
            const taxOfficeSafe = (c.taxOffice || '').replace(/'/g, "\\'");
            const taxNumberSafe = (c.taxNumber || '').replace(/'/g, "\\'");
            const addressSafe = (c.address || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");
            
            html += `<tr>
                <td style="color:var(--neon-cyan);">${c.cariKod}</td>
                <td>${c.ad || '-'}</td>
                <td>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" 
                        onclick="openCompModal('${c.cariKod}', '${adSafe}', '${c.phone || ''}', '${c.email || ''}', '${c.discountRate || 0}', '${taxOfficeSafe}', '${taxNumberSafe}', '${addressSafe}', ${c.riskLimit || 0})">Düzenle</button>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteComp('${c.cariKod}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openCompModal = function(kod='', ad='', phone='', email='', discountRate=0, taxOffice='', taxNumber='', address='', riskLimit=0) {
    window.resetModalBtn();
    const isEdit = !!kod;
    document.getElementById('modal-title').textContent = isEdit ? 'Kurum Düzenle' : 'Yeni Kurum (Kurumsal Kayıt)';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            <div class="form-group"><label>Cari Kod *</label><input type="text" id="m-kod" value="${kod}" ${isEdit ? 'disabled' : ''} required></div>
            <div class="form-group"><label>Kurum Adı (Ticari Unvan) *</label><input type="text" id="m-ad" value="${ad}" required></div>
            <div class="form-group"><label>Vergi Dairesi *</label><input type="text" id="m-taxOffice" value="${taxOffice}" required></div>
            <div class="form-group"><label>Vergi Numarası *</label><input type="text" id="m-taxNumber" value="${taxNumber}" required></div>
        </div>
        <div class="form-group full-width"><label>Tam Adres (Kaşe Bilgisi) *</label><textarea id="m-address" required style="width:100%; height:60px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid var(--glass-border); border-radius:8px; padding:10px;">${address}</textarea></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            <div class="form-group"><label>Telefon *</label><input type="text" id="m-phone" value="${phone}" required></div>
            <div class="form-group"><label>E-Posta *</label><input type="email" id="m-email" value="${email}" required></div>
            <div class="form-group"><label>Sabit İskonto (%)</label><input type="number" id="m-discountRate" value="${discountRate}" min="0" max="100" step="0.1"></div>
            <div class="form-group"><label>Risk Limiti (TL)</label><input type="number" id="m-riskLimit" value="${riskLimit}" min="0"></div>
        </div>
    `;
    document.getElementById('modal-save-btn').onclick = () => saveComp(isEdit);
    document.getElementById('admin-modal').classList.add('active');
}

async function saveComp(isEdit) {
    const data = { 
        cariKod: document.getElementById('m-kod').value, 
        ad: document.getElementById('m-ad').value,
        taxOffice: document.getElementById('m-taxOffice').value,
        taxNumber: document.getElementById('m-taxNumber').value,
        address: document.getElementById('m-address').value,
        phone: document.getElementById('m-phone').value,
        email: document.getElementById('m-email').value,
        discountRate: parseFloat(document.getElementById('m-discountRate').value) || 0,
        riskLimit: parseFloat(document.getElementById('m-riskLimit').value) || 0
    };

    // Zorunlu alan kontrolü
    if(!data.cariKod || !data.ad || !data.taxOffice || !data.taxNumber || !data.address || !data.phone || !data.email) {
        return showToast('Lütfen tüm kurumsal bilgileri (Kaşe bilgilerini) eksiksiz giriniz!', 'error');
    }

    try {
        if(isEdit) await adminApi('PUT', `/api/admin/companies/${data.cariKod}`, data);
        else await adminApi('POST', '/api/admin/add-company', data);
        closeModal(); renderCompaniesTab(); showToast('Kurumsal Cari Kaydedildi');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteComp = async function(kod) {
    showConfirm('Kurum silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/companies/${kod}`); renderCompaniesTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- SHARED MODAL LOGIC ---
window.closeModal = function() {
    document.getElementById('admin-modal').classList.remove('active');
}

// --- USER MANAGEMENT ---
async function renderUsersTab() {
    const content = document.getElementById('main-content');
    try {
        const [users, warehouses] = await Promise.all([
            adminApi('GET', '/api/admin/users'),
            adminApi('GET', '/api/warehouses')
        ]);

        const warehouseOptions = warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

        let html = `
            <div class="action-bar"><h2 class="brand">Kullanıcı Yönetimi</h2></div>
            <div class="glass-card mb-4" style="margin-bottom:20px;">
                <h3 class="brand" style="font-size:1.1em;">Yeni Kullanıcı Kaydı</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
                    <input type="text" id="u-username" placeholder="Kullanıcı Adı">
                    <input type="text" id="u-display" placeholder="İsim Soyisim">
                    <select id="u-role" onchange="toggleWarehouseSelect(this.value)">
                        <option value="distributor">Satış Temsilcisi</option>
                        <option value="warehouse">Depo Personeli</option>
                        <option value="admin">Yönetici</option>
                    </select>
                    <div id="u-warehouse-wrapper" style="display:none;">
                        <select id="u-warehouse">
                            <option value="">Depo Seçiniz (Zorunlu)...</option>
                            ${warehouseOptions}
                        </select>
                    </div>
                    <input type="password" id="u-pass" placeholder="Şifre">
                </div>
                <button class="btn btn-primary" style="margin-top:15px" onclick="addUser()">Kullanıcı Oluştur</button>
            </div>
            
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>KULLANICI</th><th>İSİM</th><th>ROL</th><th>DURUM</th><th>İŞLEM</th></tr></thead>
                    <tbody>
        `;
        users.forEach(u => {
            html += `<tr>
                <td>${u.username}</td>
                <td>${u.displayName}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-warning'}">${u.role.toUpperCase()}</span></td>
                <td>${u.isActive ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Pasif</span>'}</td>
                <td>
                    <button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="toggleUser('${u.id}')">Durum</button>
                    ${u.role !== 'admin' ? `<button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteUser('${u.id}')">Sil</button>` : ''}
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        content.innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.toggleWarehouseSelect = function(role) {
    const wrapper = document.getElementById('u-warehouse-wrapper');
    wrapper.style.display = role === 'warehouse' ? 'block' : 'none';
}

window.addUser = async function() {
    const username = document.getElementById('u-username').value;
    const displayName = document.getElementById('u-display').value;
    const role = document.getElementById('u-role').value;
    const password = document.getElementById('u-pass').value;
    const warehouseId = document.getElementById('u-warehouse').value;

    if(role === 'warehouse' && !warehouseId) {
        return showToast('Lütfen depo seçiniz!', 'error');
    }

    try {
        await adminApi('POST', '/api/admin/users', { username, displayName, role, password, warehouseId });
        showToast('Kullanıcı eklendi');
        renderUsersTab();
    } catch(e) { showToast(e.message, 'error'); }
}

window.toggleUser = async function(id) {
    try { await adminApi('POST', `/api/admin/users/${id}/toggle`); renderUsersTab(); } catch(e) { showToast(e.message, 'error'); }
}

window.deleteUser = async function(id) {
    showConfirm('Kullanıcı silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/users/${id}`); renderUsersTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- XML LOAD ---
function renderXmlTab() {
    document.getElementById('main-content').innerHTML = `
        <div class="glass-card">
            <h2 class="brand">XML Veri Aktarımı</h2>
            <p style="color:var(--text-secondary); margin-bottom:30px;">Toplu veri yüklemek için XML dosyalarını kullanın.</p>
            
            <div style="margin-bottom:25px; padding:15px; background:rgba(0,243,255,0.05); border:1px solid var(--neon-cyan); border-radius:8px; display:flex; align-items:center; justify-content:space-between;">
                <div>
                    <h4 style="margin:0; color:var(--neon-cyan);">💡 Veri Aktarım Kolaylığı</h4>
                    <p style="margin:5px 0 0 0; font-size:0.85em;">Ürünleri sisteme hatasız eklemek için şablonu kullanabilirsiniz.</p>
                </div>
                <a href="/samples/sample_products.xml" download class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); padding:8px 15px;">📥 Örnek Ürün XML İndir</a>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;">
                <div style="border: 1px dashed var(--neon-cyan); padding:20px; text-align:center; border-radius:8px;">
                    <h4>Ürünler XML</h4>
                    <input type="file" id="prod-xml" style="margin:10px 0; width:100%;">
                    <button class="btn btn-primary" onclick="uploadXml('prod-xml', '/api/admin/upload-products-xml')">Yükle</button>
                </div>
                <div style="border: 1px dashed var(--neon-purple); padding:20px; text-align:center; border-radius:8px;">
                    <h4>Distribütörler XML</h4>
                    <input type="file" id="dist-xml" style="margin:10px 0; width:100%;">
                    <button class="btn btn-primary" onclick="uploadXml('dist-xml', '/api/admin/upload-distributors-xml')">Yükle</button>
                </div>
                <div style="border: 1px dashed var(--neon-pink); padding:20px; text-align:center; border-radius:8px;">
                    <h4>Kurumlar XML</h4>
                    <input type="file" id="comp-xml" style="margin:10px 0; width:100%;">
                    <button class="btn btn-primary" onclick="uploadXml('comp-xml', '/api/admin/upload-companies-xml')">Yükle</button>
                </div>
            </div>
        </div>
    `;
}

window.uploadXml = async function(id, url) {
    const file = document.getElementById(id).files[0];
    if(!file) return showToast('Dosya seçin', 'error');
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(url, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: formData });
        const data = await res.json();
        if(res.ok) showToast('XML başarıyla aktarıldı');
        else showToast(data.error, 'error');
    } catch(e) { showToast('Ağ Hatası', 'error'); }
}

// --- ORDER MANAGEMENT & ASSIGNMENT ---
async function renderOrdersTab() {
    try {
        const [orders, warehouses, companies] = await Promise.all([
            adminApi('GET', '/api/orders'),
            adminApi('GET', '/api/warehouses'),
            adminApi('GET', '/api/companies')
        ]);
        
        const compOptions = companies.map(c => `<option value="${c.cariKod}">${c.ad || c.cariKod}</option>`).join('');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand">Sipariş Takibi & Sevk</h2>
                <div style="display:flex; gap:10px;">
                    <button id="bulk-delete-btn" class="btn" style="border-color:var(--neon-red); color:var(--neon-red); display:none;" onclick="deleteSelectedOrders()">🗑️ Seçilenleri Sil</button>
                    <button class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="window.location.href='/api/admin/export/orders'">📊 Excel (.xlsx)</button>
                </div>
            </div>
            
            <div class="glass-card" style="margin-bottom:20px; padding:15px; display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap;">
                <div class="form-group" style="margin-bottom:0; width:150px;">
                    <label style="font-size:0.8em;">Durum Filtresi</label>
                    <select id="filter-status" onchange="filterOrders()">
                        <option value="">Tümü</option>
                        <option value="YENI">YENİ</option>
                        <option value="ATANDI">ATANDI</option>
                        <option value="HAZIRLANIYOR">HAZIRLANIYOR</option>
                        <option value="KARGODA">KARGODA</option>
                        <option value="TESLIM_EDILDI">TESLIM EDILDI</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:0; width:200px;">
                    <label style="font-size:0.8em;">Kurum Filtresi</label>
                    <select id="filter-company" onchange="filterOrders()">
                        <option value="">Tümü</option>
                        ${compOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:0; width:180px;">
                    <label style="font-size:0.8em;">Arama</label>
                    <input type="text" id="filter-search" placeholder="ID veya Not ara..." oninput="filterOrders()">
                </div>
            </div>

            <div class="glass-card">
                <table class="data-table">
                    <thead><tr>
                        <th style="width:30px;"><input type="checkbox" onchange="toggleAllOrders(this.checked)"></th>
                        <th>ID</th><th>KURUM</th><th>DURUM</th><th>DEPO</th><th>İŞLEMLER</th>
                    </tr></thead>
                    <tbody id="orders-tbody">
        `;
        
        orders.forEach(o => {
            const wh = warehouses.find(w => w.id === o.warehouseId);
            const whOptions = warehouses.map(w => `<option value="${w.id}" ${o.warehouseId === w.id ? 'selected' : ''}>${w.name}</option>`).join('');
            
            const isAdmin = currentUser.role === 'admin';
            
            html += `<tr style="cursor:pointer;" onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'SELECT' && event.target.type !== 'checkbox') viewOrderDetails('${o.id}')">
                <td><input type="checkbox" class="order-checkbox" value="${o.id}" onclick="event.stopPropagation();" onchange="updateBulkBtnVisibility()"></td>
                <td style="font-size:0.8em;">${o.id}</td>
                <td>${o.companyCode}</td>
                <td>
                    <span class="badge ${o.status === 'YENI' ? 'badge-warning' : (o.status==='TESLIM_EDILDI'?'badge-success':'badge-primary')}">${o.status}</span>
                    ${o.cargoDetail ? `<div style="font-size:0.75em; color:var(--neon-cyan); margin-top:3px;">${o.cargoDetail.company} - ${o.cargoDetail.trackingCode}</div>` : ''}
                </td>
                <td>
                    <div onclick="event.stopPropagation();">
                        ${isAdmin ? `
                            <select onchange="assignToWarehouse('${o.id}', this.value)" style="padding:4px; font-size:0.85em; background:rgba(255,255,255,0.05); color:white; border:1px solid var(--neon-cyan); border-radius:4px;">
                                <option value="">Ata...</option>
                                ${whOptions}
                            </select>
                        ` : (wh ? `<span style="color:var(--neon-cyan); font-weight:bold;">${wh.name}</span>` : '<span style="color:var(--neon-red);">Atanmamış</span>')}
                    </div>
                </td>
                <td>
                    <div style="display:flex; gap:5px;" onclick="event.stopPropagation();">
                      <button class="btn" style="padding:4px 8px; font-size:0.8em;" onclick="viewOrderDetails('${o.id}')">👁️ Detay</button>
                      <button class="btn" style="padding:4px 8px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="window.open('/api/orders/${o.id}/pdf')">📄 PDF</button>
                      <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding:4px; font-size:0.85em; background:rgba(0,0,0,0.3); color:var(--neon-purple); border:1px solid var(--neon-purple); border-radius:4px;">
                          <option value="">Durum...</option>
                          <option value="HAZIRLANIYOR" ${o.status==='HAZIRLANIYOR'?'selected':''}>Hazırlanıyor</option>
                          <option value="KARGODA" ${o.status==='KARGODA'?'selected':''}>Kargoya Ver</option>
                          <option value="TESLIM_EDILDI" ${o.status==='TESLIM_EDILDI'?'selected':''}>Teslim Edildi</option>
                      </select>
                      ${isAdmin ? `
                        <button class="btn" style="padding:4px 8px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteOrder('${o.id}')">🗑️ Sil</button>
                      ` : ''}
                    </div>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.viewOrderDetails = async function(id) {
    try {
        window.resetModalBtn('💾 DEĞİŞİKLİKLERİ KAYDET', 'btn btn-primary', false);
        let pdfBtn = document.getElementById('modal-pdf-btn');
        if(pdfBtn) pdfBtn.style.display = 'none';
        
        const order = await adminApi('GET', `/api/orders/${id}`);
        const isAdmin = currentUser.role === 'admin';
        document.getElementById('modal-title').textContent = `Sipariş Detayı: ${order.id}`;
        const products = await adminApi('GET', '/api/products');

        let itemsHtml = order.items.map((i, index) => {
            const pExcl = parseFloat(i.priceExclTax) || 0;
            const tRate = parseFloat(i.taxRate) || 0;
            const dRate = parseFloat(i.discountRate) || 0;
            const q = parseInt(i.qty) || parseInt(i.miktar) || 0;
            
            const pData = products.find(prod => prod.kod === i.code);
            const imgSrc = pData && pData.image ? pData.image : '';
            const imgHtml = `
                <td style="width:40px;">
                    ${imgSrc ? `<img src="${imgSrc}" style="width:35px; height:35px; object-fit:cover; border-radius:4px;">` : `<div style="width:35px; height:35px; background:rgba(255,255,255,0.05); border-radius:4px;"></div>`}
                </td>
            `;

            if (isAdmin) {
                return `<tr>
                    ${imgHtml}
                    <td style="color:var(--neon-cyan);">${i.code}</td>
                    <td>${i.name}</td>
                    <td><input type="number" class="edit-px" data-index="${index}" value="${pExcl.toFixed(2)}" step="0.01" style="width:70px; padding:4px;" oninput="window.calcOrderRow(${index})"></td>
                    <td><input type="number" class="edit-tr" data-index="${index}" value="${tRate}" step="1" style="width:50px; padding:4px;" oninput="window.calcOrderRow(${index})"></td>
                    <td><input type="number" class="edit-dr" data-index="${index}" value="${dRate}" step="1" style="width:50px; padding:4px;" oninput="window.calcOrderRow(${index})"></td>
                    <td><input type="number" class="edit-pi" data-index="${index}" value="${(pExcl * (1 + tRate/100)).toFixed(2)}" step="0.01" style="width:80px; padding:4px;" oninput="window.calcOrderRowIncl(${index})"></td>
                    <td style="text-align:center;"><input type="number" class="edit-qty" data-index="${index}" value="${q}" min="0" style="width:60px; padding:4px;" oninput="window.calcOrderRow(${index})"></td>
                    <td style="font-weight:bold; color:var(--neon-green);" class="row-total" data-index="${index}">${(pExcl * q * (1 - dRate/100) * (1 + tRate/100)).toFixed(2)}</td>
                </tr>`;
            } else {
                return `<tr>
                    ${imgHtml}
                    <td style="color:var(--neon-cyan);">${i.code}</td>
                    <td>${i.name}</td>
                    <td>${pExcl.toFixed(2)}</td>
                    <td>%${tRate}</td>
                    <td>%${dRate}</td>
                    <td>${(pExcl * (1 + tRate/100)).toFixed(2)}</td>
                    <td style="text-align:center; font-weight:bold;">${q}</td>
                    <td style="font-weight:bold; color:var(--neon-green);">${(pExcl * q * (1 - dRate/100) * (1 + tRate/100)).toFixed(2)}</td>
                </tr>`;
            }
        }).join('');

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
                    ${isAdmin ? `
                        <select id="edit-order-type" style="padding:4px; font-size:1em; margin-top:2px;">
                            <option value="SIPARIS" ${order.orderType==='SIPARIS'?'selected':''}>SİPARİŞ</option>
                            <option value="NUMUNE" ${order.orderType==='NUMUNE'?'selected':''}>NUMUNE</option>
                        </select>
                    ` : `<b>${order.orderType}</b>`}
                </div>
                <div class="glass-card" style="padding:10px; border-color:var(--neon-green);">
                    <small style="color:var(--text-secondary); display:block; margin-bottom:4px;">DURUM</small>
                    <select id="edit-order-status" style="padding:4px; font-size:1em; margin-top:2px;" onchange="toggleCargoInputs(this.value)">
                        <option value="YENI" ${order.status==='YENI'?'selected':''}>YENİ</option>
                        <option value="HAZIRLANIYOR" ${order.status==='HAZIRLANIYOR'?'selected':''}>HAZIRLANIYOR</option>
                        <option value="KARGODA" ${order.status==='KARGODA'?'selected':''}>KARGODA</option>
                        <option value="TESLIM_EDILDI" ${order.status==='TESLIM_EDILDI'?'selected':''}>TESLİM EDİLDİ</option>
                    </select>
                </div>
            </div>
            
            <div id="cargo-inputs" class="glass-card" style="margin-bottom:15px; padding:10px; border-color:var(--neon-cyan); display: ${(order.status === 'KARGODA' || order.status === 'TESLIM_EDILDI') ? 'block' : 'none'};">
                <small style="color:var(--neon-cyan); display:block; margin-bottom:8px;">KARGO BİLGİLERİ</small>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div>
                        <small style="color:var(--text-secondary);">FİRMA</small>
                        <select id="m-cargo-company" style="margin-top:4px;">
                            <option value="Aras Kargo" ${order.cargoDetail?.company === 'Aras Kargo' ? 'selected' : ''}>Aras Kargo</option>
                            <option value="Yurtiçi Kargo" ${order.cargoDetail?.company === 'Yurtiçi Kargo' ? 'selected' : ''}>Yurtiçi Kargo</option>
                            <option value="MNG Kargo" ${order.cargoDetail?.company === 'MNG Kargo' ? 'selected' : ''}>MNG Kargo</option>
                            <option value="Sürat Kargo" ${order.cargoDetail?.company === 'Sürat Kargo' ? 'selected' : ''}>Sürat Kargo</option>
                            <option value="PTT Kargo" ${order.cargoDetail?.company === 'PTT Kargo' ? 'selected' : ''}>PTT Kargo</option>
                        </select>
                    </div>
                    <div>
                        <small style="color:var(--text-secondary);">TAKİP NO</small>
                        <input type="text" id="m-cargo-code" value="${order.cargoDetail?.trackingCode || ''}" style="margin-top:4px;">
                    </div>
                </div>
            </div>

            <div class="glass-card" style="margin-bottom:15px; padding:10px; border-color:var(--glass-border);">
                <small style="color:var(--text-secondary); display:block; margin-bottom:8px;">SİPARİŞ NOTLARI</small>
                <textarea id="edit-order-notes" rows="2" style="font-size:0.9em;" ${isAdmin ? '' : 'disabled'}>${order.notes || ''}</textarea>
            </div>

            <div style="border: 1px solid var(--glass-border); border-radius:8px; overflow:hidden;">
                <table class="data-table" style="margin:0; border-radius:0;">
                    <thead style="position:sticky; top:0; z-index:10; background:var(--bg-space-light);">
                        <tr>
                            <th style="padding:10px; font-size:0.75em;">GÖRSEL</th>
                            <th style="padding:10px; font-size:0.75em;">KOD</th>
                            <th style="padding:10px; font-size:0.75em;">AD</th>
                            <th style="padding:10px; font-size:0.75em;">FİYAT (H)</th>
                            <th style="padding:10px; font-size:0.75em;">KDV%</th>
                            <th style="padding:10px; font-size:0.75em;">İSK%</th>
                            <th style="padding:10px; font-size:0.75em;">FİYAT (D)</th>
                            <th style="padding:10px; font-size:0.75em; text-align:center;">ADET</th>
                            <th style="padding:10px; font-size:0.75em;">TOPLAM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
            </div>
            <div style="margin-top:20px;"></div>
        `;
        
        pdfBtn = document.getElementById('modal-pdf-btn');
        if(pdfBtn) {
            pdfBtn.style.display = 'flex';
            pdfBtn.onclick = () => window.open(`/api/orders/${order.id}/pdf`);
        }

        const saveBtn = document.getElementById('modal-save-btn');
        saveBtn.style.display = 'block';
        
        if(isAdmin) {
            saveBtn.innerHTML = '💾 DEĞİŞİKLİKLERİ KAYDET';
            saveBtn.onclick = async () => {
                const notes = document.getElementById('edit-order-notes').value;
                const orderType = document.getElementById('edit-order-type').value;
                const status = document.getElementById('edit-order-status').value;
                const newItems = Array.from(document.querySelectorAll('.edit-qty')).map(input => {
                    const idx = input.getAttribute('data-index');
                    const qty = parseInt(input.value) || 0;
                    const pExcl = parseFloat(document.querySelector(`.edit-px[data-index="${idx}"]`).value) || 0;
                    const tRate = parseFloat(document.querySelector(`.edit-tr[data-index="${idx}"]`).value) || 0;
                    const dRate = parseFloat(document.querySelector(`.edit-dr[data-index="${idx}"]`).value) || 0;
                    return { ...order.items[idx], qty, miktar: qty, priceExclTax: pExcl, taxRate: tRate, discountRate: dRate };
                }).filter(i => i.qty > 0);

                let cargoDetail = null;
                if(status === 'KARGODA' || status === 'TESLIM_EDILDI') {
                    cargoDetail = {
                        company: document.getElementById('m-cargo-company').value,
                        trackingCode: document.getElementById('m-cargo-code').value
                    };
                    if(!cargoDetail.trackingCode) return showToast('Takip no giriniz!', 'error');
                }

                try {
                    await adminApi('PUT', `/api/orders/${id}`, { notes, orderType, items: newItems, status, cargoDetail });
                    showToast('Sipariş güncellendi');
                    closeModal(); renderOrdersTab();
                } catch(e) { showToast(e.message, 'error'); }
            };
        } else {
            saveBtn.innerHTML = '📦 DURUMU GÜNCELLE';
            saveBtn.onclick = async () => {
                const status = document.getElementById('edit-order-status').value;
                let cargoDetail = null;
                if(status === 'KARGODA' || status === 'TESLIM_EDILDI') {
                    cargoDetail = {
                        company: document.getElementById('m-cargo-company').value,
                        trackingCode: document.getElementById('m-cargo-code').value
                    };
                    if(!cargoDetail.trackingCode) return showToast('Takip no giriniz!', 'error');
                }
                try {
                    await adminApi('PUT', `/api/orders/${id}/warehouse-status`, { status, cargoDetail });
                    showToast('Durum ve sevk bilgileri güncellendi');
                    closeModal(); renderOrdersTab();
                } catch(e) { showToast(e.message, 'error'); }
            };
        }
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

window.toggleCargoInputs = function(status) {
    const div = document.getElementById('cargo-inputs');
    if(div) div.style.display = (status === 'KARGODA' || status === 'TESLIM_EDILDI') ? 'block' : 'none';
}

window.updateOrderStatus = async function(orderId, status) {
    if(!status) return;
    if(status === 'KARGODA') {
        openCargoModal(orderId);
        return;
    }
    try {
        await adminApi('PUT', `/api/orders/${orderId}/warehouse-status`, { status });
        showToast('Durum güncellendi');
        renderOrdersTab();
    } catch(e) { showToast(e.message, 'error'); }
}

window.openCargoModal = function(orderId) {
    document.getElementById('modal-title').textContent = 'Kargo Çıkış İşlemi';
    document.getElementById('modal-body').innerHTML = `
        <div style="grid-column: span 2; background: rgba(0,243,255,0.1); padding: 10px; border-radius: 5px; font-size: 0.85em; margin-bottom: 10px; color: var(--neon-cyan);">
            Siparişi kargoya teslim ederken lütfen taşıyıcı firma ve takip numarasını aşağıdaki alanlara giriniz.
        </div>
        <div class="form-group">
            <label>Kargo Firması</label>
            <select id="cargo-company">
                <option value="Aras Kargo">Aras Kargo</option>
                <option value="Yurtiçi Kargo">Yurtiçi Kargo</option>
                <option value="MNG Kargo">MNG Kargo</option>
                <option value="Sürat Kargo">Sürat Kargo</option>
                <option value="PTT Kargo">PTT Kargo</option>
                <option value="Diğer">Diğer</option>
            </select>
        </div>
        <div class="form-group">
            <label>Takip Numarası</label>
            <input type="text" id="cargo-code" placeholder="Takip no giriniz...">
        </div>
    `;
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.style.display = 'block';
    saveBtn.textContent = '📦 Kargoya Teslim Et';
    saveBtn.className = 'btn btn-primary';
    saveBtn.onclick = async () => {
        const company = document.getElementById('cargo-company').value;
        const code = document.getElementById('cargo-code').value;
        if(!code) return showToast('Lütfen takip numarasını giriniz!', 'error');
        try {
            await adminApi('PUT', `/api/orders/${orderId}/warehouse-status`, { 
                status: 'KARGODA', 
                cargoDetail: { company, trackingCode: code } 
            });
            closeModal();
            renderOrdersTab();
            showToast('Sipariş başarıyla kargoya verildi.');
        } catch(e) { showToast(e.message, 'error'); }
    };
    document.getElementById('admin-modal').classList.add('active');
}

window.assignToWarehouse = async function(orderId, whId) {
    if(!whId) return;
    try {
        await adminApi('POST', `/api/orders/${orderId}/assign`, { warehouseId: whId });
        showToast('Sipariş depoya atandı');
        renderOrdersTab();
    } catch(e) { showToast(e.message, 'error'); }
}

// --- WAREHOUSE MANAGEMENT ---
async function renderWarehousesTab() {
    try {
        const warehouses = await adminApi('GET', '/api/warehouses');
        let html = `
            <div class="action-bar">
                <h2 class="brand">Depo Yönetimi</h2>
                <button class="btn btn-primary" onclick="openWarehouseModal()">+ Yeni Depo Ekle</button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>ID</th><th>DEPO ADI</th><th>SORUMLU</th><th>DURUM</th><th>İŞLEMLER</th></tr></thead>
                    <tbody>
        `;
        warehouses.forEach(w => {
            html += `<tr>
                <td style="color:var(--neon-cyan); font-size:0.8em;">${w.id}</td>
                <td><b>${w.name}</b></td>
                <td>${w.responsible || '-'}</td>
                <td><span class="badge ${w.isActive ? 'badge-success' : 'badge-danger'}">${w.isActive ? 'AKTİF' : 'PASİF'}</span></td>
                <td>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openWarehouseModal('${w.id}', '${w.name.replace(/'/g, "\\\\' ")}', '${(w.responsible||"").replace(/'/g, "\\\\' ")}')">Düzenle</button>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteWarehouse('${w.id}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openWarehouseModal = function(id='', name='', responsible='') {
    window.resetModalBtn();
    const isEdit = !!id;
    document.getElementById('modal-title').textContent = isEdit ? 'Depo Düzenle' : 'Yeni Depo Kaydı';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Depo ID</label>
            <input type="text" id="w-id" value="${id}" ${isEdit ? 'disabled' : ''} placeholder="Otomatik oluşturulur">
        </div>
        <div class="form-group">
            <label>Depo Adı</label>
            <input type="text" id="w-name" value="${name}">
        </div>
        <div class="form-group full-width">
            <label>Sorumlu Kişi</label>
            <input type="text" id="w-responsible" value="${responsible}">
        </div>
    `;
    document.getElementById('modal-save-btn').onclick = () => saveWarehouse(isEdit);
    document.getElementById('admin-modal').classList.add('active');
}

async function saveWarehouse(isEdit) {
    const data = {
        id: document.getElementById('w-id').value,
        name: document.getElementById('w-name').value,
        responsible: document.getElementById('w-responsible').value
    };
    try {
        if(isEdit) await adminApi('PUT', `/api/warehouses/${data.id}`, data);
        else await adminApi('POST', '/api/warehouses', data);
        closeModal();
        renderWarehousesTab();
        showToast('Depo başarıyla kaydedildi.');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteWarehouse = async function(id) {
    showConfirm('Bu depoyu silmek üzeresiniz. Devam edilsin mi?', async () => {
        try {
            await adminApi('DELETE', `/api/warehouses/${id}`);
            renderWarehousesTab();
            showToast('Depo silindi.');
        } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- BACKUP ---
function renderBackupTab() {
    document.getElementById('main-content').innerHTML = `
        <div class="glass-card" style="text-align:center;">
            <h2 class="brand">Sistem Yedekleme</h2>
            <p>Tüm JSON ve XML veritabanlarının anlık yedeğini alın.</p>
            <button class="btn btn-primary" style="margin-top:20px; padding:15px 30px;" onclick="takeBackup()">Yedek Oluştur</button>
        </div>
    `;
}

async function takeBackup() {
    try {
        await adminApi('GET', '/api/admin/backup');
        showToast('Yedek başarıyla oluşturuldu.');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteOrder = async function(id) {
    showConfirm(`Sipariş [${id}] tamamen silinecektir. Emin misiniz?`, async () => {
        try {
            await adminApi('DELETE', `/api/orders/${id}`);
            showToast('Sipariş başarıyla silindi.');
            renderOrdersTab();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

window.toggleAllOrders = function(checked) {
    document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = checked);
    updateBulkBtnVisibility();
}

window.updateBulkBtnVisibility = function() {
    const selected = document.querySelectorAll('.order-checkbox:checked').length;
    const btn = document.getElementById('bulk-delete-btn');
    if(btn) btn.style.display = selected > 0 ? 'block' : 'none';
}

window.deleteSelectedOrders = async function() {
    const ids = Array.from(document.querySelectorAll('.order-checkbox:checked')).map(cb => cb.value);
    showConfirm(`${ids.length} adet sipariş silinecektir. Emin misiniz?`, async () => {
        try {
            await adminApi('POST', '/api/orders/bulk-delete', { ids });
            showToast('Siparişler başarıyla silindi.');
            renderOrdersTab();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

window.showConfirm = function(msg, onConfirm) {
    const modal = document.getElementById('admin-modal');
    document.getElementById('modal-title').textContent = '⚠️ ONAY GEREKLİ';
    document.getElementById('modal-body').innerHTML = `<div style="text-align:center; padding:20px; font-size:1.1em; color:var(--text-primary);">${msg}</div>`;
    
    document.getElementById('modal-save-btn').style.display = 'block';
    document.getElementById('modal-save-btn').innerHTML = 'EVET, DEVAM ET';
    document.getElementById('modal-save-btn').className = 'btn btn-danger';
    document.getElementById('modal-save-btn').onclick = () => {
        onConfirm();
        closeModal();
    };
    modal.classList.add('active');
}

window.filterOrders = function() {
    const status = document.getElementById('filter-status').value;
    const company = document.getElementById('filter-company').value;
    const search = document.getElementById('filter-search').value.toLowerCase();
    
    document.querySelectorAll('#orders-tbody tr').forEach(row => {
        const rowStatus = row.querySelector('.badge').textContent;
        const rowCompany = row.cells[2].textContent; // ID is cells[1], Company is cells[2]
        const rowId = row.cells[1].textContent.toLowerCase();
        
        const matchStatus = !status || rowStatus === status;
        const matchCompany = !company || rowCompany === company;
        const matchSearch = !search || rowId.includes(search);
        
        if(matchStatus && matchCompany && matchSearch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

window.calcOrderRow = function(index) {
    const parent = document.getElementById('modal-body');
    if(!parent) return;
    const px = parseFloat(parent.querySelector('.edit-px[data-index="'+index+'"]').value) || 0;
    const tr = parseFloat(parent.querySelector('.edit-tr[data-index="'+index+'"]').value) || 0;
    const dr = parseFloat(parent.querySelector('.edit-dr[data-index="'+index+'"]').value) || 0;
    const qty = parseInt(parent.querySelector('.edit-qty[data-index="'+index+'"]').value) || 0;
    
    // Updates Inclusive Price
    parent.querySelector('.edit-pi[data-index="'+index+'"]').value = (px * (1 + tr/100)).toFixed(2);
    // Updates Line Total
    parent.querySelector('.row-total[data-index="'+index+'"]').innerText = (px * qty * (1 - dr/100) * (1 + tr/100)).toFixed(2);
}

window.calcOrderRowIncl = function(index) {
    const parent = document.getElementById('modal-body');
    if(!parent) return;
    const pi = parseFloat(parent.querySelector('.edit-pi[data-index="'+index+'"]').value) || 0;
    const tr = parseFloat(parent.querySelector('.edit-tr[data-index="'+index+'"]').value) || 0;
    
    // Calculate Base Price from Inclusive Price
    const px = pi / (1 + tr/100);
    parent.querySelector('.edit-px[data-index="'+index+'"]').value = px.toFixed(2);
    
    window.calcOrderRow(index);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const user = await initSession();
    if(user) {
        if(user.role === 'warehouse') {
            // Admin olmayan sekmeleri gizle
            document.querySelectorAll('.tab-btn').forEach(btn => {
                const target = btn.getAttribute('data-target');
                if(target !== 'orders') btn.style.display = 'none';
            });
        }

        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', switchTab));
        
        let initialTab = 'orders';
        if(user.role === 'admin') initialTab = 'dashboard';
        
        const firstTab = document.querySelector('.tab-btn[data-target="' + initialTab + '"]');
        if(firstTab) switchTab({ currentTarget: firstTab });
    }
});

// --- SUBSCRIPTION & PAYMENT ---
async function renderSubscriptionTab() {
    try {
        const sub = await adminApi('GET', '/api/admin/subscription-status');
        const expiryDate = new Date(sub.expiry);
        const diff = expiryDate - new Date();
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        let statusColor = daysLeft > 7 ? 'var(--neon-green)' : 'var(--neon-red)';
        if (sub.status === 'suspended') statusColor = 'var(--neon-red)';

        let html = `
            <div class="action-bar">
                <h2 class="brand">💎 Abonelik ve Lisans Yönetimi</h2>
            </div>

            <div class="dashboard-row">
                <div class="glass-card" style="border-color: ${statusColor};">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:20px;">Mevcut Paket Durumu</h3>
                    <div style="text-align:center; padding:20px;">
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">AKTİF PAKET</div>
                        <div class="stat-value" style="color:var(--neon-cyan);">${sub.plan.toUpperCase()}</div>
                        
                        <div style="margin-top:30px;">
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">KALAN SÜRE</div>
                            <div style="font-size:2.5rem; font-weight:bold; color:${statusColor};">${daysLeft} GÜN</div>
                            <div style="font-size:0.8rem; opacity:0.6;">Bitiş: ${expiryDate.toLocaleDateString('tr-TR')}</div>
                        </div>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:20px;">Hızlı İşlemler</h3>
                    <div style="display:flex; flex-direction:column; gap:15px; padding:10px;">
                        <button class="btn-glow-premium" onclick="window.location.href='/checkout.html'" style="width:100%; padding:15px;">🚀 PAKETİ YÜKSELT / UZAT</button>
                        <p style="font-size:0.8rem; color:var(--text-secondary); text-align:center;">
                            Paketinizi yükselterek daha fazla kullanıcı, sınırsız ürün girişi ve gelişmiş analiz özelliklerine sahip olabilirsiniz.
                        </p>
                        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.05); margin:10px 0;">
                        <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; font-size:0.85rem;">
                            <b style="color:var(--neon-purple);">Ödeme Bilgisi:</b><br>
                            Kredi kartı ile yapacağınız ödemeler anında onaylanır ve paketiniz saniyeler içinde güncellenir.
                        </div>
                    </div>
                </div>
            </div>

            <div class="glass-card" style="margin-top:20px;">
                <h3 class="brand" style="font-size:1.1em; margin-bottom:15px;">Ödeme Geçmişi</h3>
                <p style="text-align:center; padding:30px; opacity:0.5;">Henüz bir ödeme kaydı bulunamadı.</p>
            </div>
        `;
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { 
        showToast('Abonelik bilgileri alınamadı: ' + e.message, 'error'); 
    }
}