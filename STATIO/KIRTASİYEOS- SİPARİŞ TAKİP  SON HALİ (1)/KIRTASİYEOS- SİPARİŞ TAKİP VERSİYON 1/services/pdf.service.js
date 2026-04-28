const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT_PATH = 'C:\\Windows\\Fonts\\arial.ttf';

function createDoc(res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    
    if (fs.existsSync(FONT_PATH)) {
        doc.font(FONT_PATH);
    } else {
        doc.font('Helvetica');
    }
    
    return doc;
}

// Türkçe karakterler artık Arial ile destekleniyor, ancak yedek olarak kalsın
function tr(text) {
    if (!text) return "";
    return text.toString();
}

async function generateOrderPdf(order, res) {
    const doc = createDoc(res);
    
    const formatCurr = (val) => {
        return (new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)) + ' ₺';
    };

    // Header - Statio Space Dark Background
    doc.rect(0, 0, 595, 80).fill('#050510'); 
    
    const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 30, 15, { fit: [50, 50] });
    }
    
    doc.fontSize(24).fillColor('#00f3ff').text('STATIO', 90, 20, { lineBreak: false });
    doc.fontSize(9).fillColor('#9d4edd').text('LOGISTICS PLATFORM', 91, 48, { lineBreak: false });

    doc.fontSize(11).fillColor('#ffffff').text('SEVKIYAT VE LOJISTIK FORMU', 340, 32, {
        width: 220,
        align: 'right',
        lineBreak: false
    });

    // Content Start
    doc.fillColor('#333333').fontSize(14).text('SIPARIS DETAYLARI', 50, 110);
    doc.moveTo(50, 140).lineTo(550, 140).stroke('#eeeeee');

    doc.fontSize(10).fillColor('#666666');
    doc.text(`Siparis No: ${order.id}`, 50, 155);
    doc.text(`Tarih: ${new Date(order.createdAt).toLocaleString('tr-TR')}`, 50, 170);
    doc.text(`Kurum: ${order.companyCode}`, 300, 155);
    doc.text(`Durum: ${order.status}`, 300, 170);

    if (order.cargoDetail) {
        doc.rect(50, 190, 500, 40).fill('#f8f9fa');
        doc.fillColor('#333333').text(`KARGO: ${order.cargoDetail.company} - Takip No: ${order.cargoDetail.trackingCode}`, 60, 205);
    }

    const tableTop = 250;
    doc.rect(50, tableTop, 500, 25).fill('#001219');
    doc.fillColor('#00f3ff').fontSize(9);
    doc.text('GORSEL', 55, tableTop + 9);
    doc.text('URUN KODU', 100, tableTop + 9);
    doc.text('URUN ADI', 175, tableTop + 9);
    doc.text('FIYAT(H)', 310, tableTop + 9);
    doc.text('KDV%', 370, tableTop + 9);
    doc.text('ISK%', 410, tableTop + 9);
    doc.text('MKT', 450, tableTop + 9);
    doc.text('TUTAR', 490, tableTop + 9);

    let y = tableTop + 35;
    
    for (const [index, item] of (order.items || []).entries()) {
        if(index % 2 === 0) doc.rect(50, y-5, 500, 25).fill('#f2f2f2');
        
        const pExcl = parseFloat(item.priceExclTax) || 0;
        const tRate = parseFloat(item.taxRate) || 0;
        const dRate = parseFloat(item.discountRate) || 0;
        const q = parseInt(item.qty) || parseInt(item.miktar) || 0;
        const rowTotal = pExcl * q * (1 - dRate/100) * (1 + tRate/100);

        // Render Image with Sharp Conversion (WebP to PNG for PDFKit)
        const imgPath = path.join(__dirname, '..', 'data', 'uploads', `${item.code}.webp`);
        if (fs.existsSync(imgPath)) {
            try {
                const pngBuffer = await sharp(imgPath).png().toBuffer();
                doc.image(pngBuffer, 55, y - 2, { fit: [20, 20] });
            } catch (err) {
                console.error('PDF Image Error:', err);
            }
        }

        doc.fillColor('#333333').fontSize(9);
        doc.text(item.code, 100, y);
        doc.text(item.name.substring(0, 25), 175, y);
        doc.text(pExcl.toFixed(2), 310, y);
        doc.text(`%${tRate}`, 370, y);
        doc.text(`%${dRate}`, 410, y);
        doc.text(`${q}`, 450, y);
        doc.text(rowTotal.toFixed(2), 490, y);
        y += 25;
        
        if (y > 750) {
            doc.addPage();
            y = 50;
        }
    }

    y += 10;
    doc.moveTo(300, y).lineTo(550, y).stroke('#aaaaaa');
    y += 15;
    
    doc.fontSize(10).fillColor('#333333');
    doc.text('Ara Toplam (KDV Haric):', 300, y);
    doc.text(formatCurr(order.totalAmount || 0), 450, y, { width: 90, align: 'right' });
    y += 15;
    doc.text('KDV Toplami:', 300, y);
    doc.text(formatCurr(order.totalTax || 0), 450, y, { width: 90, align: 'right' });
    y += 15;
    doc.fontSize(11).fillColor('#001219');
    doc.text('GENEL TOPLAM:', 300, y);
    doc.text(formatCurr(order.finalAmount || 0), 450, y, { width: 90, align: 'right' });

    if (order.notes) {
        doc.moveDown(2);
        doc.fillColor('#666666').fontSize(9).text(`NOTLAR: ${order.notes}`, 50, y + 30);
    }
    
    doc.fontSize(8).fillColor('#999999').text('Bu belge sistem tarafindan otomatik olusturulmustur.', 50, 780, { align: 'center' });
    doc.end();
}

async function generateDeliveryNotePdf(note, res) {
    await generateOrderPdf(note, res);
}

async function generateInvoicePdf(invoice, res) {
    await generateOrderPdf(invoice, res);
}

module.exports = {
    generateOrderPdf,
    generateDeliveryNotePdf,
    generateInvoicePdf
};
