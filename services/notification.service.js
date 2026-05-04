const nodemailer = require('nodemailer');

/**
 * Statio - E-Posta Servisi
 * SMTP ayarları .env dosyasından okunur.
 */

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('[EMAIL] SMTP ayarları eksik. E-posta gönderilemeyecek.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });

    return transporter;
}

/**
 * Genel e-posta gönderme fonksiyonu
 */
async function sendMail({ to, subject, html }) {
    const t = getTransporter();
    if (!t) {
        console.warn(`[EMAIL] SMTP yapılandırılmadı. E-posta gönderilemiyor: ${subject} -> ${to}`);
        return { success: false, reason: 'SMTP_NOT_CONFIGURED' };
    }

    try {
        const info = await t.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            html
        });
        console.log(`[EMAIL] Gönderildi: ${subject} -> ${to} (${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (e) {
        console.error(`[EMAIL] Gönderilemedi: ${subject} -> ${to}`, e.message);
        return { success: false, reason: e.message };
    }
}

/**
 * Hoşgeldin e-postası
 */
async function sendWelcomeEmail(email, displayName, username) {
    return sendMail({
        to: email,
        subject: 'Statio - Hesabınız Oluşturuldu ✓',
        html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif; max-width:600px; margin:0 auto; background:#0a0a14; color:#fff; border-radius:16px; overflow:hidden; border:1px solid rgba(0,243,255,0.2);">
            <div style="padding:40px 30px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
                <h1 style="color:#00f3ff; margin:0; font-size:2em;">STATIO</h1>
                <p style="color:#8892b0; margin-top:8px;">Profesyonel Sipariş ve Stok Yönetim Sistemi</p>
            </div>
            <div style="padding:30px;">
                <h2 style="color:#fff; margin-bottom:20px;">Merhaba ${displayName} 👋</h2>
                <p style="color:#8892b0; line-height:1.7;">
                    Statio'ya hoş geldiniz! Hesabınız başarıyla oluşturuldu ve onay sürecindedir.
                </p>
                <div style="background:rgba(0,243,255,0.05); border:1px solid rgba(0,243,255,0.2); border-radius:12px; padding:20px; margin:20px 0;">
                    <p style="margin:0; color:#8892b0;">Kullanıcı Adınız:</p>
                    <p style="margin:5px 0 0; color:#00f3ff; font-size:1.3em; font-weight:bold;">${username}</p>
                </div>
                <p style="color:#8892b0; line-height:1.7;">
                    Hesabınız onaylandığında bu kullanıcı adı ve belirlediğiniz şifre ile giriş yapabilirsiniz.
                    Onay süreci genellikle <strong style="color:#fff;">24 saat</strong> içinde tamamlanır.
                </p>
            </div>
            <div style="padding:20px 30px; text-align:center; border-top:1px solid rgba(255,255,255,0.05); color:#64748b; font-size:0.8em;">
                © ${new Date().getFullYear()} Statio — Bu e-posta otomatik olarak gönderilmiştir.
            </div>
        </div>`
    });
}

/**
 * Şifre sıfırlama e-postası
 */
async function sendPasswordResetEmail(email, displayName, resetToken, baseUrl) {
    const resetLink = `${baseUrl}/reset-password.html?token=${resetToken}`;
    return sendMail({
        to: email,
        subject: 'Statio - Şifre Sıfırlama Talebi 🔑',
        html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif; max-width:600px; margin:0 auto; background:#0a0a14; color:#fff; border-radius:16px; overflow:hidden; border:1px solid rgba(0,243,255,0.2);">
            <div style="padding:40px 30px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
                <h1 style="color:#00f3ff; margin:0; font-size:2em;">STATIO</h1>
            </div>
            <div style="padding:30px;">
                <h2 style="color:#fff; margin-bottom:20px;">Şifre Sıfırlama</h2>
                <p style="color:#8892b0; line-height:1.7;">
                    Merhaba ${displayName},<br><br>
                    Hesabınız için şifre sıfırlama talebi aldık. 
                    Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz.
                </p>
                <div style="text-align:center; margin:30px 0;">
                    <a href="${resetLink}" style="display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#00f3ff,#6366f1); color:#000; text-decoration:none; border-radius:10px; font-weight:bold; font-size:1.1em;">
                        Şifremi Sıfırla
                    </a>
                </div>
                <p style="color:#64748b; font-size:0.85em; line-height:1.6;">
                    Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın. Link <strong>1 saat</strong> geçerlidir.
                </p>
            </div>
            <div style="padding:20px 30px; text-align:center; border-top:1px solid rgba(255,255,255,0.05); color:#64748b; font-size:0.8em;">
                © ${new Date().getFullYear()} Statio
            </div>
        </div>`
    });
}

/**
 * Hesap onay e-postası (SuperAdmin onayladığında)
 */
async function sendAccountApprovedEmail(email, displayName, username) {
    return sendMail({
        to: email,
        subject: 'Statio - Hesabınız Onaylandı! 🎉',
        html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif; max-width:600px; margin:0 auto; background:#0a0a14; color:#fff; border-radius:16px; overflow:hidden; border:1px solid rgba(0,243,255,0.2);">
            <div style="padding:40px 30px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
                <h1 style="color:#00f3ff; margin:0; font-size:2em;">STATIO</h1>
            </div>
            <div style="padding:30px;">
                <h2 style="color:#00ff9f; margin-bottom:20px;">🎉 Hesabınız Onaylandı!</h2>
                <p style="color:#8892b0; line-height:1.7;">
                    Merhaba ${displayName},<br><br>
                    Mağazanız başarıyla onaylandı. Artık sisteme giriş yapabilirsiniz.
                </p>
                <div style="background:rgba(0,255,159,0.05); border:1px solid rgba(0,255,159,0.2); border-radius:12px; padding:20px; margin:20px 0;">
                    <p style="margin:0; color:#8892b0;">Kullanıcı Adınız:</p>
                    <p style="margin:5px 0 0; color:#00ff9f; font-size:1.3em; font-weight:bold;">${username}</p>
                </div>
            </div>
            <div style="padding:20px 30px; text-align:center; border-top:1px solid rgba(255,255,255,0.05); color:#64748b; font-size:0.8em;">
                © ${new Date().getFullYear()} Statio
            </div>
        </div>`
    });
}

module.exports = {
    sendMail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendAccountApprovedEmail,
    getTransporter
};
