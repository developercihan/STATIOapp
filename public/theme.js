/**
 * STATIO White Label Theme Engine
 * Uygulanan her sayfada distribütörün marka ve renk ayarlarını yükler.
 */

function applyTenantTheme(tenant) {
    if (!tenant) return;
    console.log('[Theme] Applying branding:', tenant.brandName, tenant.logoUrl);
    const root = document.documentElement;

    // 1. Renkleri Uygula
    if (tenant.primaryColor) {
        root.style.setProperty('--neon-cyan', tenant.primaryColor);
        root.style.setProperty('--glow-color', tenant.primaryColor + '33'); 
    }
    if (tenant.secondaryColor) root.style.setProperty('--neon-purple', tenant.secondaryColor);
    if (tenant.accentColor) root.style.setProperty('--neon-pink', tenant.accentColor);
    
    // Arka plan parıltılarını da ana renge uyduralım
    if (tenant.primaryColor) {
        root.style.setProperty('--glow-color', tenant.primaryColor + '33'); // %20 opacity
    }

    // 2. Marka İsmini Uygula
    if (tenant.brandName && tenant.brandName.trim() !== '') {
        const newBrand = tenant.brandName.trim();
        
        // Yan menüdeki kayan yazı ve diğer başlıklar
        const brandElements = document.querySelectorAll('.brand-text, .brand, #welcome-brand');
        brandElements.forEach(el => {
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
                // Eğer Statio yazıyorsa veya daha önce değiştirilmişse (fresh check)
                if (el.classList.contains('brand-text')) {
                    el.textContent = newBrand; // Kayan yazıya direkt yaz
                } else if (el.textContent.includes('STATIO')) {
                    el.textContent = el.textContent.replace('STATIO', newBrand);
                }
            }
        });
        
        // Sayfa başlığını (Title) güncelle
        if (document.title.includes('Statio')) {
            document.title = document.title.replace('Statio', newBrand);
        } else if (document.title.includes('STATIO')) {
            document.title = document.title.replace('STATIO', newBrand);
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
