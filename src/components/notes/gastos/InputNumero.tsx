// ============================================================
//  InputNumero
// ------------------------------------------------------------
//  <input type="number"> que guarda lo TIPEADO como texto local y avisa
//  el numero aparte. Con un input controlado directo por el numero,
//  React borra lo que estas escribiendo: "0" (para tipear "0,5") se
//  vuelve vacio, y un valor invalido a medio escribir vacia el campo.
//
//  Si el valor guardado cambia desde afuera (cerrar mes, deshacer, otro
//  renglon), el texto se re-sincroniza; mientras el texto tipeado
//  equivalga al valor guardado, se respeta tal cual.
// ============================================================
import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  valor: number | undefined; // valor guardado (0 o undefined = vacio)
  onValor: (n: number | undefined) => void; // undefined si el texto no es un numero
};

function aTexto(valor: number | undefined): string {
  return valor ? String(valor) : "";
}

function aNumero(texto: string): number | undefined {
  const n = parseFloat(texto);
  return Number.isFinite(n) ? n : undefined;
}

export function InputNumero({ valor, onValor, ...rest }: Props) {
  const [texto, setTexto] = useState(() => aTexto(valor));
  // Re-sincroniza durante el render (patron recomendado por React para
  // "estado derivado de props"): solo si lo guardado ya no coincide con lo
  // tipeado. Asi "0", "0." o "1e" quedan en pantalla mientras escribis.
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    if ((aNumero(texto) || 0) !== (valor || 0)) setTexto(aTexto(valor));
  }

  return (
    <input
      {...rest}
      type="number"
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        onValor(aNumero(e.target.value));
      }}
      onBlur={(e) => {
        // Al salir, si lo tipeado no se guardo (p. ej. un dia 35 que el
        // padre rechazo), se vuelve a mostrar lo guardado.
        if ((aNumero(texto) || 0) !== (valor || 0)) setTexto(aTexto(valor));
        rest.onBlur?.(e);
      }}
    />
  );
}
