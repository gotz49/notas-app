// ============================================================
//  Iconos de los menus de bloques (SVG en linea, heredan el color
//  del texto, asi funcionan en modo claro y oscuro).
// ============================================================
export type IconName =
  | "text"
  | "bullet"
  | "check"
  | "code"
  | "date"
  | "divider"
  | "dropdown"
  | "h1"
  | "h2"
  | "h3"
  | "numbered"
  | "quote"
  | "table"
  | "image"
  | "plus"
  | "chevron";

const paths: Record<Exclude<IconName, "h1" | "h2" | "h3">, JSX.Element> = {
  text: <path d="M4 5h12M10 5v11" />,
  bullet: (
    <>
      <circle cx="4" cy="5" r="1" fill="currentColor" />
      <circle cx="4" cy="10" r="1" fill="currentColor" />
      <circle cx="4" cy="15" r="1" fill="currentColor" />
      <path d="M8 5h9M8 10h9M8 15h9" />
    </>
  ),
  check: (
    <>
      <path d="M2.5 5l1.5 1.5L6.5 4M2.5 13l1.5 1.5 2.5-2.5" />
      <path d="M9 5.5h8M9 13.5h8" />
    </>
  ),
  code: <path d="M7 5l-4 5 4 5M13 5l4 5-4 5" />,
  date: (
    <>
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8.5h14M7 2.5v3M13 2.5v3" />
    </>
  ),
  divider: <path d="M3 10h14" />,
  dropdown: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M7.5 9l2.5 2.5L12.5 9" />
    </>
  ),
  numbered: (
    <>
      <path d="M3 3.5h1.5v4M3 7.5h3M3 12.5h3l-3 4h3" />
      <path d="M9 5.5h8M9 14.5h8" />
    </>
  ),
  quote: <path d="M4 4v12M8 6h9M8 10h9M8 14h6" />,
  table: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M3 8h14M3 12h14M8 4v12" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <circle cx="7.5" cy="8" r="1.3" />
      <path d="M3.5 14.5l4-4 3 3 2-2 4 3.5" />
    </>
  ),
  plus: <path d="M10 4v12M4 10h12" />,
  chevron: <path d="M6 8l4 4 4-4" />,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  if (name === "h1" || name === "h2" || name === "h3") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        <text x="1" y="15" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
          H
        </text>
        <text x="11" y="17" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
          {name[1]}
        </text>
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
