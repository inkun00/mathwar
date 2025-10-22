
import { cn } from "@/lib/utils";

interface FlagDisplayProps {
  flagData: string[] | undefined;
  width?: number;
  className?: string;
}

const FLAG_GRID_WIDTH = 20;
const FLAG_GRID_HEIGHT = 10;
const ASPECT_RATIO = FLAG_GRID_WIDTH / FLAG_GRID_HEIGHT;

export default function FlagDisplay({ flagData, width = 48, className }: FlagDisplayProps) {
  const height = width / ASPECT_RATIO;
  
  return (
    <div
      className={cn("grid border border-border/20 overflow-hidden", className)}
      style={{
        gridTemplateColumns: `repeat(${FLAG_GRID_WIDTH}, 1fr)`,
        width: width,
        height: height,
      }}
    >
      {Array.from({ length: FLAG_GRID_WIDTH * FLAG_GRID_HEIGHT }).map((_, i) => (
        <div
          key={i}
          className="aspect-square"
          style={{
            backgroundColor: flagData?.[i] || "#ffffff",
          }}
        />
      ))}
    </div>
  );
}
