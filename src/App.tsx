// ============================================================
//  App  (componente raiz que orquesta todo)
// ------------------------------------------------------------
//  Decide que mostrar segun el estado:
//   - cargando sesion        -> spinner
//   - sin usuario logueado   -> formulario de login
//   - usuario logueado       -> lista de notas + editor
//
//  Tambien concentra el estado de UI que comparten el editor y el
//  menu de clic derecho de la lista: visibilidad del panel de
//  keywords y del panel de atajos. Asi una misma accion (p. ej.
//  "Keywords") se dispara desde los dos lugares.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useNotes } from "./hooks/useNotes";
import { signOut } from "./services/auth.service";
import { LoginForm } from "./components/auth/LoginForm";
import { NoteList } from "./components/notes/NoteList";
import { NoteEditor } from "./components/notes/NoteEditor";
import { ShortcutsHelp } from "./components/notes/ShortcutsHelp";
import { PesoExportDialog } from "./components/notes/PesoExportDialog";
import { exportNote } from "./components/notes/exportNote";
import { Spinner } from "./components/ui/Spinner";
import type { Note, NoteKind } from "./types";
import styles from "./App.module.css";

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { notes, loading: notesLoading, create, update, remove, uploadImage } =
    useNotes(user?.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  // En movil solo se ve un panel a la vez: "list" o "editor".
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  // Panel de atajos (modal). Se abre desde el menu de acciones (editor y lista).
  const [showHelp, setShowHelp] = useState(false);
  // Nota de peso que se esta exportando como imagen (o null si el dialogo esta
  // cerrado). Las notas normales/gastos se exportan directo; las de peso abren
  // este dialogo para elegir rango de fechas y ver la vista previa del grafico.
  const [pesoExport, setPesoExport] = useState<Note | null>(null);
  // Visibilidad del panel de keywords. En desktop es una preferencia de layout
  // que se recuerda entre sesiones (localStorage) y arranca abierta; en movil
  // siempre arranca cerrada para ver primero el apunte. La alterna el menu de
  // acciones (y la abre el clic derecho "Keywords" desde la lista).
  const isDesktop = window.matchMedia("(min-width: 769px)").matches;
  const [showKeywords, setShowKeywords] = useState(() => {
    if (!isDesktop) return false;
    const saved = localStorage.getItem("keywordsOpen");
    return saved === null ? true : saved === "true";
  });
  useEffect(() => {
    if (isDesktop) localStorage.setItem("keywordsOpen", String(showKeywords));
  }, [isDesktop, showKeywords]);

  // Esc: volver a la pantalla de inicio (deseleccionar la nota). Si hay un
  // modal/menu abierto, este lo cierra primero (detiene la propagacion en
  // captura), asi que aca solo llega cuando no hay nada superpuesto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (pesoExport) {
        setPesoExport(null);
        return;
      }
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      if (activeId) {
        setActiveId(null);
        setMobileView("list");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pesoExport, showHelp, activeId]);

  // Boton/gesto "atras" de Android (deslizar desde el borde). El sistema lo
  // convierte en una navegacion del historial, no en un evento tactil; por eso
  // se maneja con la History API y no detectando el swipe a mano. Al abrir una
  // nota metemos una entrada de historial; al apretar atras, popstate nos trae
  // de vuelta al listado en vez de cerrar la PWA.
  const noteOpenRef = useRef(false);
  useEffect(() => {
    function onPop() {
      if (noteOpenRef.current) {
        noteOpenRef.current = false; // el navegador ya consumio la entrada
        setActiveId(null);
        setMobileView("list");
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Mantiene el historial en sync con la nota abierta: una entrada por nota.
  useEffect(() => {
    const open = activeId !== null;
    if (open && !noteOpenRef.current) {
      noteOpenRef.current = true;
      history.pushState({ noteOpen: true }, "");
    } else if (!open && noteOpenRef.current) {
      // La nota se cerro desde la UI (Esc, "← Notas", borrar): consumimos la
      // entrada que habiamos metido para que el historial no quede desfasado.
      // El history.back() dispara popstate, pero onPop ya no hace nada porque
      // noteOpenRef quedo en false.
      noteOpenRef.current = false;
      history.back();
    }
  }, [activeId]);

  // 1) Esperando saber si hay sesion.
  if (authLoading) return <Spinner center />;

  // 2) Nadie logueado -> pantalla de acceso.
  if (!user) return <LoginForm />;

  // 3) Logueado: app principal.
  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  async function handleCreate(kind: NoteKind = "nota") {
    const nueva = await create(kind);
    if (nueva) setActiveId(nueva.id);
    setMobileView("editor"); // en movil, saltar al editor de la nota nueva
  }

  // Seleccionar una nota: en movil ademas pasa a mostrar el editor.
  function handleSelect(id: string) {
    setActiveId(id);
    setMobileView("editor");
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (activeId === id) setActiveId(null);
    setMobileView("list"); // al borrar, volver a la lista en movil
  }

  // Abrir una nota directo con el panel de keywords (clic derecho en la lista).
  function handleOpenKeywords(id: string) {
    handleSelect(id);
    setShowKeywords(true);
  }

  function handleTogglePin(note: Note) {
    void update(note.id, { pinned: !note.pinned });
  }

  // Exportar una nota. Las de peso abren el dialogo de imagen (elegir rango +
  // grafico); el resto se descargan directo (.txt / .xls).
  function handleExport(note: Note) {
    if (note.kind === "peso") setPesoExport(note);
    else exportNote(note);
  }

  return (
    <div className={`${styles.app} ${mobileView === "editor" ? styles.showEditor : ""}`}>
      <NoteList
        notes={notes}
        activeId={activeId}
        email={user.email}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onSignOut={signOut}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
        onShowHelp={() => setShowHelp(true)}
        onOpenKeywords={handleOpenKeywords}
        onExport={handleExport}
      />
      {notesLoading ? (
        <Spinner center />
      ) : (
        <NoteEditor
          note={activeNote}
          onChange={update}
          onDelete={handleDelete}
          onBack={() => setMobileView("list")}
          showKeywords={showKeywords}
          onToggleKeywords={() => setShowKeywords((v) => !v)}
          onShowHelp={() => setShowHelp(true)}
          onExport={handleExport}
          onUploadImage={uploadImage}
        />
      )}
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {pesoExport && (
        <PesoExportDialog note={pesoExport} onClose={() => setPesoExport(null)} />
      )}
    </div>
  );
}
