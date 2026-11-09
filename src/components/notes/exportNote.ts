// ============================================================
//  exportNote
// ------------------------------------------------------------
//  Descarga una nota. Segun su tipo:
//   - nota normal -> .txt: el HTML del cuerpo pasado a texto plano,
//     con el titulo arriba.
//   - nota de gastos -> .xls: una planilla con una tabla por lista
//     (pagado, concepto, cuota, monto), subtotales, el resumen del mes
//     (ingresos, gastos, saldo) y el historial de meses cerrados. Es un .xls "sin dependencias": un documento HTML
//     que Excel/Sheets abren como planilla con columnas reales.
//  Se usa desde el menu de acciones (editor y clic derecho de la lista).
// ============================================================
import type { GastoLista, Note, ResumenMes } from "../../types";
import {
  esMesValido,
  formatMonto,
  neto,
  nombreMes,
  parseGastos,
  resumen,
  subtotalLista,
} from "../../lib/gastos";

export function exportNote(note: Note) {
  if (note.kind === "gastos") {
    exportGastos(note);
    return;
  }
  exportTexto(note);
}

// Nombre de archivo seguro a partir del titulo de la nota.
function nombreArchivo(note: Note): string {
  return (note.title.trim() || "nota").replace(/[\\/:*?"<>|]/g, "_");
}

// Dispara la descarga de un Blob con el nombre indicado.
function descargar(contenido: string, tipo: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Nota normal -> .txt -------------------------------------
function exportTexto(note: Note) {
  const cuerpo =
    new DOMParser().parseFromString(note.content, "text/html").body
      .textContent ?? "";
  const texto = `${note.title}\n\n${cuerpo}`.trim() + "\n";
  descargar(texto, "text/plain;charset=utf-8", `${nombreArchivo(note)}.txt`);
}

// --- Nota de gastos -> .xls ----------------------------------
// Escapa texto para meterlo en HTML sin romper la tabla.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Una tabla por lista: encabezado, renglones y fila de subtotal. El monto va
// en moneda local con signo (los ingresos en negativo, igual que el subtotal);
// si el renglon es en dolares, el original queda anotado en el concepto.
function tablaLista(lista: GastoLista, cotizacionUSD: number): string {
  const filas = lista.renglones
    .map((r) => {
      const usd = r.moneda === "USD" ? ` (US$ ${formatMonto(Math.abs(r.monto))})` : "";
      const cuota = r.cuota ? `${r.cuota.actual}/${r.cuota.total}` : "";
      return `
      <tr>
        <td style="text-align:center">${r.pagado ? "Sí" : "No"}</td>
        <td>${esc(r.concepto)}${esc(usd)}</td>
        <td style="text-align:center;mso-number-format:'\\@'">${cuota}</td>
        <td class="num">${neto(r, cotizacionUSD)}</td>
      </tr>`;
    })
    .join("");

  return `
    <h2>${esc(lista.titulo || "Lista")}</h2>
    <table>
      <tr>
        <th>Pagado</th>
        <th>Concepto</th>
        <th>Cuota</th>
        <th>Monto</th>
      </tr>
      ${filas}
      <tr class="subtotal">
        <td></td>
        <td>Subtotal</td>
        <td></td>
        <td class="num">${subtotalLista(lista, cotizacionUSD)}</td>
      </tr>
    </table>`;
}

// Tabla con el historial de meses cerrados (del mas nuevo al mas viejo).
function tablaHistorial(historial: ResumenMes[]): string {
  if (historial.length === 0) return "";
  const filas = [...historial]
    .reverse()
    .map(
      (h) => `
      <tr>
        <td>${esc(nombreMes(h.mes))}</td>
        <td class="num">${h.ingresos}</td>
        <td class="num">${h.gastos}</td>
        <td class="num">${h.saldo}</td>
      </tr>`
    )
    .join("");
  return `
    <h2>Historial</h2>
    <table>
      <tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Saldo</th></tr>
      ${filas}
    </table>`;
}

function exportGastos(note: Note) {
  const data = parseGastos(note.content);
  const cot = data.cotizacionUSD ?? 0;
  const tablas = data.listas.map((l) => tablaLista(l, cot)).join("");
  const res = resumen(data);
  const mes = esMesValido(data.mes) ? ` — ${nombreMes(data.mes)}` : "";
  const cotizacion = cot > 0 ? `<p>Cotización: US$ 1 = ${formatMonto(cot)}</p>` : "";

  // Documento HTML que Excel reconoce como planilla. La clase .num usa
  // mso-number-format para que los montos se muestren con 2 decimales y
  // separador de miles, y Excel los trate como numeros (no como texto).
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #999; padding: 4px 8px; }
    th { background: #eee; text-align: left; }
    .num { text-align: right; mso-number-format:"#,##0.00"; }
    .subtotal td { font-weight: bold; }
    .total { font-size: 14px; font-weight: bold; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>${esc(note.title || "Gastos")}${esc(mes)}</h1>
  ${cotizacion}
  ${tablas}
  <p class="total">${
    res.ingresos > 0
      ? `Ingresos: ${formatMonto(res.ingresos)} · Gastos: ${formatMonto(res.gastos)} · Saldo: ${formatMonto(res.saldo)}`
      : `Total gastos: ${formatMonto(res.gastos)}`
  } · Falta pagar: ${formatMonto(res.pendiente)}</p>
  ${tablaHistorial(data.historial ?? [])}
</body>
</html>`;

  descargar(
    html,
    "application/vnd.ms-excel;charset=utf-8",
    `${nombreArchivo(note)}.xls`
  );
}
