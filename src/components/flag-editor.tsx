'use client';

import { useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/types";
import { useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "./ui/dialog";

interface FlagEditorProps {
  country: Country;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const FLAG_GRID_WIDTH = 32;
const FLAG_GRID_HEIGHT = 20;
const defaultColor = "#ffffff";
const colors = [
  "#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
  "#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4",
  "#009688", "#4caf50", "#8bc34a", "#cddc39", "#ffeb3b", "#ffc107", "#ff9800", "#ff5722",
  "#795548", "#9e9e9e", "#607d8b"
];

export default function FlagEditor({ country, isOpen, onOpenChange }: FlagEditorProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pixels, setPixels] = useState<string[]>(() => 
    country.flag && country.flag.length === FLAG_GRID_WIDTH * FLAG_GRID_HEIGHT 
      ? country.flag 
      : Array(FLAG_GRID_WIDTH * FLAG_GRID_HEIGHT).fill(defaultColor)
  );
  const [selectedColor, setSelectedColor] = useState(colors[1]);
  const [isErasing, setIsErasing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePixelClick = (index: number) => {
    const newPixels = [...pixels];
    newPixels[index] = isErasing ? defaultColor : selectedColor;
    setPixels(newPixels);
  };

  const handleSave = async () => {
    if (!firestore || !country) return;
    setIsProcessing(true);
    const countryRef = doc(firestore, "countries", country.id);
    try {
      await updateDoc(countryRef, { flag: pixels });
      toast({
        title: "국기 저장 완료!",
        description: "새로운 국기가 성공적으로 저장되었습니다.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("국기 저장 오류:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "국기를 저장하는 중 오류가 발생했습니다.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>국기 디자인 (32x20)</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          {/* Flag Grid */}
          <div
            className="grid touch-none cursor-pointer border aspect-[1.6/1]"
            style={{ gridTemplateColumns: `repeat(${FLAG_GRID_WIDTH}, 1fr)` }}
            onMouseDown={(e) => e.preventDefault()} // Prevent text selection
          >
            {pixels.map((color, i) => (
              <div
                key={i}
                className="aspect-square"
                style={{ backgroundColor: color }}
                onMouseDown={() => handlePixelClick(i)}
                onMouseEnter={(e) => {
                  if (e.buttons === 1) handlePixelClick(i);
                }}
              />
            ))}
          </div>

          {/* Color Palette & Controls */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-5 gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                    selectedColor === color && !isErasing
                      ? "border-ring"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setSelectedColor(color);
                    setIsErasing(false);
                  }}
                  aria-label={`색상 ${color} 선택`}
                />
              ))}
            </div>
            <Button
              variant={isErasing ? "secondary" : "outline"}
              onClick={() => setIsErasing(!isErasing)}
              className="w-full"
            >
              <Eraser className="mr-2" />
              지우개
            </Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>취소</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
