import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
  Timer,
  ShieldCheck,
  Bell,
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  Play,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const TiempoSesionPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [minutosInactividad, setMinutosInactividad] = useState<number>(() => {
    const saved = localStorage.getItem('inactivity_timeout_minutes');
    return saved ? Number(saved) : 10;
  });

  const [avisoPrevio, setAvisoPrevio] = useState<boolean>(() => {
    const saved = localStorage.getItem('inactivity_warning_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [simulando, setSimulando] = useState(false);

  const guardarConfiguracion = () => {
    localStorage.setItem('inactivity_timeout_minutes', String(minutosInactividad));
    localStorage.setItem('inactivity_warning_enabled', String(avisoPrevio));

    Swal.fire({
      title: '¡Configuración Guardada!',
      text: `El tiempo de inactividad de sesión se ha establecido en ${minutosInactividad} minutos.`,
      icon: 'success',
      confirmButtonColor: '#2563eb',
    });
    toast.success('Parámetros de sesión actualizados');
  };

  const simularAlertaExpiracion = () => {
    let timerInterval: any;
    Swal.fire({
      title: '⚠️ ¿Sigues ahí?',
      html: `
        <div class="text-xs text-slate-600 space-y-2">
          <p>Tu sesión expirará en <b><span id="countdownSeconds">60</span> segundos</b> por inactividad prolongada.</p>
          <p>Haz clic en "Continuar Sesión" para mantener tus tareas activas.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Continuar Sesión',
      cancelButtonText: 'Cerrar Sesión Ahora',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      timer: 60000,
      timerProgressBar: true,
      didOpen: () => {
        const span = Swal.getHtmlContainer()?.querySelector('#countdownSeconds');
        timerInterval = setInterval(() => {
          const timerLeft = Swal.getTimerLeft();
          if (span && timerLeft) {
            span.textContent = Math.ceil(timerLeft / 1000).toString();
          }
        }, 1000);
      },
      willClose: () => {
        clearInterval(timerInterval);
      },
    }).then((result) => {
      if (result.isConfirmed) {
        toast.success('Sesión renovada con éxito.');
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Timer className="w-5 h-5 text-blue-600" />
            Configuración de Tiempo de Sesión & Seguridad
          </h2>
          <p className="text-xs text-gray-500">
            Personaliza el tiempo de inactividad antes del cierre automático de sesión y alertas de protección
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={guardarConfiguracion}
            className="btn text-xs font-bold h-9 px-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
          >
            <Save className="w-4 h-4" /> Guardar Cambios
          </button>
        </div>
      </div>

      {/* TARJETA DE CONFIGURACIÓN */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Tiempo de Cierre por Inactividad
              </h3>
              <p className="text-xs text-gray-500">
                Si el usuario no realiza ninguna acción durante este lapso, la sesión se cerrará automáticamente
              </p>
            </div>
          </div>

          <span className="text-xs font-extrabold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            Estado Actual: {minutosInactividad} Minutos
          </span>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Seleccionar Tiempo Límite de Inactividad:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { val: 5, label: '5 Minutos', desc: 'Máxima seguridad bancaria / estaciones compartidas' },
              { val: 10, label: '10 Minutos', desc: 'Recomendado por defecto para uso operativo' },
              { val: 15, label: '15 Minutos', desc: 'Estándar administrativo' },
              { val: 30, label: '30 Minutos', desc: 'Jornadas de carga continua de datos' },
              { val: 60, label: '60 Minutos (1 Hora)', desc: 'Recomendado para equipos exclusivos' },
            ].map((op) => (
              <div
                key={op.val}
                onClick={() => setMinutosInactividad(op.val)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  minutosInactividad === op.val
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 text-xs">{op.label}</span>
                  {minutosInactividad === op.val && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
                <span className="text-[11px] text-gray-500 leading-tight block">{op.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center text-amber-600">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Aviso Previo de Expiración
                </span>
                <span className="text-[11px] text-gray-500">
                  Muestra un temporizador interactivo 60 segundos antes de cerrar sesión para confirmar si el usuario desea continuar
                </span>
              </div>
            </div>

            <input
              type="checkbox"
              checked={avisoPrevio}
              onChange={(e) => setAvisoPrevio(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* PROBAR ALERTA DE SESIÓN */}
        <div className="border-t border-gray-100 pt-5 flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-slate-700">
              ¿Deseas verificar cómo se visualiza el aviso de inactividad?
            </span>
          </div>

          <button
            type="button"
            onClick={simularAlertaExpiracion}
            className="btn btn-outline text-xs font-bold h-8 px-3 flex items-center gap-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-white"
          >
            <Play className="w-3.5 h-3.5 text-blue-600" /> Probar Aviso en Vivo
          </button>
        </div>
      </div>
    </div>
  );
};

export default TiempoSesionPage;
