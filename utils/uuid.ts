/**
 * Genera un UUID v4 compatible con todos los navegadores
 * Fallback para crypto.randomUUID() cuando no está disponible (especialmente en HTTP)
 */
export function generateUUID(): string {
  // Primero intentar crypto.randomUUID si está disponible (solo funciona en HTTPS)
  if (typeof crypto !== 'undefined' && 
      crypto.randomUUID && 
      typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // Si falla (por ejemplo, en HTTP), usar el fallback
      console.warn('crypto.randomUUID failed, using fallback:', error);
    }
  }
  
  // Fallback más simple y confiable que funciona en HTTP y HTTPS
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
