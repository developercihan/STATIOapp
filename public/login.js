document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errDiv = document.getElementById('login-error');
            const submitBtn = form.querySelector('button[type="submit"]');
            
            errDiv.style.display = 'none';
            submitBtn.textContent = 'Bağlanıyor...';
            submitBtn.disabled = true;
            
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await res.json();
                if(res.ok) {
                    if(data.user && data.user.role === 'superadmin') {
                    window.location.href = '/superadmin.html';
                } else if(data.user && (data.user.role === 'admin' || data.user.role === 'warehouse')) {
                    window.location.href = '/admin.html';
                } else if(data.user && data.user.role === 'distributor') {
                    // Eğer B2B kullanıcısı ise Dashboard'a, Plasiyer ise Sipariş Ekranına
                    if (data.user.companyCode) {
                        window.location.href = '/b2b-dashboard.html';
                    } else {
                        window.location.href = '/siparis.html';
                    }
                } else {
                    window.location.href = '/admin.html'; // Default to admin for safety if role is missing but login succeeded
                }
                } else if (data.code === 'SUSPENDED') {
                    // Askıya alınmış mağaza - Şık modal göster
                    showSuspendedModal(data.storeName);
                    submitBtn.textContent = 'Bağlantı Kur';
                    submitBtn.disabled = false;
                } else {
                    errDiv.textContent = data.error || 'Giriş başarısız. Kimlik doğrulanamadı.';
                    errDiv.style.display = 'block';
                    submitBtn.textContent = 'Bağlantı Kur';
                    submitBtn.disabled = false;
                }
            } catch(err) {
                errDiv.textContent = 'Sunucu istasyonuna ulaşılamıyor (Ağ Hatası)';
                errDiv.style.display = 'block';
                submitBtn.textContent = 'Bağlantı Kur';
                submitBtn.disabled = false;
            }
        });
    }
});

function showSuspendedModal(storeName) {
    // Mevcut modal varsa kaldır
    const existing = document.getElementById('suspended-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'suspended-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); z-index:9999;
        display:flex; justify-content:center; align-items:center;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 1px solid rgba(255,165,0,0.3);
            border-radius: 20px; padding: 3rem; max-width: 520px; width:90%;
            text-align: center; position: relative;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,165,0,0.1);
        ">
            <div style="font-size: 4rem; margin-bottom: 1rem;">⏸️</div>
            
            <h2 style="
                color: #ffa500; font-size: 1.5rem; margin-bottom: 0.5rem;
                font-family: 'Inter', sans-serif;
            ">Abonelik Askıda</h2>
            
            <p style="
                color: #8892b0; font-size: 0.95rem; line-height: 1.7;
                margin-bottom: 1.5rem;
            ">
                Sayın <strong style="color:#ccd6f6;">${storeName || 'Değerli Müşterimiz'}</strong> mağaza yetkilisi,
                <br><br>
                Mağazanızın abonelik ödemesi henüz tamamlanmadığı için 
                hesabınız geçici olarak askıya alınmıştır.
            </p>
            
            <div style="
                background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.2);
                border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;
                text-align: left;
            ">
                <p style="color: #64ffda; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">
                    💡 Bilmeniz Gerekenler:
                </p>
                <ul style="color: #8892b0; font-size: 0.85rem; line-height: 1.8; padding-left: 1.2rem;">
                    <li>Tüm verileriniz <strong style="color:#ccd6f6;">güvende</strong> tutulmaktadır.</li>
                    <li>Ödeme yapıldığında <strong style="color:#ccd6f6;">kaldığınız yerden</strong> devam edebilirsiniz.</li>
                    <li>Siparişleriniz, ürünleriniz ve müşteri bilgileriniz korunmaktadır.</li>
                </ul>
            </div>
            
            <p style="color: #8892b0; font-size: 0.85rem; margin-bottom: 2rem;">
                Ödeme yapmak veya detaylı bilgi almak için lütfen sistem yöneticinizle iletişime geçin.
            </p>
            
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <a href="mailto:destek@stationeryos.com" style="
                    padding: 12px 28px; background: linear-gradient(135deg, #ffa500, #ff8c00);
                    color: black; border-radius: 10px; text-decoration: none;
                    font-weight: 700; font-size: 0.9rem;
                    transition: all 0.3s; border: none;
                ">📧 Destek İletişim</a>
                
                <button onclick="document.getElementById('suspended-modal').remove()" style="
                    padding: 12px 28px; background: transparent;
                    border: 1px solid rgba(255,255,255,0.2); color: #8892b0;
                    border-radius: 10px; cursor: pointer; font-size: 0.9rem;
                    transition: all 0.3s;
                ">Kapat</button>
            </div>
        </div>
    `;
    
    // Dışına tıklayınca kapat
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
    
    // Fade-in animasyonu
    if (!document.getElementById('suspended-style')) {
        const style = document.createElement('style');
        style.id = 'suspended-style';
        style.textContent = '@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }';
        document.head.appendChild(style);
    }
}
