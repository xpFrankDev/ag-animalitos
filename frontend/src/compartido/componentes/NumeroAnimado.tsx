import { useEffect, useState } from 'react';

export function NumeroAnimado({ valor, formato = (numero: number) => numero.toFixed(2) }: { valor: number; formato?: (numero: number) => string }) {
  const [visible, establecerVisible] = useState(0);
  useEffect(() => { const inicio = performance.now(); let marco = 0; const animar = (ahora: number) => { const avance = Math.min(1, (ahora - inicio) / 3_000); establecerVisible(valor * (1 - ((1 - avance) ** 3))); if (avance < 1) marco = requestAnimationFrame(animar); }; marco = requestAnimationFrame(animar); return () => cancelAnimationFrame(marco); }, [valor]);
  return <>{formato(visible)}</>;
}
