const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const plantillasDir = path.join(__dirname, 'plantillas');
if (!fs.existsSync(plantillasDir)) {
    fs.mkdirSync(plantillasDir, { recursive: true });
}

const templatesData = {
    FINCAS: {
        filename: 'Plantilla_Importacion_FINCAS',
        sheetName: 'Fincas',
        rows: [
            ['CODIGO', 'NOMBRE_FINCA', 'PROPIETARIO', 'CEDULA_RIF', 'TELEFONO', 'BANCO', 'NUMERO_CUENTA', 'COMPANIA_RECEPTORIA', 'PRECIO_LITRO_USD', 'PRECIO_ACIDA_USD', 'TIPO_LECHE', 'TIENE_DOS_TIPOS_LECHE'],
            ['F-101', 'Hacienda La Esperanza', 'Juan Carlos Perez', 'V-12345678', '0414-1234567', 'BANCO DE VENEZUELA', '01020123456789012345', 'RECEPTORIA CENTRAL', 0.4200, 0.0000, 'VACA', 'NO'],
            ['F-102', 'Finca El Porvenir', 'Maria Rodriguez', 'V-87654321', '0412-9876543', 'BANESCO', '01340123456789012345', 'COLONA', 0.4500, 0.0000, 'BUFALA', 'NO'],
            ['F-103', 'Agropecuaria Santa Maria', 'Carlos Gomez', 'J-123456789', '0416-5554321', 'MERCANTIL', '01050123456789012345', 'RECEPTORIA CENTRAL', 0.4200, 0.0000, 'AMBAS', 'SI']
        ]
    },
    PROPIETARIOS: {
        filename: 'Plantilla_Importacion_PROPIETARIOS',
        sheetName: 'Propietarios',
        rows: [
            ['NOMBRE_COMPLETO', 'CEDULA_RIF', 'TELEFONO', 'EMAIL', 'BANCO', 'NUMERO_CUENTA', 'OBSERVACION'],
            ['Juan Carlos Perez', 'V-12345678', '0414-1234567', 'juanperez@gmail.com', 'BANCO DE VENEZUELA', '01020123456789012345', 'Titular principal Hacienda La Esperanza'],
            ['Maria Rodriguez', 'V-87654321', '0412-9876543', 'mrodriguez@gmail.com', 'BANESCO', '01340123456789012345', 'Pago Móvil activo al mismo teléfono'],
            ['Carlos Gomez', 'J-123456789', '0416-5554321', 'cgomez@agropecuaria.com', 'MERCANTIL', '01050123456789012345', 'Cuenta jurídica']
        ]
    },
    COMPANIAS: {
        filename: 'Plantilla_Importacion_COMPANIAS',
        sheetName: 'Companias',
        rows: [
            ['NOMBRE_COMPANIA', 'ENCARGADO', 'TELEFONO', 'DIRECCION', 'PRECIO_COMPRA_USD', 'PRECIO_BUFALA_USD', 'PRECIO_ACIDA_USD'],
            ['RECEPTORIA CENTRAL', 'Ing. Roberto Silva', '0414-9988776', 'Carretera Nacional Km 12', 0.4800, 0.5200, 0.0000],
            ['COLONA', 'Lic. Carmen Morales', '0412-3344556', 'Zona Industrial Sector B', 0.5000, 0.5500, 0.0000],
            ['PLANTA SAN ANTONIO', 'Dr. Manuel Vargas', '0424-7766554', 'Av. Intercomunal Galpón 4', 0.4900, 0.5300, 0.0000]
        ]
    },
    BANCOS: {
        filename: 'Plantilla_Importacion_BANCOS',
        sheetName: 'Bancos',
        rows: [
            ['CODIGO_BANCO', 'NOMBRE_BANCO'],
            ['0102', 'BANCO DE VENEZUELA'],
            ['0134', 'BANESCO'],
            ['0105', 'MERCANTIL'],
            ['0108', 'PROVINCIAL BBVA'],
            ['0172', 'BANCAMIGA']
        ]
    }
};

for (const [key, item] of Object.entries(templatesData)) {
    // 1. Generar archivo .xlsx físico
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(item.rows);
    
    // Autoancho
    const colWidths = item.rows[0].map((h, i) => {
        let maxLen = h.length;
        item.rows.forEach(r => {
            if (r[i] != null) {
                const s = String(r[i]);
                if (s.length > maxLen) maxLen = s.length;
            }
        });
        return { wch: Math.max(maxLen + 4, 16) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, item.sheetName);
    const xlsxPath = path.join(plantillasDir, `${item.filename}.xlsx`);
    XLSX.writeFile(wb, xlsxPath);
    console.log(`✅ Creada plantilla XLSX: ${xlsxPath}`);

    // 2. Generar archivo .csv físico (con UTF-8 BOM)
    const csvContent = item.rows.map(r => r.map(c => {
        let val = c == null ? '' : String(c);
        if (val.includes(';') || val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
    }).join(';')).join('\r\n');

    const csvPath = path.join(plantillasDir, `${item.filename}.csv`);
    fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8');
    console.log(`✅ Creada plantilla CSV: ${csvPath}`);
}

console.log('🎉 Todas las plantillas físicas generadas correctamente en plantillas/.');
