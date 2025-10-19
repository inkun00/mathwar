'use client';

import { useAuth } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Logo } from './icons/logo';

export default function Login() {
  const auth = useAuth();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google 로그인 중 오류 발생:", error);
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
            Google 계정으로 로그인하여 게임을 시작하고 진행 상황을 저장하세요.
          </p>
          <Button size="lg" className="w-full" onClick={handleGoogleLogin}>
            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.3 64.5C308.6 102.3 282.6 92 248 92c-71 0-129.5 58.5-129.5 130s58.5 130 129.5 130c78.2 0 109.3-51.8 114.3-78.2H248v-65.4h239.2c1.2 12.8 1.8 26.4 1.8 41z"></path>
            </svg>
            Google 계정으로 로그인
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
