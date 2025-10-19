'use client';

import { useState } from 'react';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type { Country } from '@/lib/types';
import { ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';


export default function SignUpDetails() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [nickname, setNickname] = useState('');
  const [countryOption, setCountryOption] = useState('existing'); // 'existing' or 'new'
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [newCountryName, setNewCountryName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false)

  const countriesQuery = useMemoFirebase(() => collection(firestore, 'countries'), [firestore]);
  const { data: countries, isLoading: countriesLoading } = useCollection<Country>(countriesQuery);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!auth.currentUser) {
      toast({ variant: 'destructive', title: '오류', description: '사용자 인증 정보를 찾을 수 없습니다.' });
      setIsLoading(false);
      return;
    }

    if (!nickname) {
        toast({ variant: 'destructive', title: '오류', description: '닉네임을 입력해주세요.' });
        setIsLoading(false);
        return;
    }

    let countryId = selectedCountryId;

    try {
      if (countryOption === 'new') {
        if (!newCountryName) {
            toast({ variant: 'destructive', title: '오류', description: '새 국가 이름을 입력해주세요.' });
            setIsLoading(false);
            return;
        }
        // Create new country
        const countryRef = await addDoc(collection(firestore, 'countries'), {
          name: newCountryName,
          createdBy: auth.currentUser.uid,
        });
        countryId = countryRef.id;
      } else {
         if (!selectedCountryId) {
            toast({ variant: 'destructive', title: '오류', description: '기존 국가를 선택해주세요.' });
            setIsLoading(false);
            return;
        }
      }

      // Create user profile
      await setDoc(doc(firestore, 'users', auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        nickname,
        email: auth.currentUser.email,
        countryId,
        tokens: 1, // Start with 1 token
        color: `hsl(${Math.random() * 360}, 60%, 70%)` // Assign a random color
      });

      toast({ title: '프로필 생성 완료!', description: '이제 게임을 시작할 수 있습니다.' });
      // The page should auto-refresh via the listener in page.tsx
    } catch (error: any) {
      console.error('Error creating profile:', error);
      toast({ variant: 'destructive', title: '프로필 생성 오류', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>프로필 설정</CardTitle>
          <CardDescription>게임에 사용할 닉네임과 국가를 설정해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">닉네임</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="게임에서 사용할 이름"
                required
              />
            </div>

            <RadioGroup value={countryOption} onValueChange={setCountryOption}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing">기존 국가 선택</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new">새로운 국가 생성</Label>
              </div>
            </RadioGroup>

            {countryOption === 'existing' ? (
                 <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={countriesLoading}
                        >
                        {selectedCountryId
                            ? countries?.find((country) => country.id === selectedCountryId)?.name
                            : "국가를 선택해주세요..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="국가 검색..." />
                            <CommandEmpty>국가를 찾을 수 없습니다.</CommandEmpty>
                            <CommandGroup>
                                <CommandList>
                                    {countries?.map((country) => (
                                        <CommandItem
                                        key={country.id}
                                        value={country.name}
                                        onSelect={() => {
                                            setSelectedCountryId(country.id);
                                            setOpen(false)
                                        }}
                                        >
                                             <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedCountryId === country.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {country.name}
                                        </CommandItem>
                                    ))}
                                </CommandList>
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>

            ) : (
              <div className="space-y-2">
                <Label htmlFor="new-country">새 국가 이름</Label>
                <Input
                  id="new-country"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  placeholder="새로운 국가의 이름"
                  required={countryOption === 'new'}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '저장 중...' : '게임 시작하기'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
