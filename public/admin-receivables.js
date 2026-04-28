window.renderReceivablesTab = async function() {
    try {
        const rcvs = await adminApi('GET', '/api/admin/receivables');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand" style="color:var(--neon-pink)">CARİ HESAP EKSTRELERİ</h2>
                <button class="btn btn-primary" onclick="openRcvModal()">+ Yeni Cari Ekle</button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>KOD</th><th>FİRMA</th><th>RİSK LİMİTİ</th><th>BAKİYE</th><th>DURUM</th><th>İŞLEM</th></tr></thead>
                    <tbody>
        `;
        
        rcvs.forEach(r => {
            html += `<tr>
                <td style="color:var(--neon-pink)">${r.code}</td>
                <td>${r.companyName}</td>
                <td style="color:var(--neon-purple); font-weight:bold;">${parseFloat(r.riskLimit || 0).toLocaleString('tr-TR')} TL</td>
                <td>${parseFloat(r.balance).toFixed(2)} TL</td>
                <td><span class="badge ${r.balance > 0 ? 'badge-danger' : 'badge-success'}">${r.balance > 0 ? 'BORÇLU' : (r.balance < 0 ? 'ALACAKLI' : 'DENGEDE')}</span></td>
                <td>
                    <button class="btn" style="padding:5px 8px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="viewTransactions('${r.id}')">👁️ Ekstre</button>
                    <button class="btn" style="padding:5px 8px; font-size:0.8em; border-color:var(--neon-pink); color:var(--neon-pink);" onclick="window.open('/api/admin/receivables/${r.id}/pdf')">📄 PDF</button>
                    <button class="btn" style="padding:5px 8px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openRcvModal('${r.id}', '${r.code}', '${r.companyName.replace(/'/g, "\\'")}', ${r.balance}, '${r.status}')">Düzenle</button>
                    <button class="btn" style="padding:5px 8px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteRcv('${r.id}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openRcvModal = function(id='', code='', name='', balance=0, status='BEKLEMEDE') {
    const isEdit = !!id;
    document.getElementById('modal-title').textContent = isEdit ? 'Cari Düzenle' : 'Yeni Cari Kaydı';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group"><label>Cari Kod</label><input type="text" id="m-rcv-code" value="${code}"></div>
        <div class="form-group"><label>Firma Adı</label><input type="text" id="m-rcv-name" value="${name}"></div>
        <div class="form-group"><label>Bakiye</label><input type="number" id="m-rcv-balance" value="${parseFloat(balance).toFixed(2)}"></div>
        <div class="form-group"><label>Durum</label>
            <select id="m-rcv-status">
                <option value="BEKLEMEDE" ${status === 'BEKLEMEDE' ? 'selected' : ''}>Beklemede</option>
                <option value="BORCLU" ${status === 'BORCLU' ? 'selected' : ''}>Borçlu</option>
                <option value="ALACAKLI" ${status === 'ALACAKLI' ? 'selected' : ''}>Alacaklı</option>
            </select>
        </div>
        <input type="hidden" id="m-rcv-id" value="${id}">
    `;
    window.resetModalBtn();
    document.getElementById('modal-save-btn').onclick = saveRcv;
    document.getElementById('admin-modal').classList.add('active');
}

async function saveRcv() {
    const id = document.getElementById('m-rcv-id').value;
    const data = {
        code: document.getElementById('m-rcv-code').value,
        companyName: document.getElementById('m-rcv-name').value,
        balance: parseFloat(document.getElementById('m-rcv-balance').value),
        status: document.getElementById('m-rcv-status').value
    };
    try {
        if(id) await adminApi('PUT', `/api/admin/receivables/${id}`, data);
        else await adminApi('POST', '/api/admin/receivables', data);
        closeModal(); renderReceivablesTab(); showToast('Cari kaydedildi');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteRcv = async function(id) {
    window.showConfirm('Cari silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/receivables/${id}`); renderReceivablesTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}
