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
                    if(data.user && data.user.role === 'warehouse') {
                        window.location.href = '/admin.html'; // Depo personeli doğrudan panele
                    } else {
                        window.location.href = '/index.html'; // Diğerleri sipariş ekranına
                    }
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
