// ============================================================
//  ThemeToggle  (boton reutilizable para cambiar de tema)
// ============================================================
import { useTheme } from "../../hooks/useTheme";
import { Button } from "./Button";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      aria-label="Cambiar tema"
      title="Cambiar tema"
      style={{
        padding: "0.5rem 0.7rem",
        justifyContent: "center",
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </Button>
  );
}