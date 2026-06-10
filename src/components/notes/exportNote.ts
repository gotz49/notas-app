// ============================================================
//  exportNote
// ------------------------------------------------------------
//  Descarga una nota. Segun su tipo:
//   - nota normal -> .txt: el HTML del cuerpo pasado a texto plano,
//     con el titulo arriba.
//   - nota de gastos -> .xls: una planilla con una tabla por lista
//     (concepto, monto, pagado), subtotales y total general ya
//     calculados. Es un .xls "sin dependencias": un documento HTML
//     que Excel/Sheets abren como planilla con columnas reales.
//  Se usa desde el menu de acciones (editor y clic derecho de la lista).
// ============================================================
import type { GastoLista, Note } from "../../types";
import {
  formatMonto,
  parseGastos,
  subtotalLista,
  totalGeneral,
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

// Una tabla por lista: encabezado, renglones y fila de subtotal.
function tablaLista(lista: GastoLista): string {
  const filas = lista.renglones
    .map(
      (r) => `
      <tr>
        <td style="text-align:center">${r.pagado ? "Sí" : "No"}</td>
        <td>${esc(r.concepto)}</td>
        <td class="num">${r.monto || 0}</td>
      </tr>`
    )
    .join("");

  return `
    <h2>${esc(lista.titulo || "Lista")}</h2>
    <table>
      <tr>
        <th>Pagado</th>
        <th>Concepto</th>
        <th>Monto</th>
      </tr>
      ${filas}
      <tr class="subtotal">
        <td></td>
        <td>Subtotal</td>
        <td class="num">${subtotalLista(lista)}</td>
      </tr>
    </table>`;
}

function exportGastos(note: Note) {
  const data = parseGastos(note.content);
  const tablas = data.listas.map(tablaLista).join("");

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
  <h1>${esc(note.title || "Gastos")}</h1>
  ${tablas}
  <p class="total">Total general: ${formatMonto(totalGeneral(data))}</p>
</body>
</html>`;

  descargar(
    html,
    "application/vnd.ms-excel;charset=utf-8",
    `${nombreArchivo(note)}.xls`
  );
}
