const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const fsPromises = require('fs/promises');

async function parseXmlFile(filePath) {
    try {
        const data = await fsPromises.readFile(filePath, 'utf8');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        return parser.parse(data);
    } catch (e) {
        throw new Error('XML parsing failed: ' + e.message);
    }
}

function buildXmlString(jsObject) {
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        suppressEmptyNode: true
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(jsObject)}`;
}

function validateProductXml(parsed) {
    if (!parsed) return false;
    // urunler veya Urunler, urun veya Urun kontrolü
    const root = parsed.urunler || parsed.Urunler;
    if (!root) return false;
    if (!root.urun && !root.Urun) return false;
    return true;
}

function validateDistributorXml(parsed) {
    if (!parsed) return false;
    const root = parsed.distributorler || parsed.Distributorler;
    if (!root) return false;
    if (!root.distributor && !root.Distributor) return false;
    return true;
}

function validateCompanyXml(parsed) {
    if (!parsed) return false;
    const root = parsed.kurumlar || parsed.Kurumlar;
    if (!root) return false;
    if (!root.kurum && !root.Kurum) return false;
    return true;
}

function getProducts(parsed) {
    if (!parsed) return [];
    const root = parsed.urunler || parsed.Urunler;
    if (!root) return [];
    const list = root.urun || root.Urun;
    return Array.isArray(list) ? list : (list ? [list] : []);
}

function getDistributors(parsed) {
    if (!parsed) return [];
    const root = parsed.distributorler || parsed.Distributorler;
    if (!root) return [];
    const list = root.distributor || root.Distributor;
    return Array.isArray(list) ? list : (list ? [list] : []);
}

function getCompanies(parsed) {
    if (!parsed) return [];
    const root = parsed.kurumlar || parsed.Kurumlar;
    if (!root) return [];
    const list = root.kurum || root.Kurum;
    return Array.isArray(list) ? list : (list ? [list] : []);
}

module.exports = {
    parseXmlFile,
    buildXmlString,
    validateProductXml,
    validateDistributorXml,
    validateCompanyXml,
    getProducts,
    getDistributors,
    getCompanies
};
