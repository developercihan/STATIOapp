
let csrfToken = '';
let currentUser = null;

let sidebarLocked = true;
const DEFAULT_SIDEBAR_ORDER = [
    { id: 'dashboard', type: 'link', label: '📊 Gösterge Paneli', target: 'dashboard' },
    
    { id: 'ops_group', type: 'group', label: '🚀 OPERASYONEL İŞLEMLER', color: 'var(--neon-cyan)', items: [
        { label: '● Sipariş Takibi', onclick: "switchTabById('orders')" },
        { label: '● Satış Faturaları', onclick: "renderInvoicesTab('INVOICE', 'SALES')" },
        { label: '● Alış Faturaları', onclick: "renderInvoicesTab('INVOICE', 'PURCHASE')" },
        { label: '● e-İrsaliyeler', onclick: "renderInvoicesTab('DESPATCH')" },
        { label: '● Depo Yönetimi', onclick: "switchTabById('warehouses')" },
        { divider: true },
        { label: '➕ Hızlı Satış Faturası', color: 'var(--neon-green)', onclick: "openQuickInvoiceModal('INVOICE')" }
    ]},

    { id: 'mgmt_group', type: 'group', label: '📁 PORTFÖY VE YÖNETİM', color: 'var(--neon-purple)', items: [
        { label: '● Ürün Yönetimi', onclick: "switchTabById('products')" },
        { label: '● Cariler (Müşteriler)', onclick: "switchTabById('companies')" },
        { label: '● Bölge Plasiyerleri', onclick: "switchTabById('distributors')" },
        { label: '● Kullanıcı Yetkileri', onclick: "switchTabById('users')" }
    ]},

    { id: 'finance_group', type: 'group', label: '💰 FİNANSAL YÖNETİM', color: 'var(--neon-green)', items: [
        { label: '● Kasa / Nakit Akışı', onclick: "renderCashTab()" },
        { label: '● Cari Hesap Ekstreleri', onclick: "switchTabById('receivables')" },
        { label: '● Çek / Senet Takibi', onclick: "renderNotesTab()" }
    ]},

    { id: 'system_group', type: 'group', label: '⚙️ SİSTEM VE AYARLAR', color: 'var(--text-dim)', items: [
        { label: '● Mağaza & Tema Ayarları', onclick: "switchTabById('settings')" },
        { label: '● XML Veri Entegrasyonu', onclick: "switchTabById('xml')" },
        { label: '● Veritabanı Yedeği', onclick: "switchTabById('backup')" }
    ]}
];

async function initSession() {
    try {
        const r = await fetch('/api/auth/me?t=' + Date.now());
        if (!r.ok) { window.location.href = '/login.html'; return null; }
        const d = await r.json();
        csrfToken = d.csrfToken;
        currentUser = d.user;
        
        // --- WHITE LABEL TEMA UYGULA ---
        if (window.applyTenantTheme) window.applyTenantTheme(currentUser.tenant);

        // --- MENÜ SENKRONİZASYONU (Kategorize Versiyon) ---
        let currentOrder = JSON.parse(localStorage.getItem('sidebarOrder')) || [];
        const hasOpsGroup = currentOrder.find(i => i.id === 'ops_group');
        const hasAlisFat = hasOpsGroup && hasOpsGroup.items.find(sub => sub.label.includes('Alış Faturaları'));

        if (currentOrder.length > 0 && (!hasOpsGroup || !hasAlisFat)) {
            localStorage.removeItem('sidebarOrder'); // Eski menüyü sil ki yeni kategori düzeni ve linkler gelsin
            window.location.reload(); 
        }

        if(currentUser.role !== 'admin' && currentUser.role !== 'superadmin' && currentUser.role !== 'warehouse') {
            window.location.href = '/404.html';
        }
        
        // Update Profile Elements
        const initial = document.getElementById('user-initial');
        const name = document.getElementById('user-display-name');
        const role = document.getElementById('user-display-role');
        
        if(initial) initial.textContent = currentUser.displayName.charAt(0).toUpperCase();
        if(name) name.textContent = currentUser.displayName.toUpperCase();
        
        const roleMap = {
            'admin': 'YÖNETİCİ',
            'superadmin': 'SİSTEM YÖNETİCİSİ',
            'warehouse': 'DEPO SORUMLUSU',
            'distributor': 'SATIŞ TEMSİLCİSİ'
        };
        if(role) role.textContent = roleMap[currentUser.role] || currentUser.role.toUpperCase();

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

window.openModal = function() {
    const m = document.getElementById('admin-modal');
    if(m) m.classList.add('active');
}
window.closeModal = function() {
    const m = document.getElementById('admin-modal');
    if(m) m.classList.remove('active');
}

window.resetModalBtn = function(text = 'KAYDET', className = 'btn btn-premium-save', show = true) {
    const btn = document.getElementById('modal-save-btn');
    if (!btn) return;
    btn.textContent = text;
    btn.className = className;
    btn.style.display = show ? 'block' : 'none';
    
    // Diğerlerini gizle
    ['modal-pdf-btn', 'modal-delete-btn', 'modal-send-btn'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
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

window.switchTabById = function(targetId) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        if(b.getAttribute('data-target') === targetId) b.classList.add('active');
        else b.classList.remove('active');
    });
    
    const content = document.getElementById('main-content');
    content.innerHTML = `<div style="text-align:center; padding: 50px;"><h2>VERİLER ALINIYOR...</h2><div class="glow-pulse" style="width:40px; height:40px; border:2px solid var(--neon-cyan); border-radius:50%; margin: 20px auto; border-top-color:transparent; animation: rotate 1s linear infinite;"></div></div>`;
    
    if(targetId === 'dashboard') renderDashboardTab();
    else if(targetId === 'orders') renderOrdersTab();
    else if(targetId === 'invoices') renderInvoicesTab();
    else if(targetId === 'products') renderProductsTab();
    else if(targetId === 'distributors') renderDistributorsTab();
    else if(targetId === 'companies') renderCompaniesTab();
    else if(targetId === 'users') renderUsersTab();
    else if(targetId === 'xml') renderXmlTab();
    else if(targetId === 'settings') renderSettingsTab();
    else if(targetId === 'warehouses') renderWarehousesTab();
    else if(targetId === 'receivables') renderReceivablesTab();
    else if(targetId === 'cash') renderCashTab();
    else if(targetId === 'notes') renderNotesTab();
    else if(targetId === 'subscription') renderSubscriptionTab();
    else if(targetId === 'backup') renderBackupTab();
    else renderDashboardTab(); // Default
    
    // Close profile dropdown if open
    const dropdown = document.getElementById('profile-dropdown');
    if(dropdown) dropdown.classList.remove('active');
}

function switchTab(event) {
    const targetId = event.currentTarget.getAttribute('data-target');
    window.switchTabById(targetId);
}

window.toggleNavGroup = function(event) {
    event.stopPropagation();
    const group = event.currentTarget.closest('.nav-group');
    if(group) {
        group.classList.toggle('active');
    }
}

window.renderSidebar = function() {
    const nav = document.getElementById('sidebar-nav');
    if(!nav) return;

    let order = JSON.parse(localStorage.getItem('sidebarOrder')) || DEFAULT_SIDEBAR_ORDER;
    nav.innerHTML = '';

    order.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'nav-item-wrapper';
        div.draggable = !sidebarLocked;
        div.dataset.index = index;
        div.dataset.id = item.id;
        if(!sidebarLocked) div.style.cursor = 'move';

        if(!sidebarLocked) {
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            div.addEventListener('dragend', handleDragEnd);
        }

        if(item.type === 'link') {
            div.innerHTML = `<a href="javascript:void(0)" class="nav-link tab-btn ${localStorage.getItem('lastAdminTab') === item.target ? 'active' : ''}" data-target="${item.target}">${item.label}</a>`;
        } else if(item.type === 'group') {
            const subItems = item.items.map(sub => {
                if(sub.divider) return `<div style="border-top:1px dashed rgba(255,255,255,0.1); margin: 5px 10px; padding-top:5px;"></div>`;
                return `<a href="javascript:void(0)" class="nav-sub-link" style="color:${sub.color || 'inherit'}" onclick="${sub.onclick}">${sub.label}</a>`;
            }).join('');

            div.innerHTML = `
                <div class="nav-group">
                    <div class="nav-link nav-group-header" style="color:${item.color || 'inherit'}" onclick="toggleNavGroup(event)">${item.label}</div>
                    <div class="nav-sub-menu">${subItems}</div>
                </div>
            `;
        }
        nav.appendChild(div);
    });

    // Re-bind tab clicks
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTabById(btn.dataset.target);
    });
}

window.toggleSidebarLock = function() {
    sidebarLocked = !sidebarLocked;
    const btn = document.getElementById('sidebar-lock-btn');
    btn.textContent = sidebarLocked ? '🔒' : '🔓';
    btn.style.opacity = sidebarLocked ? '0.6' : '1';
    btn.title = sidebarLocked ? 'Sıralamayı Düzenle' : 'Düzenlemeyi Bitir ve Kilitle';
    if(sidebarLocked) showToast('Sıralama kaydedildi ve kilitlendi.');
    else showToast('Düzenleme modu aktif: Menüleri yukarı-aşağı sürükleyebilirsiniz.', 'info');
    renderSidebar();
}

let dragSrcEl = null;
function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
}
function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}
function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (dragSrcEl !== this) {
        let order = JSON.parse(localStorage.getItem('sidebarOrder')) || DEFAULT_SIDEBAR_ORDER;
        const fromIdx = parseInt(dragSrcEl.dataset.index);
        const toIdx = parseInt(this.dataset.index);
        
        const item = order.splice(fromIdx, 1)[0];
        order.splice(toIdx, 0, item);
        
        localStorage.setItem('sidebarOrder', JSON.stringify(order));
        renderSidebar();
    }
    return false;
}
function handleDragEnd(e) {
    this.style.opacity = '1';
}


