// ==========================================================================
// CHATBOT ASISTENTE VIRTUAL ANALISTA DE DATOS
// ==========================================================================
function escaparHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escaparHTML = escaparHTML;

function toggleChatbotWindow() {
    const chatWin = document.getElementById('chatbotWindow');
    if (!chatWin) return;
    chatWin.classList.toggle('hidden');
    if (!chatWin.classList.contains('hidden')) {
        restaurarHistorialChatbot();
        const input = document.getElementById('inputChatbot');
        if (input) input.focus();
    }
}
window.toggleChatbotWindow = toggleChatbotWindow;

function getPlantillaBienvenidaChatbot() {
    return `
        <div class="chat-message bot">
            <div class="chat-avatar-mini"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-bubble">
                <div class="chat-sender">Asistente Virtual & Analista IA</div>
                <div class="chat-content">
                    ¡Hola! 👋 Soy tu **Asistente Virtual y Consultor Experto** de Transporte. Conozco todos los procesos del sistema, flujos paso a paso, auditoría, reversión de errores y análisis de datos en tiempo real.
                    <br><br>
                    <strong>¿En qué puedo guiarte hoy?</strong> Selecciona un proceso rápido o escribe cualquier duda:
                </div>
                <div class="chatbot-quick-pills" id="chatbotQuickPills" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;">
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('🚀 ¿Cómo registrar un nuevo viaje o ruta de recolección en fincas?')">🚀 Registrar Ruta</button>
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('🥛 ¿Cómo recibir un camión en receptoría y medir mermas?')">🥛 Recepción & Tanque</button>
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('💰 ¿Cómo liquidar y procesar pagos a choferes y empleados?')">💰 Pagos & Nómina</button>
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('↩️ ¿Cómo revertir, anular o corregir un error en el sistema?')">↩️ Revertir Errores</button>
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('🔄 ¿Cómo hacer un traspaso de leche entre camiones?')">🔄 Traspasos</button>
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('💳 ¿Cómo otorgar y descontar un adelanto o préstamo?')">💳 Adelantos</button>
                    <button class="quick-pill" onclick="enviarSugerenciaChatbot('📊 Diagnóstico general del ciclo operativo actual')">📊 Diagnóstico BD</button>
                </div>
            </div>
        </div>
    `;
}

function guardarHistorialChatbot() {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    try {
        localStorage.setItem('transporte_chat_history_v2', container.innerHTML);
    } catch (e) {
        console.warn('No se pudo guardar historial del chat:', e);
    }
}

function restaurarHistorialChatbot() {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    try {
        const guardado = localStorage.getItem('transporte_chat_history_v2');
        if (guardado && guardado.trim().length > 50) {
            container.innerHTML = guardado;
            container.scrollTop = container.scrollHeight;
        } else if (!container.innerHTML || container.innerHTML.trim() === '') {
            container.innerHTML = getPlantillaBienvenidaChatbot();
        }
    } catch (e) {
        console.warn('Error al restaurar historial del chat:', e);
    }
}
window.restaurarHistorialChatbot = restaurarHistorialChatbot;

function limpiarConversacionChatbot() {
    Swal.fire({
        title: '¿Reiniciar Conversación?',
        text: 'Se borrará el historial del chat y comenzará una nueva sesión.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, reiniciar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    }).then(res => {
        if (res.isConfirmed) {
            try {
                localStorage.removeItem('transporte_chat_history_v2');
            } catch (e) {}
            const container = document.getElementById('chatbotMessages');
            if (container) {
                container.innerHTML = getPlantillaBienvenidaChatbot();
            }
            showToast('Historial del chat reiniciado.', 'info');
        }
    });
}
window.limpiarConversacionChatbot = limpiarConversacionChatbot;

let chatbotEnviando = false;

function enviarSugerenciaChatbot(texto) {
    if (chatbotEnviando) return;
    const input = document.getElementById('inputChatbot');
    if (input) input.value = texto;
    enviarMensajeChatbot();
}
window.enviarSugerenciaChatbot = enviarSugerenciaChatbot;

