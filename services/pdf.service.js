const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const dataAccess = require('./dataAccess');

// Windows sistem fontları - Türkçe karakter desteği için
const FONT_REGULAR = 'C:\\Windows\\Fonts\\arial.ttf';
const FONT_BOLD    = 'C:\\Windows\\Fonts\\arialbd.ttf';

class PdfService {
    async generateStatementPdf(receivable, res, tenantId) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 0, size: 'A4' });

                if (fs.existsSync(FONT_REGULAR)) {
                    doc.registerFont('Regular', FONT_REGULAR);
                    doc.registerFont('Bold', FONT_BOLD);
                } else {
                    doc.registerFont('Regular', 'Helvetica');
                    doc.registerFont('Bold', 'Helvetica-Bold');
                }

                doc.pipe(res);

                const W = 595;
                const ML = 40;
                const MR = W - ML;

                // --- HEADER ---
                doc.fillColor('#0a0a14').rect(0, 0, W, 100).fill();
                
                const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, ML, 20, { width: 50, height: 50 });
                }

                doc.font('Regular').fillColor('#00e5ff').fontSize(28)
                   .text('STATIO', 100, 25);
                doc.font('Regular').fillColor('#ffffff').fontSize(10)
                   .text('CARİ HESAP EKSTRESİ (STATEMENT)', 103, 60);

                doc.font('Bold').fillColor('#ffffff').fontSize(14)
                   .text(receivable.companyName.toUpperCase(), ML, 35, { align: 'right', width: MR - ML });
                doc.font('Regular').fillColor('#cccccc').fontSize(9)
                   .text(`Cari Kod: ${receivable.code}`, ML, 55, { align: 'right', width: MR - ML });
                doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, ML, 68, { align: 'right', width: MR - ML });

                // --- DURUM ÖZETİ (Glow Card Concept in PDF) ---
                const bal = parseFloat(receivable.balance) || 0;
                const statusColor = bal > 0 ? '#ff3366' : (bal < 0 ? '#00ff88' : '#00f3ff');
                const statusText = bal > 0 ? `Müsterinin size ${bal.toLocaleString('tr-TR')} TL borcu var.` 
                                         : (bal < 0 ? `Sizin müsteriye ${Math.abs(bal).toLocaleString('tr-TR')} TL borcunuz var.` : 'Hesap Dengede');

                doc.fillColor('#f8f9fa').rect(ML, 120, MR - ML, 50).fill();
                doc.strokeColor(statusColor).lineWidth(2).rect(ML, 120, MR - ML, 50).stroke();
                
                doc.font('Bold').fillColor(statusColor).fontSize(14)
                   .text(statusText, ML, 137, { align: 'center', width: MR - ML });

                // --- TABLO BAŞLIĞI ---
                const tableTop = 200;
                const headerH = 25;
                const col = {
                    date: { x: ML + 10, w: 80 },
                    desc: { x: ML + 100, w: 220 },
                    amt:  { x: ML + 330, w: 90 },
                    bal:  { x: ML + 430, w: 90 }
                };

                doc.fillColor('#1a1a2e').rect(ML, tableTop, MR - ML, headerH).fill();
                doc.font('Bold').fillColor('#ffffff').fontSize(9);
                doc.text('TARİH', col.date.x, tableTop + 8);
                doc.text('İŞLEM AÇIKLAMASI', col.desc.x, tableTop + 8);
                doc.text('TUTAR', col.amt.x, tableTop + 8);
                doc.text('KALAN BAKİYE', col.bal.x, tableTop + 8);

                // --- SATIRLAR ---
                let curY = tableTop + headerH;
                const tx = receivable.transactions || [];
                const rowH = 30;

                doc.font('Regular').fontSize(9);
                tx.slice().reverse().forEach((t, i) => {
                    if (curY > 750) {
                        doc.addPage();
                        curY = 50;
                    }

                    const bg = i % 2 === 0 ? '#ffffff' : '#fcfcfc';
                    doc.fillColor(bg).rect(ML, curY, MR - ML, rowH).fill();

                    doc.fillColor('#333333');
                    doc.text(new Date(t.date).toLocaleDateString('tr-TR'), col.date.x, curY + 10);
                    
                    doc.font('Bold').fillColor(t.type === 'INVOICE' ? '#d63384' : '#198754');
                    doc.text(t.description, col.desc.x, curY + 10, { width: col.desc.w, ellipsis: true });
                    
                    doc.font('Regular').fillColor('#333333');
                    doc.text(`${t.type === 'INVOICE' ? '+' : '-'} ${t.amount.toLocaleString('tr-TR')} TL`, col.amt.x, curY + 10);
                    doc.text(`${t.balanceAfter.toLocaleString('tr-TR')} TL`, col.bal.x, curY + 10);

                    curY += rowH;
                });

                // --- FOOTER ---
                doc.fontSize(8).fillColor('#aaaaaa')
                   .text('Bu belge Statio Logistics Platform tarafından otomatik olarak olusturulmustur.', 0, 810, { align: 'center', width: W });

                doc.end();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    async generateOrderPdf(order, res, tenantId) {
        return new Promise(async (resolve, reject) => {
            try {
                // Ürün verilerini yükle (resimler için)
                const products = await dataAccess.readJson('products.json', tenantId);

                const doc = new PDFDocument({ margin: 0, size: 'A4' });

                // Font kaydı - Türkçe karakter desteği
                if (fs.existsSync(FONT_REGULAR)) {
                    doc.registerFont('Regular', FONT_REGULAR);
                    doc.registerFont('Bold', FONT_BOLD);
                } else {
                    doc.registerFont('Regular', 'Helvetica');
                    doc.registerFont('Bold', 'Helvetica-Bold');
                }

                doc.pipe(res);

                const W  = 595; // A4 genişlik
                const ML = 40;  // Sol margin biraz daha geniş
                const MR = W - ML; // Sağ limit

                // ============================================================
                // HEADER - Koyu arka plan
                // ============================================================
                doc.fillColor('#0a0a14').rect(0, 0, W, 90).fill();

                const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, ML, 15, { width: 50, height: 50 });
                }

                doc.font('Regular').fillColor('#00e5ff').fontSize(32)
                   .text('STATIO', 100, 18, { lineBreak: false });
                doc.font('Regular').fillColor('#9c27b0').fontSize(11)
                   .text('LOGISTICS PLATFORM', 103, 52, { lineBreak: false });

                doc.font('Regular').fillColor('#ffffff').fontSize(12)
                   .text('SEVKİYAT VE LOJİSTİK FORMU', ML, 35, {
                       width: MR - ML,
                       align: 'right',
                       lineBreak: false
                   });

                // ============================================================
                // SİPARİŞ DETAYLARI başlık
                // ============================================================
                doc.font('Regular').fillColor('#222222').fontSize(17)
                   .text('SİPARİS DETAYLARI', ML, 130);

                doc.moveTo(ML, 160).lineTo(MR, 160)
                   .strokeColor('#e0e0e0').lineWidth(1).stroke();

                // ============================================================
                // BİLGİ ALANI
                // ============================================================
                const orderNote = order.notes || order.note || '';
                const statusColor = '#555555';

                doc.font('Regular').fillColor('#444444').fontSize(10)
                   .text(`Siparis No: ${order.id}`, ML, 180, { lineBreak: false })
                   .text(`Tarih: ${new Date(order.createdAt).toLocaleString('tr-TR')}`, ML, 198, { lineBreak: false });

                doc.font('Regular').fillColor('#444444').fontSize(10)
                   .text(`Kurum: ${order.companyCode || '-'}`, 300, 180, { lineBreak: false });

                doc.text('Durum: ', 300, 198, { continued: true, lineBreak: false });
                doc.fillColor(statusColor).text(order.status || '-');

                // ============================================================
                // TABLO SÜTUN POZİSYONLARI
                // ============================================================
                // Hepsini sola dayalı yapacağız
                const C = {
                    gorsel: { x: ML + 5,   w: 45  },
                    kod:    { x: ML + 55,  w: 75  },
                    ad:     { x: ML + 130, w: 140 },
                    fiyat:  { x: ML + 270, w: 50  },
                    kdv:    { x: ML + 330, w: 40  },
                    isk:    { x: ML + 375, w: 40  },
                    mkt:    { x: ML + 415, w: 30  },
                    tutar:  { x: ML + 455, w: 50  },
                };

                const tableTop = 250;
                const headerH  = 28;
                const rowH     = 50;

                // Tablo başlığı
                doc.fillColor('#021a1f').rect(ML, tableTop, MR - ML, headerH).fill();

                doc.font('Bold').fillColor('#00e5ff').fontSize(9);
                const hy = tableTop + 10;
                
                doc.text('GORSEL',    C.gorsel.x, hy, { lineBreak: false });
                doc.text('URUN KODU', C.kod.x,    hy, { lineBreak: false });
                doc.text('URUN ADI',  C.ad.x,     hy, { lineBreak: false });
                doc.text('FIYAT(H)',  C.fiyat.x,  hy, { lineBreak: false });
                doc.text('KDV%',      C.kdv.x,    hy, { lineBreak: false });
                doc.text('ISK%',      C.isk.x,    hy, { lineBreak: false });
                doc.text('MKT',       C.mkt.x,    hy, { lineBreak: false });
                doc.text('TUTAR',     C.tutar.x,  hy, { lineBreak: false });

                // ============================================================
                // ÜRÜN SATIRLARI
                // ============================================================
                let curY = tableTop + headerH;
                let subtotal = 0;
                let totalTax = 0;

                for (let i = 0; i < order.items.length; i++) {
                    const item = order.items[i];

                    if (curY > 700) {
                        doc.addPage();
                        curY = 40;
                    }

                    // Zebra arka plan
                    const bg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    doc.fillColor(bg).rect(ML, curY, MR - ML, rowH).fill();

                    // Sayısal hesaplar
                    const qty       = parseInt(item.qty || item.miktar) || 0;
                    const priceExcl = parseFloat(item.priceExclTax) || 0;
                    const taxRate   = parseFloat(item.taxRate) || 0;
                    const discRate  = parseFloat(item.discountRate) || 0;
                    const lineBase  = priceExcl * qty * (1 - discRate / 100);
                    const lineTax   = lineBase * (taxRate / 100);
                    const lineTotal = lineBase + lineTax;

                    subtotal += lineBase;
                    totalTax += lineTax;

                    // Görsel
                    const productData = products.find(p => p.kod === item.code);
                    if (productData && productData.image) {
                        try {
                            const imgRelPath = productData.image.replace(/^\//, '');
                            // Tenant bazlı upload klasörü kontrolü
                            let imgPath = path.join(dataAccess.dataDir, tenantId, imgRelPath);
                            if (!fs.existsSync(imgPath)) {
                                // Fallback: global uploads (eğer varsa)
                                imgPath = path.join(dataAccess.dataDir, imgRelPath);
                            }
                            
                            if (fs.existsSync(imgPath)) {
                                const pngBuf = await sharp(imgPath).png().toBuffer();
                                doc.image(pngBuf, C.gorsel.x + 2, curY + 6, { width: 38, height: 38 });
                            }
                        } catch (e) { /* geç */ }
                    }

                    const textY = curY + 20; // Dikey hizalama tam ortada

                    doc.font('Regular').fillColor('#333333').fontSize(9);

                    doc.text(item.code || '-', C.kod.x, textY, { width: C.kod.w, lineBreak: false });
                    doc.text(item.name || '-', C.ad.x,  textY, { width: C.ad.w, lineBreak: false, ellipsis: true });
                    
                    doc.text(priceExcl.toFixed(2), C.fiyat.x, textY, { lineBreak: false });
                    doc.text(`%${taxRate}`,        C.kdv.x,   textY, { lineBreak: false });
                    doc.text(`%${discRate}`,       C.isk.x,   textY, { lineBreak: false });
                    doc.text(qty.toString(),       C.mkt.x,   textY, { lineBreak: false });
                    doc.text(lineTotal.toFixed(2), C.tutar.x, textY, { lineBreak: false });

                    curY += rowH;
                }

                // ============================================================
                // TOPLAM ALANI
                // ============================================================
                curY += 20;
                const grandTotal = subtotal + totalTax;

                const totX = 300; // Ara toplamın başladığı x noktası

                doc.moveTo(totX, curY).lineTo(MR, curY)
                   .strokeColor('#cccccc').lineWidth(1).stroke();

                doc.font('Regular').fillColor('#333333').fontSize(10);
                
                doc.text('Ara Toplam (KDV Haric):', totX, curY + 12, { lineBreak: false });
                doc.text(`${subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} \u20BA`, ML, curY + 12, { align: 'right', width: MR - ML, lineBreak: false });

                doc.text('KDV Toplami:', totX, curY + 30, { lineBreak: false });
                doc.text(`${totalTax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} \u20BA`, ML, curY + 30, { align: 'right', width: MR - ML, lineBreak: false });

                doc.moveTo(totX, curY + 48).lineTo(MR, curY + 48)
                   .strokeColor('#cccccc').lineWidth(1).stroke();

                doc.font('Bold').fillColor('#111111').fontSize(12);
                doc.text('GENEL TOPLAM:', totX, curY + 56, { lineBreak: false });
                doc.text(`${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} \u20BA`, ML, curY + 56, { align: 'right', width: MR - ML, lineBreak: false });

                // ============================================================
                // NOTLAR
                // ============================================================
                if (orderNote) {
                    curY += 100;
                    doc.font('Regular').fillColor('#e67e22').fontSize(10)
                       .text('NOTLAR: ', ML, curY, { continued: true, lineBreak: false });
                    doc.fillColor('#555555')
                       .text(orderNote, { lineBreak: false });
                }

                doc.end();
                resolve();
            } catch (err) {
                console.error('PDF Generation Error:', err);
                reject(err);
            }
        });
    }
}

module.exports = new PdfService();
