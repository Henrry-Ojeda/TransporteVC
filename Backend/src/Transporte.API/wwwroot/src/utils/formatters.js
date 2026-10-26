// ==========================================================================
// UTILIDADES PURAS DE FORMATEO (Strangler Fig Refactor)
// ==========================================================================

function capitalizarTexto(str) {
    if (!str || typeof str !== 'string') return str || '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    if (/^(CI|C\.I|RIF|USD|BS|ID|LT|LTS|N\/A)$/i.test(trimmed)) return trimmed.toUpperCase();
    return trimmed
        .toLowerCase()
        .replace(/(?:^|[\s\(\[\{\/\-])([a-záéíóúñ])/gi, (match) => match.toUpperCase());
}

function formatearTextoSemana(s) {
    if (!s) return 'N/A';
    if (typeof s === 'string') {
        const parts = s.split('(');
        if (parts.length > 2) {
            return `${parts[0].trim()} (${parts[1].split(')')[0].trim()})`;
        }
        return s;
    }
    const cod = String(s.codigo || s.Codigo || s.nombre || s.Nombre || `Semana #${s.id || s.Id || ''}`).trim();
    const fIni = (s.fechaInicio || s.FechaInicio || '').split('T')[0];
    const fFin = (s.fechaFin || s.FechaFin || '').split('T')[0];
    
    if (fIni && fFin) {
        const codLimpio = cod.split('(')[0].trim();
        return `${codLimpio} (${fIni} al ${fFin})`;
    }
    
    const parts = cod.split('(');
    if (parts.length > 2) {
        return `${parts[0].trim()} (${parts[1].split(')')[0].trim()})`;
    }
    return cod;
}

function formatearFechaLocal(fechaStr) {
    if (!fechaStr) return '';
    return fechaStr.split('T')[0];
}

function formatearNumero(num, decimales = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('es-VE', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}

function formatearFechaTicket(fechaStr) {
    if (!fechaStr) return 'Sin fecha';
    try {
        const clean = fechaStr.split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return clean;
    } catch(e) {
        return fechaStr;
    }
}

function formatearMarkdownAnalista(texto) {
    if (!texto) return '';
    let html = texto;

    // Encabezados
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 12px 0 6px 0; color: #38bdf8; font-size: 14.5px; font-weight: 800; letter-spacing: -0.01em;">$1</h4>');
    html = html.replace(/^#### (.*$)/gim, '<h5 style="margin: 10px 0 4px 0; color: #a5f3fc; font-size: 13.5px; font-weight: 700;">$1</h5>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 14px 0 8px 0; color: #60a5fa; font-size: 16px; font-weight: 800;">$1</h3>');

    // Negritas e itálicas
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #f8fafc; font-weight: 700;">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1;">$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(15, 23, 42, 0.6); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 12.5px; border: 1px solid rgba(56, 189, 248, 0.2); font-family: monospace;">$1</code>');

    // Listas con viñetas
    html = html.replace(/^[*-] (.*$)/gim, '<div style="display: flex; gap: 6px; margin-bottom: 4px;"><span style="color: #38bdf8; font-weight: 800;">&bull;</span><span>$1</span></div>');

    // Listas numeradas
    html = html.replace(/^(\d+)\. (.*$)/gim, '<div style="display: flex; gap: 8px; margin-bottom: 5px; align-items: flex-start;"><span style="background: #2563eb; color: #fff; font-size: 11px; font-weight: 800; min-width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-top: 2px;">$1</span><span>$2</span></div>');

    // Saltos de línea
    html = html.replace(/\n/g, '<br>');

    return html;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Exportación global en Browser
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.capitalizarTexto = capitalizarTexto;
    window.formatearTextoSemana = formatearTextoSemana;
    window.formatearFechaLocal = formatearFechaLocal;
    window.formatearNumero = formatearNumero;
    window.formatearFechaTicket = formatearFechaTicket;
    window.formatearMarkdownAnalista = formatearMarkdownAnalista;
}

// Exportación modular para bundlers / Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        capitalizarTexto,
        formatearTextoSemana,
        formatearFechaLocal,
        formatearNumero,
        formatearFechaTicket,
        formatearMarkdownAnalista
    };
}
