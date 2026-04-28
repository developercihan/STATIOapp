const ExcelJS = require('exceljs');

/**
 * Statio - Excel Reporting Service
 * Profesyonel raporlama için ExcelJS motoru.
 */
class ExcelService {
    /**
     * Verilen veriyi Excel dosyasına dönüştürür.
     * @param {Array} data - Yazdırılacak nesne dizisi
     * @param {Array} columns - Sütun tanımları { header, key, width }
     * @param {string} sheetName - Sayfa adı
     */
    async generateExcel(data, columns, sheetName = 'Statio Rapor') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        // Sütunları tanımla
        worksheet.columns = columns;

        // Başlık satırını stilize et
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C3E50' } // Koyu lacivert/gri profesyonel renk
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        // Verileri ekle
        data.forEach(item => {
            const row = worksheet.addRow(item);
            row.alignment = { vertical: 'middle' };
            row.height = 20;
        });

        // Kenarlıkları ekle
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Buffer olarak döndür
        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = new ExcelService();
