// ==========================================================================
// MÓDULO DE LIQUIDACIONES, COMPROBANTES Y RELACIÓN DE COMPRA PARA FINCAS
// ==========================================================================

/**
 * Copia el detalle formateado de compra de leche al portapapeles para WhatsApp.
 * 
 * @param {string} texto - Texto formateado con emojis para enviar por WhatsApp.
 */
async function copiarDetalleLiquidacionWhatsApp(texto) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = texto;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
        Swal.fire({
            icon: 'success',
            title: '¡Copiado para WhatsApp!',
            text: 'La relación detallada de leche se ha copiado al portapapeles.',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    } catch (err) {
        console.error('Error al copiar al portapapeles:', err);
        Swal.fire({
            icon: 'info',
            title: 'Texto para WhatsApp',
            html: `<textarea style="width: 100%; height: 250px; font-family: monospace; font-size: 12px; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">${texto}</textarea>`,
            confirmButtonText: 'Cerrar'
        });
    }
}

/**
 * Captura el recibo o relación de compra en formato imagen y la copia directamente al portapapeles.
 */
async function descargarImagenRecibo() {
    const el = document.getElementById('areaImpresionReciboPago');
    if (!el) {
        Swal.fire({ icon: 'warning', title: 'Atención', text: 'No se encontró el comprobante para generar la imagen.' });
        return;
    }
    if (typeof html2canvas !== 'function') {
        Swal.fire({ icon: 'error', title: 'Error', text: 'La librería html2canvas no está disponible.' });
        return;
    }

    if (typeof ejecutarCapturaReporte === 'function') {
        await ejecutarCapturaReporte(el, 'Comprobante_Pago', '#ffffff');
    } else {
        try {
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (navigator.clipboard && window.ClipboardItem && blob) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                Swal.fire({
                    icon: 'success',
                    title: '¡Captura copiada!',
                    text: 'La imagen del recibo se copió al portapapeles. Puedes pegarla con Ctrl + V.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error('Error capturando recibo:', err);
        }
    }
}

/**
 * Abre el diálogo de impresión nativo del navegador enfocándose exclusivamente en el área del recibo.
 */
function imprimirReciboPago() {
    window.print();
}

/**
 * Obtiene el rango de fechas de la semana en formato legible.
 * 
 * @param {Object} item - Objeto con información del ciclo o semana.
 * @returns {string} Texto formateado de la semana.
 */
function obtenerPeriodoSemanaTexto(item) {
    if (typeof state !== 'undefined' && state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
        return `Semanas Unificadas (${state.ciclosMultiLiquidacion.join(' + ')})`;
    }
    if (!item) return 'Semana Activa';
    if (item.semanasUnificadas || item.SemanasUnificadas) return `Semanas: ${item.semanasUnificadas || item.SemanasUnificadas}`;
    if (item.semanaTexto) return item.semanaTexto;
    if (item.semanaNumero || item.SemanaNumero) {
        const num = item.semanaNumero || item.SemanaNumero;
        const fIni = (item.fechaInicioCiclo || item.FechaInicioCiclo || item.fechaInicio || '').split('T')[0];
        const fFin = (item.fechaFinCiclo || item.FechaFinCiclo || item.fechaFin || '').split('T')[0];
        if (fIni && fFin) return `Semana ${num} (${fIni} al ${fFin})`;
        return `Semana ${num}`;
    }
    return 'Semana Activa';
}

// Exportación global en Browser
if (typeof window !== 'undefined') {
    window.copiarDetalleLiquidacionWhatsApp = copiarDetalleLiquidacionWhatsApp;
    window.descargarImagenRecibo = descargarImagenRecibo;
    window.imprimirReciboPago = imprimirReciboPago;
    window.obtenerPeriodoSemanaTexto = obtenerPeriodoSemanaTexto;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        copiarDetalleLiquidacionWhatsApp,
        descargarImagenRecibo,
        imprimirReciboPago,
        obtenerPeriodoSemanaTexto
    };
}
