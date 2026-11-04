// ============================================================
//  Workspace  (la app una vez que iniciaste sesion)
// ------------------------------------------------------------
//  Orquesta la pantalla principal: lista de notas + editor.
//   - Tiene el estado de las notas (useNotes) y la cola de
//     autoguardado (useAutosave), y se los pasa a la lista y al editor.
//   - Concentra el estado de UI que comparten el editor y el menu de
//     clic derecho de la lista: panel de keywords y de atajos. Asi una
//     misma accion (p. ej. "Keywords") se dispara desde los dos lugares.
//   - Maneja las acciones que pueden fallar (crear, papelera, borrar,
//     fijar, salir) y muestra avisos (Toast) con el resultado.
//
//  App.tsx lo monta con key={user.id}: si cambia el usuario, React lo
//  destruye y crea uno nuevo, asi nunca quedan en pantalla (ni en
//  memoria) notas de la cuenta anterior.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useNotes } from "./hooks/useNotes";
import { useAutosave } from "./hooks/useAutosave";
import { signOut } from "./services/auth.service";
import { NoteList } from "./components/notes/NoteList";
import { NoteEditor } from "./components/notes/NoteEditor";
import { ShortcutsHelp } from "./components/notes/ShortcutsHelp";
import { PesoExportDialog } from "./components/notes/PesoExportDialog";
import { exportNote } from "./components/notes/exportNote";
import { Spinner } from "./components/ui/Spinner";
import { Button } from "./components/ui/Button";
import { Toast, useToast } from "./components/ui/Toast";
import { countTrash, type NotesView } from "./utils/notes";
import { toUserMessage } from "./utils/errors";
import type { Note, NoteKind } from "./types";
import styles from "./Workspace.module.css";

