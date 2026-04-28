/**
 * Statio - Shared Utility Functions
 * Bu dosya tüm modüllerde (Admin/Shop/Orders) ortak kullanılan fonksiyonları içerir.
 */

window.formatCurrency = function(val) {
    return (new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)) + ' ₺';
}

window.showToast = function(msg, type='success') {
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
    
    setTimeout(() => { 
        t.style.opacity = '0'; 
        t.style.transform = 'translateX(20px)';
        setTimeout(()=>t.remove(), 300); 
    }, 1500); 
}

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

window.closeModal = function() {
    const m = document.getElementById('admin-modal');
    if(m) m.classList.remove('active');
}

window.resetModalBtn = function(text, className, show) {
    const btn = document.getElementById('modal-save-btn');
    if(!btn) return;
    btn.textContent = text;
    btn.className = className;
    btn.style.display = show ? 'block' : 'none';
}
