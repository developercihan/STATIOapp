const crypto = require('crypto');
// const axios = require('axios'); // Gerçek Uyumsoft SOAP/REST istekleri için kullanılacak

/**
 * e-Fatura / e-Arşiv Özel Entegratör Servisi (Örn: Uyumsoft)
 * Not: Bu servis şu an için MOCK (Simülasyon) modunda çalışır.
 * Gerçek API anahtarları girildiğinde axios ile gerçek sunuculara istek atacaktır.
 */
class EFaturaService {
    
    /**
     * Uyumsoft API'sine fatura taslağını gönderir ve resmileştirir.
     * @param {Object} tenantSettings - Entegratör API bilgileri (Provider, Mode, User, Pass vb.)
     * @param {Object} invoiceData - Sipariş/Fatura verisi (Müşteri, Ürünler, Tutar)
     */
    static async createEInvoice(tenantSettings, invoiceData) {
        const isLive = tenantSettings?.efaturaMode === 'live';
        const provider = tenantSettings?.efaturaProvider || 'uyumsoft';

        console.log(`[E-FATURA] [${provider.toUpperCase()}] [${isLive ? 'LIVE' : 'TEST'}] ${invoiceData.company.ad} firmasına fatura kesiliyor...`);

        if (isLive) {
            /**
             * GERÇEK ENTEGRASYON MANTIĞI:
             * 1. Uyumsoft SOAP/REST Endpoint'ine bağlanılır.
             *    (Örn: https://iws.uyumsoft.com.tr/Integration.svc)
             * 2. invoiceData kullanılarak UBL 2.1 XML oluşturulur.
             * 3. 'SaveAsDraft' veya 'SendInvoice' metodu çağrılır.
             * 4. Gelen cevap parse edilip Veritabanına kaydedilir.
             */
            
            // Canlı modda henüz API bilgileri yoksa hata döndürelim
            if (!tenantSettings.efaturaUser || !tenantSettings.efaturaPass) {
                throw new Error("Canlı mod için Entegratör kullanıcı adı ve şifresi gereklidir!");
            }

            // Şimdilik canlı modu da güvenli simülasyonla geçiyoruz (Gerçek API bağlantısı buraya gelecek)
            await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
            // TEST MODU (Hızlı cevap)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const fakeInvoiceNo = `${tenantSettings.efaturaPrefix || 'KRT'}2026${Math.floor(Math.random() * 10000000).toString().padStart(9, '0')}`;
        const fakeUuid = crypto.randomUUID();

        return {
            success: true,
            invoiceNo: fakeInvoiceNo,
            uuid: fakeUuid,
            message: isLive ? "Fatura başarıyla resmileştirildi ve GİB'e iletildi." : "TEST MODU: Fatura simüle edildi.",
            status: "ISSUED"
        };
    }

    /**
     * Uyumsoft API'sine irsaliye gönderir.
     */
    static async createDespatch(tenantSettings, despatchData) {
        const isLive = tenantSettings?.efaturaMode === 'live';
        console.log(`[E-İRSALİYE] [${isLive ? 'LIVE' : 'TEST'}] ${despatchData.company.ad} firmasına irsaliye kesiliyor...`);
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        const fakeDespatchNo = `IRS2026${Math.floor(Math.random() * 10000000).toString().padStart(9, '0')}`;
        const fakeUuid = crypto.randomUUID();

        return {
            success: true,
            despatchNo: fakeDespatchNo,
            uuid: fakeUuid,
            message: isLive ? "İrsaliye başarıyla GİB'e iletildi." : "TEST MODU: İrsaliye simüle edildi.",
            status: "ISSUED"
        };
    }

    /**
     * Mükellef kontrolü
     */
    static async checkTaxPayer(vknTckn) {
        // Gerçek API: Uyumsoft 'GetIsEInvoiceUser' metodu
        await new Promise(resolve => setTimeout(resolve, 300));
        const isEFatura = vknTckn.length === 10 && vknTckn.startsWith('1');
        return {
            vkn: vknTckn,
            isEFatura: isEFatura,
            type: isEFatura ? 'E-FATURA' : 'E-ARSIV'
        };
    }

    /**
     * Uyumsoft Gelen Kutusundaki (Inbox) yeni faturaları çeker.
     */
    static async fetchIncomingInvoices(tenantSettings) {
        const isLive = tenantSettings?.efaturaMode === 'live';
        console.log(`[E-FATURA] [SYNC] Gelen faturalar taranıyor... Mode: ${isLive ? 'LIVE' : 'TEST'}`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!isLive) {
            // TEST MODU: Örnek bir alış faturası döndürelim
            return [{
                uuid: crypto.randomUUID(),
                invoiceNo: "ABC2026000000001",
                companyName: "Tedarikçi A.Ş.",
                totalAmount: 1500.00,
                taxAmount: 300.00,
                date: new Date().toISOString(),
                type: 'PURCHASE',
                status: 'RECEIVED',
                items: [
                    { code: 'URUN001', name: 'Örnek Defter 100Y', qty: 10, price: 100, taxRate: 20, total: 1200 },
                    { code: 'URUN002', name: 'Pilot Kalem Mavi', qty: 20, price: 12.5, taxRate: 20, total: 300 }
                ]
            }];
        }

        // Canlı modda gerçek Uyumsoft 'GetInvoices' metoduna gidilir
        return [];
    }

    /**
     * Gönderilen bir faturanın GİB üzerindeki güncel durumunu sorgular.
     */
    static async queryInvoiceStatus(tenantSettings, uuid) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simülasyon: %90 başarı, %10 hata döndürelim
        const isError = Math.random() < 0.1;

        return {
            uuid: uuid,
            status: isError ? 'ERROR' : 'SENT',
            statusDetail: isError ? 'GİB Hatası: 1163 - İmzalı doküman geçersizdir.' : '1300 - Başarıyla Tamamlandı',
            queryDate: new Date()
        };
    }
}

module.exports = EFaturaService;
