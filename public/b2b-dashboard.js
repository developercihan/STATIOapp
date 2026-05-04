let currentUser = null;
let allProducts = [];

async function initDashboard() {
    try {
        const r = await fetch('/api/auth/me');
        if (!r.ok) { window.location.href = '/login.html'; return; }
        const d = await r.json();
        currentUser = d.user;

        // --- WHITE LABEL TEMA UYGULA ---
        if (window.applyTenantTheme) window.applyTenantTheme(currentUser.tenant);

        if (!currentUser.companyCode) {
            // Eğer B2B kullanıcısı değilse sipariş ekranına at
            window.location.href = '/siparis.html';
            return;
        }

        document.getElementById('welcome-text').textContent = `Hoş geldiniz, ${currentUser.displayName}`;
        
        // --- DİNAMİK BANNERLARI YÜKLE ---
        renderBanners(currentUser.tenant.banners);

        await loadDashboardData();
        startSlider();
    } catch(e) {
        window.location.href = '/login.html';
    }
}

async function loadDashboardData() {
    try {
        // Ürünleri ve Kurum bilgilerini paralel çek
        const [prods, comps] = await Promise.all([
            fetch('/api/products').then(res => res.json()),
            fetch('/api/companies').then(res => res.json())
        ]);

        allProducts = prods;
        const myComp = comps.find(c => c.cariKod === currentUser.companyCode);

        if (myComp) {
            document.getElementById('info-discount').textContent = `%${myComp.discountRate || 0}`;
            document.getElementById('info-risk').textContent = formatCurrency(myComp.riskLimit || 0);
            // Bakiye bilgisi için ek bir API gerekebilir ama şimdilik risk limitinden düşelim veya 0 diyelim
            document.getElementById('info-balance').textContent = "0.00 ₺"; 
        }

        renderFeatured(allProducts.slice(0, 4)); // İlk 4 ürünü vitrine koy

    } catch (e) {
        console.error("Dashboard veri hatası:", e);
    }
}

function renderBanners(bannerData) {
    const slider = document.getElementById('hero-slider');
    let banners = [];
    try {
        banners = JSON.parse(bannerData || '[]');
    } catch(e) { banners = []; }

    if (banners.length === 0) {
        // Eğer banner yoksa varsayılan bir tane göster
        slider.innerHTML = `
            <div class="slide active" style="background-image: url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070');">
                <div class="slide-overlay"></div>
                <div class="slide-content">
                    <div class="slide-subtitle">SİSTEME HOŞ GELDİNİZ</div>
                    <div class="slide-title">KOLAY<br>SİPARİŞ</div>
                    <button class="btn btn-primary" onclick="window.location.href='/siparis.html'">HEMEN KEŞFET</button>
                </div>
            </div>
        `;
        return;
    }

    slider.innerHTML = banners.map((b, idx) => `
        <div class="slide ${idx === 0 ? 'active' : ''}" style="background-image: url('${b.image}');">
            <div class="slide-overlay"></div>
            <div class="slide-content">
                <div class="slide-subtitle">${b.subtitle || ''}</div>
                <div class="slide-title">${b.title || 'KAMPANYA'}</div>
                <button class="btn btn-primary" onclick="window.location.href='${b.link || '/siparis.html'}'">İNCELİ</button>
            </div>
        </div>
    `).join('');
}

function renderFeatured(list) {
    const grid = document.getElementById('featured-products');
    grid.innerHTML = '';
    
    list.forEach(p => {
        const div = document.createElement('div');
        div.className = 'glass-card product-card';
        div.style.position = 'relative';
        
        const px = parseFloat(p.priceExclTax) || 0;
        const tax = parseFloat(p.taxRate) || 20;
        const incl = px * (1 + tax/100);

        div.innerHTML = `
            <div class="deal-badge">ÖZEL FİYAT</div>
            <div style="width:100%; height:180px; display:flex; align-items:center; justify-content:center; overflow:hidden; margin-bottom:15px; background:rgba(255,255,255,0.02); border-radius:10px;">
                ${p.image ? `<img src="${p.image}" style="max-width:90%; max-height:90%; object-fit:contain;">` : '🖼️'}
            </div>
            <div style="font-weight:bold; margin-bottom:10px; font-family:'Outfit';">${p.ad}</div>
            <div style="color:var(--neon-green); font-size:1.2rem; font-weight:bold;">${formatCurrency(incl)}</div>
            <button class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="window.location.href='/siparis.html'">İNCELE</button>
        `;
        grid.appendChild(div);
    });
}

// --- SLIDER MANTIĞI ---
function startSlider() {
    const slides = document.querySelectorAll('.slide');
    let current = 0;

    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, 5000); // 5 saniyede bir döner
}

window.formatCurrency = function(val) {
    return (new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)) + ' ₺';
}

async function logout() {
    await fetch('/api/auth/logout');
    window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', initDashboard);
