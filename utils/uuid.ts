/**
 * Genera un UUID v4 compatible con todos los navegadores
 * Fallback para crypto.randomUUID() cuando no está disponible
 */
export function generateUUID(): string {
  // Si crypto.randomUUID está disponible, usarlo
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: generar UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
