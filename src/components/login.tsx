'use client';

import { useState } from 'react';
import { useAuth } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Logo } from './icons/logo';
import { User, Mail, KeyRound } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { signInAnonymously } from 'firebase/auth';

export default function Login() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuthError = (err: any) => {
    let errorMessage = "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    switch (err.code) {
      case 'auth/invalid-email':
        errorMessage = '유효하지 않은 이메일 주소 형식입니다.';
        break;
      case 'auth/user-not-found':
        errorMessage = '등록되지 않은 사용자입니다. 회원가입을 먼저 진행해 주세요.';
        break;
      case 'auth/wrong-password':
        errorMessage = '비밀번호가 일치하지 않습니다.';
        break;
      case 'auth/email-already-in-use':
        errorMessage = '이미 사용 중인 이메일입니다. 로그인해 주세요.';
        break;
      case 'auth/weak-password':
          errorMessage = '비밀번호는 6자리 이상이어야 합니다.';
          break;
      case 'auth/operation-not-allowed':
          errorMessage = '서버 설정 오류입니다. 관리자에게 문의하세요.';
          break;
      default:
        console.error("Firebase Auth Error:", err);
        errorMessage = '인증 처리 중 오류가 발생했습니다.';
        break;
    }
     toast({
      variant: "destructive",
      title: isSignUp ? "회원가입 오류" : "로그인 오류",
      description: errorMessage,
    });
  };
  
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({ title: '회원가입 성공!', description: '게임에 오신 것을 환영합니다.' });
    } catch (err) {
      handleAuthError(err);
    }
  };


  const handleAnonymousLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("익명 로그인 오류:", error);
      toast({
        variant: "destructive",
        title: "익명 로그인 오류",
        description: "익명 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-2xl">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Logo className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">소수 정복</CardTitle>
          <CardDescription className="text-lg">
            {isSignUp ? '새로운 계정을 만들어 영토를 정복하세요.' : '소수점 계산으로 영토를 확장하는 전략 게임'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
               <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full">
              {isSignUp ? '이메일로 회원가입' : '이메일로 로그인'}
            </Button>
          </form>

          <div className="my-4 flex items-center">
            <div className="flex-grow border-t border-muted-foreground/20"></div>
            <span className="mx-4 text-xs text-muted-foreground">또는</span>
            <div className="flex-grow border-t border-muted-foreground/20"></div>
          </div>
          
          <Button variant="secondary" size="lg" className="w-full" onClick={handleAnonymousLogin}>
            <User className="mr-2 h-5 w-5" />
            익명으로 게임 시작
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
           <Button variant="link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp
              ? '이미 계정이 있으신가요? 로그인'
              : '계정이 없으신가요? 회원가입'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    