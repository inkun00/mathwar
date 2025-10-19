'use client';

import { useAuth } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Logo } from './icons/logo';
import { User } from "lucide-react";

export default function Login() {
  const auth = useAuth();

  const handleAnonymousLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("익명 로그인 중 오류 발생:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md text-center shadow-2xl">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Logo className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">소수 정복</CardTitle>
          <CardDescription className="text-lg">
            소수점 계산으로 영토를 확장하는 전략 게임
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            아래 버튼을 눌러 바로 게임을 시작하세요.
          </p>
          <Button size="lg" className="w-full" onClick={handleAnonymousLogin}>
            <User className="mr-2 h-5 w-5" />
            익명으로 게임 시작
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