window.viewTransactions = async function(id) {
    try {
        const data = await adminApi('GET', `/api/admin/receivables/${id}/transactions`);
        const bal = parseFloat(data.balance) || 0;
        
        let summaryHtml = '';
        if (bal > 0) {
            summaryHtml = `<div class="glass-card" style="border-color:var(--neon-red); padding:15px; text-align:center; margin-bottom:15px;">
                <div style="font-size:0.8em; color:var(--text-secondary);">GÜNCEL DURUM</div>
                <div style="font-size:1.5em; font-weight:bold; color:var(--neon-red);">Müşterinin size ${bal.toLocaleString('tr-TR')} TL borcu var.</div>
            </div>`;
        } else if (bal < 0) {
            summaryHtml = `<div class="glass-card" style="border-color:var(--neon-green); padding:15px; text-align:center; margin-bottom:15px;">
                <div style="font-size:0.8em; color:var(--text-secondary);">GÜNCEL DURUM</div>
                <div style="font-size:1.5em; font-weight:bold; color:var(--neon-green);">Sizin müşteriye ${Math.abs(bal).toLocaleString('tr-TR')} TL borcunuz var.</div>
            </div>`;
        } else {
            summaryHtml = `<div class="glass-card" style="border-color:var(--neon-cyan); padding:15px; text-align:center; margin-bottom:15px;">
                <div style="font-size:1.5em; font-weight:bold; color:var(--neon-cyan);">Hesap Dengede (0.00 TL)</div>
            </div>`;
        }

        document.getElementById('modal-title').textContent = `Ekstre: ${data.companyName}`;
        document.getElementById('modal-body').innerHTML = `
            <div class="full-width">
                ${summaryHtml}
                <div class="glass-card" style="padding:15px; margin-bottom:15px;">
                    <h4 class="brand" style="font-size:0.9em; margin-bottom:10px; color:var(--neon-purple);">💳 HIZLI ÖDEME (TAHSİLAT) EKLE</h4>
                    <div style="display:flex; gap:10px;">
                        <input type="number" id="m-pay-amount" placeholder="Tutar (TL)" style="flex:1;">
                        <input type="text" id="m-pay-desc" placeholder="Açıklama (Opsiyonel)" style="flex:2;">
                        <button class="btn btn-primary" onclick="addPayment('${id}')">ÖDEME AL</button>
                    </div>
                </div>
                <div class="glass-card" style="padding:10px;">
                    <table class="data-table" style="font-size:0.85em;">
                        <thead><tr><th>TARİH</th><th>İŞLEM</th><th>TUTAR</th><th>KALAN BAKİYE</th></tr></thead>
                        <tbody>
                            ${data.transactions.reverse().map(t => {
                                let descHtml = t.description;
                                // Eğer relatedId varsa direkt kullan, yoksa açıklama içinden parse etmeyi dene
                                let orderId = t.relatedId;
                                if(!orderId && t.description.includes('#ORD-')) {
                                    const match = t.description.match(/#(ORD-[\d-]+)/);
                                    if(match) orderId = match[1];
                                }

                                if(orderId) {
                                    descHtml = `<span style="cursor:pointer; text-decoration:underline; border-bottom:1px dashed var(--neon-pink);" 
                                                      onclick="event.stopPropagation(); ${orderId.startsWith('cash') ? `viewCashDetails('${orderId}')` : `viewOrderDetails('${orderId}')`}" 
                                                      title="${orderId.startsWith('cash') ? 'Kasa İşlem Detayını Gör' : 'Sipariş Detayını Gör'}">
                                                  ${t.description} 🔍
                                                </span>`;
                                }
                                return `
                                <tr>
                                    <td>${new Date(t.date).toLocaleDateString('tr-TR')}</td>
                                    <td style="font-weight:bold; color:${t.type==='INVOICE'?'var(--neon-pink)':'var(--neon-green)'}">${descHtml}</td>
                                    <td>${t.type==='INVOICE'?'+':'-'} ${t.amount.toLocaleString('tr-TR')} TL</td>
                                    <td style="opacity:0.7;">${t.balanceAfter.toLocaleString('tr-TR')} TL</td>
                                </tr>
                            `;}).join('')}
                        </tbody>
                    </table>
                    ${data.transactions.length === 0 ? '<p style="text-align:center; padding:20px; opacity:0.5;">Henüz hareket kaydı yok.</p>' : ''}
                </div>
            </div>
        `;
        window.resetModalBtn('KAPAT', 'btn', true);
        const pdfBtn = document.getElementById('modal-pdf-btn');
        if(pdfBtn) {
            pdfBtn.style.display = 'flex';
            pdfBtn.onclick = () => window.open(`/api/admin/receivables/${id}/pdf`);
        }
        document.getElementById('modal-save-btn').onclick = closeModal;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}

window.addPayment = async function(id) {
    const amount = document.getElementById('m-pay-amount').value;
    const description = document.getElementById('m-pay-desc').value;
    if(!amount) return showToast('Lütfen tutar giriniz', 'error');
    
    try {
        await adminApi('POST', `/api/admin/receivables/${id}/transactions`, { amount, description });
        showToast('Ödeme başarıyla kaydedildi');
        viewTransactions(id); // Reload modal
        renderReceivablesTab(); // Reload table
    } catch(e) { showToast(e.message, 'error'); }
}
