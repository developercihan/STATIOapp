console.log('KIRTASIYE_OS_APP_V2_LOADED');
let csrfToken = '';
let currentUser = null;
let allProducts = [];
let allCompanies = [];
let cart = [];

async function initSession() {
    try {
        const r = await fetch('/api/auth/me');
        if (!r.ok) { window.location.href = '/login.html'; return null; }
        const d = await r.json();
        csrfToken = d.csrfToken;
        currentUser = d.user;

        if(currentUser.role === 'warehouse') {
            window.location.href = '/admin.html';
            return null;
        }

        // Update Profile Elements
        const initial = document.getElementById('user-initial');
        const name = document.getElementById('user-display-name');
        const role = document.getElementById('user-display-role');
        
        if(initial) initial.textContent = currentUser.displayName.charAt(0).toUpperCase();
        if(name) name.textContent = currentUser.displayName.toUpperCase();
        if(role) role.textContent = currentUser.role.toUpperCase();
        
        const admBtn = document.getElementById('admin-btn');
        if(admBtn && currentUser.role !== 'admin' && currentUser.role !== 'superadmin' && currentUser.role !== 'warehouse') admBtn.style.display = 'none';
        
        // Super Admin için gizli geçiş
        if(currentUser.role === 'superadmin') {
            const profileInfo = document.querySelector('.profile-info');
            if (profileInfo) {
                const sysLink = document.createElement('a');
                sysLink.href = '/superadmin.html';
                sysLink.style.cssText = 'display:block; font-size:0.65rem; color:rgba(255,255,255,0.2); text-decoration:none; margin-top:2px;';
                sysLink.textContent = 'Sistem';
                profileInfo.appendChild(sysLink);
            }
        }
        
        return d.user;
    } catch(e) {
        window.location.href = '/login.html';
        return null;
    }
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

async function api(method, path, body) {
    const opts = { method, headers:{ 'Content-Type':'application/json', 'X-CSRF-Token': csrfToken } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    let data = {};
    try { data = await r.json(); } catch(e) {}
    if (!r.ok) throw new Error(data.error || 'API Hatası');
    return data;
}

function showToast(msg, type='success') {
    const c = document.getElementById('toast-container');
    if(!c) return;
    
    // Limit active toasts to 5
    if (c.children.length >= 5) {
        c.children[0].remove();
    }

    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)';
    t.style.boxShadow = type === 'error' ? '0 0 15px rgba(255,51,102,0.3)' : '0 0 15px rgba(0,243,255,0.3)';
    t.innerHTML = `<b>${type==='error'?'UYARI:':'BİLGİ:'}</b> ${msg}`;
    c.appendChild(t);
    
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

async function logout() {
    await fetch('/api/auth/logout');
    window.location.href = '/login.html';
}

async function loadInitialData() {
    try {
        const [dists, comps, prods] = await Promise.all([
            api('GET', '/api/distributors'),
            api('GET', '/api/companies'),
            api('GET', '/api/products')
        ]);
        
        const distSel = document.getElementById('dist-select');
        distSel.innerHTML = '<option value="">Distribütör Seçin...</option>';
        dists.forEach(d => distSel.innerHTML += `<option value="${d.kod}">${d.ad}</option>`);
        
        const compSel = document.getElementById('comp-select');
        compSel.innerHTML = '<option value="">Kurum Seçin...</option>';
        comps.forEach(c => compSel.innerHTML += `<option value="${c.cariKod}">${c.ad}</option>`);
        
        allCompanies = comps;
        compSel.addEventListener('change', () => renderCart());
        
        allProducts = prods;
        renderProducts(allProducts);
    } catch(e) {
        showToast('Veritabanları senkronize edilemedi', 'error');
    }
}

function renderProducts(list) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    if(list.length === 0) {
        grid.innerHTML = '<p style="text-align:center;width:100%;color:var(--text-secondary);">Ürün matrisinde kayıt bulunamadı.</p>';
        return;
    }
    
    // Performans için max 100 ürün render et
    list.slice(0, 100).forEach(p => {
        const div = document.createElement('div');
        div.className = 'glass-card product-card';
        
        const px = parseFloat(p.priceExclTax) || 0;
        const tax = parseFloat(p.taxRate) || 20;
        const incl = px * (1 + tax/100);
        
        div.innerHTML = `
            <div style="width:100%; height:180px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:15px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid rgba(255,255,255,0.08); cursor:zoom-in;" 
                 onclick="${p.image ? `openLightbox('${p.image}')` : ''}">
                ${p.image ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:contain; padding:10px;">` : '<span style="font-size:0.7em; opacity:0.3;">GÖRSEL YOK</span>'}
            </div>
            <div style="font-family:var(--font-heading); color:var(--text-secondary); font-size:0.8em; margin-bottom:5px;">[${p.kod}]</div>
            <div style="font-weight:bold; margin-bottom:10px; font-size:1.1em; min-height:40px; line-height:1.2;">${p.ad}</div>
            <div style="color:var(--neon-green); font-size:1.1em; font-weight:bold; margin-bottom:5px;">${formatCurrency(incl)} <span style="font-size:0.6em; color:gray;">(KDV Dahil)</span></div>
            <div style="color:var(--text-secondary); font-size:0.8em; margin-bottom:10px;">Hariç: ${formatCurrency(px)} | KDV: %${tax}</div>
            <button class="btn btn-primary" style="margin-top:auto; width:100%; padding:8px;" onclick="addToCart('${p.kod}')">Sepete Ekle</button>
        `;
        grid.appendChild(div);
    });
}

function addToCart(code) {
    const prod = allProducts.find(p => String(p.kod) === String(code));
    if(!prod) return;
    
    const existing = cart.find(c => String(c.code) === String(code));
    if(existing) existing.qty++;
    else {
        cart.push({ 
            code: prod.kod, 
            name: prod.ad, 
            qty: 1, 
            miktar: 1, 
            priceExclTax: parseFloat(prod.priceExclTax) || 0,
            taxRate: parseFloat(prod.taxRate) || 20
        });
    }
    renderCart();
    showToast(`${prod.ad} sepete eklendi.`);
}

function removeFromCart(code) {
    cart = cart.filter(c => String(c.code) !== String(code));
    renderCart();
}

function updateQty(code, qty) {
    const item = cart.find(c => String(c.code) === String(code));
    if(item) {
        item.qty = parseInt(qty);
        if(item.qty <= 0) removeFromCart(code);
        else renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    
    // Get Selected Company to calculate active discount
    const compCode = document.getElementById('comp-select').value;
    const company = allCompanies.find(c => String(c.cariKod) === String(compCode));
    const compDiscount = company ? (parseFloat(company.discountRate) || 0) : 0;
    
    let subTotalExcl = 0;
    let sumTax = 0;
    let grandTotal = 0;

    cart.forEach(item => {
        // Enforce the company discount rate on the item
        item.discountRate = compDiscount;
        item.miktar = item.qty; // ensure sync for backend items logic
        
        const pExcl = item.priceExclTax;
        const q = item.qty;
        const dRate = item.discountRate;
        const tRate = item.taxRate;
        
        const lineExcl = pExcl * q * (1 - (dRate / 100));
        const lineTax = lineExcl * (tRate / 100);
        const lineIncl = lineExcl + lineTax;
        
        subTotalExcl += lineExcl;
        sumTax += lineTax;
        grandTotal += lineIncl;
        
        container.innerHTML += `
            <div class="cart-item glass-card" style="margin-bottom:10px; padding:15px;">
                <div style="flex:1;">
                    <div class="cart-item-title">${item.name}</div>
                    <div style="font-size:0.8em; color:var(--text-secondary); margin-top:5px;">KOD: ${item.code} | Br: ${formatCurrency(pExcl)} | İsk: %${dRate}</div>
                    <div style="font-size:1.1em; color:var(--neon-green); margin-top:5px; font-weight:bold;">${formatCurrency(lineIncl)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="number" value="${item.qty}" min="1" style="width:60px; padding:5px; text-align:center;" onchange="updateQty('${item.code}', this.value)">
                    <button class="btn btn-danger" style="padding:6px 10px;" onclick="removeFromCart('${item.code}')">X</button>
                </div>
            </div>
        `;
    });

    if (cart.length > 0) {
        container.innerHTML += `
            <div class="glass-card" style="margin-top:20px; padding:15px; border-color:var(--neon-purple);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:var(--text-secondary);"><span>Ara Toplam (KDV Hariç):</span> <span>${formatCurrency(subTotalExcl)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:var(--text-secondary);"><span>KDV Toplamı:</span> <span>${formatCurrency(sumTax)}</span></div>
                ${compDiscount > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:5px; color:var(--neon-pink);"><span>Cari İskontosu:</span> <span>%${compDiscount}</span></div>` : ''}
                <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;">
                <div style="display:flex; justify-content:space-between; font-size:1.3em; font-weight:bold; color:var(--neon-green);"><span>Genel Toplam:</span> <span>${formatCurrency(grandTotal)}</span></div>
            </div>
        `;
    }
}

async function submitOrder() {
    if(cart.length === 0) return showToast('Sepet boş!', 'error');
    
    const doc = {
        distributorCode: document.getElementById('dist-select').value,
        companyCode: document.getElementById('comp-select').value,
        orderType: document.getElementById('type-select').value,
        notes: document.getElementById('notes-input').value,
        items: cart
    };
    
    if(!doc.distributorCode) return showToast('Distribütör seçimi zorunlu', 'error');
    if(!doc.companyCode) return showToast('Kurum seçimi zorunlu', 'error');
    
    try {
        const res = await api('POST', '/api/orders', doc);
        showToast(`Sipariş başarıyla iletildi! NO: ${res.orderId}`);
        cart = [];
        renderCart();
        document.getElementById('notes-input').value = '';
    } catch(e) {
        if (e.message.includes('RİSK LİMİTİ AŞILDI')) {
            showRiskModal(e.message);
        } else {
            showToast(e.message, 'error');
        }
    }
}

function showRiskModal(msg) {
    let modal = document.getElementById('risk-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'risk-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content glass-card" style="border-color:var(--neon-red); max-width:500px;">
                <div class="modal-header">
                    <h2 style="color:var(--neon-red); display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.5em;">⚠️</span> RİSK LİMİTİ UYARISI
                    </h2>
                </div>
                <div class="modal-body" id="risk-modal-text" style="white-space:pre-wrap; line-height:1.5; font-size:1.1em; color:var(--text-primary);">
                </div>
                <div class="modal-footer" style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                    <button class="btn" style="width:100%; padding:12px; border-color:var(--neon-red); color:var(--neon-red);" onclick="document.getElementById('risk-modal').classList.remove('active')">ANLADIM, KAPAT</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('risk-modal-text').innerText = msg;
    modal.classList.add('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await initSession();
    if(user) {
        loadInitialData();
        
        document.getElementById('search-input').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = allProducts.filter(p => 
                (p.kod && p.kod.toString().toLowerCase().includes(val)) ||
                (p.ad && p.ad.toString().toLowerCase().includes(val))
            );
            renderProducts(filtered);
        });
    }
});
