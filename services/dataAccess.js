const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { withLock } = require('../utils/fileLock');

const IS_VERCEL = !!process.env.VERCEL;
const dataDir = path.join(__dirname, '..', 'data');
const tmpDir = IS_VERCEL ? '/tmp' : path.join(__dirname, '..', 'tmp');

// Dizin oluşturmayı güvenli yap (Vercel'de sessizce geç)
try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (e) { /* Vercel: salt okunur, data zaten deploy edilmiş */ }

try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
} catch (e) { /* /tmp Vercel'de zaten var */ }

/**
 * Dosya yolunu tenant bazlı çözer.
 * Eğer tenantId verilirse data/<tenantId>/filename yoluna bakar.
 */
function resolvePath(fileName, tenantId = null) {
    if (!tenantId || fileName === 'users.json' || fileName === 'audit_logs.json' || fileName === 'tenants.json') {
        return path.join(dataDir, fileName);
    }
    
    const tenantPath = path.join(dataDir, tenantId);
    try {
        if (!fs.existsSync(tenantPath)) {
            fs.mkdirSync(tenantPath, { recursive: true });
        }
    } catch (e) { /* Vercel: salt okunur */ }
    return path.join(tenantPath, fileName);
}

async function readJson(fileName, tenantId = null) {
    const filePath = resolvePath(fileName, tenantId);
    return await withLock(filePath, async () => {
        try {
            const data = await fsPromises.readFile(filePath, 'utf8');
            return JSON.parse(data) || [];
        } catch (error) {
            if (fileName === 'integrations.json') {
                return { mysoft: {}, aras: {}, luca: {}, b2b: {} };
            }
            return [];
        }
    });
}

async function writeJson(fileName, data, tenantId = null) {
    const filePath = resolvePath(fileName, tenantId);
    return await withLock(filePath, async () => {
        const tmpPath = path.join(tmpDir, path.basename(filePath) + '.tmp' + Date.now());
        try {
            await fsPromises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
            // Vercel'de /tmp'den data/'ya rename yapılamaz, doğrudan yaz
            if (IS_VERCEL) {
                await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
                try { await fsPromises.unlink(tmpPath); } catch(e) {}
            } else {
                await fsPromises.rename(tmpPath, filePath);
            }
        } catch (error) {
            try { if (fs.existsSync(tmpPath)) await fsPromises.unlink(tmpPath); } catch(e) {}
            if (IS_VERCEL) {
                console.warn('Vercel yazma hatası (beklenen):', error.message);
                return; // Vercel'de yazma hatasını sessizce geç
            }
            throw new Error(`Dosya yazılırken hata oluştu: ${filePath} - ${error.message}`);
        }
    });
}

async function readXml(fileName, tenantId = null) {
    const filePath = resolvePath(fileName, tenantId);
    return await withLock(filePath, async () => {
        try {
            const data = await fsPromises.readFile(filePath, 'utf8');
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_"
            });
            return parser.parse(data);
        } catch (error) {
            return null;
        }
    });
}

async function writeXml(fileName, jsObject, rootTag, tenantId = null) {
    const filePath = resolvePath(fileName, tenantId);
    return await withLock(filePath, async () => {
        const tmpPath = path.join(tmpDir, path.basename(filePath) + '.tmp' + Date.now());
        try {
            const builder = new XMLBuilder({
                ignoreAttributes: false,
                format: true,
                suppressEmptyNode: true
            });
            const xmlContent = builder.build(jsObject);
            const finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
            await fsPromises.writeFile(tmpPath, finalXml, 'utf8');
            if (IS_VERCEL) {
                await fsPromises.writeFile(filePath, finalXml, 'utf8');
                try { await fsPromises.unlink(tmpPath); } catch(e) {}
            } else {
                await fsPromises.rename(tmpPath, filePath);
            }
        } catch (error) {
            try { if (fs.existsSync(tmpPath)) await fsPromises.unlink(tmpPath); } catch(e) {}
            if (IS_VERCEL) {
                console.warn('Vercel XML yazma hatası (beklenen):', error.message);
                return;
            }
            throw new Error(`XML yazılırken hata oluştu: ${filePath} - ${error.message}`);
        }
    });
}

async function appendAuditLog(logEntry, tenantId = null) {
    if (IS_VERCEL) return; // Vercel'de audit log yazmayı atla
    
    const auditFile = resolvePath('audit_logs.json', tenantId);
    return await withLock(auditFile, async () => {
        let logs = [];
        try {
            const data = await fsPromises.readFile(auditFile, 'utf8');
            logs = JSON.parse(data) || [];
        } catch (e) {
            logs = [];
        }
        
        logs.push({ ...logEntry, tenantId, timestamp: new Date().toISOString() });
        
        if (logs.length > 50000) {
            logs = logs.slice(logs.length - 50000);
        }
        
        const tmpPath = path.join(tmpDir, 'audit_logs.json.tmp' + Date.now());
        await fsPromises.writeFile(tmpPath, JSON.stringify(logs, null, 2), 'utf8');
        await fsPromises.rename(tmpPath, auditFile);
    });
}

module.exports = {
    readJson,
    writeJson,
    readXml,
    writeXml,
    appendAuditLog,
    dataDir
};
