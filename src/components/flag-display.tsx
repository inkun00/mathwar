
import { cn } from "@/lib/utils";

interface FlagDisplayProps {
  flagData: string[] | undefined;
  size?: number;
  className?: string;
}

const FLAG_GRID_SIZE = 10;

export default function FlagDisplay({ flagData, size = 48, className }: FlagDisplayProps) {
  const pixelSize = size / FLAG_GRID_SIZE;

  return (
    <div
      className={cn("grid border border-border/20 overflow-hidden", className)}
      style={{
        gridTemplateColumns: `repeat(${FLAG_GRID_SIZE}, 1fr)`,
        width: size,
        height: size,
      }}
    >
      {Array.from({ length: FLAG_GRID_SIZE * FLAG_GRID_SIZE }).map((_, i) => (
        <div
          key={i}
          style={{
            width: pixelSize,
            height: pixelSize,
            backgroundColor: flagData?.[i] || "#ffffff",
          }}
        />
      ))}
    </div>
  );
}
