// ============================================================
//  App  (componente raiz que orquesta todo)
// ------------------------------------------------------------
//  Decide que mostrar segun el estado:
//   - cargando sesion        -> spinner
//   - sin usuario logueado   -> formulario de login
//   - usuario logueado       -> lista de notas + editor
// ============================================================
import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useNotes } from "./hooks/useNotes";
import { signOut } from "./services/auth.service";
import { LoginForm } from "./components/auth/LoginForm";
import { NoteList } from "./components/notes/NoteList";
import { NoteEditor } from "./components/notes/NoteEditor";
import { Spinner } from "./components/ui/Spinner";

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { notes, loading: notesLoading, create, update, remove } = useNotes(user?.id);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 1) Esperando saber si hay sesion.
  if (authLoading) return <Spinner center />;

  // 2) Nadie logueado -> pantalla de acceso.
  if (!user) return <LoginForm />;

  // 3) Logueado: app principal.
  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  async function handleCreate() {
    const nueva = await create();
    if (nueva) setActiveId(nueva.id);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (activeId === id) setActiveId(null);
  }

  return (
    <div style={{ display: "flex" }}>
      <NoteList
        notes={notes}
        activeId={activeId}
        email={user.email}
        onSelect={setActiveId}
        onCreate={handleCreate}
        onSignOut={signOut}
      />
      {notesLoading ? (
        <Spinner center />
      ) : (
        <NoteEditor note={activeNote} onChange={update} onDelete={handleDelete} />
      )}
    </div>
  );
}