async function enviarMensajeChatbot(e) {
    if (e) {
        e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
    }

    if (chatbotEnviando) return;

    const input = document.getElementById('inputChatbot');
    const container = document.getElementById('chatbotMessages');
    const btnSend = document.getElementById('btnEnviarChatbot');
    if (!input || !container) return;

    const mensaje = input.value.trim();
    if (!mensaje) return;

    chatbotEnviando = true;
    input.disabled = true;
    if (btnSend) btnSend.disabled = true;

    // 1. Mostrar mensaje del usuario
    const userMsgHtml = `
        <div class="chat-message user">
            <div class="chat-bubble">
                <div class="chat-sender" style="color: #ffffff;">TÚ</div>
                <div class="chat-content">${escaparHTML(mensaje)}</div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', userMsgHtml);
    input.value = '';
    container.scrollTop = container.scrollHeight;
    guardarHistorialChatbot();

    // 2. Indicador de Carga
    const typingId = `typing_${Date.now()}`;
    const typingHtml = `
        <div class="chat-message bot" id="${typingId}">
            <div class="chat-avatar-mini"><i class="fa-solid fa-brain"></i></div>
            <div class="chat-bubble" style="background: #1e293b; color: #94a3b8;">
                <div class="chat-sender">Analista de Datos IA</div>
                <div class="chat-content" style="font-style: italic;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Consultando Base de Datos SQL y analizando métricas...
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', typingHtml);
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/chat/analizar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ mensaje })
        });

        const typingElem = document.getElementById(typingId);
        if (typingElem) typingElem.remove();

        if (!res.ok) throw new Error('Error consultando al Analista de Datos Virtual.');

        const data = await res.json();
        const markdownFormateado = formatearMarkdownAnalista(data.respuesta || 'Sin respuesta del sistema.');

        let problemasHtml = '';
        if (data.problemasDetectados && data.problemasDetectados.length > 0) {
            problemasHtml = `
                <div class="chatbot-alert-box">
                    <strong style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Problemas Detectados:</strong>
                    <ul style="margin: 4px 0 0 16px; padding: 0;">
                        ${data.problemasDetectados.map(p => `<li>${escaparHTML(p)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        let sugerenciasHtml = '';
        if (data.sugerencias && data.sugerencias.length > 0) {
            sugerenciasHtml = `
                <div class="chatbot-tip-box">
                    <strong style="color: #10b981;"><i class="fa-solid fa-lightbulb"></i> Recomendaciones del Analista:</strong>
                    <ul style="margin: 4px 0 0 16px; padding: 0;">
                        ${data.sugerencias.map(s => `<li>${escaparHTML(s)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Sugerencias rápidas para preguntas de seguimiento continuo
        const pillsSeguimiento = `
            <div class="chatbot-quick-pills" style="margin-top: 10px;">
                <button class="quick-pill" onclick="enviarSugerenciaChatbot('📊 Diagnóstico General del Ciclo')">📊 Diagnóstico General</button>
                <button class="quick-pill" onclick="enviarSugerenciaChatbot('⚠️ ¿Dónde están los mayores problemas de merma?')">⚠️ Mermas</button>
                <button class="quick-pill" onclick="enviarSugerenciaChatbot('💰 Estado de adelantos y préstamos pendientes')">💰 Adelantos</button>
                <button class="quick-pill" onclick="enviarSugerenciaChatbot('🧪 Leche Ácida y Pérdidas de Calidad')">🧪 Leche Ácida</button>
            </div>
        `;

        const botMsgHtml = `
            <div class="chat-message bot">
                <div class="chat-avatar-mini"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-bubble">
                    <div class="chat-sender">Analista de Datos IA</div>
                    <div class="chat-content">
                        ${markdownFormateado}
                        ${problemasHtml}
                        ${sugerenciasHtml}
                        ${pillsSeguimiento}
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', botMsgHtml);
        container.scrollTop = container.scrollHeight;
        guardarHistorialChatbot();
    } catch (err) {
        const typingElem = document.getElementById(typingId);
        if (typingElem) typingElem.remove();

        const errHtml = `
            <div class="chat-message bot">
                <div class="chat-avatar-mini"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="chat-bubble" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444;">
                    <div class="chat-sender" style="color: #ef4444;">Analista IA - Error</div>
                    <div class="chat-content" style="color: #fca5a5;">
                        No se pudo procesar la consulta: ${escaparHTML(err.message)}
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', errHtml);
        container.scrollTop = container.scrollHeight;
        guardarHistorialChatbot();
    } finally {
        chatbotEnviando = false;
        input.disabled = false;
        if (btnSend) btnSend.disabled = false;
        setTimeout(() => input.focus(), 50);
    }
}
window.enviarMensajeChatbot = enviarMensajeChatbot;

var formatearMarkdownAnalista = window.formatearMarkdownAnalista;
