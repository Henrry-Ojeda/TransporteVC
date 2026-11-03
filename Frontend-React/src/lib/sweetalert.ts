import Swal, { type SweetAlertOptions, type SweetAlertResult } from 'sweetalert2';

/**
 * Muestra un diálogo modal moderno de confirmación con SweetAlert2.
 * Devuelve `true` si el usuario presiona confirmar, `false` en caso contrario.
 */
export async function confirmDialog(options: {
  title?: string;
  text?: string;
  html?: string;
  icon?: 'warning' | 'question' | 'info' | 'error' | 'success';
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  danger?: boolean;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title || '¿Estás seguro?',
    text: options.text,
    html: options.html,
    icon: options.icon || (options.danger !== false ? 'warning' : 'question'),
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText || (options.danger ? 'Sí, continuar' : 'Aceptar'),
    cancelButtonText: options.cancelButtonText || 'Cancelar',
    confirmButtonColor: options.confirmButtonColor || (options.danger ? '#ef4444' : '#2563eb'),
    cancelButtonColor: options.cancelButtonColor || '#64748b',
    reverseButtons: true,
    focusCancel: true,
    background: '#ffffff',
    color: '#0f172a',
  });

  return result.isConfirmed;
}

/**
 * Atajo para confirmaciones de desactivación o eliminación de registros.
 */
export async function confirmDeleteOrDeactivate(
  actionDescription: string,
  itemName?: string
): Promise<boolean> {
  const title = itemName ? `¿${actionDescription} "${itemName}"?` : `¿${actionDescription}?`;
  return confirmDialog({
    title,
    text: 'Esta acción actualizará el estado del registro en el sistema.',
    icon: 'warning',
    confirmButtonText: 'Sí, proceder',
    cancelButtonText: 'Cancelar',
    danger: true,
  });
}

/**
 * Atajo para alertas informativas o de éxito.
 */
export async function alertSuccess(title: string, text?: string): Promise<void> {
  await Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#10b981',
    background: '#ffffff',
    color: '#0f172a',
  });
}

/**
 * Atajo para alertas de error.
 */
export async function alertError(title: string, text?: string): Promise<void> {
  await Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Cerrar',
    confirmButtonColor: '#ef4444',
    background: '#ffffff',
    color: '#0f172a',
  });
}

export { Swal };
export default Swal;
