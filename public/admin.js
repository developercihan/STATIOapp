
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


// --- GLOBAL API HELPERS ---
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

        document.getElementById('modal-body').innerHTML = AdminTemplates.quickInvoiceModal(docType, settings);

        const renderSelectedCompanies = () => {
            const list = document.getElementById('qi-selected-companies-list');
            list.innerHTML = selectedCompanies.map(c => AdminTemplates.quickCompanyBadge(c)).join('');
        };

        window.removeQuickCompany = (kod) => {
            selectedCompanies = selectedCompanies.filter(x => x.kod !== kod);
            renderSelectedCompanies();
        };

        const renderItems = () => {
            const body = document.getElementById('qi-items-body');
            body.innerHTML = quickItems.map((item, idx) => AdminTemplates.quickInvoiceItemRow(item, idx)).join('');
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
            const discs = document.querySelectorAll('.qi-item-discount');
            const taxRates = document.querySelectorAll('.qi-item-tax');

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
                const totalEl = document.getElementById(`qi-row-total-${idx}`);
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
            if(e.target.classList.contains('qi-item-qty') || e.target.classList.contains('qi-item-price') || e.target.classList.contains('qi-item-discount') || e.target.classList.contains('qi-item-tax')) recalculateQuickInvoice();
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
        document.getElementById('main-content').innerHTML = AdminTemplates.dashboard(stats);

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
        
        document.getElementById('modal-body').innerHTML = AdminTemplates.cashDetailsModal(accountType, filtered);
        openModal();
    } catch(e) { console.error(e); }
}

// Devir Bakiyesi Girişi
window.openInitialBalanceModal = function() {
    window.resetModalBtn('KAYDET', 'btn btn-premium-save', true);
    document.getElementById('modal-title').textContent = 'Açılış Bakiyesi (Devir) Girişi';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('modal-body').innerHTML = AdminTemplates.initialBalanceModal(today);
    
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

        document.getElementById('modal-body').innerHTML = AdminTemplates.invoiceDetailsModal(inv, itemsHtml);
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
        document.getElementById('main-content').innerHTML = AdminTemplates.productsTab(products);
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
    document.getElementById('modal-body').innerHTML = AdminTemplates.productModal(isEdit, {
        kod, ad, priceExclTax, taxRate, stock, image, barcode, unit, category, brand, description, visibility, channel, discountRate
    });
    document.getElementById('modal-save-btn').onclick = () => saveProduct(isEdit);
    const modalContent = document.querySelector('.modal-content');
    if(modalContent) modalContent.style.maxWidth = '900px';
    document.getElementById('admin-modal').classList.add('active');
}

window.previewProductImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('m-image-container').innerHTML = AdminTemplates.productImagePreview(e.target.result);
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.openStockModal = function(code, name, current) {
    window.resetModalBtn('STOK GÜNCELLE');
    document.getElementById('modal-title').textContent = `Stok Yönetimi: ${name}`;
    document.getElementById('modal-body').innerHTML = AdminTemplates.stockModal(current);
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
    const t = parseFloat(document.getElementById('m-taxRate').value) || 0;
    document.getElementById('m-price-incl').value = (px * (1 + t/100)).toFixed(2);
}

window.calcProdExcl = function() {
    const pi = parseFloat(document.getElementById('m-price-incl').value) || 0;
    const t = parseFloat(document.getElementById('m-taxRate').value) || 0;
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

async function renderDistributorsTab() {
    try {
        const dists = await adminApi('GET', '/api/distributors');
        document.getElementById('main-content').innerHTML = AdminTemplates.distributorsTab(dists);
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
    document.getElementById('modal-body').innerHTML = AdminTemplates.distModal(isEdit, generatedKod, ad, phone, email);
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

async function renderCompaniesTab() {
    try {
        const comps = await adminApi('GET', '/api/companies');
        document.getElementById('main-content').innerHTML = AdminTemplates.companiesTab(comps);
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

    document.getElementById('modal-body').innerHTML = AdminTemplates.companyModal(isEdit, {
        id, kod, ad, taxOffice, taxNumber, riskLimit, discountRate, province, district, phone, email, address, b2bUser
    }, salesRepOptions);
    document.getElementById('modal-save-btn').onclick = () => saveComp(isEdit);
    document.getElementById('admin-modal').classList.add('active');
}

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


// --- USER MANAGEMENT ---
async function renderUsersTab() {
    const content = document.getElementById('main-content');
    try {
        const [users, warehouses] = await Promise.all([
            adminApi('GET', '/api/admin/users'),
            adminApi('GET', '/api/warehouses')
        ]);

        const warehouseOptions = warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

        content.innerHTML = AdminTemplates.usersTab(users, warehouseOptions);
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
    document.getElementById('main-content').innerHTML = AdminTemplates.xmlTab();
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
        document.getElementById('main-content').innerHTML = AdminTemplates.ordersTab(orders, warehouses, companies, currentUser);
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

            return AdminTemplates.orderItemRow(i, index, isAdmin, imgSrc, rowTotal, pExcl, tRate, dRate, q);
        }).join('');

        document.getElementById('modal-body').innerHTML = AdminTemplates.orderDetailsModal(order, isAdmin, itemsHtml);
        
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
    document.getElementById('modal-body').innerHTML = AdminTemplates.cargoModal();
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
        document.getElementById('main-content').innerHTML = AdminTemplates.warehousesTab(warehouses);
    } catch(e) { showToast(e.message, 'error'); }
}

window.openWarehouseModal = function(id='', name='', responsible='') {
    window.resetModalBtn();
    const isEdit = !!id;
    document.getElementById('modal-title').textContent = isEdit ? 'Depo Düzenle' : 'Yeni Depo Kaydı';
    document.getElementById('modal-body').innerHTML = AdminTemplates.warehouseModal(isEdit, id, name, responsible);
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
    document.getElementById('main-content').innerHTML = AdminTemplates.backupTab();
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

    main.innerHTML = AdminTemplates.settingsTab(data, email, whatsapp, settings, banners);

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

        document.getElementById('main-content').innerHTML = AdminTemplates.subscriptionTab(sub, daysLeft, statusColor, expiryDate);
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
    msg.innerHTML = message;
    
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
        document.getElementById('modal-body').innerHTML = AdminTemplates.despatchModal(carrier);

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

        document.getElementById('main-content').innerHTML = AdminTemplates.invoicesTab(title, filterType, filterDocType, filtered);
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
        const saveBtn = document.getElementById('modal-save-btn');
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

window.downloadInvoicePdf = function(id) {
    window.open(`/api/invoices/pdf/${id}`, '_blank');
};

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
    body.innerHTML = AdminTemplates.profileModal(currentUser);

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

window.openBankModal = function() {
    window.resetModalBtn('HESABI EKLE');
    document.getElementById('modal-title').textContent = 'Yeni Banka Hesabı Ekle';
    document.getElementById('modal-body').innerHTML = AdminTemplates.bankModal();
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