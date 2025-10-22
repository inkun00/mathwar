'use client';

import type { User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Gem, Coins, HelpCircle } from "lucide-react";

interface MarketSheetProps {
  currentUser: User;
}

const marketItems = [
  {
    id: 'expansion-token',
    name: '확장 토큰',
    description: '새로운 땅을 정복하거나, 다른 플레이어의 땅을 침략할 수 있습니다.',
    price: 100,
    icon: <HelpCircle className="h-8 w-8 text-blue-500" />
  }
];

export default function MarketSheet({ currentUser }: MarketSheetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handlePurchase = async (itemId: string, price: number) => {
    if (!firestore || !currentUser) return;

    if ((currentUser.gamePoints ?? 0) < price) {
      toast({
        variant: "destructive",
        title: "포인트 부족",
        description: "아이템을 구매하기에 포인트가 충분하지 않습니다.",
      });
      return;
    }

    const userRef = doc(firestore, "users", currentUser.id);

    try {
      if (itemId === 'expansion-token') {
        await updateDoc(userRef, {
          gamePoints: increment(-price),
          tokens: increment(1),
        });
        toast({
          title: "구매 완료!",
          description: "확장 토큰 1개를 획득했습니다.",
        });
      }
      // Add other item purchase logic here
    } catch (error) {
      console.error("아이템 구매 오류:", error);
      toast({
        variant: "destructive",
        title: "구매 실패",
        description: "아이템을 구매하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  };


  return (
    <div className="mt-6 flex h-[calc(100%-3rem)] flex-col">
      <div className="mb-6">
        <Card className="bg-primary/10 border-primary">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>보유 포인트</CardTitle>
            <Coins className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUser.gamePoints ?? 0} 포인트</div>
            <p className="text-xs text-muted-foreground">
              매일 자정에 보유한 땅 1개당 1포인트가 지급됩니다.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex-grow space-y-4 overflow-y-auto pr-2">
        {marketItems.map(item => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader className="flex-row items-start gap-4 space-y-0">
               <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                {item.icon}
              </div>
              <div className="flex-1">
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto flex items-center justify-end border-t pt-4">
              <div className="flex items-center gap-2 mr-4">
                 <Coins className="h-4 w-4 text-yellow-500" />
                 <span className="font-bold">{item.price} 포인트</span>
              </div>
              <Button onClick={() => handlePurchase(item.id, item.price)}>
                구매
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
