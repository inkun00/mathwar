import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { User } from "@/lib/types";
import { UserCircle, HelpCircle } from "lucide-react";

interface HeaderProps {
  currentUser: User;
  onSolveProblemClick: () => void;
}

export default function Header({ currentUser, onSolveProblemClick }: HeaderProps) {
  return (
    <header className="w-full max-w-7xl rounded-lg border bg-card/80 p-4 shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-primary" />
          <h1 className="font-headline text-xl font-bold tracking-tight sm:text-2xl">
            Decimal Conquest
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 sm:flex">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
            <div className="text-right">
              <p className="font-semibold">{currentUser.name}</p>
              <p className="text-sm text-muted-foreground">
                {currentUser.tokens} expansion {currentUser.tokens === 1 ? 'token' : 'tokens'}
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-10 hidden sm:block" />
          <Button onClick={onSolveProblemClick}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Solve a Problem
          </Button>
        </div>
      </div>
    </header>
  );
}
