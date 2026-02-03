import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  headerRight?: ReactNode;
}

export function CollapsiblePanel({
  title,
  className = "",
  defaultOpen = true,
  children,
  headerRight,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`panel collapsible-panel ${className} ${open ? "panel-open" : "panel-collapsed"}`}>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <div className="collapsible-title-row">
          <span className={`collapse-chevron ${open ? "chevron-open" : ""}`}>&#9654;</span>
          <h2>{title}</h2>
        </div>
        {headerRight && (
          <div className="collapsible-header-right" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
