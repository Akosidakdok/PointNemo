import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface PixelPanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  headerAction?: ReactNode;
  variant?: "default" | "equipment" | "alert";
}

export const PixelPanel = forwardRef<HTMLDivElement, PixelPanelProps>(
  ({ children, title, headerAction, variant = "default", className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`pixel-panel panel-${variant} ${className}`} {...props}>
        {title && (
          <div className="panel-header">
            <h2 className="panel-title">{title}</h2>
            {headerAction && <div className="panel-header-action">{headerAction}</div>}
          </div>
        )}
        <div className="panel-content">{children}</div>
      </div>
    );
  }
);

PixelPanel.displayName = "PixelPanel";