export function Workspace({ user }: { user: User }) {
  const notesApi = useNotes(user.id);
  const { notes } = notesApi;
  const autosave = useAutosave(notesApi.save);
  const toast = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  // Pestana de la lista: notas normales o papelera.
  const [view, setView] = useState<NotesView>("notes");
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

  // Muestra un error en un aviso y deja el detalle en la consola (F12).
  const showError = toast.error;
  const fail = useCallback(
    (e: unknown, fallback: string) => {
      console.error(fallback, e);
      showError(toUserMessage(e, fallback));
    },
    [showError]
  );

  // ---------- Pantallas de carga / error ----------
  if (notesApi.status === "loading") return <Spinner center />;
  if (notesApi.status === "error") {
    return (
      <div className={styles.fatal} role="alert">
        <p>{notesApi.loadError}</p>
        <Button onClick={() => void notesApi.reload()}>Reintentar</Button>
        <Button variant="ghost" onClick={() => void handleSignOut()}>
          Cerrar sesión
        </Button>
      </div>
    );
  }

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  // ---------- Acciones ----------

  async function handleCreate(kind: NoteKind = "nota") {
    try {
      const nueva = await notesApi.create(kind);
      setView("notes");
      setActiveId(nueva.id);
      setMobileView("editor"); // en movil, saltar al editor de la nota nueva
    } catch (e) {
      fail(e, "No se pudo crear la nota.");
    }
  }

  // Seleccionar una nota: en movil ademas pasa a mostrar el editor.
  function handleSelect(id: string) {
    setActiveId(id);
    setMobileView("editor");
  }

  // "Borrar" = mandar a la papelera (con Deshacer). Antes de mover, se
  // guarda lo pendiente; la nota se cierra sin esperar al servidor.
  async function handleTrash(id: string) {
    const wasOpen = activeId === id;
    try {
      await autosave.queue.flush();
      if (wasOpen) {
        setActiveId(null);
        setMobileView("list"); // al borrar, volver a la lista en movil
      }
      await notesApi.trash(id);
      toast.show({
        message: "Nota movida a la papelera.",
        action: { label: "Deshacer", run: () => void handleRestore(id, false).then(() => handleSelect(id)) },
      });
    } catch (e) {
      if (wasOpen) setActiveId(id); // fallo: volver a mostrarla
      fail(e, "No se pudo mover la nota a la papelera.");
    }
  }

  async function handleRestore(id: string, notify = true) {
    try {
      await notesApi.restore(id);
      if (notify) toast.show({ message: "Nota restaurada." });
    } catch (e) {
      fail(e, "No se pudo restaurar la nota.");
    }
  }

  async function handleDeleteForever(id: string) {
    const nombre = notes.find((n) => n.id === id)?.title || "Sin título";
    if (!window.confirm(`¿Borrar "${nombre}" para siempre? No se puede deshacer.`)) return;
    try {
      autosave.queue.discard(id);
      await notesApi.deleteForever(id);
      if (activeId === id) {
        setActiveId(null);
        setMobileView("list");
      }
      toast.show({ message: "Nota borrada definitivamente." });
    } catch (e) {
      fail(e, "No se pudo borrar la nota.");
    }
  }

  async function handleEmptyTrash() {
    const cantidad = countTrash(notes);
    if (cantidad === 0) return;
    const que = cantidad === 1 ? "la nota" : `las ${cantidad} notas`;
    if (!window.confirm(`¿Borrar para siempre ${que} de la papelera? No se puede deshacer.`)) return;
    const ids = notes.filter((n) => n.deleted_at !== null).map((n) => n.id);
    try {
      ids.forEach((id) => autosave.queue.discard(id));
      await notesApi.emptyTrash();
      if (activeId && ids.includes(activeId)) setActiveId(null);
      toast.show({ message: "Papelera vacía." });
    } catch (e) {
      fail(e, "No se pudo vaciar la papelera.");
    }
  }

  // Abrir una nota directo con el panel de keywords (clic derecho en la lista).
  function handleOpenKeywords(id: string) {
    handleSelect(id);
    setShowKeywords(true);
  }

  function handleTogglePin(note: Note) {
    notesApi.togglePin(note.id).catch((e) => fail(e, "No se pudo fijar la nota."));
  }

  // Exportar una nota. Las de peso abren el dialogo de imagen (elegir rango +
  // grafico); el resto se descargan directo (.txt / .xls).
  function handleExport(note: Note) {
    if (note.kind === "peso") setPesoExport(note);
    else exportNote(note);
  }

  // Salir: primero guardar lo pendiente; si algo no se pudo guardar, preguntar.
  async function handleSignOut() {
    await autosave.queue.flush();
    if (
      autosave.queue.hasUnsavedChanges() &&
      !window.confirm("Hay cambios que no se pudieron guardar. Si salís ahora se pierden. ¿Salir igual?")
    ) {
      return;
    }
    try {
      await signOut();
    } catch (e) {
      fail(e, "No se pudo cerrar la sesión.");
    }
  }

  // Ojo: en movil, Workspace.module.css elige el panel visible con
  // ".app > :first-child" (lista) y ":last-child" (editor). Por eso el
  // div .app tiene SOLO esos dos hijos; los modales y el aviso van afuera.
  return (
    <>
    <div className={`${styles.app} ${mobileView === "editor" ? styles.showEditor : ""}`}>
      <NoteList
        notes={notes}
        activeId={activeId}
        email={user.email}
        view={view}
        onViewChange={setView}
        onEmptyTrash={() => void handleEmptyTrash()}
        onSelect={handleSelect}
        onCreate={(kind) => void handleCreate(kind)}
        onSignOut={() => void handleSignOut()}
        onTogglePin={handleTogglePin}
        onDelete={(id) => void handleTrash(id)}
        onShowHelp={() => setShowHelp(true)}
        onOpenKeywords={handleOpenKeywords}
        onExport={handleExport}
      />
      <NoteEditor
        note={activeNote}
        autosave={autosave}
        onTitleDraft={notesApi.patchLocal}
        onRefreshNote={notesApi.refreshNote}
        onTrash={(id) => void handleTrash(id)}
        onRestore={(id) => void handleRestore(id)}
        onDeleteForever={(id) => void handleDeleteForever(id)}
        onTogglePin={handleTogglePin}
        onError={fail}
        onBack={() => setMobileView("list")}
        showKeywords={showKeywords}
        onToggleKeywords={() => setShowKeywords((v) => !v)}
        onShowHelp={() => setShowHelp(true)}
        onExport={handleExport}
        onUploadImage={notesApi.uploadImage}
      />
    </div>
    {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    {pesoExport && <PesoExportDialog note={pesoExport} onClose={() => setPesoExport(null)} />}
    <Toast toast={toast.current} onClose={toast.dismiss} />
    </>
  );
}
