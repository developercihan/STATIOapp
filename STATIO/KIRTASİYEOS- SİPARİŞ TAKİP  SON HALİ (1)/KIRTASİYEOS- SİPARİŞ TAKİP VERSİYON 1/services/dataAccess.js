const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { withLock } = require('../utils/fileLock');

const dataDir = path.join(__dirname, '..', 'data');
const tmpDir = path.join(__dirname, '..', 'tmp');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

async function readJson(filePath) {
    return await withLock(filePath, async () => {
        try {
            const data = await fsPromises.readFile(filePath, 'utf8');
            return JSON.parse(data) || [];
        } catch (error) {
            if (filePath.includes('integrations.json')) {
                return { mysoft: {}, aras: {}, luca: {}, b2b: {} };
            }
            return [];
        }
    });
}

async function writeJson(filePath, data) {
    return await withLock(filePath, async () => {
        const tmpPath = path.join(tmpDir, path.basename(filePath) + '.tmp' + Date.now());
        try {
            await fsPromises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
            await fsPromises.rename(tmpPath, filePath);
        } catch (error) {
            if (fs.existsSync(tmpPath)) {
                await fsPromises.unlink(tmpPath);
            }
            throw new Error(`Dosya yazılırken hata oluştu: ${filePath} - ${error.message}`);
        }
    });
}

async function readXml(filePath) {
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

async function writeXml(filePath, jsObject, rootTag) {
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
            await fsPromises.rename(tmpPath, filePath);
        } catch (error) {
            if (fs.existsSync(tmpPath)) {
                await fsPromises.unlink(tmpPath);
            }
            throw new Error(`XML yazılırken hata oluştu: ${filePath} - ${error.message}`);
        }
    });
}

async function appendAuditLog(logEntry) {
    const auditFile = path.join(dataDir, 'audit_logs.json');
    return await withLock(auditFile, async () => {
        let logs = [];
        try {
            const data = await fsPromises.readFile(auditFile, 'utf8');
            logs = JSON.parse(data) || [];
        } catch (e) {
            logs = [];
        }
        
        logs.push(logEntry);
        
        // Keep only last 50,000 logs
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
