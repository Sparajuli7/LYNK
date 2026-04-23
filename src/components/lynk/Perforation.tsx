interface PerforationProps {
  variant?: "solid" | "dashed";
}

export function Perforation({ variant = "solid" }: PerforationProps) {
  return variant === "dashed" ? (
    <div className="perf-dashed" aria-hidden="true" />
  ) : (
    <div className="perf" aria-hidden="true" />
  );
}
