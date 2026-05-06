/**
 * StationeryOS Admin Dashboard Templates
 * UI components extracted from admin.js for better modularity.
 */

window.AdminTemplates = {
    integrationsTab: (settings = {}) => {
        const categories = [
            { id: 'marketplace', name: 'Pazaryeri Entegrasyonları', icon: '🏪', description: 'Trendyol, Hepsiburada, Amazon...' },
            { id: 'ecommerce', name: 'E-Ticaret Altyapıları', icon: '💻', description: 'Shopify, Etsy, ikas, Woocommerce...' },
            { id: 'invoicing', name: 'Fatura Entegrasyonları', icon: '🧾', description: 'Uyumsoft, Mysoft, Paraşüt, EDM...' },
            { id: 'cargo', name: 'Kargo Servisleri', icon: '🚚', description: 'Aras, Yurtiçi, MNG, PTT...' },
            { id: 'logistics', name: 'Toplu Kargo Çözümleri', icon: '📦', description: 'Geliver, Kargonomi...' },
            { id: 'payment', name: 'Ödeme Sistemleri', icon: '💳', description: 'iZico, PayTR, iPara...' },
            { id: 'sms', name: 'SMS & Bildirim', icon: '📱', description: 'Netgsm, İleti Merkezi...' }
        ];

        const renderIntegrationCard = (name, logo, status) => {
            const statusMap = {
                'active': { text: 'AKTİF', color: 'var(--neon-green)', bg: 'rgba(57, 255, 20, 0.1)' },
                'pending': { text: 'BEKLEMEDE', color: '#ff9f43', bg: 'rgba(255, 159, 67, 0.1)' },
                'inactive': { text: 'BAĞLANMADI', color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.02)' }
            };
            const s = statusMap[status];
            return `
                <div class="glass-card" style="padding:15px; text-align:center; transition:all 0.3s; border-color:rgba(255,255,255,0.05); position:relative;">
                    <div style="background:white; padding:8px; border-radius:8px; height:45px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        <img src="${logo}" style="max-height:100%; max-width:100%; object-fit:contain;">
                    </div>
                    <div style="font-size:0.75em; font-weight:bold; margin-bottom:10px; color:#fff;">${name}</div>
                    <div style="font-size:0.6em; padding:4px 8px; border-radius:4px; background:${s.bg}; color:${s.color}; border:1px solid ${s.color}22; font-weight:bold; letter-spacing:0.5px;">
                        ${s.text}
                    </div>
                    <button class="btn btn-sm" style="width:100%; margin-top:10px; font-size:0.7em; padding:6px; border-color:rgba(255,255,255,0.1);" onclick="event.stopPropagation(); openMarketplaceModal('${name.toLowerCase().replace(/ /g,'')}','${name}','var(--neon-cyan)')">
                        YÖNET
                    </button>
                </div>
            `;
        };

        return `
            <div class="action-bar">
                <h2 class="brand">🔌 Entegrasyon Merkezi</h2>
                <div style="font-size:0.8em; color:var(--neon-cyan); background:rgba(0,243,255,0.1); padding:5px 12px; border-radius:20px; border:1px solid var(--neon-cyan); font-weight:bold; letter-spacing:1px;">
                    CANLI VERİ AKIŞI AKTİF
                </div>
            </div>

            <!-- Sağlık Kontrolü & Canlı İzleme -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px;">
                <div class="glass-card" style="padding:15px; border-left:4px solid var(--neon-green); background:rgba(57, 255, 20, 0.05);">
                    <div style="font-size:0.7em; opacity:0.6; letter-spacing:1px;">API DURUMU</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <b style="color:var(--neon-green);">TÜMÜ AKTİF</b>
                        <span style="width:10px; height:10px; background:var(--neon-green); border-radius:50%; box-shadow:0 0 10px var(--neon-green); animation: pulse 2s infinite;"></span>
                    </div>
                </div>
                <div class="glass-card" style="padding:15px; border-left:4px solid var(--neon-cyan);">
                    <div style="font-size:0.7em; opacity:0.6; letter-spacing:1px;">SON SENKRONİZASYON</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <b style="color:var(--neon-cyan);">2 Dakika Önce</b>
                        <span style="font-size:1.2em;">🔄</span>
                    </div>
                </div>
                <div class="glass-card" style="padding:15px; border-left:4px solid var(--neon-purple);">
                    <div style="font-size:0.7em; opacity:0.6; letter-spacing:1px;">GÜNLÜK İŞLEM</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <b style="color:var(--neon-purple);">1,248 Veri Paketi</b>
                        <span style="font-size:1.2em;">📊</span>
                    </div>
                </div>
                <div class="glass-card" style="padding:15px; border-left:4px solid #ff9f43;">
                    <div style="font-size:0.7em; opacity:0.6; letter-spacing:1px;">HATA KAYDI</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <b style="color:#ff9f43;">0 Kritik Hata</b>
                        <span style="font-size:1.2em;">🛡️</span>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:25px;" id="integrations-grid">
                ${categories.map(cat => `
                    <div class="glass-card category-card" id="cat-${cat.id}" onclick="window.toggleCategory('${cat.id}')" style="cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position:relative; overflow:hidden;">
                        <div style="display:flex; align-items:center; gap:20px;">
                            <div style="font-size:2.5em; background:rgba(255,255,255,0.05); width:70px; height:70px; display:flex; align-items:center; justify-content:center; border-radius:15px; border:1px solid rgba(255,255,255,0.1);">
                                ${cat.icon}
                            </div>
                            <div style="flex:1;">
                                <h3 style="margin:0; font-size:1.2em; color:var(--neon-cyan); letter-spacing:0.5px;">${cat.name}</h3>
                                <p style="margin:5px 0 0 0; font-size:0.85em; opacity:0.6; line-height:1.4;">${cat.description}</p>
                            </div>
                            <div class="arrow-icon" style="font-size:0.8em; opacity:0.3;">▼</div>
                        </div>
                        
                        <div id="content-${cat.id}" class="category-content" style="display:none; margin-top:25px; padding-top:25px; border-top:1px solid rgba(255,255,255,0.1); animation: slideDown 0.4s ease-out;">
                            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:15px;">
                                ${cat.id === 'marketplace' ? `
                                    ${renderIntegrationCard('Trendyol', '/logos/trendyol.svg', 'active')}
                                    ${renderIntegrationCard('Hepsiburada', '/logos/hepsiburada.svg', 'active')}
                                    ${renderIntegrationCard('Amazon', '/logos/amazon.svg', 'pending')}
                                    ${renderIntegrationCard('Çiçeksepeti', '/logos/ciceksepeti.svg', 'inactive')}
                                ` : ''}
                                ${cat.id === 'ecommerce' ? `
                                    ${renderIntegrationCard('Shopify', '/logos/shopify.svg', 'active')}
                                    ${renderIntegrationCard('Etsy', '/logos/etsy.svg', 'active')}
                                    ${renderIntegrationCard('Woocommerce', '/logos/woocommerce.svg', 'inactive')}
                                    ${renderIntegrationCard('ikas', '/logos/ikas.svg', 'inactive')}
                                ` : ''}
                                ${cat.id === 'invoicing' ? `
                                    ${renderIntegrationCard('Uyumsoft', '/logos/uyumsoft.svg', 'active')}
                                    ${renderIntegrationCard('Mysoft', '/logos/mysoft.svg', 'inactive')}
                                    ${renderIntegrationCard('Paraşüt', '/logos/parasut.svg', 'inactive')}
                                    ${renderIntegrationCard('EDM', '/logos/edm.svg', 'inactive')}
                                ` : ''}
                                ${cat.id === 'cargo' ? `
                                    ${renderIntegrationCard('Aras Kargo', '/logos/aras.svg', 'active')}
                                    ${renderIntegrationCard('Yurtiçi Kargo', '/logos/yurtici.svg', 'inactive')}
                                    ${renderIntegrationCard('MNG Kargo', '/logos/mng.svg', 'inactive')}
                                    ${renderIntegrationCard('PTT Kargo', '/logos/ptt.svg', 'inactive')}
                                ` : ''}
                                ${cat.id === 'logistics' ? `
                                    ${renderIntegrationCard('Geliver', '/logos/geliver.svg', 'inactive')}
                                    ${renderIntegrationCard('Kargonomi', '/logos/kargonomi.svg', 'inactive')}
                                ` : ''}
                                ${cat.id === 'payment' ? `
                                    ${renderIntegrationCard('iZico', '/logos/izico.svg', 'inactive')}
                                    ${renderIntegrationCard('PayTR', '/logos/paytr.svg', 'inactive')}
                                ` : ''}
                                ${cat.id === 'sms' ? `
                                    ${renderIntegrationCard('Netgsm', '/logos/netgsm.svg', 'inactive')}
                                    ${renderIntegrationCard('İleti Merkezi', '/logos/iletimerkezi.svg', 'inactive')}
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <style>
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .category-card:hover {
                    border-color: var(--neon-cyan);
                    box-shadow: 0 0 20px rgba(0, 243, 255, 0.1);
                    transform: translateY(-5px);
                }
                .category-card.active-cat {
                    grid-column: 1 / -1;
                    background: rgba(0, 243, 255, 0.05);
                }
            </style>
            </div>
        `;
    },



    uyumsoftModal: (s) => `
        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
            <div style="background: rgba(0, 95, 184, 0.1); border: 1px solid rgba(0, 95, 184, 0.3); padding: 15px; border-radius: 8px; color: #fff; font-size: 0.9em;">
                <b>ℹ️ Uyumsoft Entegrasyon Bilgileri</b><br>
                Uyumsoft tarafından size iletilen Web Servis kullanıcı bilgilerini giriniz. Eğer bilgileriniz yoksa Uyumsoft destek ekibiyle iletişime geçin.
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label>API Kullanıcı Adı</label>
                    <input type="text" id="int-uyum-user" value="${s.user || ''}" placeholder="Örn: webservis_123">
                </div>
                <div class="form-group">
                    <label>API Şifresi</label>
                    <input type="password" id="int-uyum-pass" value="${s.pass || ''}" placeholder="••••••••">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label>Fatura Seri / Önek</label>
                    <input type="text" id="int-uyum-prefix" value="${s.prefix || 'KRT'}" placeholder="Örn: KRT">
                </div>
                <div class="form-group">
                    <label>Çalışma Modu</label>
                    <select id="int-uyum-mode">
                        <option value="test" ${s.mode === 'test' ? 'selected' : ''}>TEST (Simülasyon)</option>
                        <option value="live" ${s.mode === 'live' ? 'selected' : ''}>CANLI (Gerçek Fatura)</option>
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-top:10px;">
                <label>Vercel / Bulut Senkronizasyonu</label>
                <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                    <input type="checkbox" id="int-uyum-sync" ${s.autoSync !== false ? 'checked' : ''} style="width:20px; height:20px;">
                    <span style="font-size:0.85em; opacity:0.8;">Gelen faturaları her saat başı otomatik kontrol et ve içeri al.</span>
                </div>
            </div>
        </div>
    `,

    marketplaceModal: (mId, mName, color, s) => `
        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;" id="int-modal-container">
            <div id="int-settings-view">
                <div style="background: ${color}22; border: 1px solid ${color}44; padding: 15px; border-radius: 8px; color: #fff; font-size: 0.9em; margin-bottom:15px;">
                    <b>🔌 ${mName} Entegrasyon Ayarları</b><br>
                    Gerçek zamanlı sipariş ve stok senkronizasyonu için lütfen aşağıdaki API anahtarlarını giriniz. Bu bilgiler doğrudan ilgili platformun sunucularıyla güvenli bir şekilde konuşmak için kullanılır.
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>API Key / Kullanıcı</label>
                        <input type="text" id="int-m-key" value="${s.apiKey || ''}" placeholder="API Key giriniz">
                    </div>
                    <div class="form-group">
                        <label>API Secret / Şifre</label>
                        <input type="password" id="int-m-secret" value="${s.apiSecret || ''}" placeholder="••••••••">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>Merchant ID / Satıcı Kodu</label>
                        <input type="text" id="int-m-id" value="${s.merchantId || ''}" placeholder="Mağaza kodunuz">
                    </div>
                    <div class="form-group">
                        <label>Entegrasyon Durumu</label>
                        <select id="int-m-active">
                            <option value="true" ${s.active !== false ? 'selected' : ''}>AKTİF (Canlı)</option>
                            <option value="false" ${s.active === false ? 'selected' : ''}>PASİF (Durduruldu)</option>
                        </select>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin-bottom:10px;">
                    <h4 style="font-size:0.85em; color:var(--neon-cyan); margin-bottom:10px;">⚡ Otomasyon Kuralları</h4>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="int-m-sync-stock" ${s.syncStock !== false ? 'checked' : ''} style="width:18px; height:18px;">
                            <span style="font-size:0.85em;">Stokları anlık olarak ${mName} ile eşitle.</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="int-m-sync-order" ${s.syncOrders !== false ? 'checked' : ''} style="width:18px; height:18px;">
                            <span style="font-size:0.85em;">Gelen siparişleri otomatik olarak sisteme çek.</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn btn-primary" style="flex:1; padding:15px; font-weight:bold; background:${color}; border:none; color:${color === '#f9d908' ? '#000' : '#fff'};" onclick="testMarketplaceConnection('${mId}')" id="btn-test-int">
                        🔍 BAĞLANTIYI DOĞRULA (GERÇEK ZAMANLI)
                    </button>
                </div>
            </div>
        </div>
    `,

    dashboard: (stats) => `
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
    `,
    productsTab: (products) => `
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
                    ${products.map(p => {
                        const pExcl = parseFloat(p.priceExclTax) || 0;
                        const tRate = parseFloat(p.taxRate) || 0;
                        const pIncl = pExcl * (1 + tRate/100);
                        const adSafe = p.ad.replace(/'/g, "\\'");
                        return `
                        <tr>
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
                                    onclick="openProductModal('${p.kod}', '${adSafe}', '${p.priceExclTax || 0}', '${p.taxRate || 20}', ${p.stock || 0}, '${p.image || ''}', '${p.barcode || ''}', '${p.unit || 'Adet'}', '${p.category || ''}', '${p.brand || ''}', '${p.description || ''}', '${p.visibility || 'B2B_ONLY'}', '${p.channel || ''}', '${p.discountRate || 0}')">Düzenle</button>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteProduct('${p.kod}')">Sil</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `,
    productModal: (isEdit, p) => `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Header Section with Image and Basic Info -->
            <div style="display: grid; grid-template-columns: 180px 1fr; gap: 25px; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                <div id="m-image-preview-wrapper" style="width: 180px; height: 180px; border: 2px dashed rgba(0, 243, 255, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; cursor: pointer; transition: all 0.3s ease; background: rgba(0,0,0,0.3);" onclick="document.getElementById('m-image-input').click()">
                    <div id="m-image-container" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<div style="text-align: center; color: var(--neon-cyan); opacity: 0.7;"><span style="font-size: 2.5em; display: block; margin-bottom: 10px;">📸</span><span style="font-size: 0.8em; font-weight: bold;">RESİM SEÇ</span></div>'}
                    </div>
                    <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0, 243, 255, 0.8); color: #000; font-size: 0.7em; font-weight: bold; text-align: center; padding: 5px; transform: translateY(100%); transition: transform 0.3s ease;" class="upload-overlay">DEĞİŞTİR</div>
                </div>
                <input type="file" id="m-image-input" style="display: none;" accept="image/*" onchange="previewProductImage(this)">
                
                <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 15px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="color: var(--neon-cyan); font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Ürün Kodu (SKU)</label>
                        <input type="text" id="m-kod" value="${p.kod}" ${isEdit ? 'disabled' : ''} style="font-family: monospace; font-size: 1.1em; letter-spacing: 1px; border-color: rgba(157, 78, 221, 0.3);">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="color: var(--neon-cyan); font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Ürün Adı</label>
                        <input type="text" id="m-ad" value="${p.ad}" style="font-size: 1.1em; border-color: rgba(157, 78, 221, 0.3);">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="color: var(--neon-cyan); font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Barkod</label>
                        <input type="text" id="m-barcode" value="${p.barcode}" placeholder="Barkod okutun veya yazın..." style="border-color: rgba(157, 78, 221, 0.3);">
                    </div>
                </div>
            </div>

            <!-- Detailed Info Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="form-group">
                    <label>Birim</label>
                    <select id="m-unit">
                        <option value="Adet" ${p.unit === 'Adet' ? 'selected' : ''}>Adet</option>
                        <option value="Paket" ${p.unit === 'Paket' ? 'selected' : ''}>Paket</option>
                        <option value="Koli" ${p.unit === 'Koli' ? 'selected' : ''}>Koli</option>
                        <option value="KG" ${p.unit === 'KG' ? 'selected' : ''}>Kilogram</option>
                        <option value="Metre" ${p.unit === 'Metre' ? 'selected' : ''}>Metre</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Mevcut Stok</label>
                    <input type="number" id="m-stock" value="${p.stock}" style="color: var(--neon-green); font-weight: bold; font-size: 1.1em;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="form-group"><label>Kategori</label><input type="text" id="m-category" value="${p.category}" placeholder="Örn: Kağıt Ürünleri"></div>
                <div class="form-group"><label>Marka</label><input type="text" id="m-brand" value="${p.brand}" placeholder="Örn: Statio"></div>
            </div>

            <!-- Pricing Section -->
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 12px; border: 1px solid rgba(157, 78, 221, 0.1);">
                <h4 style="color: var(--neon-purple); margin-bottom: 15px; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px;">💰 Fiyatlandırma</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <div class="form-group" style="margin-bottom: 0;"><label>Fiyat (Hariç)</label><input type="number" id="m-price" value="${p.priceExclTax}" oninput="calcProdIncl()"></div>
                    <div class="form-group" style="margin-bottom: 0;"><label>KDV (%)</label><input type="number" id="m-taxRate" value="${p.taxRate}" oninput="calcProdIncl()"></div>
                    <div class="form-group" style="margin-bottom: 0;"><label>İskonto (%)</label><input type="number" id="m-discountRate" value="${p.discountRate}"></div>
                </div>
                <div class="form-group" style="margin-top: 15px; margin-bottom: 0;">
                    <label style="color: var(--neon-green);">Birim Fiyat (KDV Dahil)</label>
                    <input type="number" id="m-price-incl" value="${(p.priceExclTax * (1 + p.taxRate/100)).toFixed(2)}" oninput="calcProdExcl()" style="background: rgba(0, 243, 255, 0.05); color: var(--neon-green); font-weight: bold; font-size: 1.2em; border-color: var(--neon-green);">
                </div>
            </div>

            <!-- Visibility and Channels -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="form-group">
                    <label>Görünürlük</label>
                    <select id="m-visibility">
                        <option value="B2B_ONLY" ${p.visibility === 'B2B_ONLY' ? 'selected' : ''}>Sadece B2B (Müşterilere)</option>
                        <option value="PUBLIC" ${p.visibility === 'PUBLIC' ? 'selected' : ''}>Herkese Açık (Web Store)</option>
                        <option value="HIDDEN" ${p.visibility === 'HIDDEN' ? 'selected' : ''}>Gizli</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Satış Kanalı</label>
                    <select id="m-channel">
                        <option value="b2b" ${p.channel === 'b2b' ? 'selected' : ''}>B2B Portalı</option>
                        <option value="web" ${p.channel === 'web' ? 'selected' : ''}>Web Mağazası</option>
                        <option value="all" ${p.channel === 'all' ? 'selected' : ''}>Tüm Kanallar</option>
                    </select>
                </div>
            </div>

            <div class="form-group full-width" style="margin-bottom: 0;">
                <label>Ürün Açıklaması</label>
                <textarea id="m-description" rows="3" style="resize: vertical; min-height: 80px;">${p.description}</textarea>
            </div>
            
            <input type="hidden" id="m-image" value="${p.image}">
        </div>
    `,
    distributorsTab: (dists) => `
        <div class="action-bar">
            <h2 class="brand">Distribütörler</h2>
            <button class="btn btn-primary" onclick="openDistModal()">+ Yeni Distribütör</button>
        </div>
        <div class="glass-card">
            <table class="data-table">
                <thead><tr><th>KOD</th><th>AD</th><th>İŞLEMLER</th></tr></thead>
                <tbody>
                    ${dists.map(d => `
                        <tr>
                            <td style="color:var(--neon-cyan);">${d.kod}</td>
                            <td>${d.ad}</td>
                            <td>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openDistModal('${d.kod}', '${(d.ad || '').replace(/'/g, "\\")}', '${d.phone || ''}', '${d.email || ''}')">Düzenle</button>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteDist('${d.kod}')">Sil</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `,
    distModal: (isEdit, generatedKod, ad, phone, email) => `
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
    `,
    companiesTab: (comps) => `
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
                    ${comps.map(c => {
                        const adSafe = (c.ad || '').replace(/'/g, "\\'");
                        return `
                        <tr>
                            <td style="color:var(--neon-cyan);">${c.cariKod}</td>
                            <td>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" 
                                    onclick="openCompModal('${c.cariKod}', '${adSafe}', '${(c.taxOffice || '').replace(/'/g, "\\'")}', '${(c.taxNumber || '').replace(/'/g, "\\'")}', '${(c.address || '').replace(/'/g, "\\'").replace(/\n/g, "\\n")}', '${(c.province || '').replace(/'/g, "\\'")}', '${(c.district || '').replace(/'/g, "\\'")}', '${c.b2bUser || ''}', '${c.priceList || 'LIST1'}', '${c.discountRate || 0}', '${c.isBlocked || false}')">Düzenle</button>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteCompany('${c.cariKod}')">Sil</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `,
    ordersTab: (orders, warehouses, companies, currentUser) => {
        const statusMap = {
            'YENI': { text: 'YENİ', color: 'var(--neon-purple)', icon: '✨' },
            'ATANDI': { text: 'ATANDI', color: 'var(--neon-blue)', icon: '📍' },
            'HAZIRLANIYOR': { text: 'HAZIRLANIYOR', color: '#ff9f43', icon: '📦' },
            'KARGODA': { text: 'KARGODA', color: 'var(--neon-cyan)', icon: '🚚' },
            'TESLIM_EDILDI': { text: 'TESLİM EDİLDİ', color: 'var(--neon-green)', icon: '✅' },
            'INVOICED': { text: 'FATURALANDI', color: '#00d2d3', icon: '🧾' },
            'CANCELLED': { text: 'İPTAL EDİLDİ', color: 'var(--neon-red)', icon: '✕' }
        };

        const getSourceBadge = (source = 'B2B', notes = '') => {
            const sources = {
                'shopify': { icon: '/logos/shopify.svg', color: '#95bf47', name: 'Shopify' },
                'etsy': { icon: '/logos/etsy.svg', color: '#f45800', name: 'Etsy' },
                'trendyol': { icon: '/logos/trendyol.svg', color: '#f27a1a', name: 'Trendyol' },
                'hepsiburada': { icon: '/logos/hepsiburada.svg', color: '#ff6000', name: 'Hepsiburada' },
                'ikas': { icon: '/logos/ikas.svg', color: '#ff6600', name: 'ikas' },
                'B2B': { icon: '👤', color: 'var(--neon-purple)', name: 'B2B Portal' }
            };

            let key = (source || 'B2B').toLowerCase();
            
            // Fallback: Eğer source B2B ise ama notlarda özel bir kelime geçiyorsa onu kullan
            if (key === 'b2b' && notes) {
                const n = notes.toLowerCase();
                if (n.includes('shopify')) key = 'shopify';
                else if (n.includes('etsy')) key = 'etsy';
                else if (n.includes('trendyol')) key = 'trendyol';
                else if (n.includes('hepsiburada')) key = 'hepsiburada';
                else if (n.includes('ikas')) key = 'ikas';
            }

            const s = sources[key] || sources['B2B'];
            if(s.icon && s.icon.startsWith('/')) {
                return `<div title="${s.name}" style="display:flex; align-items:center; justify-content:center; background:white; padding:4px; border-radius:4px; width:28px; height:28px; border:1px solid ${s.color}44; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                            <img src="${s.icon}" style="width:100%; height:100%; object-fit:contain;">
                        </div>`;
            }
            return `<span title="${s.name}" style="font-size:1.4em;">${s.icon}</span>`;
        };

        return `
            <div class="action-bar">
                <h2 class="brand">🚀 Operasyon Paneli</h2>
                <div style="display:flex; gap:10px;">
                    <button id="bulk-delete-btn" class="btn" style="border-color:var(--neon-red); color:var(--neon-red); display:none;" onclick="deleteSelectedOrders()">🗑️ Seçilenleri Sil</button>
                    <button class="btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="window.location.href='/api/admin/export/orders'">📊 Excel (.xlsx)</button>
                </div>
            </div>
            
            <div class="glass-card" style="margin-bottom:25px; padding:20px; display:flex; gap:20px; align-items:flex-end; flex-wrap:wrap; border-color:rgba(0, 243, 255, 0.1);">
                <div class="form-group" style="margin-bottom:0; width:180px;">
                    <label style="font-size:0.75em; opacity:0.6; letter-spacing:1px;">DURUM FİLTRESİ</label>
                    <select id="filter-status" onchange="filterOrders()" style="height:45px; background:rgba(0,0,0,0.4);">
                        <option value="">Tümü</option>
                        ${Object.keys(statusMap).map(k => `<option value="${k}">${statusMap[k].text}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:0; flex:1; min-width:250px;">
                    <label style="font-size:0.75em; opacity:0.6; letter-spacing:1px;">MÜŞTERİ / SİPARİŞ ARA</label>
                    <input type="text" id="order-search" placeholder="İsim, Sipariş No veya Kurum..." oninput="filterOrders()" style="height:45px; background:rgba(0,0,0,0.4);">
                </div>
            </div>

            <div class="glass-card" style="padding:0; overflow:hidden; border-color:rgba(255,255,255,0.05);">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px; text-align:center;"><input type="checkbox" onchange="toggleAllOrders(this.checked)" style="width:18px; height:18px;"></th>
                            <th style="width:80px; text-align:center;">KANAL</th>
                            <th style="width:120px;">SİPARİŞ NO</th>
                            <th>MÜŞTERİ / KURUM</th>
                            <th style="width:140px;">TUTAR</th>
                            <th style="width:160px;">DURUM</th>
                            <th style="width:130px;">İŞLEMLER</th>
                        </tr>
                    </thead>
                    <tbody id="orders-tbody">
                        ${orders.map(o => {
                            const s = statusMap[o.status] || { text: o.status, color: '#fff', icon: '' };
                            return `
                            <tr class="order-row" data-status="${o.status}" data-search="${o.id} ${o.companyCode} ${o.company?.ad || ''}">
                                <td style="text-align:center;"><input type="checkbox" class="order-checkbox" value="${o.id}" onchange="updateBulkBtnVisibility()" style="width:18px; height:18px;"></td>
                                <td style="text-align:center;">${getSourceBadge(o.source, o.notes)}</td>
                                <td style="font-family:monospace; color:var(--neon-cyan); font-weight:bold;">#${o.id.toString().padStart(5, '0')}</td>
                                <td>
                                    <div style="font-weight:bold; font-size:1.1em;">${o.company?.ad || o.companyCode}</div>
                                    <div style="font-size:0.75em; opacity:0.5; margin-top:4px;">📅 ${new Date(o.createdAt).toLocaleString('tr-TR')}</div>
                                </td>
                                <td style="font-weight:bold; color:var(--neon-green); font-size:1.1em;">${formatCurrency(o.totalAmount)}</td>
                                <td>
                                    <span class="badge" style="background:${s.color}22; color:${s.color}; border:1px solid ${s.color}44; padding:8px 12px; border-radius:8px; font-size:0.8em; display:inline-flex; align-items:center; gap:8px; font-weight:bold;">
                                        <span>${s.icon}</span> ${s.text}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-primary" style="width:100%; padding:10px; font-weight:bold; font-size:0.8em; border:none; box-shadow:0 0 10px rgba(0,243,255,0.2);" onclick="viewOrderDetails('${o.id}')">👁️ YÖNET</button>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },
    companyModal: (isEdit, p, salesRepOptions) => {
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

        return accordionStyle + `
            <div style="max-height:75vh; overflow-y:auto; padding-right:5px;">
                <input type="hidden" id="m-comp-id" value="${p.id}">
                
                <!-- BÖLÜM 1: GENEL BİLGİLER -->
                <div class="acc-item">
                    <div class="acc-header active" onclick="toggleAccordion(this)">
                        <span style="font-weight:bold; letter-spacing:1px; color:var(--neon-cyan);">📁 01. GENEL BİLGİLER</span>
                        <span class="acc-icon">▼</span>
                    </div>
                    <div class="acc-content active">
                        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px;">
                            <div class="form-group"><label>Cari Kod *</label><input type="text" id="m-kod" value="${p.kod}" ${isEdit ? 'disabled' : ''} required></div>
                            <div class="form-group"><label>Kurum Adı (Ticari Unvan) *</label><input type="text" id="m-ad" value="${p.ad}" required></div>
                            <div class="form-group"><label>Vergi Dairesi *</label><input type="text" id="m-taxOffice" value="${p.taxOffice}" required></div>
                            <div class="form-group"><label>Vergi Numarası *</label><input type="text" id="m-taxNumber" value="${p.taxNumber}" required></div>
                            <div class="form-group"><label>Risk Limiti (TL)</label><input type="number" id="m-riskLimit" value="${p.riskLimit}" min="0"></div>
                            <div class="form-group"><label>Sabit İskonto (%)</label><input type="number" id="m-discountRate" value="${p.discountRate}" min="0" max="100" step="0.1"></div>
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
                            <div class="form-group"><label>İl (Şehir) *</label><input type="text" id="m-province" value="${p.province}" required></div>
                            <div class="form-group"><label>İlçe *</label><input type="text" id="m-district" value="${p.district}" required></div>
                            <div class="form-group"><label>Telefon *</label><input type="text" id="m-phone" value="${p.phone}" required></div>
                            <div class="form-group"><label>E-Posta *</label><input type="email" id="m-email" value="${p.email}" required></div>
                            <div class="form-group" style="grid-column: span 2;"><label>Tam Adres (Kaşe Bilgisi) *</label><textarea id="m-address" required style="width:100%; height:60px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid var(--glass-border); border-radius:8px; padding:10px;">${p.address}</textarea></div>
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
                            <div class="form-group"><label>Kullanıcı Adı</label><input type="text" id="m-b2b-user" value="${p.b2bUser}"></div>
                            <div class="form-group"><label>Şifre</label><input type="password" id="m-b2b-pass" placeholder="${isEdit ? 'Değişmeyecekse boş bırakın' : 'Yeni şifre...'}"></div>
                        </div>
                    </div>
                </div>

                <!-- BÖLÜM 4: ÖZEL KAMPANYALAR -->
                ${isEdit ? `
                <div class="acc-item">
                    <div class="acc-header" onclick="toggleAccordion(this); loadSpecialDeals('${p.id}')">
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
                            <button class="btn btn-primary" style="grid-column:span 2; margin-top:10px;" onclick="addSpecialDeal('${p.id}')">KAMPANYAYI TANIMLA</button>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },
    orderItemRow: (item, index, isAdmin, imgSrc, rowTotal, pExcl, tRate, dRate, q) => `
        <div class="glass-card" style="margin-bottom:15px; padding:15px; border-color:rgba(255,255,255,0.1);">
            <div style="display:flex; gap:15px; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
                ${imgSrc ? `<img src="${imgSrc}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">` : `<div style="width:60px; height:60px; background:rgba(255,255,255,0.05); border-radius:8px;"></div>`}
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#fff; font-size:1.1em;">${item.name}</div>
                    <div style="color:var(--neon-cyan); font-size:0.9em;">${item.code}</div>
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
    `,

    orderDetailsModal: (order, isAdmin, itemsHtml) => {

        const sourceBadge = (source = 'B2B', notes = '') => {
            const sources = {
                'shopify': { icon: '/logos/shopify.svg', name: 'Shopify', color: '#95bf47' },
                'etsy': { icon: '/logos/etsy.svg', name: 'Etsy', color: '#f45800' },
                'trendyol': { icon: '/logos/trendyol.svg', name: 'Trendyol', color: '#f27a1a' },
                'hepsiburada': { icon: '/logos/hepsiburada.svg', name: 'Hepsiburada', color: '#ff6000' },
                'ikas': { icon: '/logos/ikas.svg', name: 'ikas', color: '#ff6600' },
                'B2B': { icon: '👤', name: 'B2B Portal', color: 'var(--neon-purple)' }
            };

            let key = (source || 'B2B').toLowerCase();
            if (key === 'b2b' && notes) {
                const n = notes.toLowerCase();
                if (n.includes('shopify')) key = 'shopify';
                else if (n.includes('etsy')) key = 'etsy';
                else if (n.includes('trendyol')) key = 'trendyol';
                else if (n.includes('hepsiburada')) key = 'hepsiburada';
                else if (n.includes('ikas')) key = 'ikas';
            }

            const s = sources[key] || sources['B2B'];
            return `<div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:30px; border:1px solid ${s.color}44;">
                        ${s.icon.startsWith('/') ? `<img src="${s.icon}" style="width:16px; height:16px; object-fit:contain;">` : `<span>${s.icon}</span>`}
                        <span style="font-size:0.75em; font-weight:bold; letter-spacing:1px; color:${s.color}">${s.name.toUpperCase()}</span>
                    </div>`;
        };

        return `
            <div style="display:grid; grid-template-columns: 1fr 320px; gap:25px;" id="order-operations-container">
                <!-- Sol Kolon: Sipariş İçeriği -->
                <div style="display:flex; flex-direction:column; gap:20px;">
                    <div class="glass-card" style="padding:20px; border-color:rgba(255,255,255,0.1); background:rgba(0,0,0,0.2);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                            <h3 style="margin:0; font-size:1.1em; color:var(--neon-cyan);">📦 SİPARİŞ KALEMLERİ</h3>
                            ${sourceBadge(order.source, order.notes)}
                        </div>
                        <div style="max-height:500px; overflow-y:auto; padding-right:10px;">
                            ${itemsHtml}
                        </div>
                    </div>

                    <div class="glass-card" style="padding:20px; border-color:var(--neon-purple);">
                        <h3 style="margin:0 0 15px 0; font-size:0.9em; color:var(--neon-purple);">📝 SİPARİŞ NOTLARI</h3>
                        <textarea id="edit-order-notes" rows="3" style="width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px; border-radius:10px; font-size:0.95em;" ${isAdmin ? '' : 'disabled'} placeholder="Operasyonel notlar...">${order.notes || ''}</textarea>
                    </div>
                </div>

                <!-- Sağ Kolon: Operasyon Merkezi -->
                <div style="display:flex; flex-direction:column; gap:20px;">
                    <!-- Finansal Özet -->
                    <div class="glass-card" style="padding:20px; background:linear-gradient(135deg, rgba(57, 255, 20, 0.05), transparent); border-color:rgba(57, 255, 20, 0.2);">
                        <div style="font-size:0.8em; opacity:0.6; margin-bottom:5px;">TOPLAM TUTAR</div>
                        <div style="font-size:1.8em; font-weight:bold; color:var(--neon-green); letter-spacing:1px;">${formatCurrency(order.finalAmount || 0)}</div>
                        <div style="font-size:0.7em; opacity:0.4; margin-top:5px;">KDV DAHİL GENEL TOPLAM</div>
                        
                        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.05); margin:15px 0;">
                        
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.7em; opacity:0.6;">SİPARİŞ DURUMU</label>
                            <select id="edit-order-status" style="width:100%; height:45px; background:rgba(0,0,0,0.6); color:var(--neon-cyan); border-color:var(--neon-cyan); margin-top:5px;" onchange="toggleCargoInputs(this.value)">
                                <option value="YENI" ${order.status==='YENI'?'selected':''}>✨ YENİ</option>
                                <option value="HAZIRLANIYOR" ${order.status==='HAZIRLANIYOR'?'selected':''}>📦 HAZIRLANIYOR</option>
                                <option value="KARGODA" ${order.status==='KARGODA'?'selected':''}>🚚 KARGODA</option>
                                <option value="TESLIM_EDILDI" ${order.status==='TESLIM_EDILDI'?'selected':''}>✅ TESLİM EDİLDİ</option>
                                <option value="CANCELLED" ${order.status==='CANCELLED'?'selected':''}>✕ İPTAL EDİLDİ</option>
                            </select>
                        </div>
                    </div>

                    <!-- Lojistik Motoru -->
                    <div class="glass-card" style="padding:20px; border-color:var(--neon-cyan);">
                        <h4 style="margin:0 0 15px 0; font-size:0.85em; color:var(--neon-cyan); letter-spacing:1px;">🚚 LOJİSTİK MOTORU</h4>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <button class="btn btn-primary" style="width:100%; padding:12px; font-size:0.8em; font-weight:bold; border:none;" onclick="generateIntegratedCargoLabel('${order.id}')">
                                📑 ENTEGRASYON İLE GÖNDER
                            </button>
                            <div style="font-size:0.65em; opacity:0.5; text-align:center;">Aras, Yurtiçi veya Geliver üzerinden barkod oluşturur.</div>
                            
                            <div id="manual-cargo-fields" style="border-top:1px solid rgba(255,255,255,0.05); padding-top:12px; margin-top:5px;">
                                <label style="font-size:0.7em; opacity:0.6; display:block; margin-bottom:5px;">MANUEL TAKİP NO</label>
                                <input type="text" id="m-cargo-code" value="${order.cargoDetail?.trackingCode || ''}" placeholder="Takip no..." style="height:35px; font-size:0.85em; background:rgba(0,0,0,0.3);">
                            </div>
                        </div>
                    </div>

                    <!-- Finans & Fatura -->
                    <div class="glass-card" style="padding:20px; border-color:var(--neon-purple);">
                        <h4 style="margin:0 0 15px 0; font-size:0.85em; color:var(--neon-purple); letter-spacing:1px;">🧾 FİNANS & FATURA</h4>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <button class="btn" style="width:100%; padding:12px; font-size:0.8em; font-weight:bold; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="generateIntegratedInvoice('${order.id}')">
                                🚀 e-FATURA OLUŞTUR (GİB)
                            </button>
                            <div style="font-size:0.65em; opacity:0.5; text-align:center;">Uyumsoft veya Paraşüt üzerinden faturayı keser.</div>
                            
                            <div style="background:rgba(157, 78, 221, 0.1); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.75em;">Durum:</span>
                                <b style="font-size:0.75em; color:var(--neon-purple);">${order.status === 'INVOICED' ? 'FATURALANDI' : 'TASLAK'}</b>
                            </div>
                        </div>
                </div>
            </div>
        `;
    },
    cargoBarcodePreview: (order, trackingCode, company) => `
        <div id="barcode-thermal-print" style="width:380px; background:white; color:black; padding:20px; border:2px solid #000; font-family:'Courier New', Courier, monospace; margin:0 auto; box-shadow:0 0 20px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:start; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px;">
                <div style="font-weight:bold; font-size:1.2em;">${company.toUpperCase()}</div>
                <div style="text-align:right; font-size:0.7em;">${new Date().toLocaleDateString('tr-TR')}</div>
            </div>
            
            <div style="text-align:center; padding:10px 0;">
                <div style="font-size:0.8em; margin-bottom:5px;">TAKİP NUMARASI</div>
                <div style="font-size:1.4em; font-weight:bold; letter-spacing:2px;">${trackingCode}</div>
                <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${trackingCode}&scale=2&rotate=N&includetext=false" style="width:100%; height:80px; margin-top:10px; object-fit:contain;">
            </div>

            <div style="border-top:1px solid #000; border-bottom:1px solid #000; padding:10px 0; margin:10px 0; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div style="font-size:0.7em;">
                    <div style="font-weight:bold; text-decoration:underline; margin-bottom:3px;">GÖNDERİCİ:</div>
                    <b>STATIO HUB</b><br>
                    StationeryOS Lojistik Merkezi<br>
                    İstanbul / TR
                </div>
                <div style="font-size:0.7em;">
                    <div style="font-weight:bold; text-decoration:underline; margin-bottom:3px;">ALICI:</div>
                    <b>${order.company?.ad || 'MÜŞTERİ'}</b><br>
                    ${order.company?.adres || 'Adres bilgisi çekiliyor...'}<br>
                    Tel: ${order.company?.tel || '-'}
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.7em;">Sipariş: #${order.id.toString().padStart(5, '0')}</div>
                <div style="background:black; color:white; padding:5px 10px; font-weight:bold; font-size:1.2em;">${order.source?.toUpperCase() || 'B2B'}</div>
            </div>
            
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary" style="flex:1; background:#000; color:#fff; border:none; padding:10px;" onclick="window.printBarcode()">🖨️ YAZICIYA GÖNDER</button>
                <button class="btn" style="flex:1; border:1px solid #000; color:#000; padding:10px;" onclick="closeModal()">✕ KAPAT</button>
            </div>
        </div>
    `,
    cargoModal: () => `
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
    `,
    warehousesTab: (warehouses) => `
        <div class="action-bar">
            <h2 class="brand">Depo Yönetimi</h2>
            <button class="btn btn-primary" onclick="openWarehouseModal()">+ Yeni Depo Ekle</button>
        </div>
        <div class="glass-card">
            <table class="data-table">
                <thead><tr><th>ID</th><th>DEPO ADI</th><th>SORUMLU</th><th>DURUM</th><th>İŞLEMLER</th></tr></thead>
                <tbody>
                    ${warehouses.map(w => `
                        <tr>
                            <td style="color:var(--neon-cyan); font-size:0.8em;">${w.id}</td>
                            <td><b>${w.name}</b></td>
                            <td>${w.responsible || '-'}</td>
                            <td><span class="badge ${w.isActive ? 'badge-success' : 'badge-danger'}">${w.isActive ? 'AKTİF' : 'PASİF'}</span></td>
                            <td>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openWarehouseModal('${w.id}', '${(w.name || "").replace(/'/g, "\\")}', '${(w.responsible || "").replace(/'/g, "\\")}')">Düzenle</button>
                                <button class="btn" style="padding:5px 10px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteWarehouse('${w.id}')">Sil</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `,
    warehouseModal: (isEdit, id, name, responsible) => `
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
    `,
    backupTab: () => `
        <div class="glass-card" style="text-align:center;">
            <h2 class="brand">Sistem Yedekleme</h2>
            <p>Tüm JSON ve XML veritabanlarının anlık yedeğini alın.</p>
            <button class="btn btn-primary" style="margin-top:20px; padding:15px 30px;" onclick="takeBackup()">Yedek Oluştur</button>
        </div>
    `,
    invoicesTab: (title, filterType, filterDocType, filtered) => `
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
                    ${filtered.length === 0 ? `
                        <tr><td colspan="8" style="text-align:center; padding:50px; opacity:0.5;">
                            <div style="font-size:3em; margin-bottom:10px;">📂</div>
                            Henüz seçili türde bir belge bulunamadı.
                        </td></tr>
                    ` : filtered.map(inv => AdminTemplates.invoiceRow(inv)).join('')}
                </tbody>
            </table>
        </div>
    `,
    invoiceRow: (inv) => {
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
            typeColor = '#ff9f43'; 
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
        
        return `
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
    },
    usersTab: (users, warehouseOptions) => `
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
                    ${users.map(u => {
                        const roleMap = {
                            'admin': 'YÖNETİCİ',
                            'superadmin': 'SİSTEM YÖN.',
                            'warehouse': 'DEPO PERSONELİ',
                            'distributor': 'SATIŞ TEMSİLCİSİ'
                        };
                        const roleLabel = roleMap[u.role] || u.role.toUpperCase();
                        return `
                            <tr>
                                <td>${u.username}</td>
                                <td>${u.displayName}</td>
                                <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-warning'}">${roleLabel}</span></td>
                                <td>${u.isActive ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Pasif</span>'}</td>
                                <td>
                                    <button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="toggleUser('${u.id}')">Durum</button>
                                    ${u.role !== 'admin' ? `<button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteUser('${u.id}')">Sil</button>` : ''}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `,
    xmlTab: () => `
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
                <div style="border: 1px dashed var(--neon-green); padding:20px; text-align:center; border-radius:8px;">
                    <h4>Müşteriler XML</h4>
                    <input type="file" id="comp-xml" style="margin:10px 0; width:100%;">
                    <button class="btn btn-primary" onclick="uploadXml('comp-xml', '/api/admin/upload-companies-xml')">Yükle</button>
                </div>
            </div>
        </div>
    `,
    settingsTab: (data, email, whatsapp, settings, banners) => `
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
                            <label>Resmi Kurum Adı</label>
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
    `,
    subscriptionTab: (sub, daysLeft, statusColor, expiryDate) => `
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
    `,
    despatchModal: (carrier) => `
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
    `,
    cashDetailsModal: (accountType, filtered) => `
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
    `,
    initialBalanceModal: (today) => `
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
            <input type="date" id="devir-date" class="form-control" value="${today}">
        </div>
        <div class="form-group full-width">
            <label>Mevcut Bakıye (₺)</label>
            <input type="number" id="devir-amount" class="form-control" placeholder="Örn: 200000">
        </div>
        <div class="form-group full-width">
            <label>Açıklama</label>
            <input type="text" id="devir-notes" class="form-control" value="Sistem Açılış Bakiyesi">
        </div>
    `,
    quickInvoiceModal: (docType, settings) => `
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
    `,
    quickCompanyBadge: (c) => `
        <div style="background:rgba(0,243,255,0.1); padding:5px 15px; border-radius:20px; border:1px solid var(--neon-cyan); display:flex; align-items:center; gap:8px; font-size:0.9em; color:var(--neon-cyan);">
            <span>✅ ${c.ad} (${c.kod})</span>
            <button onclick="removeQuickCompany('${c.kod}')" style="background:none; border:none; color:var(--neon-red); cursor:pointer; font-weight:bold;">✕</button>
        </div>
    `,
    quickInvoiceItemRow: (item, idx) => `
        <tr style="background: rgba(255,255,255,0.03); border-radius:8px;">
            <td style="text-align:center; padding:10px;"><img src="${item.image || '/assets/no-image.png'}" style="width:45px; height:45px; border-radius:8px; object-fit:cover; border:1px solid var(--glass-border);"></td>
            <td style="font-family:monospace; color:var(--neon-cyan); font-weight:bold; font-size:0.9em; padding-left:10px;">${item.kod}</td>
            <td style="font-size:0.95em; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:300px;">${item.ad}</td>
            <td><input type="number" class="qi-item-qty" data-idx="${idx}" value="${item.qty}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
            <td><input type="number" class="qi-item-price" data-idx="${idx}" value="${item.priceExclTax}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
            <td><input type="number" class="qi-item-discount" data-idx="${idx}" value="${item.discount || 0}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
            <td><input type="number" class="qi-item-tax" data-idx="${idx}" value="${item.taxRate}" style="text-align:center; height:35px; background:rgba(0,0,0,0.4);"></td>
            <td style="text-align:right; font-weight:bold; color:var(--neon-cyan); padding-right:15px;" id="qi-row-total-${idx}">0.00 ₺</td>
            <td style="text-align:center;"><button onclick="removeQuickItem(${idx})" style="background:none; border:none; color:var(--neon-red); cursor:pointer; font-size:1.2em;">🗑️</button></td>
        </tr>
    `,
    bankModal: () => `
        <div class="form-group"><label>Banka Adı</label><input type="text" id="m-bank-name" placeholder="Örn: Garanti BBVA"></div>
        <div class="form-group"><label>IBAN</label><input type="text" id="m-bank-iban" placeholder="TR00..."></div>
        <div class="form-group"><label>Hesap Sahibi</label><input type="text" id="m-bank-holder" placeholder="Kurum Unvanı"></div>
    `,
    profileModal: (user) => `
        <div class="form-group full-width">
            <label>Görünen Ad</label>
            <input type="text" id="p-displayName" value="${user.displayName}" placeholder="Adınız Soyadınız">
        </div>
        <div class="form-group full-width">
            <label>Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)</label>
            <input type="password" id="p-password" placeholder="******">
        </div>
        <div class="form-group full-width">
            <label>Yeni Şifre Tekrar</label>
            <input type="password" id="p-password-confirm" placeholder="******">
        </div>
    `,
    invoiceDetailsModal: (inv, itemsHtml) => `
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
            <div class="glass-card" style="padding:15px; background:rgba(0,0,0,0.3); border-color:var(--neon-green);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>ARA TOPLAM:</span>
                    <b>${inv.subTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</b>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>TOPLAM KDV:</span>
                    <b>${inv.taxTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</b>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:1.3em; color:var(--neon-green); font-weight:bold; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; margin-top:5px;">
                    <span>GENEL TOPLAM:</span>
                    <span>${inv.finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
            </div>
        </div>
    `,
    stockModal: (current) => `
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
    `,
    productImagePreview: (src) => `<img src="${src}" style="width:100%; height:100%; object-fit:cover;">`
};
