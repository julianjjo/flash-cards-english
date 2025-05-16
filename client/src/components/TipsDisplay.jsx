import React from "react";

/**
 * Componente visual para mostrar los tips generados por Gemini.
 * Muestra solo el primer ítem de cada sección y permite expandir para ver más.
 * Props:
 *   - tips: string (JSON generado por Gemini o texto plano)
 *   - className: string (opcional, para estilos extra)
 *   - maxChars: número (opcional, para limitar caracteres en modo compacto)
 */
export default function TipsDisplay({ tips, className = "", maxChars = 0 }) {
  const [expanded, setExpanded] = React.useState(false);
  let parsed = null;
  try {
    parsed = JSON.parse(tips);
  } catch {
    // Si no es JSON, mostrar como texto plano
    const showText = !expanded && maxChars > 0 && tips.length > maxChars ? tips.slice(0, maxChars) + '...' : tips;
    return (
      <div className={`mt-2 text-xs text-gray-700 whitespace-pre-line bg-blue-50 rounded p-2 border border-blue-200 ${className}`}>
        {showText}
        {!expanded && maxChars > 0 && tips.length > maxChars && (
          <button className="ml-2 text-blue-600 underline text-xs" onClick={e => { e.stopPropagation(); setExpanded(true); }}>
            Ver más
          </button>
        )}
      </div>
    );
  }
  // Helper para mostrar solo el primer elemento y expandir
  const showArray = (arr, icon, label) => {
    if (!arr) return null;
    if (!Array.isArray(arr)) arr = [arr];
    if (arr.length === 0) return null;
    const content = arr.join(' | ');
    const showContent = !expanded && maxChars > 0 && content.length > maxChars ? content.slice(0, maxChars) + '...' : content;
    return (
      <div className="mb-1">
        <b>{icon} {label}:</b> {showContent}
        {!expanded && maxChars > 0 && content.length > maxChars && (
          <button className="ml-2 text-blue-600 underline text-xs" onClick={e => { e.stopPropagation(); setExpanded(true); }}>
            Ver más
          </button>
        )}
      </div>
    );
  };
  return (
    <div className={`mt-2 text-xs text-gray-700 bg-blue-50 rounded p-2 border border-blue-200 w-full max-w-lg mx-auto ${className}`}>
      {showArray(parsed.tips, '💡', 'Tips')}
      {showArray(parsed.sinonimos, '🔄', 'Sinónimos')}
      {showArray(parsed.ejemplos, '📝', 'Ejemplo')}
      {parsed.curiosidad && (
        <div className="mb-1"><b>✨ Curiosidad:</b> {(!expanded && maxChars > 0 && parsed.curiosidad.length > maxChars) ? parsed.curiosidad.slice(0, maxChars) + '...' : parsed.curiosidad}
        {!expanded && maxChars > 0 && parsed.curiosidad.length > maxChars && (
          <button className="ml-2 text-blue-600 underline text-xs" onClick={e => { e.stopPropagation(); setExpanded(true); }}>
            Ver más
          </button>
        )}
        </div>
      )}
    </div>
  );
}
