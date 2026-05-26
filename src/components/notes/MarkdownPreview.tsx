// ============================================================
//  MarkdownPreview
// ------------------------------------------------------------
//  Convierte el texto Markdown en HTML formateado.
//  Usa la libreria "react-markdown" + "remark-gfm" (que agrega
//  tablas, listas de tareas, etc. estilo GitHub).
// ============================================================
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return null;
  }
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  );
}