window.openQuickInvoiceModal = async function(docType) {
    window.resetModalBtn();
    try {
        const companies = await adminApi('GET', '/api/companies');
        const products = await adminApi('GET', '/api/products');
        const settingsRes = await adminApi('GET', '/api/admin/settings');
        const settings = settingsRes.settings || {};
        
        let quickItems = [];
        let selectedCompanies = [];

        window.resetModalBtn('🚀 SEÇİLİ TÜM CARİLERE KES VE RESMİLEŞTİR', docType === 'DESPATCH' ? 'btn btn-premium-irsaliye' : 'btn btn-premium-fatura');
        document.getElementById('modal-title').textContent = docType === 'INVOICE' ? '➕ Yeni e-Fatura Oluştur (Toplu İşlem Destekli)' : '🚚 Yeni e-İrsaliye Oluştur (Toplu İşlem Destekli)';
        
        const modalContent = document.querySelector('.modal-content');
        if(modalContent) modalContent.style.maxWidth = '1250px';

        document.getElementById('modal-body').innerHTML = `
            <div class="form-group full-width">
                <label>Cari / Firma Arayın (Birden Fazla Seçebilirsiniz)</label>
                <div class="search-container">
                    <input type="text" id="qi-company-search" placeholder="Firma adı veya kod yazın..." style="width:100%; height:45px; font-size:1.1em;">
                    <div id="qi-company-results" class="search-results"></div>
                </div>
                <div id="qi-selected-companies-list" style="margin-top:15px; display:flex; flex-wrap:wrap; gap:10px; min-height:35px;"></div>
            </div>

            <div class="glass-card full-width" style="margin-bottom:15px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h4 style="color:var(--neon-purple); margin:0; font-size:1.2em;">📦 Fatura İçeriği (Tüm Carilere Aynı Ürünler Kesilecektir)</h4>
                    <div class="search-container" style="width:350px;">
                        <input type="text" id="qi-product-search" placeholder="Ürün ara ve ekle..." style="height:40px; padding:0 15px;">
                        <div id="qi-product-results" class="search-results"></div>
                    </div>
                </div>
                <div style="overflow-x:auto;">
                    <table class="data-table" style="width:100%; min-width:1000px; border-collapse: separate; border-spacing: 0 8px;">
                        <thead>
                            <tr style="background:none;">
                                <th style="width:60px; text-align:center;">Görsel</th>
                                <th style="width:130px;">Ürün Kodu</th>
                                <th>Ürün Adı</th>
                                <th style="width:80px; text-align:center;">Miktar</th>
                                <th style="width:110px; text-align:center;">B.Fiyat</th>
                                <th style="width:80px; text-align:center;">İsk%</th>
                                <th style="width:80px; text-align:center;">KDV%</th>
                                <th style="width:130px; text-align:right;">Satır Toplamı</th>
                                <th style="width:40px; text-align:center;"></th>
                            </tr>
                        </thead>
                        <tbody id="qi-items-body"></tbody>
                    </table>
                </div>
                <div style="text-align:right; margin-top:15px; padding:20px; border-top:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); border-radius:12px;">
                    <div style="font-size:1em; opacity:0.7; margin-bottom:5px;">Toplam KDV: <b id="qi-tax-total">0.00 ₺</b></div>
                    <div style="font-size:1.5em; color:var(--neon-green); font-weight:bold;">TEK BELGE TOPLAMI: <b id="qi-final-total">0,00 ₺</b></div>
                </div>
            </div>

            ${docType === 'DESPATCH' ? `
                <div class="full-width glass-card" style="padding:20px; border-color:var(--neon-cyan);">
                    <h4 style="color:var(--neon-cyan); margin-bottom:15px; font-size:1.1em;">🚚 Taşıyıcı / Lojistik Bilgileri (Tüm İrsaliyeler İçin Geçerli)</h4>
                    <div style="display:grid; grid-template-columns: 1fr 2fr 1fr; gap:15px;">
                        <div><label style="font-size:0.8em; opacity:0.6;">Taşıyıcı VKN</label><input type="text" id="qi-carrier-tax" value="${settings.carrierTaxNumber || ''}" style="height:35px;"></div>
                        <div><label style="font-size:0.8em; opacity:0.6;">Taşıyıcı Ünvan</label><input type="text" id="qi-carrier-name" value="${settings.carrierName || ''}" style="height:35px;"></div>
                        <div><label style="font-size:0.8em; opacity:0.6;">Araç Plakası</label><input type="text" id="qi-carrier-plate" value="${settings.carrierPlate || ''}" style="height:35px;"></div>
                    </div>
                </div>
            ` : ''}
        `;

        const renderSelectedCompanies = () => {
            const list = document.getElementById('qi-selected-companies-list');
            list.innerHTML = selectedCompanies.map(c => `
                <div style="background:rgba(0,243,255,0.1); padding:5px 15px; border-radius:20px; border:1px solid var(--neon-cyan); display:flex; align-items:center; gap:8px; font-size:0.9em; color:var(--neon-cyan);">
                    <span>✅ ${c.ad} (${c.kod})</span>
                    <button onclick="removeQuickCompany('${c.kod}')" style="background:none; border:none; color:var(--neon-red); cursor:pointer; font-weight:bold;">✕</button>
                </div>
            `).join('');
        };

        window.removeQuickCompany = (kod) => {
            selectedCompanies = selectedCompanies.filter(x => x.kod !== kod);
            renderSelectedCompanies();
        };

        const renderItems = () => {
            const body = document.getElementById('qi-items-body');
            body.innerHTML = quickItems.map((item, idx) => `
                <tr style="background: rgba(255,255,255,0.03); border-radius:8px;">
                    <td style="text-align:center; padding:10px;"><img src="${item.image || '/assets/no-image.png'}" style="width:45px; height:45px; border-radius:8px; object-fit:cover; border:1px solid var(--glass-border);"></td>
                    <td style="font-family:monospace; color:var(--neon-cyan); font-weight:bold; font-size:0.9em; padding-left:10px;">${item.kod}</td>
                    <td style="font-size:0.95em; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:300px;">${item.ad}</td>
                    <td><input type="number" class="qi-item-qty" data-idx="${idx}" value="${item.qty}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
                    <td><input type="number" class="qi-item-price" data-idx="${idx}" value="${item.priceExclTax}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
                    <td><input type="number" class="qi-item-disc" data-idx="${idx}" value="${item.discountRate || 0}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
                    <td><input type="number" class="qi-item-taxrate" data-idx="${idx}" value="${item.taxRate || 20}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
                    <td style="text-align:right; color:var(--neon-cyan); font-weight:bold; font-size:1.1em; padding-right:15px;" id="qi-item-total-${idx}">${(item.lineTotal || 0).toLocaleString('tr-TR')} ₺</td>
                    <td style="text-align:center;"><button class="btn" onclick="removeQuickItem(${idx})" style="color:var(--neon-red); border:none; background:none;">✕</button></td>
                </tr>
            `).join('');
            recalculateQuickInvoice();
        };

        window.removeQuickItem = (idx) => {
            quickItems.splice(idx, 1);
            renderItems();
        };

        const recalculateQuickInvoice = () => {
            let totalExcl = 0, totalTax = 0;
            const qtys = document.querySelectorAll('.qi-item-qty');
            const prices = document.querySelectorAll('.qi-item-price');
            const discs = document.querySelectorAll('.qi-item-disc');
            const taxRates = document.querySelectorAll('.qi-item-taxrate');

            quickItems.forEach((item, idx) => {
                item.qty = parseFloat(qtys[idx].value) || 0;
                item.priceExclTax = parseFloat(prices[idx].value) || 0;
                item.discountRate = parseFloat(discs[idx].value) || 0;
                item.taxRate = parseFloat(taxRates[idx].value) || 0;
                const discounted = (item.priceExclTax * item.qty) * (1 - item.discountRate/100);
                const tax = discounted * (item.taxRate / 100);
                item.lineTotal = discounted + tax;
                totalExcl += discounted;
                totalTax += tax;
                const totalEl = document.getElementById(`qi-item-total-${idx}`);
                if(totalEl) totalEl.textContent = item.lineTotal.toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' ₺';
            });
            document.getElementById('qi-tax-total').textContent = totalTax.toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' ₺';
            document.getElementById('qi-final-total').textContent = (totalExcl + totalTax).toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' ₺';
        };

        const coInput = document.getElementById('qi-company-search');
        const coResults = document.getElementById('qi-company-results');
        
        coInput.oninput = () => {
            const q = coInput.value.toLocaleLowerCase('tr');
            if(q.length < 1) { coResults.classList.remove('active'); return; }
            const filtered = companies.filter(c => (c.ad||'').toLocaleLowerCase('tr').includes(q) || (c.cariKod||'').toLocaleLowerCase('tr').includes(q)).slice(0, 10);
            if(filtered.length > 0) {
                coResults.innerHTML = filtered.map(c => `
                    <div class="search-item" onclick="selectQuickCompany('${c.cariKod}', '${(c.ad||c.cariKod).replace(/'/g,"\\'")}')">
                        <div class="search-avatar">${(c.ad || '?')[0].toUpperCase()}</div>
                        <div class="search-info">
                            <b>${c.ad || c.cariKod}</b>
                            <div class="search-details">
                                <div class="detail-group"><span class="detail-label">Kod:</span><span class="detail-value value-cyan">${c.cariKod}</span></div>
                                <div class="detail-group"><span class="detail-label">Şehir:</span><span class="detail-value">${c.sehir || '-'}</span></div>
                            </div>
                        </div>
                    </div>
                `).join('');
                coResults.classList.add('active');
            } else { coResults.classList.remove('active'); }
        };

        window.selectQuickCompany = (kod, ad) => {
            if(!selectedCompanies.find(x => x.kod === kod)) { selectedCompanies.push({ kod, ad }); }
            renderSelectedCompanies();
            coResults.classList.remove('active');
            coInput.value = '';
        };

        const prInput = document.getElementById('qi-product-search');
        const prResults = document.getElementById('qi-product-results');
        
        prInput.oninput = () => {
            const q = prInput.value.toLocaleLowerCase('tr');
            if(q.length < 1) { prResults.classList.remove('active'); return; }
            const filtered = products.filter(p => p.ad.toLocaleLowerCase('tr').includes(q) || p.kod.toLocaleLowerCase('tr').includes(q)).slice(0, 10);
            if(filtered.length > 0) {
                prResults.innerHTML = filtered.map(p => `
                    <div class="search-item" onclick="addQuickProduct('${p.id}')">
                        <img class="search-avatar" src="${p.image || '/assets/no-image.png'}" style="object-fit:cover;">
                        <div class="search-info">
                            <b>${p.ad}</b>
                            <div class="search-details">
                                <div class="detail-group"><span class="detail-label">Kod:</span><span class="detail-value value-cyan">${p.kod}</span></div>
                                <div class="detail-group"><span class="detail-label">Fiyat:</span><span class="detail-value value-green">₺${(p.satisFiyati || 0).toLocaleString('tr-TR')}</span></div>
                                <div class="detail-group"><span class="detail-label">Stok:</span><span class="detail-value value-cyan">${p.stok || 0}</span></div>
                            </div>
                        </div>
                    </div>
                `).join('');
                prResults.classList.add('active');
            } else { prResults.classList.remove('active'); }
        };

        window.addQuickProduct = (pid) => {
            const p = products.find(x => x.id === pid);
            if(p) {
                quickItems.push({
                    id: p.id, ad: p.ad, kod: p.kod, image: p.image, qty: 1, priceExclTax: p.priceExclTax, taxRate: p.taxRate, discountRate: 0,
                    lineTotal: p.priceExclTax * (1 + p.taxRate/100)
                });
                renderItems();
            }
            prResults.classList.remove('active');
            prInput.value = '';
        };

        document.getElementById('modal-body').addEventListener('input', (e) => {
            if(e.target.classList.contains('qi-item-qty') || e.target.classList.contains('qi-item-price') || e.target.classList.contains('qi-item-disc') || e.target.classList.contains('qi-item-taxrate')) recalculateQuickInvoice();
        });

        document.getElementById('modal-save-btn').onclick = async () => {
            if(selectedCompanies.length === 0) return showToast('Lütfen en az bir firma seçin.', 'error');
            if(quickItems.length === 0) return showToast('Lütfen en az bir ürün ekleyin.', 'error');
            
            const totalAmount = parseFloat(document.getElementById('qi-final-total').textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
            const taxAmount = parseFloat(document.getElementById('qi-tax-total').textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

            const payload = {
                companyIds: selectedCompanies.map(c => c.kod),
                docType,
                details: JSON.stringify(quickItems.map(i => ({
                    productId: i.id,
                    ad: i.ad,
                    kod: i.kod,
                    qty: i.qty,
                    priceExclTax: i.priceExclTax,
                    discountRate: i.discountRate,
                    taxRate: i.taxRate,
                    lineTotal: i.lineTotal
                }))),
                totalAmount,
                taxAmount,
                carrierInfo: docType === 'DESPATCH' ? {
                    taxNumber: document.getElementById('qi-carrier-tax').value,
                    name: document.getElementById('qi-carrier-name').value,
                    plate: document.getElementById('qi-carrier-plate').value
                } : null
            };

            try {
                const res = await adminApi('POST', '/api/invoices/quick', payload);
                showToast(res.message, 'success');
                closeModal();
                renderInvoicesTab(docType);
            } catch(e) { showToast('Hata: ' + e.message, 'error'); }
        };

        document.getElementById('admin-modal').classList.add('active');
        document.addEventListener('click', (e) => {
            const coRes = document.getElementById('qi-company-results');
            const prRes = document.getElementById('qi-product-results');
            if(!e.target.closest('.search-container')) {
                if(coRes) coRes.classList.remove('active');
                if(prRes) prRes.classList.remove('active');
            }
        });
    } catch(e) { console.error(e); showToast('Hata: ' + e.message, 'error'); }
}

async function renderDashboardTab() {
    try {
        const stats = await adminApi('GET', '/api/stats/dashboard');
        let html = `
            <div class="action-bar">
                <h2 class="brand">📊 Yönetim Paneli</h2>
                <div style="display:flex; gap:10px;">
                    <button class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="renderDashboardTab()">🔄 Yenile</button>
                </div>
            </div>
            
            <div class="stats-grid" style="grid-template-columns: repeat(5, 1fr);">
                <div class="glass-card stat-item" style="border-bottom: 2px solid var(--neon-cyan); cursor:pointer;" onclick="showCashDetails('BANKA')">
                    <div class="label">🏦 Banka Bakiyesi</div>
                    <div class="value" style="color:var(--neon-cyan);">${formatCurrency(stats.bankBalance)}</div>
                </div>
                <div class="glass-card stat-item" style="border-bottom: 2px solid var(--neon-green); cursor:pointer;" onclick="showCashDetails('KASA')">
                    <div class="label">💵 Kasa Bakiyesi</div>
                    <div class="value" style="color:var(--neon-green);">${formatCurrency(stats.cashBalance)}</div>
                </div>
                <div class="glass-card stat-item" style="border-bottom: 2px solid var(--neon-blue); cursor:pointer;" onclick="showCashDetails('SENET')">
                    <div class="label">📜 Senet Portföyü</div>
                    <div class="value" style="color:var(--neon-blue);">${formatCurrency(stats.senetBalance || 0)}</div>
                </div>
                <div class="glass-card stat-item" style="border-bottom: 2px solid var(--neon-pink); cursor:pointer;" onclick="showCashDetails('KREDI_KARTI')">
                    <div class="label">💳 KK Harcamaları</div>
                    <div class="value" style="color:var(--neon-pink);">${formatCurrency(stats.ccSpend)}</div>
                </div>
                <div class="glass-card stat-item" style="border-bottom: 2px solid var(--neon-purple);">
                    <div class="label">📈 Tahmini Net Kar</div>
                    <div class="value" style="color:${stats.profitability >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'}; font-size:1.6em;">${formatCurrency(stats.profitability)}</div>
                </div>
            </div>
            
            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; margin-top:20px;">
                <div class="glass-card stat-item" style="opacity:0.8;">
                    <div class="label">Toplam Satış (Fatura)</div>
                    <div class="value" style="font-size:1.4em;">${formatCurrency(stats.totalSales)}</div>
                </div>
                <div class="glass-card stat-item" style="opacity:0.8;">
                    <div class="label">Toplam Alış (Fatura)</div>
                    <div class="value" style="font-size:1.4em;">${formatCurrency(stats.totalPurchase)}</div>
                </div>
            </div>

            <div class="glass-card" style="margin-top:20px; padding:20px; display:grid; grid-template-columns: 1fr 1fr; align-items:center;">
                <div>
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:10px;">📊 Mali Bilanço Özeti</h3>
                    <p style="font-size:0.9em; opacity:0.7;">Satış ve Alış faturaları arasındaki oransal dağılımı gösterir.</p>
                </div>
                <div style="height:250px;">
                    <canvas id="salesChart"></canvas>
                </div>
            </div>
            
            <div class="dashboard-row" style="margin-top:20px;">
                <div class="glass-card" style="flex:1;">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:20px; padding:20px 20px 0 20px;">🏢 En Çok İşlem Yapan Cariler</h3>
                    <div style="padding:0 20px 20px 20px;">
                        <table class="data-table" style="font-size:0.9em;">
                            <thead><tr><th>Müşteri</th><th style="text-align:right;">İşlem Sıklığı</th><th style="text-align:right;">Toplam Hacim</th></tr></thead>
                            <tbody>
                                ${stats.topCompanies.map(c => `
                                    <tr onclick="showCompanyStatsDetail('${c.code}', '${c.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
                                        <td>${c.name}</td>
                                        <td style="text-align:right;">${c.count}</td>
                                        <td style="text-align:right; font-weight:bold; color:var(--neon-green);">${formatCurrency(c.total)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="glass-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; margin-top:0;">
                    <h3 class="brand" style="font-size:1.1em; margin-bottom:15px;">Hızlı Özet</h3>
                    <p style="color:var(--text-secondary); max-width:300px; font-size:0.9em;">
                        ${stats.totalInvoices > 0 ? `Sistemdeki resmi <b>Satış</b> ve <b>Alış</b> faturaları üzerinden hesaplanan mali verilerdir.` : `<b style="color:var(--neon-pink);">Sistemde henüz kesilmiş fatura bulunamadı.</b> Verilerin görünmesi için önce siparişleri faturalandırın.`}
                    </p>
                    <div style="display:flex; gap:10px; margin-top:15px;">
                        <button class="btn" style="border-color:var(--neon-purple); color:var(--neon-purple); font-size:0.8em;" onclick="openInitialBalanceModal()">📂 Bakiye Devri Yap</button>
                        <button class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.8em;" onclick="renderDashboardTab()">🔄 Yenile</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('main-content').innerHTML = html;

        // Initialize Chart
        setTimeout(() => {
            const ctx = document.getElementById('salesChart').getContext('2d');
            
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Toplam Satış', 'Toplam Alış'],
                    datasets: [{
                        data: [stats.totalSales, stats.totalPurchase],
                        backgroundColor: ['#00ff9f', '#ff0066'],
                        borderColor: 'rgba(0,0,0,0.5)',
                        borderWidth: 2,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#fff', font: { family: 'Outfit', size: 12 } }
                        }
                    }
                }
            });
        }, 100);

    } catch(e) { 
        console.error(e);
        showToast('İstatistikler yüklenemedi: ' + e.message, 'error'); 
    }
}

