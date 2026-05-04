/**
 * STATIO White Label Theme Engine
 * Uygulanan her sayfada distribütörün marka ve renk ayarlarını yükler.
 */

function applyTenantTheme(tenant) {
    if (!tenant) return;

    const root = document.documentElement;

    // 1. Renkleri Uygula
    if (tenant.primaryColor) root.style.setProperty('--neon-cyan', tenant.primaryColor);
    if (tenant.secondaryColor) root.style.setProperty('--neon-purple', tenant.secondaryColor);
    if (tenant.accentColor) root.style.setProperty('--neon-pink', tenant.accentColor);
    
    // Arka plan parıltılarını da ana renge uyduralım
    if (tenant.primaryColor) {
        root.style.setProperty('--glow-color', tenant.primaryColor + '33'); // %20 opacity
    }

    // 2. Marka İsmini Uygula
    if (tenant.brandName) {
        // Logolu alanlardaki marka yazılarını bul ve değiştir
        const brandElements = document.querySelectorAll('.brand-text, .brand, #welcome-brand');
        brandElements.forEach(el => {
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
                // Eğer Statio yazıyorsa veya boşsa değiştir
                if (el.textContent.includes('STATIO') || el.textContent === '') {
                    el.textContent = el.textContent.replace('STATIO', tenant.brandName);
                }
            }
        });
        
        // Sayfa başlığını (Title) güncelle
        if (document.title.includes('STATIO')) {
            document.title = document.title.replace('STATIO', tenant.brandName);
        }
    }

    // 3. Logoyu Uygula (Eğer varsa)
    if (tenant.logoUrl) {
        const logoImgs = document.querySelectorAll('.statio-logo, .login-logo-img');
        logoImgs.forEach(img => {
            img.src = tenant.logoUrl;
        });
    }
}

// Global olarak erişilebilir olsun
window.applyTenantTheme = applyTenantTheme;