// Detaylı Kasa Raporu
window.showCashDetails = async function(accountType) {
    try {
        const transactions = await adminApi('GET', '/api/admin/cash-transactions');
        const filtered = transactions.filter(t => (t.accountType || '').toUpperCase() === accountType);
        
        window.resetModalBtn('', '', false);
        document.getElementById('modal-title').textContent = `${accountType.replace('_', ' ')} Detaylı Rapor`;
        
        let html = `
            <div class="full-width glass-card" style="padding:15px;">
                <table class="data-table" style="font-size:0.85em;">
                    <thead><tr><th>Tarih</th><th>Açıklama</th><th>Cari</th><th>Tür</th><th style="text-align:right;">Tutar</th></tr></thead>
                    <tbody>
                        ${filtered.map(t => {
                            let descHtml = t.description;
                            const orderId = t.orderId || t.invoiceId || t.id;
                            if(orderId) {
                                const clickFn = (t.type === 'INVOICE') 
                                    ? `viewInvoiceDetails('${orderId}')` 
                                    : (['PAYMENT', 'TAHSILAT', 'ODEME'].includes(t.type) ? `viewCashDetails('${orderId}')` : `viewOrderDetails('${orderId}')`);
                                
                                descHtml = `<span style="cursor:pointer; text-decoration:underline; border-bottom:1px dashed var(--neon-pink);" 
                                                  onclick="event.stopPropagation(); ${clickFn}" 
                                                  title="Detayları Gör">
                                              ${t.notes || t.description || 'Detay'} 🔍
                                            </span>`;
                            }
                            return `
                            <tr>
                                <td>${new Date(t.date).toLocaleDateString('tr-TR')}</td>
                                <td>${descHtml}</td>
                                <td>${t.companyName || t.cariCode}</td>
                                <td><span class="badge ${t.type === 'TAHSILAT' || t.type === 'GELIR' || t.type === 'DEVIR' ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
                                <td style="text-align:right; font-weight:bold;">${formatCurrency(t.amount)}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
                ${filtered.length === 0 ? '<div style="text-align:center; padding:20px; opacity:0.5;">İşlem bulunamadı.</div>' : ''}
            </div>
        `;
        document.getElementById('modal-body').innerHTML = html;
        openModal();
    } catch(e) { console.error(e); }
}

// Devir Bakiyesi Girişi
window.openInitialBalanceModal = function() {
    window.resetModalBtn('KAYDET', 'btn btn-premium-save', true);
    document.getElementById('modal-title').textContent = 'Açılış Bakiyesi (Devir) Girişi';
    
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Hesap Türü</label>
            <select id="devir-account" class="form-control">
                <option value="BANKA">BANKA HESABI</option>
                <option value="KASA">NAKİT KASA</option>
                <option value="KREDI_KARTI">KREDİ KARTI (Borç/Harcama)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Tarih</label>
            <input type="date" id="devir-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group full-width">
            <label>Mevcut Bakıye (₺)</label>
            <input type="number" id="devir-amount" class="form-control" placeholder="Örn: 200000">
        </div>
        <div class="form-group full-width">
            <label>Açıklama</label>
            <input type="text" id="devir-notes" class="form-control" value="Sistem Açılış Bakiyesi">
        </div>
    `;
    
    document.getElementById('modal-save-btn').onclick = async () => {
        const data = {
            type: 'DEVIR',
            cariCode: 'SISTEM',
            amount: document.getElementById('devir-amount').value,
            accountType: document.getElementById('devir-account').value,
            date: document.getElementById('devir-date').value,
            notes: document.getElementById('devir-notes').value,
            receiptCode: 'DEVIR-' + Date.now().toString().slice(-4)
        };
        
        try {
            await adminApi('POST', '/api/admin/cash-transactions', data);
            showToast('Devir bakiyesi başarıyla kaydedildi');
            closeModal();
            renderDashboardTab();
        } catch(e) { showToast('Hata: ' + e.message, 'error'); }
    };
    
    openModal();
}

window.viewInvoiceDetails = async function(id) {
    try {
        window.resetModalBtn('', '', false);
        const inv = await adminApi('GET', `/api/invoices/${id}`);
        
        document.getElementById('modal-title').textContent = `${inv.docType === 'DESPATCH' ? 'İrsaliye' : 'Fatura'} Detayı: ${inv.invoiceNo}`;
        
        let details = [];
        try { details = JSON.parse(inv.details); } catch(e) {}

        let itemsHtml = details.map(i => {
            const qty = parseFloat(i.qty || i.miktar || 0);
            const price = parseFloat(i.price || i.priceExclTax || 0);
            const name = i.name || i.ad || 'Ürün';
            return `
                <div class="glass-card" style="margin-bottom:10px; padding:12px;">
                    <div style="font-weight:bold; color:var(--neon-cyan);">${name}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.9em;">
                        <span>${qty} x ${price.toLocaleString('tr-TR')} TL</span>
                        <b style="color:var(--neon-green)">${(qty * price).toLocaleString('tr-TR')} TL</b>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('modal-body').innerHTML = `
            <div style="display:flex; flex-direction:column; gap:15px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="glass-card" style="padding:10px;">
                        <small style="opacity:0.6;">CARİ</small>
                        <div style="font-weight:bold;">${inv.companyName}</div>
                    </div>
                    <div class="glass-card" style="padding:10px;">
                        <small style="opacity:0.6;">TARİH</small>
                        <div style="font-weight:bold;">${new Date(inv.date).toLocaleDateString('tr-TR')}</div>
                    </div>
                </div>
                <div class="glass-card" style="padding:10px; border-color:var(--neon-purple);">
                    <small style="opacity:0.6;">ETTN (UUID)</small>
                    <div style="font-size:0.8em; word-break:break-all;">${inv.uuid || '-'}</div>
                </div>
                <div>
                    <b style="display:block; margin-bottom:10px;">KALEMLER</b>
                    ${itemsHtml}
                </div>
                <div class="glass-card" style="padding:15px; border-top:2px solid var(--neon-green);">
                    <div style="display:flex; justify-content:space-between; font-size:1.3em; font-weight:bold; color:var(--neon-green);">
                        <span>TOPLAM TUTAR:</span>
                        <span>${parseFloat(inv.totalAmount).toLocaleString('tr-TR')} TL</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast('Belge bulunamadı: ' + e.message, 'error'); }
}

window.showProductStatsDetail = async function(code, name) {
    try {
        const details = await adminApi('GET', `/api/stats/product/${code}`);
        window.resetModalBtn('', '', false);
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
        window.resetModalBtn('', '', false);
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
        
        window.resetModalBtn('', '', false);
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
        window.resetModalBtn('', '', false);
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
            html += `<tr>
                <td>${p.image ? `<img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : '🖼️'}</td>
                <td style="color:var(--neon-cyan);">${p.kod}</td>
                <td>
                    ${p.ad}
                    ${p.visibility === 'B2B_ONLY' ? '<br><span style="font-size:0.7em;color:var(--neon-purple);">[SADECE B2B]</span>' : ''}
                    ${p.visibility === 'HIDDEN' ? '<br><span style="font-size:0.7em;color:var(--neon-red);">[GİZLİ]</span>' : ''}
                </td>
                <td>${p.priceExclTax?.toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺</td>
                <td style="color:${p.stock <= 0 ? 'var(--neon-red)' : 'var(--neon-green)'}">${p.stock} ${p.unit || 'Adet'}</td>
                <td>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" 
                        onclick="openProductModal('${p.kod}', '${adSafe}', '${p.priceExclTax || 0}', '${p.taxRate || 20}', ${p.stock || 0}, '${p.image || ''}', '${p.barcode || ''}', '${p.unit || 'Adet'}', '${p.category || ''}', '${p.brand || ''}', '${p.description || ''}', '${p.visibility || 'B2B_ONLY'}', '${p.channel || ''}')">Düzenle</button>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteProduct('${p.kod}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.resetModalBtn = function(text = 'KAYDET', className = 'btn btn-primary', show = true) {
    const saveBtn = document.getElementById('modal-save-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const pdfBtn = document.getElementById('modal-pdf-btn');
    const delBtn = document.getElementById('modal-delete-btn');
    const sendBtn = document.getElementById('modal-send-btn');
    
    // Hepsini gizle
    if(pdfBtn) pdfBtn.style.display = 'none';
    if(delBtn) delBtn.style.display = 'none';
    if(sendBtn) sendBtn.style.display = 'none';
    if(saveBtn) saveBtn.style.display = 'none';
    
    const oldExtra = document.getElementById('extra-invoice-btns');
    if(oldExtra) oldExtra.remove();

    if(cancelBtn) {
        cancelBtn.style.display = 'block';
        cancelBtn.className = 'btn btn-premium-close';
    }

    if(saveBtn) {
        saveBtn.innerHTML = text;
        saveBtn.className = className + ' btn-premium-save';
        saveBtn.style.display = show ? 'block' : 'none';
    }
}

window.openProductModal = function(kod='', ad='', priceExclTax=0, taxRate=20, stock=0, image='', barcode='', unit='Adet', category='', brand='', description='', visibility='B2B_ONLY', channel='b2b', discountRate=0) {
    window.resetModalBtn();
    const isEdit = !!kod;
    document.getElementById('modal-title').textContent = isEdit ? 'Ürün Düzenle' : 'Yeni Ürün Kaydı';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:grid; grid-template-columns: 120px 1fr; gap:20px; margin-bottom:20px;">
            <div id="m-image-preview-wrapper" style="width:120px; height:120px; border:2px dashed rgba(255,255,255,0.1); border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; cursor:pointer;" onclick="document.getElementById('m-image-input').click()">
                <div id="m-image-container" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                    ${image ? '<img src="' + image + '" style="width:100%; height:100%; object-fit:cover;">' : '<span style="font-size:0.7em; text-align:center; opacity:0.5;">Resim Seç</span>'}
                </div>
            </div>
            <input type="file" id="m-image-input" style="display:none;" accept="image/*" onchange="previewProductImage(this)">
            <div>
                <div class="form-group"><label>Ürün Kodu (SKU)</label><input type="text" id="m-kod" value="${kod}" ${isEdit ? 'disabled' : ''}></div>
                <div class="form-group"><label>Ürün Adı</label><input type="text" id="m-ad" value="${ad}"></div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
            <div class="form-group"><label>Barkod</label><input type="text" id="m-barcode" value="${barcode}"></div>
            <div class="form-group">
                <label>Birim</label>
                <select id="m-unit">
                    <option value="Adet" ${unit === 'Adet' ? 'selected' : ''}>Adet</option>
                    <option value="Paket" ${unit === 'Paket' ? 'selected' : ''}>Paket</option>
                    <option value="Koli" ${unit === 'Koli' ? 'selected' : ''}>Koli</option>
                    <option value="KG" ${unit === 'KG' ? 'selected' : ''}>Kilogram</option>
                    <option value="Metre" ${unit === 'Metre' ? 'selected' : ''}>Metre</option>
                </select>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
            <div class="form-group">
                <label>Kategori</label>
                <input type="text" id="m-category" value="${category}" placeholder="Örn: Kağıt Ürünleri">
            </div>
            <div class="form-group">
                <label>Marka</label>
                <input type="text" id="m-brand" value="${brand}" placeholder="Örn: Statio">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-bottom:15px;">
            <div class="form-group"><label>Fiyat (Hariç)</label><input type="number" id="m-price" value="${priceExclTax}" oninput="calcProdIncl()"></div>
            <div class="form-group"><label>KDV (%)</label><input type="number" id="m-taxRate" value="${taxRate}" oninput="calcProdIncl()"></div>
            <div class="form-group"><label>İskonto (%)</label><input type="number" id="m-discountRate" value="${discountRate}"></div>
        </div>

        <div class="form-group"><label>Birim Fiyat (Dahil)</label><input type="number" id="m-price-incl" value="${(priceExclTax * (1 + taxRate/100)).toFixed(2)}" oninput="calcProdExcl()"></div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
            <div class="form-group">
                <label>Görünürlük</label>
                <select id="m-visibility">
                    <option value="B2B_ONLY" ${visibility === 'B2B_ONLY' ? 'selected' : ''}>Sadece B2B (Müşterilere)</option>
                    <option value="PUBLIC" ${visibility === 'PUBLIC' ? 'selected' : ''}>Herkese Açık (Web Store)</option>
                    <option value="HIDDEN" ${visibility === 'HIDDEN' ? 'selected' : ''}>Gizli</option>
                </select>
            </div>
            <div class="form-group">
                <label>Satış Kanalı</label>
                <select id="m-channel">
                    <option value="b2b" ${channel === 'b2b' ? 'selected' : ''}>B2B Portalı</option>
                    <option value="web" ${channel === 'web' ? 'selected' : ''}>Web Mağazası</option>
                    <option value="all" ${channel === 'all' ? 'selected' : ''}>Tüm Kanallar</option>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label>Mevcut Stok</label>
            <input type="number" id="m-stock" value="${stock}">
        </div>

        <div class="form-group full-width">
            <label>Ürün Açıklaması</label>
            <textarea id="m-description" rows="3">${description}</textarea>
        </div>
        
        <input type="hidden" id="m-image" value="${image}">
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
        barcode: document.getElementById('m-barcode').value,
        unit: document.getElementById('m-unit').value,
        priceExclTax: parseFloat(document.getElementById('m-price').value) || 0,
        taxRate: parseFloat(document.getElementById('m-taxRate').value) || 20,
        stock: parseFloat(document.getElementById('m-stock').value) || 0,
        image: document.getElementById('m-image').value,
        category: document.getElementById('m-category').value,
        brand: document.getElementById('m-brand').value,
        description: document.getElementById('m-description').value,
        visibility: document.getElementById('m-visibility').value,
        channel: document.getElementById('m-channel').value,
        discountRate: parseFloat(document.getElementById('m-discountRate').value) || 0
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
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openDistModal('${d.kod}', '${(d.ad || '').replace(/'/g, "\\'")}', '${d.phone || ''}', '${d.email || ''}')">Düzenle</button>
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

    let generatedKod = kod;
    if (!isEdit) {
        let maxId = 0;
        const rows = document.querySelectorAll('#main-content table tbody tr td:first-child');
        rows.forEach(td => {
            const match = td.textContent.match(/DİST-(\d+)/i);
            if (match) {
                const id = parseInt(match[1], 10);
                if (id > maxId) maxId = id;
            }
        });
        generatedKod = `DİST-${maxId + 1}`;
    }

    document.getElementById('modal-title').textContent = isEdit ? 'Distribütör Düzenle' : 'Yeni Distribütör';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Distribütör Kodu</label>
            <input type="text" id="m-kod" value="${generatedKod}" ${isEdit ? 'disabled' : ''}>
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
            const provinceSafe = (c.province || '').replace(/'/g, "\\'");
            const districtSafe = (c.district || '').replace(/'/g, "\\'");
            
            html += `<tr>
                <td style="color:var(--neon-cyan);">${c.cariKod}</td>
                <td>
                    ${c.ad || '-'} 
                    ${c.b2bUser ? `<br><small style="color:var(--neon-purple);">👤 B2B: ${c.b2bUser}</small>` : ''}
                </td>
                <td>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" 
                        onclick="openCompModal('${c.cariKod}', '${adSafe}', '${c.phone || ''}', '${c.email || ''}', '${c.discountRate || 0}', '${taxOfficeSafe}', '${taxNumberSafe}', '${addressSafe}', ${c.riskLimit || 0}, '${provinceSafe}', '${districtSafe}', '${c.b2bUser || ''}', '${c.salesRepId || ''}', '${c.id}')">Düzenle</button>
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteComp('${c.cariKod}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openCompModal = async function(kod='', ad='', phone='', email='', discountRate=0, taxOffice='', taxNumber='', address='', riskLimit=0, province='', district='', b2bUser='', salesRepId='', id='') {
    window.resetModalBtn();
    const isEdit = !!kod;
    document.getElementById('modal-title').textContent = isEdit ? 'KURUM YÖNETİMİ' : 'YENİ KURUM KAYDI';
    
    // Plasiyerleri çekelim
    let salesRepOptions = '<option value="">-- Sorumlu Atanmadı --</option>';
    try {
        const users = await adminApi('GET', '/api/admin/users');
        const reps = users.filter(u => u.role === 'distributor' && !u.companyCode);
        reps.forEach(r => {
            salesRepOptions += `<option value="${r.id}" ${salesRepId === r.id ? 'selected' : ''}>${r.displayName} (${r.username})</option>`;
        });
    } catch(e) { console.error('Plasiyerler yuklenemedi'); }

    const accordionStyle = `
        <style>
            .acc-item { margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.02); }
            .acc-header { background: rgba(255,255,255,0.03); padding: 15px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s; border-bottom: 1px solid transparent; }
            .acc-header:hover { background: rgba(0,243,255,0.05); }
            .acc-header.active { border-bottom-color: rgba(0,243,255,0.2); background: rgba(0,243,255,0.08); }
            .acc-content { padding: 20px; display: none; }
            .acc-content.active { display: block; animation: slideDown 0.3s ease-out; }
            .acc-icon { transition: transform 0.3s; font-size: 0.8em; opacity: 0.5; }
            .acc-header.active .acc-icon { transform: rotate(180deg); opacity: 1; color: var(--neon-cyan); }
            @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            .deal-card { background: rgba(0,0,0,0.2); border: 1px solid rgba(0,243,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        </style>
    `;

    document.getElementById('modal-body').innerHTML = accordionStyle + `
        <div style="max-height:75vh; overflow-y:auto; padding-right:5px;">
            <input type="hidden" id="m-comp-id" value="${id}">
            
            <!-- BÖLÜM 1: GENEL BİLGİLER -->
            <div class="acc-item">
                <div class="acc-header active" onclick="toggleAccordion(this)">
                    <span style="font-weight:bold; letter-spacing:1px; color:var(--neon-cyan);">📁 01. GENEL BİLGİLER</span>
                    <span class="acc-icon">▼</span>
                </div>
                <div class="acc-content active">
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px;">
                        <div class="form-group"><label>Cari Kod *</label><input type="text" id="m-kod" value="${kod}" ${isEdit ? 'disabled' : ''} required></div>
                        <div class="form-group"><label>Kurum Adı (Ticari Unvan) *</label><input type="text" id="m-ad" value="${ad}" required></div>
                        <div class="form-group"><label>Vergi Dairesi *</label><input type="text" id="m-taxOffice" value="${taxOffice}" required></div>
                        <div class="form-group"><label>Vergi Numarası *</label><input type="text" id="m-taxNumber" value="${taxNumber}" required></div>
                        <div class="form-group"><label>Risk Limiti (TL)</label><input type="number" id="m-riskLimit" value="${riskLimit}" min="0"></div>
                        <div class="form-group"><label>Sabit İskonto (%)</label><input type="number" id="m-discountRate" value="${discountRate}" min="0" max="100" step="0.1"></div>
                    </div>
                </div>
            </div>

            <!-- BÖLÜM 2: ADRES VE İLETİŞİM -->
            <div class="acc-item">
                <div class="acc-header" onclick="toggleAccordion(this)">
                    <span style="font-weight:bold; letter-spacing:1px; color:var(--neon-purple);">📍 02. ADRES VE İLETİŞİM</span>
                    <span class="acc-icon">▼</span>
                </div>
                <div class="acc-content">
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px;">
                        <div class="form-group"><label>İl (Şehir) *</label><input type="text" id="m-province" value="${province}" required></div>
                        <div class="form-group"><label>İlçe *</label><input type="text" id="m-district" value="${district}" required></div>
                        <div class="form-group"><label>Telefon *</label><input type="text" id="m-phone" value="${phone}" required></div>
                        <div class="form-group"><label>E-Posta *</label><input type="email" id="m-email" value="${email}" required></div>
                        <div class="form-group" style="grid-column: span 2;"><label>Tam Adres (Kaşe Bilgisi) *</label><textarea id="m-address" required style="width:100%; height:60px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid var(--glass-border); border-radius:8px; padding:10px;">${address}</textarea></div>
                    </div>
                </div>
            </div>

            <!-- BÖLÜM 3: SORUMLULUK VE ERİŞİM -->
            <div class="acc-item">
                <div class="acc-header" onclick="toggleAccordion(this)">
                    <span style="font-weight:bold; letter-spacing:1px; color:var(--neon-green);">🔐 03. ERİŞİM VE SORUMLULUK</span>
                    <span class="acc-icon">▼</span>
                </div>
                <div class="acc-content">
                    <div class="form-group" style="margin-bottom:20px;">
                        <label style="color:var(--neon-cyan);">👤 Sorumlu Plasiyer</label>
                        <select id="m-salesRepId" style="width:100%; background:rgba(0,0,0,0.5); color:var(--neon-cyan); border:1px solid var(--neon-cyan); padding:10px; border-radius:8px;">
                            ${salesRepOptions}
                        </select>
                    </div>
                    <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;">
                    <h4 style="font-size:0.8em; color:var(--neon-purple); margin-bottom:15px;">B2B PORTAL GİRİŞ BİLGİLERİ</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div class="form-group"><label>Kullanıcı Adı</label><input type="text" id="m-b2b-user" value="${b2bUser}"></div>
                        <div class="form-group"><label>Şifre</label><input type="password" id="m-b2b-pass" placeholder="${isEdit ? 'Değişmeyecekse boş bırakın' : 'Yeni şifre...'}"></div>
                    </div>
                </div>
            </div>

            <!-- BÖLÜM 4: ÖZEL KAMPANYALAR -->
            ${isEdit ? `
            <div class="acc-item">
                <div class="acc-header" onclick="toggleAccordion(this); loadSpecialDeals('${id}')">
                    <span style="font-weight:bold; letter-spacing:1px; color:var(--neon-pink);">🎯 04. ÖZEL KAMPANYALAR</span>
                    <span class="acc-icon">▼</span>
                </div>
                <div class="acc-content">
                    <div id="deals-list-container">Veriler yükleniyor...</div>
                    <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;">
                    <h4 style="font-size:0.8em; color:var(--neon-cyan); margin-bottom:15px;">YENİ KAMPANYA EKLE</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="form-group" style="grid-column:span 2;"><label>Kampanya / Ürün Adı</label><input type="text" id="deal-name" placeholder="Örn: İlk 5 Ürün İndirimi"></div>
                        <div class="form-group"><label>Ürün Kodu (Boşsa Hepsi)</label><input type="text" id="deal-productId" placeholder="KRT-001"></div>
                        <div class="form-group"><label>Ek İskonto (%)</label><input type="number" id="deal-discount" value="0"></div>
                        <div class="form-group"><label>Max Ürün Adedi</label><input type="number" id="deal-maxQty" placeholder="Sınırsız için boş bırak"></div>
                        <button class="btn btn-primary" style="grid-column:span 2; margin-top:10px;" onclick="addSpecialDeal('${id}')">KAMPANYAYI TANIMLA</button>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    window.toggleAccordion = function(header) {
        const content = header.nextElementSibling;
        const isActive = header.classList.contains('active');
        if(isActive) {
            header.classList.remove('active');
            content.classList.remove('active');
        } else {
            header.classList.add('active');
            content.classList.add('active');
        }
    }

    const modalContent = document.querySelector('.modal-content');
    if(modalContent) modalContent.style.maxWidth = '750px';

    document.getElementById('modal-save-btn').onclick = () => saveComp(isEdit);
    document.getElementById('admin-modal').classList.add('active');
}

async function saveComp(isEdit) {
    const data = { 
        cariKod: document.getElementById('m-kod').value, 
        ad: document.getElementById('m-ad').value,
        taxOffice: document.getElementById('m-taxOffice').value,
        taxNumber: document.getElementById('m-taxNumber').value,
        province: document.getElementById('m-province').value,
        district: document.getElementById('m-district').value,
        address: document.getElementById('m-address').value,
        phone: document.getElementById('m-phone').value,
        email: document.getElementById('m-email').value,
        discountRate: parseFloat(document.getElementById('m-discountRate').value) || 0,
        riskLimit: parseFloat(document.getElementById('m-riskLimit').value) || 0,
        salesRepId: document.getElementById('m-salesRepId').value,
        b2bUser: document.getElementById('m-b2b-user').value,
        b2bPass: document.getElementById('m-b2b-pass').value
    };

    // Zorunlu alan kontrolü (e-fatura için zorunlu)
    if(!data.cariKod || !data.ad || !data.taxOffice || !data.taxNumber || !data.province || !data.address || !data.phone || !data.email) {
        return showToast('Lütfen e-Fatura için zorunlu olan kurum bilgilerini (İl, İlçe, Vergi vb.) eksiksiz giriniz!', 'error');
    }

    try {
        if(isEdit) await adminApi('PUT', `/api/admin/companies/${data.cariKod}`, data);
        else await adminApi('POST', '/api/admin/add-company', data);
        closeModal(); renderCompaniesTab(); showToast('Kurumsal Cari Kaydedildi');
    } catch(e) { showToast(e.message, 'error'); }
}

// --- SPECIAL DEALS HELPERS ---
window.loadSpecialDeals = async function(companyId) {
    const container = document.getElementById('deals-list-container');
    if(!container) return;
    
    try {
        const deals = await adminApi('GET', `/api/admin/companies/${companyId}/deals`);
        if(deals.length === 0) {
            container.innerHTML = '<div style="opacity:0.5; font-size:0.8em; text-align:center; padding:10px; border:1px dashed rgba(255,255,255,0.1); border-radius:8px;">Henüz özel kampanya tanımlanmamış.</div>';
            return;
        }
        
        container.innerHTML = deals.map(d => `
            <div class="deal-card">
                <div>
                    <div style="font-size:0.9em; font-weight:bold; color:var(--neon-pink);">${d.name || 'Özel İndirim'}</div>
                    <div style="font-size:0.75em; color:var(--text-secondary);">
                        ${d.product ? `Ürün: ${d.product.ad} (${d.product.kod})` : 'Tüm Ürünler'} | 
                        İndirim: %${d.discountRate} 
                        ${d.maxQty ? ` | Limit: İlk ${d.maxQty} adet` : ''}
                    </div>
                </div>
                <button class="btn" style="padding:4px 8px; font-size:0.7em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteSpecialDeal('${d.id}', '${companyId}')">Sil</button>
            </div>
        `).join('');
    } catch(e) { container.innerHTML = 'Yüklenemedi: ' + e.message; }
}

window.addSpecialDeal = async function(companyId) {
    const data = {
        name: document.getElementById('deal-name').value,
        productId: document.getElementById('deal-productId').value, // Frontend logic can resolve this or backend
        discountRate: document.getElementById('deal-discount').value,
        maxQty: document.getElementById('deal-maxQty').value
    };
    
    if(!data.name) return showToast('Lütfen kampanya adı girin', 'error');
    
    try {
        await adminApi('POST', `/api/admin/companies/${companyId}/deals`, data);
        showToast('Kampanya tanımlandı', 'success');
        loadSpecialDeals(companyId);
        // Clear form
        document.getElementById('deal-name').value = '';
        document.getElementById('deal-productId').value = '';
        document.getElementById('deal-discount').value = '0';
        document.getElementById('deal-maxQty').value = '';
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteSpecialDeal = async function(dealId, companyId) {
    if(!confirm('Bu kampanyayı silmek istediğinize emin misiniz?')) return;
    try {
        await adminApi('DELETE', `/api/admin/companies/deals/${dealId}`);
        showToast('Kampanya silindi');
        loadSpecialDeals(companyId);
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteComp = async function(kod) {
    showConfirm('Kurum silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/companies/${kod}`); renderCompaniesTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- SHARED MODAL LOGIC ---
window.closeModal = function() {
    const modal = document.getElementById('admin-modal');
    modal.classList.remove('active');
    
    // Reset modal width to default
    const modalContent = document.querySelector('.modal-content');
    if(modalContent) modalContent.style.maxWidth = '800px';
}

window.shareOnWhatsApp = function(id, token, amount) {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/order-view.html?token=${token}`;
    const message = `Sayın müşterimiz, ${id} nolu siparişinizin detayları ve ödeme bilgileri (Tutar: ${parseFloat(amount).toFixed(2)} TL) için şu linke tıklayabilirsiniz:\n\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}


// --- SYSTEM SETTINGS ---
async function renderSettingsTab() {
    const content = document.getElementById('main-content');
    try {
        const settings = await adminApi('GET', '/api/admin/settings');
        
        content.innerHTML = `
            <div class="action-bar"><h2 class="brand">Sistem ve Marka Ayarları (White Label)</h2></div>
            
            <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:25px;">
                <!-- SOL KOLON: MARKA VE RENKLER -->
                <div class="glass-card">
                    <h3 class="brand" style="font-size:1em; margin-bottom:20px; color:var(--neon-cyan);">🎨 GÖRSEL KİMLİK VE TEMA</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div class="form-group" style="grid-column:span 2;"><label>Marka İsmi (Panel Başlığı)</label><input type="text" id="s-brandName" value="${settings.brandName || 'STATIO'}"></div>
                        <div class="form-group"><label>Ana Renk (Primary)</label><input type="color" id="s-primaryColor" value="${settings.primaryColor || '#00f3ff'}" style="height:45px;"></div>
                        <div class="form-group"><label>İkincil Renk (Secondary)</label><input type="color" id="s-secondaryColor" value="${settings.secondaryColor || '#9d4edd'}" style="height:45px;"></div>
                        <div class="form-group"><label>Vurgu Rengi (Accent)</label><input type="color" id="s-accentColor" value="${settings.accentColor || '#ff3366'}" style="height:45px;"></div>
                    </div>
                    <p style="font-size:0.8em; color:var(--text-dim); margin-top:15px;">* Renk değişiklikleri kaydedildikten sonra tüm sayfalara (B2B Dashboard, Sipariş Ekranı vb.) anında yansır.</p>
                </div>

                <!-- SAĞ KOLON: ÖNİZLEME VEYA YARDIM -->
                <div class="glass-card" style="border-color:var(--neon-purple);">
                    <h3 class="brand" style="font-size:1em; margin-bottom:20px; color:var(--neon-purple);">💡 WHITE LABEL NEDİR?</h3>
                    <p style="font-size:0.9em; line-height:1.6; color:var(--text-secondary);">
                        Bu panel üzerinden sistemin tüm siberpunk estetiğini kendi kurumsal kimliğinize uyarlayabilirsiniz. 
                        <br><br>
                        Girdiğiniz <b>Marka İsmi</b> müşterilerinizin giriş ekranında ve dashboard'da gördüğü isim olacaktır.
                        <br><br>
                        <b>Banners (Afişler)</b> kısmından ana sayfanızdaki "yanarlı dönerli" kampanya görsellerini yönetebilirsiniz.
                    </p>
                </div>

                <!-- ALT KOLON: BANNER YÖNETİMİ -->
                <div class="glass-card" style="grid-column:span 2;">
                    <h3 class="brand" style="font-size:1em; margin-bottom:20px; color:var(--neon-green);">🖼️ DASHBOARD BANNER YÖNETİMİ (KAMPANYALAR)</h3>
                    <p style="font-size:0.8em; color:var(--text-dim); margin-bottom:15px;">JSON formatında banner listesi giriniz (Resim URL, Başlık, Alt Başlık, Link):</p>
                    <textarea id="s-banners" style="width:100%; height:150px; background:rgba(0,0,0,0.3); color:var(--neon-green); font-family:monospace; border:1px solid var(--glass-border); border-radius:10px; padding:15px;">${JSON.stringify(JSON.parse(settings.banners || '[]'), null, 2)}</textarea>
                    <button class="btn btn-primary" style="margin-top:20px; width:100%; padding:15px;" onclick="saveSettings()">AYARLARI KAYDET VE UYGULA</button>
                </div>
            </div>
        `;
    } catch(e) { showToast(e.message, 'error'); }
}

async function saveSettings() {
    const data = {
        brandName: document.getElementById('s-brandName').value,
        primaryColor: document.getElementById('s-primaryColor').value,
        secondaryColor: document.getElementById('s-secondaryColor').value,
        accentColor: document.getElementById('s-accentColor').value,
        banners: document.getElementById('s-banners').value
    };

    try {
        await adminApi('POST', '/api/admin/settings', data);
        showToast('Sistem ayarları başarıyla güncellendi! Tema uygulanıyor...', 'success');
        // Temayı anında uygula (isteğe bağlı, sayfa yenileme de olabilir)
        setTimeout(() => window.location.reload(), 1500);
    } catch(e) { showToast(e.message, 'error'); }
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
            const roleMap = {
                'admin': 'YÖNETİCİ',
                'superadmin': 'SİSTEM YÖN.',
                'warehouse': 'DEPO PERSONELİ',
                'distributor': 'SATIŞ TEMSİLCİSİ'
            };
            const roleLabel = roleMap[u.role] || u.role.toUpperCase();

            html += `<tr>
                <td>${u.username}</td>
                <td>${u.displayName}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-warning'}">${roleLabel}</span></td>
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
                <table class="data-table orders-list-table">
                    <thead><tr>
                        <th style="width:30px;"><input type="checkbox" class="invoice-checkbox" onchange="toggleAllOrders(this.checked)"></th>
                        <th>ID</th><th>KURUM</th><th>DURUM</th><th>TUTAR</th><th>DEPO</th><th>İŞLEMLER</th>
                    </tr></thead>
                    <tbody id="orders-tbody">
        `;
        
        orders.forEach(o => {
            const wh = warehouses.find(w => w.id === o.warehouseId);
            const whOptions = warehouses.map(w => `<option value="${w.id}" ${o.warehouseId === w.id ? 'selected' : ''}>${w.name}</option>`).join('');
            
            const isAdmin = currentUser.role === 'admin';
            let cargoInfo = '';
            if (o.cargoDetail) {
                try {
                    const cd = typeof o.cargoDetail === 'string' ? JSON.parse(o.cargoDetail) : o.cargoDetail;
                    if (cd && cd.company && cd.trackingCode) {
                        cargoInfo = `<div style="font-size:0.75em; color:var(--neon-cyan); margin-top:3px;">${cd.company} - ${cd.trackingCode}</div>`;
                    }
                } catch(e) { console.error('Cargo parse error', e); }
            }
            
            const statusMap = {
                'YENI': 'YENİ',
                'ATANDI': 'ATANDI',
                'HAZIRLANIYOR': 'HAZIRLANIYOR',
                'KARGODA': 'KARGODA',
                'TESLIM_EDILDI': 'TESLİM EDİLDİ',
                'INVOICED': 'FATURALANDI',
                'CANCELLED': 'İPTAL EDİLDİ'
            };
            const statusLabel = statusMap[o.status] || o.status;
            
            html += `<tr style="cursor:pointer;" onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'SELECT' && event.target.type !== 'checkbox') viewOrderDetails('${o.id}')">
                <td data-label="Seç"><input type="checkbox" class="invoice-checkbox order-checkbox" value="${o.id}" onclick="event.stopPropagation();" onchange="updateBulkBtnVisibility()"></td>
                <td data-label="ID" style="font-size:0.8em;">${o.id}</td>
                <td data-label="Kurum">${o.companyCode}</td>
                <td data-label="Durum">
                    <span class="badge ${o.status === 'YENI' ? 'badge-warning' : (o.status==='TESLIM_EDILDI' || o.status==='INVOICED' ? 'badge-success' : 'badge-primary')}">${statusLabel}</span>
                    ${cargoInfo}
                </td>
                <td data-label="Tutar" style="font-weight:bold; color:var(--neon-green);">${(o.finalAmount || 0).toLocaleString('tr-TR')} ₺</td>
                <td data-label="Depo">
                    <div onclick="event.stopPropagation();">
                        ${isAdmin ? `
                            <select onchange="assignToWarehouse('${o.id}', this.value)" class="warehouse-select-mobile">
                                <option value="">Depo Seçin...</option>
                                ${whOptions}
                            </select>
                        ` : (wh ? `<span style="color:var(--neon-cyan); font-weight:bold;">${wh.name}</span>` : '<span style="color:var(--neon-red);">Atanmamış</span>')}
                    </div>
                </td>
                <td data-label="İşlemler">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;" onclick="event.stopPropagation();">
                      <button class="btn btn-action" onclick="viewOrderDetails('${o.id}')">👁️ Detay</button>
                      <button class="btn btn-action" onclick="window.open('/api/orders/${o.id}/pdf')">📄 PDF</button>
                      <button class="btn btn-action btn-whatsapp" onclick="shareOnWhatsApp('${o.id}', '${o.publicToken}', '${o.finalAmount}')" title="WhatsApp ile Paylaş">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#25D366" viewBox="0 0 16 16">
                              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                          </svg>
                      </button>
                      <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
                          <option value="">Durum...</option>
                          <option value="HAZIRLANIYOR" ${o.status==='HAZIRLANIYOR'?'selected':''}>Hazırlanıyor</option>
                          <option value="KARGODA" ${o.status==='KARGODA'?'selected':''}>Kargoya Ver</option>
                          <option value="TESLIM_EDILDI" ${o.status==='TESLIM_EDILDI'?'selected':''}>Teslim Edildi</option>
                      </select>
                      ${isAdmin ? `
                        <button class="btn btn-action btn-danger" onclick="deleteOrder('${o.id}')">🗑️ Sil</button>
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
        
        let cData = order.cargoDetail;
        if (typeof cData === 'string') {
            try { cData = JSON.parse(cData); } catch(e) { cData = null; }
        }
        order.cargoDetail = cData;

        const products = await adminApi('GET', '/api/products');

        let itemsHtml = order.items.map((i, index) => {
            const pExcl = parseFloat(i.priceExclTax) || 0;
            const tRate = parseFloat(i.taxRate) || 0;
            const dRate = parseFloat(i.discountRate) || 0;
            const q = parseInt(i.qty) || parseInt(i.miktar) || 0;
            const rowTotal = (pExcl * q * (1 - dRate/100) * (1 + tRate/100)).toFixed(2);
            const pData = products.find(prod => prod.kod === i.code);
            const imgSrc = pData && pData.image ? pData.image : '';

            return `
                <div class="glass-card" style="margin-bottom:15px; padding:15px; border-color:rgba(255,255,255,0.1);">
                    <div style="display:flex; gap:15px; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
                        ${imgSrc ? `<img src="${imgSrc}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">` : `<div style="width:60px; height:60px; background:rgba(255,255,255,0.05); border-radius:8px;"></div>`}
                        <div style="flex:1;">
                            <div style="font-weight:bold; color:#fff; font-size:1.1em;">${i.name}</div>
                            <div style="color:var(--neon-cyan); font-size:0.9em;">${i.code}</div>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                        <div>
                            <label style="font-size:0.8em; color:var(--text-secondary); display:block; margin-bottom:5px;">Birim Fiyat (₺)</label>
                            ${isAdmin ? `<input type="number" class="edit-px" data-index="${index}" value="${pExcl.toFixed(2)}" step="0.01" style="width:100%; height:40px;" oninput="window.calcOrderRow(${index})">` : `<b>${pExcl.toFixed(2)} ₺</b>`}
                        </div>
                        <div>
                            <label style="font-size:0.8em; color:var(--text-secondary); display:block; margin-bottom:5px;">Miktar (Adet)</label>
                            ${isAdmin ? `<input type="number" class="edit-qty" data-index="${index}" value="${q}" min="0" style="width:100%; height:40px;" oninput="window.calcOrderRow(${index})">` : `<b>${q}</b>`}
                        </div>
                        <div style="grid-column: span 2; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-top:5px;">
                            <span style="color:var(--text-secondary);">Ürün Toplamı:</span>
                            <b style="color:var(--neon-green); font-size:1.2em;" class="row-total" data-index="${index}">${rowTotal} ₺</b>
                        </div>
                    </div>
                    <input type="hidden" class="edit-tr" data-index="${index}" value="${tRate}">
                    <input type="hidden" class="edit-dr" data-index="${index}" value="${dRate}">
                    <input type="hidden" class="edit-pi" data-index="${index}" value="${(pExcl * (1 + tRate/100)).toFixed(2)}">
                </div>
            `;
        }).join('');

        document.getElementById('modal-body').innerHTML = `
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:20px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="glass-card" style="padding:12px;">
                        <small style="color:var(--text-secondary); display:block;">KURUM</small>
                        <b style="color:var(--neon-cyan); font-size:1.1em;">${order.companyCode}</b>
                    </div>
                    <div class="glass-card" style="padding:12px;">
                        <small style="color:var(--text-secondary); display:block;">TARİH</small>
                        <b style="font-size:0.9em;">${new Date(order.createdAt).toLocaleString('tr-TR')}</b>
                    </div>
                    <div class="glass-card" style="padding:12px;">
                        <small style="color:var(--text-secondary); display:block; margin-bottom:5px;">SİPARİŞ TİPİ</small>
                        <select id="edit-order-type" style="width:100%; height:45px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:0 10px;" ${isAdmin ? '' : 'disabled'}>
                            <option value="SIPARIS" ${order.orderType==='SIPARIS'?'selected':''}>SİPARİŞ</option>
                            <option value="NUMUNE" ${order.orderType==='NUMUNE'?'selected':''}>NUMUNE</option>
                        </select>
                    </div>
                    <div class="glass-card" style="padding:12px;">
                        <small style="color:var(--text-secondary); display:block; margin-bottom:5px;">SİPARİŞ DURUMU</small>
                        <select id="edit-order-status" style="width:100%; height:45px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:0 10px;" onchange="toggleCargoInputs(this.value)">
                            <option value="YENI" ${order.status==='YENI'?'selected':''}>YENİ</option>
                            <option value="HAZIRLANIYOR" ${order.status==='HAZIRLANIYOR'?'selected':''}>HAZIRLANIYOR</option>
                            <option value="KARGODA" ${order.status==='KARGODA'?'selected':''}>KARGODA</option>
                            <option value="TESLIM_EDILDI" ${order.status==='TESLIM_EDILDI'?'selected':''}>TESLİM EDİLDİ</option>
                        </select>
                    </div>
                </div>

                <div id="cargo-inputs" class="glass-card" style="padding:15px; border-color:var(--neon-cyan);">
                    <b style="color:var(--neon-cyan); display:block; margin-bottom:12px; font-size:0.9em;">🚚 KARGO & SEVK BİLGİLERİ</b>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="font-size:0.8em; color:var(--text-secondary); display:block; margin-bottom:5px;">KARGO FİRMASI</label>
                            <select id="m-cargo-company" style="width:100%; height:45px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:0 10px;">
                                <option value="">Seçiniz...</option>
                                <option value="Aras Kargo" ${order.cargoDetail?.company === 'Aras Kargo' ? 'selected' : ''}>Aras Kargo</option>
                                <option value="Yurtiçi Kargo" ${order.cargoDetail?.company === 'Yurtiçi Kargo' ? 'selected' : ''}>Yurtiçi Kargo</option>
                                <option value="MNG Kargo" ${order.cargoDetail?.company === 'MNG Kargo' ? 'selected' : ''}>MNG Kargo</option>
                                <option value="Sürat Kargo" ${order.cargoDetail?.company === 'Sürat Kargo' ? 'selected' : ''}>Sürat Kargo</option>
                                <option value="PTT Kargo" ${order.cargoDetail?.company === 'PTT Kargo' ? 'selected' : ''}>PTT Kargo</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.8em; color:var(--text-secondary); display:block; margin-bottom:5px;">TAKİP NUMARASI</label>
                            <input type="text" id="m-cargo-code" value="${order.cargoDetail?.trackingCode || ''}" style="width:100%; height:45px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:0 12px;" placeholder="Takip numarasını girin...">
                        </div>
                    </div>
                </div>

                <div class="glass-card" style="padding:15px; border-color:var(--neon-purple);">
                    <b style="color:var(--neon-purple); display:block; margin-bottom:12px; font-size:0.9em;">📝 SİPARİŞ NOTLARI</b>
                    <textarea id="edit-order-notes" rows="3" style="width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:12px; border-radius:8px; font-size:1em;" ${isAdmin ? '' : 'disabled'} placeholder="Buraya not ekleyebilirsiniz...">${order.notes || ''}</textarea>
                </div>

                <div style="margin-top:10px;">
                    <b style="color:#fff; display:block; margin-bottom:12px; font-size:0.9em; padding-left:5px;">📦 ÜRÜN LİSTESİ</b>
                    ${itemsHtml}
                </div>

                <div class="glass-card" style="padding:15px; border-top:2px solid var(--neon-green); background:rgba(57,255,20,0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95em;">
                        <span style="color:var(--text-secondary);">Ara Toplam (KDV Hariç):</span>
                        <b id="detail-sub-total" style="color:#fff;">${(order.totalAmount || 0).toLocaleString('tr-TR')} ₺</b>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.95em;">
                        <span style="color:var(--text-secondary);">KDV Toplamı:</span>
                        <b id="detail-tax-total" style="color:#fff;">${(order.totalTax || 0).toLocaleString('tr-TR')} ₺</b>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:1.4em; font-weight:bold; color:var(--neon-green); margin-top:5px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
                        <span>Genel Toplam:</span>
                        <span id="detail-final-amount">${(order.finalAmount || 0).toLocaleString('tr-TR')} ₺</span>
                    </div>
                </div>
            </div>
            <div style="height:30px;"></div>
        `;
        
        pdfBtn = document.getElementById('modal-pdf-btn');
        if(pdfBtn) {
            pdfBtn.style.display = 'flex';
            pdfBtn.className = 'btn btn-premium-pdf';
            pdfBtn.innerHTML = '<span>📄</span> PDF ÖZET';
            pdfBtn.onclick = () => window.open(`/api/orders/${order.id}/pdf`);
        }

        // e-Fatura & e-İrsaliye Butonlarını Footer'a Ekle
        const footerActions = document.getElementById('modal-footer-actions');
        if(footerActions && isAdmin && order.status !== 'CANCELLED') {
            const extraBtns = document.createElement('div');
            extraBtns.id = 'extra-invoice-btns';
            extraBtns.style.cssText = 'display:flex; gap:10px; margin-right:auto; margin-left:15px;';
            extraBtns.innerHTML = `
                <button class="btn btn-premium-fatura" onclick="createEInvoice('${order.id}')">⚡ E-FATURA</button>
                <button class="btn btn-premium-irsaliye" onclick="createEDespatch('${order.id}')">🚚 E-İRSALİYE</button>
            `;
            // Varsa eskiyi sil
            const old = document.getElementById('extra-invoice-btns');
            if(old) old.remove();
            
            // PDF butonunun hemen yanına ekle
            pdfBtn.after(extraBtns);
        } else if(footerActions) {
            const old = document.getElementById('extra-invoice-btns');
            if(old) old.remove();
        }

        const cancelBtn = document.getElementById('modal-cancel-btn');
        if(cancelBtn) {
            cancelBtn.className = 'btn btn-premium-close';
            cancelBtn.textContent = 'KAPAT';
        }

        const saveBtn = document.getElementById('modal-save-btn');
        saveBtn.style.display = 'block';
        saveBtn.className = 'btn btn-premium-save';
        saveBtn.innerHTML = isAdmin ? '💾 KAYDET' : '📦 DURUMU GÜNCELLE';
        saveBtn.onclick = () => saveOrderDetails(id, isAdmin, order);
        
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast('Sipariş bulunamadı: ' + e.message, 'error'); }
}

async function saveOrderDetails(id, isAdmin, order) {
    const notes = document.getElementById('edit-order-notes').value;
    const orderType = document.getElementById('edit-order-type') ? document.getElementById('edit-order-type').value : order.orderType;
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
        if(isAdmin) {
            const newItems = Array.from(document.querySelectorAll('.edit-qty')).map(input => {
                const idx = input.getAttribute('data-index');
                const qty = parseInt(input.value) || 0;
                const pExcl = parseFloat(document.querySelector(`.edit-px[data-index="${idx}"]`).value) || 0;
                const tRate = parseFloat(document.querySelector(`.edit-tr[data-index="${idx}"]`).value) || 0;
                const dRate = parseFloat(document.querySelector(`.edit-dr[data-index="${idx}"]`).value) || 0;
                return { ...order.items[idx], qty, miktar: qty, priceExclTax: pExcl, taxRate: tRate, discountRate: dRate };
            }).filter(i => i.qty > 0);

            await adminApi('PUT', `/api/orders/${id}`, { notes, orderType, items: newItems, status, cargoDetail });
            showToast('Sipariş güncellendi');
        } else {
            await adminApi('PUT', `/api/orders/${id}/warehouse-status`, { status, cargoDetail });
            showToast('Durum ve sevk bilgileri güncellendi');
        }
        closeModal(); renderOrdersTab();
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
                    <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openWarehouseModal('${w.id}', '${(w.name || "").replace(/'/g, "\\'")}', '${(w.responsible || "").replace(/'/g, "\\'")}')">Düzenle</button>
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
    parent.querySelector('.row-total[data-index="'+index+'"]').innerText = (px * qty * (1 - dr/100) * (1 + tr/100)).toFixed(2) + ' ₺';
    
    window.updateAllOrderTotals();
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

window.updateAllOrderTotals = function() {
    let subTotal = 0;
    let taxTotal = 0;
    
    document.querySelectorAll('.edit-qty').forEach(input => {
        const idx = input.getAttribute('data-index');
        const qty = parseInt(input.value) || 0;
        const px = parseFloat(document.querySelector(`.edit-px[data-index="${idx}"]`).value) || 0;
        const tr = parseFloat(document.querySelector(`.edit-tr[data-index="${idx}"]`).value) || 0;
        const dr = parseFloat(document.querySelector(`.edit-dr[data-index="${idx}"]`).value) || 0;
        
        const lineSub = px * qty * (1 - dr/100);
        const lineTax = lineSub * (tr/100);
        
        subTotal += lineSub;
        taxTotal += lineTax;
    });
    
    const finalTotal = subTotal + taxTotal;
    
    const subEl = document.getElementById('detail-sub-total');
    const taxEl = document.getElementById('detail-tax-total');
    const finalEl = document.getElementById('detail-final-amount');
    
    if(subEl) subEl.innerText = subTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
    if(taxEl) taxEl.innerText = taxTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
    if(finalEl) finalEl.innerText = finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

// --- SETTINGS ---
let currentSettingsBanks = [];

async function renderSettingsTab() {
    try {
        const data = await adminApi('GET', '/api/admin/settings');
        const settings = data.settings || {};
        currentSettingsBanks = settings.banks || [];
        window.currentSettingsData = data; // Global store for UI refreshes
        
        const emailVal = data.email || settings.email || '';

        renderSettingsUI(data, emailVal, settings.whatsapp);
    } catch(e) { showToast(e.message, 'error'); }
}

function renderSettingsUI(data, email, whatsapp) {
    const main = document.getElementById('main-content');
    const settings = data.settings || {};
    const banners = Array.isArray(data.banners) ? data.banners : (typeof data.banners === 'string' ? JSON.parse(data.banners || '[]') : []);

    main.innerHTML = `
        <div class="settings-container" style="display: flex; gap: 30px; height: calc(100vh - 120px); animation: fadeIn 0.4s ease-out;">
            <!-- Left Sidebar Navigation for Settings -->
            <div class="settings-sidebar glass-card" style="width: 280px; padding: 20px; display: flex; flex-direction: column; gap: 10px;">
                <div style="margin-bottom: 25px; padding: 0 10px;">
                    <h3 class="brand" style="font-size: 1.1em; letter-spacing: 2px; color: var(--neon-cyan);">YÖNETİM</h3>
                    <p style="font-size: 0.7em; opacity: 0.5;">Sistem ve Görünüm Yapılandırması</p>
                </div>
                
                <a href="javascript:void(0)" class="settings-nav-btn active" data-tab="general">🏢 Kurumsal Bilgiler</a>
                <a href="javascript:void(0)" class="settings-nav-btn" data-tab="branding">🎨 Marka & Görünüm</a>
                <a href="javascript:void(0)" class="settings-nav-btn" data-tab="integrations">🚀 Entegrasyonlar</a>
                <a href="javascript:void(0)" class="settings-nav-btn" data-tab="banners">🖼️ Banner Yönetimi</a>
                <a href="javascript:void(0)" class="settings-nav-btn" data-tab="banks">🏦 Banka Hesapları</a>
                
                <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid var(--glass-border);">
                    <button class="btn btn-premium-save" style="width:100%; padding: 15px; font-weight: bold;" onclick="saveAdminSettings()">💾 DEĞİŞİKLİKLERİ KAYDET</button>
                </div>
            </div>

            <!-- Right Content Area -->
            <div class="settings-content glass-card" style="flex: 1; overflow-y: auto; padding: 40px; position: relative; border-radius: 20px;">
                
                <!-- GENERAL TAB -->
                <div id="tab-general" class="settings-tab-pane">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom: 35px;">
                        <div style="width:40px; height:40px; background:rgba(0, 243, 255, 0.1); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--neon-cyan); font-size:1.2em;">🏢</div>
                        <h2 class="brand" style="margin:0;">Kurumsal Bilgiler</h2>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                        <div class="form-group">
                            <label>Resmi Ünvan (Fatura / Kaşe)</label>
                            <input type="text" id="s-officialName" value="${data.officialName || ''}" placeholder="Statio Yazılım Danışmanlık Ltd.">
                        </div>
                        <div class="form-group">
                            <label>İletişim E-Posta</label>
                            <input type="email" id="s-email" value="${email}" placeholder="destek@statio.com">
                        </div>
                        <div class="form-group">
                            <label>Telefon Numarası</label>
                            <input type="text" id="s-phone" value="${data.phone || ''}" placeholder="0212 XXX XX XX">
                        </div>
                        <div class="form-group">
                            <label>Vergi Dairesi</label>
                            <input type="text" id="s-taxOffice" value="${data.taxOffice || ''}">
                        </div>
                        <div class="form-group">
                            <label>Vergi Numarası</label>
                            <input type="text" id="s-taxNumber" value="${data.taxNumber || ''}">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Adres Bilgisi</label>
                            <textarea id="s-address" rows="3" placeholder="Merkez Mah. No:1...">${data.address || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>WhatsApp Destek Hattı</label>
                            <input type="text" id="s-whatsapp" value="${whatsapp || ''}" placeholder="905XXXXXXXXX">
                            <small style="opacity:0.4;">Müşterilerin size tek tıkla ulaşacağı hat.</small>
                        </div>
                    </div>
                </div>

                <!-- BRANDING TAB -->
                <div id="tab-branding" class="settings-tab-pane" style="display: none;">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom: 35px;">
                        <div style="width:40px; height:40px; background:rgba(157, 78, 221, 0.1); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--neon-purple); font-size:1.2em;">🎨</div>
                        <h2 class="brand" style="margin:0;">Marka & Görünüm</h2>
                    </div>

                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 40px; align-items: start;">
                        <div>
                            <label style="display:block; margin-bottom:15px; font-weight:bold;">Kurumsal Logo</label>
                            <div class="logo-preview-box" onclick="triggerLogoUpload()">
                                <img src="${data.logoUrl || '/assets/logo.png'}" id="s-logo-preview" style="max-width:90%; max-height:90%; object-fit:contain;">
                                <div style="position:absolute; bottom:0; left:0; width:100%; background:rgba(0,243,255,0.1); text-align:center; font-size:0.65em; padding:6px; backdrop-filter:blur(10px); border-top:1px solid var(--glass-border); color:var(--neon-cyan); letter-spacing:1px; font-weight:bold;">📸 DEĞİŞTİR</div>
                            </div>
                            <input type="file" id="logo-file-input" style="display:none;" onchange="handleLogoUpload(event)">
                            <input type="hidden" id="s-logoUrl" value="${data.logoUrl || '/assets/logo.png'}">
                            
                            <div style="margin-top:20px;">
                                <label style="display:block; margin-bottom:8px; font-size:0.85em; color:var(--text-secondary);">Marka Adı</label>
                                <input type="text" id="s-brandName" value="${data.brandName || 'STATIO'}" placeholder="Marka isminiz..." style="font-size:0.9em; padding:10px;">
                                <p style="font-size:0.65em; opacity:0.4; margin-top:5px;">Hover (üzerine gelince) animasyonundaki ismi değiştirir.</p>
                            </div>
                            
                            <p style="font-size:0.7em; opacity:0.5; margin-top:10px; text-align:center;">Tavsiye: 512x512 PNG</p>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 25px;">
                            <div>
                                <label style="display:block; margin-bottom:15px; font-weight:bold;">Sistem Renk Paleti</label>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div class="color-control">
                                        <input type="color" id="s-primaryColor" value="${data.primaryColor || '#00f3ff'}" style="width:45px; height:45px; border:none; background:none; cursor:pointer;">
                                        <div>
                                            <div style="font-size:0.8em; font-weight:bold;">Ana Renk</div>
                                            <div style="font-size:0.7em; opacity:0.5;">Arayüzün ruhu</div>
                                        </div>
                                    </div>
                                    <div class="color-control">
                                        <input type="color" id="s-secondaryColor" value="${data.secondaryColor || '#9d4edd'}" style="width:45px; height:45px; border:none; background:none; cursor:pointer;">
                                        <div>
                                            <div style="font-size:0.8em; font-weight:bold;">İkincil Renk</div>
                                            <div style="font-size:0.7em; opacity:0.5;">Butonlar & Detaylar</div>
                                        </div>
                                    </div>
                                    <div class="color-control">
                                        <input type="color" id="s-accentColor" value="${data.accentColor || '#ff3366'}" style="width:45px; height:45px; border:none; background:none; cursor:pointer;">
                                        <div>
                                            <div style="font-size:0.8em; font-weight:bold;">Vurgu Rengi</div>
                                            <div style="font-size:0.7em; opacity:0.5;">Uyarılar & Neonlar</div>
                                        </div>
                                    </div>
                                </div>
                                <div style="display:flex; gap:12px; margin-top:25px; padding-top:20px; border-top:1px solid var(--glass-border);">
                                    <button class="btn btn-sm" style="flex:1; border-color:var(--text-dim); color:var(--text-dim); font-size:0.75em;" onclick="resetColorsToDefault()">↩ TÜMÜNÜ SIFIRLA</button>
                                    <button class="btn btn-sm btn-primary" style="flex:1.5; font-weight:bold; box-shadow: 0 0 15px var(--neon-cyan);" onclick="applyColorsAndRefresh()">🚀 KAYDET VE YENİLE</button>
                                </div>
                            </div>
                            
                            <div style="padding:20px; background:rgba(255,255,255,0.02); border-radius:15px; border:1px solid var(--glass-border);">
                                <h4 style="margin:0 0 10px 0; font-size:0.9em;">💡 Görünüm Hakkında</h4>
                                <p style="font-size:0.8em; opacity:0.6; line-height:1.5;">Seçtiğiniz renkler tüm yönetim paneli ve müşteri ekranlarında otomatik olarak uygulanır. Siberpunk estetiğini korumak için neon tonları tercih etmenizi öneririz.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- INTEGRATIONS TAB -->
                <div id="tab-integrations" class="settings-tab-pane" style="display: none;">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom: 35px;">
                        <div style="width:40px; height:40px; background:rgba(0, 255, 159, 0.1); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--neon-green); font-size:1.2em;">🚀</div>
                        <h2 class="brand" style="margin:0;">Entegrasyon Servisleri</h2>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, rgba(0, 243, 255, 0.05), transparent); padding: 30px; border-radius: 20px; border: 1px solid rgba(0, 243, 255, 0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                            <h3 style="margin:0; color:var(--neon-cyan);">Uyumsoft e-Fatura</h3>
                            <span style="background:var(--neon-green); color:#000; font-size:0.7em; padding:4px 10px; border-radius:20px; font-weight:bold;">BAĞLI</span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div class="form-group">
                                <label>Çalışma Modu</label>
                                <select id="s-efaturaMode" style="height:50px;">
                                    <option value="test" ${settings.efaturaMode === 'test' ? 'selected' : ''}>🧪 TEST (Simülasyon)</option>
                                    <option value="live" ${settings.efaturaMode === 'live' ? 'selected' : ''}>🔴 CANLI (Gerçek Gönderim)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fatura Seri Prefix</label>
                                <input type="text" id="s-efaturaPrefix" value="${settings.efaturaPrefix || 'KRT'}" maxlength="3" style="text-transform:uppercase;">
                            </div>
                            <div class="form-group">
                                <label>API Kullanıcı Adı</label>
                                <input type="text" id="s-efaturaUser" value="${settings.efaturaUser || ''}">
                            </div>
                            <div class="form-group">
                                <label>API Şifresi</label>
                                <input type="password" id="s-efaturaPass" value="${settings.efaturaPass || ''}">
                            </div>
                        </div>
                        <input type="hidden" id="s-efaturaProvider" value="uyumsoft">
                    </div>

                    <div style="margin-top:30px; background: rgba(255,255,255,0.03); padding:25px; border-radius:20px; border:1px solid var(--glass-border);">
                        <h4 style="margin:0 0 20px 0; color:var(--text-primary);">🚚 Varsayılan Taşıyıcı Bilgileri</h4>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:15px;">
                            <div class="form-group"><label>Kargo VKN</label><input type="text" id="s-carrierTaxNumber" value="${settings.carrierTaxNumber || ''}"></div>
                            <div class="form-group"><label>Kargo Ünvan</label><input type="text" id="s-carrierName" value="${settings.carrierName || ''}"></div>
                            <div class="form-group"><label>Araç Plaka</label><input type="text" id="s-carrierPlate" value="${settings.carrierPlate || ''}"></div>
                        </div>
                    </div>
                </div>

                <!-- BANNERS TAB -->
                <div id="tab-banners" class="settings-tab-pane" style="display: none;">
                     <div class="action-bar" style="margin-bottom:30px;">
                        <h2 class="brand">🖼️ Banner Yönetimi</h2>
                        <button class="btn btn-primary" onclick="addNewBannerRow()">+ YENİ BANNER</button>
                    </div>
                    <div id="banner-management-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 25px;">
                        ${banners.map((b, idx) => `
                            <div class="glass-card banner-item" data-index="${idx}" style="padding:15px; position:relative; border-radius:15px;">
                                <div style="width:100%; aspect-ratio:21/9; background:rgba(0,0,0,0.3); border-radius:12px; margin-bottom:15px; overflow:hidden; border:1px solid var(--glass-border);">
                                    <img src="${b.url}" id="banner-img-${idx}" style="width:100%; height:100%; object-fit:cover;">
                                </div>
                                <button class="btn btn-sm btn-primary" style="width:100%; margin-bottom:12px; height:40px;" onclick="triggerBannerUpload(${idx})">📸 RESMİ DEĞİŞTİR</button>
                                <input type="file" id="banner-input-${idx}" style="display:none;" onchange="handleBannerFileChange(event, ${idx})">
                                <input type="hidden" class="banner-url-hidden" id="banner-url-${idx}" value="${b.url}">
                                <div class="form-group">
                                    <label style="font-size:0.75em; opacity:0.6;">Yönlendirme Linki</label>
                                    <input type="text" class="banner-link-input" value="${b.link || ''}" style="width:100%; height:35px; font-size:0.8em;" placeholder="https://...">
                                </div>
                                <button class="btn btn-sm" style="width:100%; border-color:var(--neon-red); color:var(--neon-red); margin-top:10px; height:35px;" onclick="removeBannerItem(${idx})">🗑️ BU BANNERI SİL</button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- BANKS TAB -->
                <div id="tab-banks" class="settings-tab-pane" style="display: none;">
                    <div class="action-bar" style="margin-bottom:30px;"><h2 class="brand">🏦 Banka Hesapları</h2><button class="btn btn-primary" onclick="openBankModal()">+ YENİ HESAP EKLE</button></div>
                    <div id="settings-banks-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap:20px;">
                        ${(settings.banks || []).map((bank, idx) => `
                            <div class="glass-card" style="padding:20px; display:flex; justify-content:space-between; align-items:center; border-color:rgba(157, 78, 221, 0.3); border-radius:15px;">
                                <div>
                                    <div style="font-weight:bold; color:var(--neon-cyan); font-size:1.1em;">${bank.name}</div>
                                    <div style="font-size:0.85em; opacity:0.7; margin:5px 0; font-family:monospace; letter-spacing:1px;">${bank.iban}</div>
                                    <div style="font-size:0.75em; opacity:0.5;">${bank.holder}</div>
                                </div>
                                <button class="btn btn-sm" onclick="deleteBank(${idx})" style="border-color:var(--neon-red); border-radius:50%; width:35px; height:35px; padding:0; display:flex; align-items:center; justify-content:center;">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-tab-pane').forEach(p => p.style.display = 'none');
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
        };
    });
}

window.deleteBank = function(index) {
    showConfirm('Bu banka hesabını silmek istediğinize emin misiniz?', () => {
        currentSettingsBanks.splice(index, 1);
        saveAdminSettings(true); // Silent save to refresh UI
    });
}

// --- BANNER HELPER FUNCTIONS ---
window.addNewBannerRow = function() {
    const grid = document.getElementById('banner-management-grid');
    const idx = grid.querySelectorAll('.banner-item').length;
    const div = document.createElement('div');
    div.className = 'glass-card banner-item';
    div.dataset.index = idx;
    div.style = 'padding:15px; border-color:rgba(255,255,255,0.1); position:relative; overflow:hidden;';
    div.innerHTML = `
        <div class="banner-preview-container" style="width:100%; aspect-ratio:21/9; background:rgba(0,0,0,0.4); border-radius:8px; margin-bottom:12px; display:flex; align-items:center; justify-content:center; border:1px solid var(--glass-border); position:relative;">
            <img src="" id="banner-img-${idx}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; display:none;">
            <span id="banner-placeholder-${idx}" style="opacity:0.3;">Resim Yükle</span>
            <div class="banner-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; flex-direction:column; justify-content:center; align-items:center; gap:10px;">
                <button class="btn btn-sm btn-primary" onclick="triggerBannerUpload(${idx})">📸 RESİM SEÇ</button>
            </div>
        </div>
        <input type="file" id="banner-input-${idx}" style="display:none;" onchange="handleBannerFileChange(event, ${idx})">
        <input type="hidden" class="banner-url-hidden" id="banner-url-${idx}" value="">
        <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.7em;">Tıklama Linki (Opsiyonel)</label>
            <input type="text" class="banner-link-input" value="" style="font-size:0.8em;" placeholder="https://...">
        </div>
        <button class="btn" style="width:100%; border-color:var(--neon-red); color:var(--neon-red); font-size:0.8em; padding:8px;" onclick="removeBannerItem(${idx})">🗑️ İPTAL</button>
    `;
    grid.appendChild(div);
}

window.removeBannerItem = function(idx) {
    const item = document.querySelector(`.banner-item[data-index="${idx}"]`);
    if(item) item.remove();
}

window.triggerBannerUpload = function(idx) {
    document.getElementById(`banner-input-${idx}`).click();
}

window.triggerLogoUpload = function() {
    document.getElementById('logo-file-input').click();
}

window.handleLogoUpload = async function(event) {
    const file = event.target.files[0];
    if(!file) return;

    try {
        const formData = new FormData();
        formData.append('banner', file); // We use the same banner upload endpoint for simplicity

        showToast('Logo yükleniyor...', 'info');
        const res = await fetch('/api/admin/banners/upload', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData
        });

        if(!res.ok) throw new Error('Yükleme başarısız');
        const data = await res.json();

        // UI Update
        const preview = document.getElementById('s-logo-preview');
        const hiddenInput = document.getElementById('s-logoUrl');

        if(preview) preview.src = data.url;
        if(hiddenInput) hiddenInput.value = data.url;

        showToast('Logo güncellendi', 'success');
    } catch(e) {
        showToast(e.message, 'error');
    }
}

window.handleBannerFileChange = async function(event, idx) {
    const file = event.target.files[0];
    if(!file) return;

    try {
        const formData = new FormData();
        formData.append('banner', file);

        showToast('Resim yükleniyor...', 'info');
        const res = await fetch('/api/admin/banners/upload', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData
        });

        if(!res.ok) throw new Error('Yükleme başarısız');
        const data = await res.json();

        // UI Update
        const img = document.getElementById(`banner-img-${idx}`);
        const placeholder = document.getElementById(`banner-placeholder-${idx}`);
        const hiddenInput = document.getElementById(`banner-url-${idx}`);

        img.src = data.url;
        img.style.display = 'block';
        if(placeholder) placeholder.style.display = 'none';
        hiddenInput.value = data.url;

        showToast('Resim yüklendi', 'success');
    } catch(e) {
        showToast(e.message, 'error');
    }
}

window.saveAdminSettings = async function(silent = false) {
    const btn = document.querySelector('.btn-premium-save');
    if(btn) {
        btn.disabled = true;
        btn.textContent = 'KAYDEDİLİYOR...';
    }

    try {
        // Gather Banners from the grid
        const banners = [];
        document.querySelectorAll('.banner-item').forEach(item => {
            const urlInput = item.querySelector('.banner-url-hidden');
            const linkInput = item.querySelector('.banner-link-input');
            if(urlInput && urlInput.value) {
                banners.push({ 
                    url: urlInput.value, 
                    link: linkInput ? linkInput.value : '' 
                });
            }
        });

        const data = {
            officialName: document.getElementById('s-officialName').value,
            taxOffice: document.getElementById('s-taxOffice').value,
            taxNumber: document.getElementById('s-taxNumber').value,
            phone: document.getElementById('s-phone').value,
            address: document.getElementById('s-address').value,
            email: document.getElementById('s-email').value,
            settings: {
                banks: currentSettingsBanks,
                whatsapp: document.getElementById('s-whatsapp').value,
                efaturaProvider: document.getElementById('s-efaturaProvider').value,
                efaturaMode: document.getElementById('s-efaturaMode').value,
                efaturaUser: document.getElementById('s-efaturaUser').value,
                efaturaPass: document.getElementById('s-efaturaPass').value,
                efaturaPrefix: document.getElementById('s-efaturaPrefix').value,
                carrierTaxNumber: document.getElementById('s-carrierTaxNumber').value,
                carrierName: document.getElementById('s-carrierName').value,
                carrierPlate: document.getElementById('s-carrierPlate').value
            },
            brandName: document.getElementById('s-brandName').value,
            logoUrl: document.getElementById('s-logoUrl').value,
            primaryColor: document.getElementById('s-primaryColor').value,
            secondaryColor: document.getElementById('s-secondaryColor').value,
            accentColor: document.getElementById('s-accentColor').value,
            banners: banners // This is now an array
        };
        
        await adminApi('PUT', '/api/admin/settings', data);
        if(!silent) showToast('Ayarlar başarıyla güncellendi.', 'success');
        if(!silent) renderSettingsTab();
    } catch(e) { 
        showToast('Kaydetme hatası: ' + e.message, 'error'); 
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.textContent = '💾 DEĞİŞİKLİKLERİ KAYDET';
        }
    }
}



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


// Uygulama içi (In-App) Pop-up Sistemleri
window.customAlert = function(message) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(5px);';
    
    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1a2e; border:1px solid var(--neon-cyan); border-radius:12px; padding:25px; width:90%; max-width:400px; box-shadow:0 0 20px rgba(0, 255, 255, 0.2); text-align:center;';
    
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#fff; font-size:1.1em; margin-bottom:20px; white-space:pre-wrap; line-height:1.5;';
    msg.textContent = message;
    
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'TAMAM';
    btn.style.width = '100%';
    btn.onclick = () => overlay.remove();
    
    box.appendChild(msg);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

window.customConfirm = function(message, onConfirm, options = {}) {
    const okText = options.okText || 'ONAYLA';
    const cancelText = options.cancelText || 'İPTAL';
    const themeColor = options.color || 'var(--neon-purple)';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(5px);';
    
    const box = document.createElement('div');
    box.style.cssText = `background:#1a1a2e; border:1px solid ${themeColor}; border-radius:12px; padding:25px; width:90%; max-width:450px; box-shadow:0 0 20px ${themeColor}33; text-align:center;`;
    
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#fff; font-size:1.1em; margin-bottom:20px; white-space:pre-wrap; line-height:1.5;';
    msg.textContent = message;
    
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:15px;';
    
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.style.cssText = 'background:transparent; border:1px solid rgba(255,255,255,0.1); color:var(--text-secondary);';
    btnCancel.textContent = cancelText;
    btnCancel.onclick = () => {
        overlay.remove();
        if(options.onCancel) options.onCancel();
    };
    
    const btnOk = document.createElement('button');
    btnOk.className = 'btn';
    btnOk.style.cssText = `background:${themeColor}; border:none; color:${themeColor === 'var(--neon-cyan)' ? '#000' : '#fff'}; font-weight:bold;`;
    btnOk.textContent = okText;
    btnOk.onclick = () => {
        overlay.remove();
        onConfirm();
    };
    
    btnGroup.appendChild(btnCancel);
    btnGroup.appendChild(btnOk);
    box.appendChild(msg);
    box.appendChild(btnGroup);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}
window.showConfirm = window.customConfirm;


window.createEInvoice = function(orderId) {
    customConfirm('Bu siparişi resmileştirip e-Fatura/e-Arşiv olarak kesmek istediğinize emin misiniz? Bu işlem geri alınamaz!', async () => {
        try {
            showToast('e-Fatura Entegratöre Gönderiliyor... Lütfen Bekleyin.', 'info');
            const res = await adminApi('POST', '/api/invoices/create-from-order', { orderId });
            showToast(res.message, 'success');
            
            if(res.invoice && res.invoice.invoiceNo) {
                customAlert(`✅ Fatura Kesildi!\n\nFatura No: ${res.invoice.invoiceNo}\nETTN: ${res.invoice.uuid}`);
            }
            
            closeModal();
            renderOrdersTab();
        } catch(e) {
            customAlert(`❌ E-Fatura Hatası:\n\n${e.message}`);
        }
    });
}

window.createEDespatch = async function(orderId) {
    try {
        // Ayarları al (varsayılan taşıyıcı için)
        const settings = await adminApi('GET', '/api/admin/settings');
        const carrier = {
            taxNumber: settings.settings?.carrierTaxNumber || '',
            name: settings.settings?.carrierName || '',
            plate: settings.settings?.carrierPlate || ''
        };

        window.resetModalBtn('🚀 İRSALİYEYİ ONAYLA VE KES', 'btn btn-premium-irsaliye');
        document.getElementById('modal-title').textContent = '🚚 e-İrsaliye: Taşıyıcı Bilgileri';
        document.getElementById('modal-body').innerHTML = `
            <div class="full-width glass-card" style="margin-bottom:15px; padding:15px; border-color:var(--neon-cyan);">
                <p style="font-size:0.9em; opacity:0.8; margin-bottom:15px;">İrsaliye kesilmeden önce taşıyıcı bilgilerini kontrol ediniz. Boş bırakırsanız ayarlardaki varsayılan bilgiler kullanılacaktır.</p>
                <div class="form-group">
                    <label>Taşıyıcı VKN / TCKN</label>
                    <input type="text" id="mi-carrier-tax" value="${carrier.taxNumber}">
                </div>
                <div class="form-group">
                    <label>Taşıyıcı Ünvan / Ad Soyad</label>
                    <input type="text" id="mi-carrier-name" value="${carrier.name}">
                </div>
                <div class="form-group">
                    <label>Araç Plaka</label>
                    <input type="text" id="mi-carrier-plate" value="${carrier.plate}">
                </div>
            </div>
        `;

        document.getElementById('modal-save-btn').onclick = async () => {
            const finalCarrier = {
                taxNumber: document.getElementById('mi-carrier-tax').value,
                name: document.getElementById('mi-carrier-name').value,
                plate: document.getElementById('mi-carrier-plate').value
            };

            try {
                showToast('e-İrsaliye Oluşturuluyor...', 'info');
                const res = await adminApi('POST', '/api/invoices/create-despatch', { 
                    orderId, 
                    carrierInfo: finalCarrier 
                });
                showToast(res.message, 'success');
                
                if(res.despatch && res.despatch.invoiceNo) {
                    customAlert(`✅ İrsaliye Kesildi!\n\nİrsaliye No: ${res.despatch.invoiceNo}\nETTN: ${res.despatch.uuid}`);
                }
                
                closeModal();
                renderOrdersTab();
            } catch(e) {
                customAlert(`❌ E-İrsaliye Hatası:\n\n${e.message}`);
            }
        };
        
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

async function renderInvoicesTab(filterDocType = 'ALL', filterType = 'ALL') {
    try {
        const invoices = await adminApi('GET', '/api/invoices');
        let filtered = invoices;
        
        if(filterDocType !== 'ALL') {
            filtered = filtered.filter(inv => inv.docType === filterDocType);
        }
        if(filterType !== 'ALL') {
            filtered = filtered.filter(inv => inv.type === filterType);
        }
        
        let title = '📑 e-Arşiv & Belge Yönetimi';
        if(filterDocType === 'INVOICE') {
            if(filterType === 'SALES') title = '🧾 Satış Faturaları';
            else if(filterType === 'PURCHASE') title = '🛒 Alış Faturaları';
            else if(filterType === 'RETURN') title = '🔄 İade Faturaları';
        } else if(filterDocType === 'DESPATCH') {
            title = '🚚 e-İrsaliye Arşivi';
        }

        let html = `
            <div class="action-bar" style="align-items:flex-end;">
                <h2 class="brand">${title}</h2>
                <div style="display:flex; gap:10px;">
                    ${filterType === 'PURCHASE' ? `<button class="btn btn-primary" style="background:var(--neon-purple); border-color:var(--neon-purple);" onclick="syncIncomingInvoices()">📥 UYUMSOFT'TAN GELENLERİ ÇEK</button>` : ''}
                    <button class="btn btn-primary" onclick="openQuickInvoiceModal('${filterDocType}')">+ Yeni Oluştur</button>
                </div>
            </div>
            <div id="bulk-send-container" style="display:none; margin-bottom:15px; animation: slideIn 0.3s ease;">
                <button id="bulk-invoice-send-btn" class="btn btn-premium-fatura" style="width:100%; padding:15px; font-weight:bold; letter-spacing:1px; display:none;" onclick="${filterType === 'PURCHASE' ? 'bulkImportPurchaseInvoices()' : 'sendSelectedInvoicesToGib()'}">
                    🚀 ${filterType === 'PURCHASE' ? 'SEÇİLENLERİ TOPLU OLARAK STOKLARA İŞLE' : 'SEÇİLENLERİ GİB\'E GÖNDER'}
                </button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;"><input type="checkbox" class="invoice-checkbox invoice-checkbox-all" onchange="window.toggleAllInvoices(this.checked)"></th>
                            <th>TARİH</th>
                            <th>BELGE NO / ETTN</th>
                            <th>TİP</th>
                            <th>CARİ</th>
                            <th style="text-align:right;">TOPLAM TUTAR</th>
                            <th>DURUM</th>
                            <th style="text-align:right;">İŞLEMLER</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if(filtered.length === 0) {
            html += `<tr><td colspan="8" style="text-align:center; padding:50px; opacity:0.5;">
                <div style="font-size:3em; margin-bottom:10px;">📂</div>
                Henüz seçili türde bir belge bulunamadı.
            </td></tr>`;
        }

        filtered.forEach(inv => {
            const isDespatch = inv.docType === 'DESPATCH';
            const color = isDespatch ? 'var(--neon-cyan)' : 'var(--neon-purple)';
            
            let typeLabel = isDespatch ? 'İRSALİYE' : 'FATURA';
            let typeColor = color;
            
            if(inv.type === 'SALES') typeLabel = isDespatch ? 'SATIŞ İRS.' : 'SATIŞ FAT.';
            else if(inv.type === 'PURCHASE') {
                typeLabel = isDespatch ? 'ALIŞ İRS.' : 'ALIŞ FAT.';
                typeColor = 'var(--neon-pink)';
            }
            else if(inv.type === 'RETURN') {
                typeLabel = 'İADE FAT.';
                typeColor = '#ff9f43'; // Orange for return
            }
            
            const statusMap = {
                'DRAFT': 'TASLAK',
                'ISSUED': "GİB'e Gönderilecek",
                'SENT': "GİB'e Gönderildi",
                'RECEIVED': 'Gelen Fatura',
                'IMPORTED': 'Stoklara İşlendi',
                'CANCELLED': 'İPTAL'
            };
            
            let statusColor = 'var(--neon-green)';
            if(inv.status === 'ISSUED') statusColor = 'var(--neon-cyan)';
            if(inv.status === 'DRAFT') statusColor = 'var(--text-secondary)';
            if(inv.status === 'CANCELLED') statusColor = 'var(--neon-red)';
            if(inv.status === 'RECEIVED') statusColor = 'var(--neon-purple)';
            if(inv.status === 'IMPORTED') statusColor = 'var(--neon-green)';

            const statusLabel = statusMap[inv.status] || inv.status;
            
            html += `
                <tr class="${inv.status === 'ISSUED' ? 'row-pending' : ''}" style="cursor:pointer;" onclick="editInvoice('${inv.uuid}')">
                    <td style="text-align:center;">
                        ${inv.status === 'ISSUED' ? `<input type="checkbox" class="invoice-checkbox" value="${inv.id}" onchange="event.stopPropagation(); window.updateInvoiceBulkBtnVisibility()">` : '•'}
                    </td>
                    <td>${new Date(inv.date).toLocaleDateString('tr-TR')}</td>
                    <td>
                        <div style="color:${color}; font-weight:bold; font-size:1.1em;">${inv.invoiceNo || '-'}</div>
                        <div style="font-size:0.7em; opacity:0.5; font-family:monospace;">${inv.uuid}</div>
                    </td>
                    <td><span style="font-size:0.75em; padding:3px 8px; border-radius:4px; border:1px solid ${typeColor}; color:${typeColor}; font-weight:bold;">${typeLabel}</span></td>
                    <td><span style="color:var(--text-primary);">${inv.companyName || inv.companyId}</span></td>
                    <td style="text-align:right; font-weight:bold; color:var(--neon-green);">${inv.totalAmount.toLocaleString('tr-TR')} ₺</td>
                    <td>
                        <span style="color:${statusColor}; font-size:0.9em; display:flex; align-items:center; gap:5px; font-weight:bold;">
                            <span style="width:8px; height:8px; background:${statusColor}; border-radius:50%; box-shadow:0 0 8px ${statusColor};"></span>
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="text-align:right;">
                        <div style="display:flex; gap:8px; justify-content:flex-end;">
                             ${inv.status === 'ISSUED' ? `<button class="btn" style="padding:5px 12px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan); background:rgba(0,243,255,0.05);" onclick="event.stopPropagation(); sendToIntegrator('${inv.id}')">🚀 GÖNDER</button>` : ''}
                             <button class="btn" style="padding:5px 12px; font-size:0.8em; border-color:var(--neon-pink); color:var(--neon-pink);" onclick="event.stopPropagation(); downloadInvoicePdf('${inv.id}')">📥 PDF</button>
                             ${inv.status === 'ISSUED' ? `<button class="btn" style="padding:5px 12px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red); background:rgba(255,0,60,0.05);" onclick="event.stopPropagation(); deleteInvoice('${inv.uuid}')">🗑️ SİL</button>` : ''}
                             ${inv.status === 'RECEIVED' ? `<button class="btn" style="padding:5px 12px; font-size:0.8em; border-color:var(--neon-green); color:var(--neon-green); background:rgba(0,255,159,0.05);" onclick="event.stopPropagation(); bulkImportPurchaseInvoices(['${inv.uuid}'])">📥 İÇERİ AL</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
        window.currentInvoiceTabParams = { filterDocType, filterType }; // Refresh için sakla
    } catch(e) { showToast('Belgeler yüklenemedi: ' + e.message, 'error'); }
}

window.toggleAllInvoices = function(checked) {
    document.querySelectorAll('.invoice-checkbox').forEach(cb => cb.checked = checked);
    window.updateInvoiceBulkBtnVisibility();
}

window.updateInvoiceBulkBtnVisibility = function() {
    const selected = document.querySelectorAll('.invoice-checkbox:checked').length;
    const btn = document.getElementById('bulk-invoice-send-btn');
    if(btn) btn.style.display = selected > 0 ? 'block' : 'none';
}

window.sendSelectedInvoicesToGib = async function() {
    const ids = Array.from(document.querySelectorAll('.invoice-checkbox:checked')).map(cb => cb.value);
    customConfirm(`${ids.length} adet belgeyi toplu olarak GİB'e göndermek istediğinize emin misiniz?`, async () => {
        try {
            showToast('Toplu gönderim başlatıldı...', 'info');
            const res = await adminApi('POST', '/api/invoices/bulk-send', { ids });
            showToast(res.message, 'success');
            renderInvoicesTab(window.currentInvoiceTabParams?.filterDocType || 'ALL', window.currentInvoiceTabParams?.filterType || 'ALL');
        } catch(e) { 
            console.error('Bulk send error:', e);
            customAlert('Toplu gönderim hatası: ' + e.message); 
        }
    });
}

window.editInvoice = async function(uuid) {
    window.resetModalBtn(); // Anında temizle
    try {
        const invoices = await adminApi('GET', '/api/invoices');
        const inv = invoices.find(i => i.uuid === uuid);
        if(!inv) return showToast('Belge bulunamadı', 'error');
        
        const isPurchase = inv.type === 'PURCHASE';
        // KESİN KURAL: GİB'e gitmiş veya Stoklara işlenmişse KİLİTLE.
        const finalizedStatuses = ['SENT', 'SUCCESS', 'IMPORTED', 'COMPLETED'];
        const isFinalized = finalizedStatuses.includes((inv.status || '').toUpperCase());
        
        const canEdit = !isFinalized;
        const isSent = isFinalized; 

        let items = [];
        try { items = JSON.parse(inv.details); } catch(e) { items = []; }

        const carrier = inv.carrierInfo ? JSON.parse(inv.carrierInfo) : { taxNumber:'', name:'', plate:'' };

        const myProducts = await adminApi('GET', '/api/products');
        
        window.resetModalBtn('💾 KAYDET', 'btn btn-premium-save', canEdit);
        
        // Modal içi aksiyon butonlarını sıfırla
        const delBtn = document.getElementById('modal-delete-btn');
        const sendBtn = document.getElementById('modal-send-btn');
        if(delBtn) delBtn.style.display = 'none';
        if(sendBtn) sendBtn.style.display = 'none';
        if(saveBtn) saveBtn.style.display = 'none';

        if(!isSent) {
            // SİL butonunu modal içinden kaldırdık (Liste yanına taşındı)
            if(delBtn) delBtn.style.display = 'none';

            if(sendBtn && inv.status === 'ISSUED') {
                sendBtn.style.display = 'block';
                sendBtn.onclick = () => sendToIntegrator(inv.id);
            }
        }
        
        document.getElementById('modal-title').textContent = `${canEdit ? '⚙️ Belgeyi Düzenle' : '👁️ Belgeyi İncele'}: ${inv.invoiceNo || 'Taslak'}`;
        
        let modalBody = `
            <div class="full-width glass-card" style="margin-bottom:20px; padding:15px; border-color:var(--neon-purple);">
                <h4 style="color:var(--neon-purple); margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📦 Ürün Kalemleri</span>
                    ${isPurchase ? `<small style="color:var(--neon-cyan); font-size:0.6em;">Tedarikçi Ürünlerini Kendi Stoklarınızla Eşleştirin</small>` : ''}
                </h4>
                <div style="overflow-x: auto; width: 100%; border-radius: 8px;">
                <table class="data-table" style="font-size:0.85em; width:100%; table-layout:fixed;">
                    <thead>
                        <tr>
                            ${isPurchase ? '<th style="width:180px;">Gelen Ürün (Tedarikçi)</th>' : ''}
                            <th style="width:150px;">Stok Kodunuz</th>
                            <th style="width:auto;">Stok Adınız</th>
                            <th style="width:70px;">Miktar</th>
                            <th style="width:100px;">B.Fiyat</th>
                            <th style="width:60px;">İsk %</th>
                            <th style="width:60px;">KDV %</th>
                            <th style="width:110px; text-align:right;">Toplam</th>
                        </tr>
                    </thead>
                    <tbody id="me-items-body">
                        ${(Array.isArray(items) && items.length > 0) ? items.map((item, idx) => `
                            <tr>
                                ${isPurchase ? `
                                    <td style="opacity:0.6; font-size:0.8em; white-space:normal; line-height:1.2;">
                                        <b style="color:var(--neon-purple);">${item.supplierCode || item.code || ''}</b><br>${item.supplierName || item.name || ''}
                                    </td>
                                ` : ''}
                                <td class="search-container">
                                    <input type="text" class="me-item-code" data-idx="${idx}" value="${item.code || item.kod || item.productCode || item.sku || item.barcode || ''}" placeholder="Kod Ara..." ${isSent ? 'readonly' : ''} style="padding:6px; font-size:0.95em; font-family:monospace; color:var(--neon-cyan); height:32px;">
                                    <div class="search-results-list" id="me-search-res-${idx}"></div>
                                </td>
                                <td><input type="text" class="me-item-name" data-idx="${idx}" value="${item.name || item.ad || item.description || item.productName || ''}" ${isSent ? 'readonly' : ''} style="padding:6px; font-size:0.95em; width:100%; height:32px;"></td>
                                <td><input type="number" step="1" class="me-item-qty" data-idx="${idx}" value="${item.qty || item.miktar || item.quantity || 1}" ${isSent ? 'readonly' : ''} style="padding:6px; font-size:0.95em; height:32px; text-align:center;"></td>
                                <td><input type="number" step="0.01" class="me-item-price" data-idx="${idx}" value="${item.price || item.priceExclTax || item.unitPrice || 0}" ${isSent ? 'readonly' : ''} style="padding:6px; font-size:0.95em; height:32px; text-align:center;"></td>
                                <td><input type="number" step="0.1" class="me-item-disc" data-idx="${idx}" value="${item.discountRate || item.discount || 0}" ${isSent ? 'readonly' : ''} style="padding:6px; font-size:0.95em; height:32px; text-align:center;"></td>
                                <td><input type="number" step="1" class="me-item-taxrate" data-idx="${idx}" value="${item.taxRate || item.tax || 20}" ${isSent ? 'readonly' : ''} style="padding:6px; font-size:0.95em; height:32px; text-align:center;"></td>
                                <td style="text-align:right; font-weight:bold; color:var(--neon-cyan); white-space:nowrap;" class="me-item-total" data-idx="${idx}">${formatCurrency(item.total || item.lineTotal || item.amount || 0)}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--neon-pink); opacity:0.7;">⚠️ Bu belgenin içeriği okunamadı veya ürün bulunamadı.</td></tr>`}
                    </tbody>
                </table>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div class="form-group" style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid rgba(157, 78, 221, 0.2);">
                    <label style="color:var(--neon-purple); font-weight:bold;">🧾 Vergi (KDV) Tutarı</label>
                    <input type="text" id="me-tax" value="${formatCurrency(inv.taxAmount)}" data-raw="${inv.taxAmount}" readonly style="opacity:1; background:transparent; border:none; font-size:1.4em; color:var(--text-primary);">
                </div>
                <div class="form-group" style="background: rgba(0,243,255,0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(0, 243, 255, 0.2);">
                    <label style="color:var(--neon-cyan); font-weight:bold;">💰 GENEL TOPLAM [KDV DAHİL]</label>
                    <input type="text" id="me-total" value="${formatCurrency(inv.totalAmount)}" data-raw="${inv.totalAmount}" readonly style="opacity:1; background:transparent; border:none; font-size:2em; font-weight:bold; color:var(--neon-green);">
                </div>
            </div>
        `;

        if(inv.docType === 'DESPATCH') {
            modalBody += `
                <div class="full-width" style="margin-top:10px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
                    <h4 style="color:var(--neon-cyan); margin-bottom:15px;">🚚 Taşıyıcı Bilgileri</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                        <div><label>Taşıyıcı VKN</label><input type="text" id="me-carrier-tax" value="${carrier.taxNumber}" ${isSent ? 'readonly' : ''}></div>
                        <div><label>Taşıyıcı Ünvan</label><input type="text" id="me-carrier-name" value="${carrier.name}" ${isSent ? 'readonly' : ''}></div>
                        <div><label>Araç Plaka</label><input type="text" id="me-carrier-plate" value="${carrier.plate}" ${isSent ? 'readonly' : ''}></div>
                    </div>
                </div>
            `;
        }

        const modalContent = document.querySelector('.modal-content');
        if(modalContent) modalContent.style.maxWidth = '1100px';

        document.getElementById('modal-body').innerHTML = modalBody;

        // Hesaplama Fonksiyonu
        const recalculateEditModal = () => {
            let totalExcl = 0;
            let totalTax = 0;
            const rows = document.querySelectorAll('#me-items-body tr');
            
            rows.forEach((row, idx) => {
                const qty = parseFloat(row.querySelector('.me-item-qty').value) || 0;
                const price = parseFloat(row.querySelector('.me-item-price').value) || 0;
                const disc = parseFloat(row.querySelector('.me-item-disc').value) || 0;
                const taxRate = parseFloat(row.querySelector('.me-item-taxrate').value) || 0;
                
                const discountedTotal = (price * qty) * (1 - disc/100);
                const tax = discountedTotal * (taxRate / 100);
                const lineTotal = discountedTotal + tax;
                
                totalExcl += discountedTotal;
                totalTax += tax;
                
                row.querySelector('.me-item-total').textContent = formatCurrency(lineTotal);
                
                items[idx].qty = qty;
                items[idx].price = price;
                items[idx].priceExclTax = price;
                items[idx].discountRate = disc;
                items[idx].taxRate = taxRate;
                items[idx].lineTotalExcl = discountedTotal;
                items[idx].lineTax = tax;
                items[idx].total = lineTotal;
                items[idx].lineTotal = lineTotal;
            });
            
            document.getElementById('me-tax').value = formatCurrency(totalTax);
            document.getElementById('me-total').value = formatCurrency(totalExcl + totalTax);
            
            document.getElementById('me-tax').setAttribute('data-raw', totalTax.toFixed(2));
            document.getElementById('me-total').setAttribute('data-raw', (totalExcl + totalTax).toFixed(2));
        };

        // Event Listeners
        document.querySelectorAll('.me-item-qty, .me-item-price, .me-item-disc, .me-item-taxrate, .me-item-code, .me-item-name').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = input.getAttribute('data-idx');
                
                if(input.classList.contains('me-item-code')) {
                    items[idx].code = input.value;
                    // Stok Arama
                    const q = input.value.toLowerCase();
                    const resDiv = document.getElementById(`me-search-res-${idx}`);
                    if(q.length > 0) {
                        const filtered = myProducts.filter(p => p.kod.toLowerCase().includes(q) || p.ad.toLowerCase().includes(q)).slice(0, 5);
                        resDiv.innerHTML = filtered.map(p => `
                            <div class="search-result-item" onclick="window.selectMatchedProduct(${idx}, '${p.kod}', '${p.ad.replace(/'/g,"\\'")}')">
                                <div class="p-name">${p.ad}</div>
                                <div class="p-info">
                                    <span>Kod: <b>${p.kod}</b></span>
                                    <span>Fiyat: <b style="color:var(--neon-green);">${p.priceExclTax} ₺</b></span>
                                    <span>Stok: <b style="color:var(--neon-cyan);">${p.stock}</b></span>
                                </div>
                            </div>
                        `).join('');
                        resDiv.classList.add('active');
                    } else {
                        resDiv.classList.remove('active');
                    }
                }
                
                if(input.classList.contains('me-item-name')) items[idx].name = input.value;
                recalculateEditModal();
            });
        });

        window.selectMatchedProduct = async (idx, code, name) => {
            const supplierCode = items[idx].supplierCode || items[idx].code;
            const supplierName = inv.companyId; // Cari Ünvanı (Tedarikçi Adı)

            items[idx].code = code;
            items[idx].name = name;
            
            const rows = document.querySelectorAll('#me-items-body tr');
            const row = rows[idx];
            row.querySelector('.me-item-code').value = code;
            row.querySelector('.me-item-name').value = name;
            
            document.getElementById(`me-search-res-${idx}`).classList.remove('active');
            recalculateEditModal();

            // Eşleşmeyi Arka Planda Kaydet (Opsiyonel ama istenen özellik)
            if(isPurchase && supplierCode) {
                try {
                    await adminApi('POST', '/api/invoices/save-mapping', {
                        supplierName: supplierName,
                        supplierCode: supplierCode,
                        myCode: code
                    });
                    showToast(`'${supplierCode}' -> '${code}' eşleşmesi hatırlandı.`, 'info');
                } catch(e) { console.warn('Mapping save error:', e); }
            }
        };

        if(!isSent) {
            document.getElementById('modal-save-btn').onclick = async () => {
            const updatedData = {
                totalAmount: document.getElementById('me-total').getAttribute('data-raw') || inv.totalAmount.toString(),
                taxAmount: document.getElementById('me-tax').getAttribute('data-raw') || inv.taxAmount.toString(),
                details: JSON.stringify(items),
                carrierInfo: inv.docType === 'DESPATCH' ? {
                    taxNumber: document.getElementById('me-carrier-tax').value,
                    name: document.getElementById('me-carrier-name').value,
                    plate: document.getElementById('me-carrier-plate').value
                } : null,
                orderId: inv.orderId // Siparişi de güncellemek için lazım
            };

            try {
                const res = await adminApi('PUT', `/api/invoices/${uuid}`, updatedData);
                showToast(res.message);
                closeModal();
                renderInvoicesTab(window.currentInvoiceTabParams?.filterDocType, window.currentInvoiceTabParams?.filterType);
            } catch(e) { showToast(e.message, 'error'); }
        };
    }

        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast('Düzenleme hatası: ' + e.message, 'error'); }
}

window.deleteInvoice = function(uuid) {
    customConfirm('Bu belgeyi KALICI olarak silmek istediğinize emin misiniz? (Bu işlem geri alınamaz)', async () => {
        try {
            showToast('Belge siliniyor...', 'info');
            const res = await adminApi('DELETE', `/api/invoices/${uuid}`);
            showToast(res.message, 'success');
            renderInvoicesTab(window.currentInvoiceTabParams?.filterDocType || 'ALL', window.currentInvoiceTabParams?.filterType || 'ALL');
        } catch(e) {
            console.error('Delete invoice error:', e);
            customAlert('Silme hatası: ' + e.message);
        }
    });
}

window.downloadInvoicePdf = function(uuid) {
    showToast('Belge PDF formatına dönüştürülyor...', 'info');
    setTimeout(() => {
        customAlert(`📄 PDF Hazır (Simülasyon)\n\nGerçek Uyumsoft entegrasyonu tamamlandığında ${uuid} ID'li belgenin resmi PDF formatı otomatik olarak indirilecektir.`);
    }, 1000);
}

window.sendToIntegrator = function(id) {
    customConfirm('Bu belgeyi Uyumsoft Entegratör sistemine canlı olarak göndermek istediğinize emin misiniz?', async () => {
        try {
            showToast('Entegratör servisine bağlanılıyor...', 'info');
            const res = await adminApi('POST', '/api/invoices/bulk-send', { ids: [id] });
            showToast(res.message, 'success');
            renderInvoicesTab(window.currentInvoiceTabParams?.filterDocType || 'ALL', window.currentInvoiceTabParams?.filterType || 'ALL');
        } catch(e) {
            console.error('Send to integrator error:', e);
            customAlert(`❌ E-Fatura Hatası:\n\n${e.message}`);
        }
    });
}

window.viewInvoiceXml = function(uuid) {
    customAlert(`Bu belge (UUID: ${uuid}) şu an entegratör havuzundadır.\n\nGerçek bir Uyumsoft bağlantısı yapıldığında burada faturanın orijinal XML görüntüsü açılacaktır.`);
}

window.syncIncomingInvoices = async function() {
    try {
        showToast('Uyumsoft Gelen Kutusu taranıyor...', 'info');
        const res = await adminApi('POST', '/api/invoices/sync-inbox');
        showToast(res.message, 'success');
        renderInvoicesTab('INVOICE', 'PURCHASE');
    } catch(e) { customAlert('Senkronizasyon Hatası: ' + e.message); }
}

window.queryInvoiceStatus = async function(uuid) {
    try {
        showToast('Güncel durum sorgulanıyor...', 'info');
        const res = await adminApi('GET', `/api/invoices/${uuid}/status`);
        
        let icon = res.status === 'ERROR' ? '❌' : '✅';
        customAlert(`${icon} Belge Durumu (GİB)\n\nETTN: ${res.uuid}\nDurum: ${res.statusDetail}\nSorgu Tarihi: ${new Date(res.queryDate).toLocaleString('tr-TR')}`);
        
        renderInvoicesTab(window.currentInvoiceTabParams?.filterDocType, window.currentInvoiceTabParams?.filterType);
    } catch(e) { customAlert('Sorgulama Hatası: ' + e.message); }
}

window.bulkImportPurchaseInvoices = async function(uuids = null) {
    const selectedUuids = uuids || [];
    if(!uuids) {
        document.querySelectorAll('.invoice-checkbox:checked').forEach(cb => {
            const row = cb.closest('tr');
            const uuidText = row.querySelector('div[style*="font-family:monospace"]').textContent;
            selectedUuids.push(uuidText);
        });
    }

    if(selectedUuids.length === 0) return showToast('Lütfen fatura seçin', 'error');

    customConfirm(`${selectedUuids.length} adet faturayı stoklara işlemek istediğinize emin misiniz?`, () => {
        // İkinci aşama: Stok kartı oluşturma seçeneği (Uygulama içi popup ile)
        customConfirm("Sistemde bulunmayan ürünler faturadaki bilgilerle OTOMATİK AÇILSIN MI?", async () => {
            // EVET seçildi
            await executeImport(true);
        }, { 
            okText: 'EVET, OTOMATİK AÇ', 
            cancelText: 'HAYIR, SADECE KAYITLILARI AL',
            color: 'var(--neon-cyan)',
            onCancel: async () => {
                // HAYIR seçildi (Sadece kayıtlıları alacak)
                await executeImport(false);
            }
        });

        // Not: Eğer ikinci popup'ta "İptal/Hayır" denirse ne olacak? 
        // Mevcut mantıkta "Hayır" demek işlemi tamamen iptal etmemeli, sadece autoCreate=false olmalı.
        // Ama customConfirm'de cancelText overlay'i kapatıyor. 
        // Bu yüzden "HAYIR" butonuna basıldığında da bir işlem yapması için onCancel desteği eklemeliyim 
        // VEYA ikinci popup'ı bir "seçim" penceresine dönüştürmeliyim.
        
        // Şimdilik daha basit bir çözüm:
        async function executeImport(autoCreate) {
            try {
                showToast('Stoklar güncelleniyor...', 'info');
                const res = await adminApi('POST', '/api/invoices/bulk-import-purchase', { 
                    uuids: selectedUuids,
                    autoCreateMissing: autoCreate
                });
                
                if(res.errors && res.errors.length > 0) {
                    customAlert(`Bazı faturalar içeri alınamadı:\n\n${res.errors.join('\n')}`);
                } else {
                    showToast(res.message, 'success');
                }
                renderInvoicesTab(window.currentInvoiceTabParams?.filterDocType, window.currentInvoiceTabParams?.filterType);
            } catch(e) { showToast(e.message, 'error'); }
        }
    });
}

window.syncIncomingInvoices = async function() {
    try {
        showToast('Uyumsoft taranıyor...', 'info');
        const res = await adminApi('POST', '/api/invoices/sync-inbox');
        showToast(res.message, 'success');
        renderInvoicesTab('INVOICE', 'PURCHASE');
    } catch(e) { showToast('Sync hatası: ' + e.message, 'error'); }
}

// Kasa İşlemi Ekle/Düzenle
window.openCashTransactionModal = async function(id = null) {
    try {
        const [methods, companies] = await Promise.all([
            adminApi('GET', '/api/payment-methods'),
            adminApi('GET', '/api/companies')
        ]);
        
        let tx = { type: 'TAHSILAT', cariCode: '', amount: 0, accountType: 'KASA', date: new Date().toISOString().split('T')[0], notes: '', receiptCode: '' };
        if (id) {
            const all = await adminApi('GET', '/api/admin/cash-transactions');
            tx = all.find(t => t.id === id);
        }

        window.resetModalBtn('KAYDET', 'btn btn-premium-save', true);
        document.getElementById('modal-title').textContent = id ? 'Kasa İşlemi Düzenle' : 'YENİ KASA İŞLEMİ';
        
        let html = `
            <div class="form-group">
                <label>İşlem Tipi *</label>
                <select id="cash-type" class="form-control">
                    <option value="TAHSILAT" ${tx.type === 'TAHSILAT' ? 'selected' : ''}>TAHSİLAT (Giriş)</option>
                    <option value="ODEME" ${tx.type === 'ODEME' ? 'selected' : ''}>ÖDEME (Çıkış)</option>
                    <option value="GELIR" ${tx.type === 'GELIR' ? 'selected' : ''}>GENEL GELİR (Satış Dışı)</option>
                    <option value="GIDER" ${tx.type === 'GIDER' ? 'selected' : ''}>GENEL GİDER (Alış Dışı)</option>
                </select>
            </div>
            <div class="form-group">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label>Ödeme Yöntemi / Kasa *</label>
                    <a href="javascript:void(0)" onclick="managePaymentMethods()" style="font-size:0.75em; color:var(--neon-cyan);">⚙️ Yönet</a>
                </div>
                <select id="cash-accountType" class="form-control">
                    ${methods.map(m => `<option value="${m.name}" ${tx.accountType === m.name ? 'selected' : ''}>${m.name} (${m.type})</option>`).join('')}
                </select>
            </div>
            <div class="form-group full-width">
                <label>Cari Hesap Seçimi *</label>
                <input type="text" id="cash-cari-search" class="form-control" placeholder="Cari adını veya kodunu yazmaya başlayın..." value="${tx.cariCode}">
                <div id="cash-cari-results" class="search-results-dropdown"></div>
            </div>
            <div class="form-group">
                <label>Tutar (TL) *</label>
                <input type="number" id="cash-amount" class="form-control" value="${tx.amount}">
            </div>
            <div class="form-group">
                <label>İşlem Tarihi</label>
                <input type="date" id="cash-date" class="form-control" value="${tx.date ? new Date(tx.date).toISOString().split('T')[0] : ''}">
            </div>
            <div class="form-group">
                <label>Fiş / Evrak No</label>
                <input type="text" id="cash-receipt" class="form-control" value="${tx.receiptCode || ''}" placeholder="Fiş No">
            </div>
            <div class="form-group full-width">
                <label>Not / Açıklama</label>
                <textarea id="cash-notes" class="form-control" rows="3" placeholder="Açıklama...">${tx.notes || ''}</textarea>
            </div>
        `;

        document.getElementById('modal-body').innerHTML = html;
        
        // Cari Arama Logic
        const input = document.getElementById('cash-cari-search');
        const results = document.getElementById('cash-cari-results');
        input.oninput = () => {
            const val = input.value.toLowerCase();
            if (val.length < 2) { results.innerHTML = ''; return; }
            const filtered = companies.filter(c => c.ad.toLowerCase().includes(val) || c.cariKod.toLowerCase().includes(val));
            results.innerHTML = filtered.map(c => `<div onclick="selectCashCari('${c.cariKod}', '${c.ad}')"><b>${c.cariKod}</b> - ${c.ad}</div>`).join('');
        };

        document.getElementById('modal-save-btn').onclick = async () => {
            const data = {
                type: document.getElementById('cash-type').value,
                cariCode: input.value.split(' ')[0],
                accountType: document.getElementById('cash-accountType').value,
                amount: document.getElementById('cash-amount').value,
                date: document.getElementById('cash-date').value,
                receiptCode: document.getElementById('cash-receipt').value,
                notes: document.getElementById('cash-notes').value
            };
            try {
                if (id) await adminApi('PUT', `/api/admin/cash-transactions/${id}`, data);
                else await adminApi('POST', '/api/admin/cash-transactions', data);
                showToast('İşlem kaydedildi');
                closeModal();
                if (window.currentTab === 'dashboard') renderDashboardTab();
                else renderCashTab();
            } catch (e) { showToast('Hata: ' + e.message, 'error'); }
        };

        openModal();
    } catch(e) { console.error(e); }
}

window.selectCashCari = (code, name) => {
    document.getElementById('cash-cari-search').value = code;
    document.getElementById('cash-cari-results').innerHTML = '';
}

window.managePaymentMethods = async function() {
    try {
        const methods = await adminApi('GET', '/api/payment-methods');
        window.resetModalBtn('', '', false);
        document.getElementById('modal-title').textContent = '🏦 Kasa ve Hesap Yönetimi';
        let html = `
            <div class="full-width glass-card" style="padding:15px; margin-bottom:20px;">
                <h4 class="brand" style="font-size:0.9em; margin-bottom:10px;">➕ Yeni Hesap/Yöntem Ekle</h4>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="new-method-name" class="form-control" placeholder="Hesap Adı (Örn: Vakıfbank)">
                    <select id="new-method-type" class="form-control" style="width:150px;">
                        <option value="KASA">KASA</option>
                        <option value="BANKA">BANKA</option>
                        <option value="KREDI_KARTI">K. KARTI</option>
                        <option value="SENET">SENET</option>
                    </select>
                    <button class="btn btn-premium-save" onclick="saveNewPaymentMethod()">EKLE</button>
                </div>
            </div>
            <div class="full-width">
                <table class="data-table">
                    <thead><tr><th>Hesap Adı</th><th>Tür</th><th style="text-align:right;">İşlem</th></tr></thead>
                    <tbody>
                        ${methods.map(m => `
                            <tr>
                                <td>${m.name}</td>
                                <td><span class="badge badge-primary">${m.type}</span></td>
                                <td style="text-align:right;">
                                    <button class="btn" onclick="deletePaymentMethod('${m.id}')" style="padding:5px 10px; border-color:var(--neon-red); color:var(--neon-red); font-size:0.7em;">SİL</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        document.getElementById('modal-body').innerHTML = html;
    } catch(e) { console.error(e); }
}

window.saveNewPaymentMethod = async function() {
    const name = document.getElementById('new-method-name').value;
    const type = document.getElementById('new-method-type').value;
    if(!name) return showToast('İsim boş olamaz', 'error');
    try {
        await adminApi('POST', '/api/payment-methods', { name, type });
        showToast('Hesap eklendi');
        managePaymentMethods();
    } catch(e) { showToast('Hata: ' + e.message, 'error'); }
}

window.deletePaymentMethod = async function(id) {
    window.showConfirm('Bu hesabı silmek istediğinize emin misiniz?', async () => {
        try {
            await adminApi('DELETE', `/api/payment-methods/${id}`);
            showToast('Hesap silindi');
            managePaymentMethods();
        } catch(e) { showToast('Hata: ' + e.message, 'error'); }
    });
}

window.openProfileModal = function() {
    const m = document.getElementById('admin-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    if(!m || !body) return;

    title.textContent = '👤 Profil Ayarları';
    body.innerHTML = `
        <div class="form-group full-width">
            <label>Görünen Ad</label>
            <input type="text" id="p-displayName" value="${currentUser.displayName}" placeholder="Adınız Soyadınız">
        </div>
        <div class="form-group full-width">
            <label>Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)</label>
            <input type="password" id="p-password" placeholder="******">
        </div>
        <div class="form-group full-width">
            <label>Yeni Şifre Tekrar</label>
            <input type="password" id="p-password-confirm" placeholder="******">
        </div>
    `;

    resetModalBtn('PROFİLİ GÜNCELLE');
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.onclick = saveProfile;
    
    openModal();
}

async function saveProfile() {
    const displayName = document.getElementById('p-displayName').value;
    const password = document.getElementById('p-password').value;
    const confirm = document.getElementById('p-password-confirm').value;

    if (password && password !== confirm) {
        showToast('Şifreler eşleşmiyor', 'error');
        return;
    }

    try {
        const btn = document.getElementById('modal-save-btn');
        btn.disabled = true;
        btn.textContent = 'GÜNCELLENİYOR...';

        await adminApi('POST', '/api/auth/update-profile', { displayName, password });
        
        showToast('Profil başarıyla güncellendi');
        currentUser.displayName = displayName;
        
        // UI güncelle
        const nameEl = document.getElementById('user-display-name');
        if(nameEl) nameEl.textContent = displayName.toUpperCase();
        const initialEl = document.getElementById('user-initial');
        if(initialEl) initialEl.textContent = displayName.charAt(0).toUpperCase();

        closeModal();
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        const btn = document.getElementById('modal-save-btn');
        if(btn) {
            btn.disabled = false;
            btn.textContent = 'PROFİLİ GÜNCELLE';
        }
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initSession().then(user => {
        if(user) {
            renderSidebar();
            
            // URL'de bir tab belirtilmişse onu aç, yoksa role göre varsayılan
            const urlParams = new URLSearchParams(window.location.search);
            const targetTab = urlParams.get('tab');
            
            if(targetTab) {
                switchTabById(targetTab);
            } else {
                let initialTab = 'dashboard';
                if(user.role === 'warehouse') initialTab = 'orders';
                switchTabById(initialTab);
            }
        }
    });
});

// --- MISSING UI HELPERS ---

window.triggerLogoUpload = () => document.getElementById('logo-file-input').click();

window.handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append('banner', file); // Backend handles 'banner' field for generic uploads

    try {
        showToast('Logo yükleniyor...', 'info');
        const res = await fetch('/api/admin/banners/upload', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData
        });

        if(!res.ok) throw new Error('Yükleme başarısız');
        const data = await res.json();

        const preview = document.getElementById('s-logo-preview');
        const hiddenInput = document.getElementById('s-logoUrl');
        if(preview) preview.src = data.url;
        if(hiddenInput) hiddenInput.value = data.url;
        showToast('Logo yüklendi. Kaydetmeyi unutmayın!', 'success');
    } catch(e) { showToast(e.message, 'error'); }
};

window.openBankModal = function() {
    window.resetModalBtn('HESABI EKLE');
    document.getElementById('modal-title').textContent = 'Yeni Banka Hesabı Ekle';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group"><label>Banka Adı</label><input type="text" id="m-bank-name" placeholder="Örn: Garanti BBVA"></div>
        <div class="form-group"><label>IBAN</label><input type="text" id="m-bank-iban" placeholder="TR00..."></div>
        <div class="form-group"><label>Hesap Sahibi</label><input type="text" id="m-bank-holder" placeholder="Kurum Unvanı"></div>
    `;
    document.getElementById('modal-save-btn').onclick = () => {
        const name = document.getElementById('m-bank-name').value;
        const iban = document.getElementById('m-bank-iban').value;
        const holder = document.getElementById('m-bank-holder').value;
        if(!name || !iban) return showToast('Banka adı ve IBAN zorunludur', 'error');

        if(!window.currentSettingsBanks) window.currentSettingsBanks = [];
        window.currentSettingsBanks.push({ name, iban, holder });
        closeModal();
        renderSettingsUI(window.currentSettingsData); 
        showToast('Hesap listeye eklendi. Kaydet butonuna basarak kalıcı hale getirin.');
    };
    document.getElementById('admin-modal').classList.add('active');
};

window.triggerBannerUpload = (idx) => {
    const input = document.getElementById(`banner-input-${idx}`);
    if(input) input.click();
};

window.handleBannerFileChange = async (event, idx) => {
    const file = event.target.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append('banner', file);

    try {
        showToast('Banner yükleniyor...', 'info');
        const res = await fetch('/api/admin/banners/upload', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData
        });

        if(!res.ok) throw new Error('Yükleme başarısız');
        const data = await res.json();

        const img = document.getElementById(`banner-img-${idx}`);
        const urlInput = document.getElementById(`banner-url-${idx}`);
        const placeholder = document.getElementById(`banner-placeholder-${idx}`);
        
        if(img) {
            img.src = data.url;
            img.style.display = 'block';
        }
        if(placeholder) placeholder.style.display = 'none';
        if(urlInput) urlInput.value = data.url;
        showToast('Banner yüklendi', 'success');
    } catch(e) { showToast(e.message, 'error'); }
};

window.removeBannerItem = function(idx) {
    const grid = document.getElementById('banner-management-grid');
    const items = grid.querySelectorAll('.banner-item');
    if(items[idx]) items[idx].remove();
};

window.syncIncomingInvoices = async function() {
    try {
        showToast('Uyumsoft senkronizasyonu başlatıldı...', 'info');
        const res = await adminApi('POST', '/api/invoices/sync-inbox');
        showToast(`İşlem tamam: ${res.count} yeni fatura çekildi.`, 'success');
        renderInvoicesTab('INVOICE', 'PURCHASE');
    } catch(e) { showToast(e.message, 'error'); }
};

window.bulkImportPurchaseInvoices = async function() {
    const selected = Array.from(document.querySelectorAll('.invoice-checkbox:checked'))
        .filter(i => !i.classList.contains('invoice-checkbox-all'))
        .map(i => i.dataset.id);

    if(selected.length === 0) return showToast('Lütfen stoklara işlenecek faturaları seçin', 'error');

    showConfirm(`${selected.length} adet faturadaki ürünler stoklarınıza işlensin mi?`, async () => {
        try {
            const res = await adminApi('POST', '/api/invoices/bulk-import', { ids: selected });
            showToast(res.message, 'success');
            renderInvoicesTab('INVOICE', 'PURCHASE');
        } catch(e) { showToast(e.message, 'error'); }
    });
};

window.sendSelectedInvoicesToGib = async function() {
    const selected = Array.from(document.querySelectorAll('.invoice-checkbox:checked'))
        .filter(i => !i.classList.contains('invoice-checkbox-all'))
        .map(i => i.dataset.id);

    if(selected.length === 0) return showToast('Lütfen gönderilecek faturaları seçin', 'error');

    showConfirm(`${selected.length} adet fatura GİB'e gönderilsin mi?`, async () => {
        try {
            const res = await adminApi('POST', '/api/invoices/bulk-send', { ids: selected });
            showToast(res.message, 'success');
            renderInvoicesTab('INVOICE', 'SALES');
        } catch(e) { showToast(e.message, 'error'); }
    });
};

window.toggleAllInvoices = function(checked) {
    document.querySelectorAll('.invoice-checkbox').forEach(cb => cb.checked = checked);
};

window.viewInvoiceDetail = async function(id) {
    try {
        const inv = await adminApi('GET', `/api/invoices/${id}`);
        customAlert(`
            <b>Fatura Detayı</b><br>
            No: ${inv.invoiceNo || 'Taslak'}<br>
            Cari: ${inv.companyName}<br>
            Tarih: ${new Date(inv.date).toLocaleDateString('tr-TR')}<br>
            Tutar: ${inv.totalAmount.toLocaleString('tr-TR')} ₺<br><br>
            <button class="btn btn-sm" onclick="window.open('/api/invoices/pdf/${id}', '_blank')">📄 PDF Görüntüle</button>
        `);
    } catch(e) { showToast(e.message, 'error'); }
};

window.editInvoice = async function(uuid) {
    // Current flow: Redirect to invoice edit page or open modal
    // For now, let's just view detail as edit is complex
    window.viewInvoiceDetail(uuid);
};

window.downloadInvoicePdf = function(id) {
    window.open(`/api/invoices/pdf/${id}`, '_blank');
};

window.deleteInvoice = function(uuid) {
    showConfirm('Bu belgeyi silmek istediğinize emin misiniz?', async () => {
        try {
            await adminApi('DELETE', `/api/invoices/${uuid}`);
            showToast('Belge silindi');
            if(window.currentInvoiceTabParams) renderInvoicesTab(window.currentInvoiceTabParams.filterDocType, window.currentInvoiceTabParams.filterType);
        } catch(e) { showToast(e.message, 'error'); }
    });
};

window.sendToIntegrator = async function(id) {
    try {
        showToast('Belge gönderiliyor...', 'info');
        const res = await adminApi('POST', `/api/invoices/send/${id}`);
        showToast('Başarıyla GİB\'e iletildi.', 'success');
        if(window.currentInvoiceTabParams) renderInvoicesTab(window.currentInvoiceTabParams.filterDocType, window.currentInvoiceTabParams.filterType);
    } catch(e) { 
        customAlert(`❌ Gönderim Hatası:\n\n${e.message}`);
    }
};

window.resetColorsToDefault = function() {
    const primary = document.getElementById('s-primaryColor');
    const secondary = document.getElementById('s-secondaryColor');
    const accent = document.getElementById('s-accentColor');
    const brandName = document.getElementById('s-brandName');
    const logoUrl = document.getElementById('s-logoUrl');
    const logoPreview = document.getElementById('s-logo-preview');
    
    if(primary) primary.value = '#00f3ff';
    if(secondary) secondary.value = '#9d4edd';
    if(accent) accent.value = '#ff3366';
    if(brandName) brandName.value = 'STATIO';
    if(logoUrl) logoUrl.value = '/assets/logo.png';
    if(logoPreview) logoPreview.src = '/assets/logo.png';
    
    showToast('Tüm marka ayarları varsayılana çekildi. Uygula butonuna basarak kaydedebilirsiniz.', 'info');
};

window.applyColorsAndRefresh = async function() {
    showToast('Ayarlar uygulanıyor...', 'info');
    try {
        await saveAdminSettings(true); // Silent save
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch(e) { showToast('Kayıt sırasında hata oluştu', 'error'); }
};