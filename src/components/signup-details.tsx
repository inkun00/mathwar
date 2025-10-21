'use client';

import { useState } from 'react';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type { Country } from '@/lib/types';
import { ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { moderateText } from '@/ai/flows/moderate-text-flow';


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
      toast({ variant: 'destructive', title: '오류', description: '사용자 인증 정보를 찾을 수 없습니다. 다시 로그인해 주세요.' });
      setIsLoading(false);
      return;
    }

    if (!nickname) {
        toast({ variant: 'destructive', title: '입력 오류', description: '닉네임을 입력해주세요.' });
        setIsLoading(false);
        return;
    }
    
    if (nickname.length > 6) {
        toast({ variant: 'destructive', title: '입력 오류', description: '닉네임은 6글자 이하로만 만들 수 있습니다.' });
        setIsLoading(false);
        return;
    }

    try {
      // Moderate nickname
      const nicknameModeration = await moderateText(nickname);
      if (!nicknameModeration.isAppropriate) {
        toast({
          variant: 'destructive',
          title: '부적절한 닉네임',
          description: nicknameModeration.reason || '입력한 닉네임은 사용할 수 없습니다. 다른 이름을 시도해 보세요.',
        });
        setIsLoading(false);
        return;
      }

      let countryId = selectedCountryId;

      if (countryOption === 'new') {
        if (!newCountryName) {
            toast({ variant: 'destructive', title: '입력 오류', description: '새 국가 이름을 입력해주세요.' });
            setIsLoading(false);
            return;
        }
        if (newCountryName.length > 6) {
            toast({ variant: 'destructive', title: '입력 오류', description: '국가 이름은 6글자 이하로만 만들 수 있습니다.' });
            setIsLoading(false);
            return;
        }
        
        // Moderate country name
        const countryNameModeration = await moderateText(newCountryName);
        if (!countryNameModeration.isAppropriate) {
            toast({
                variant: 'destructive',
                title: '부적절한 국가 이름',
                description: countryNameModeration.reason || '입력한 국가 이름은 사용할 수 없습니다. 다른 이름을 시도해 보세요.',
            });
            setIsLoading(false);
            return;
        }

        // Create new country
        const countryRef = await addDoc(collection(firestore, 'countries'), {
          name: newCountryName,
          createdBy: auth.currentUser.uid,
          color: `hsl(${Math.random() * 360}, 60%, 70%)`, // Assign a random color to new country
          demised: false,
        });
        countryId = countryRef.id;
      } else {
         if (!selectedCountryId) {
            toast({ variant: 'destructive', title: '선택 오류', description: '기존 국가 중 하나를 선택해주세요.' });
            setIsLoading(false);
            return;
        }
      }

      // Create user profile
      await setDoc(doc(firestore, 'users', auth.currentUser.uid), {
        id: auth.currentUser.uid,
        uid: auth.currentUser.uid,
        nickname,
        email: auth.currentUser.email,
        countryId,
        tokens: 1, // Start with 1 token
        conqueredCountries: [],
      });

      toast({ title: '프로필 생성 완료!', description: '이제 게임을 시작할 수 있습니다.' });
      // The page should auto-refresh via the listener in page.tsx
    } catch (error: any) {
      console.error('프로필 생성 오류:', error);
      toast({ variant: 'destructive', title: '프로필 생성 오류', description: error.message || '프로필을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const availableCountries = countries?.filter(c => !c.demised);

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
                placeholder="게임에서 사용할 이름 (6자 이하)"
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
                            ? availableCountries?.find((country) => country.id === selectedCountryId)?.name
                            : "국가를 선택해주세요..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="국가 검색..." />
                            <CommandEmpty>생성된 국가가 없습니다.</CommandEmpty>
                            <CommandGroup>
                                <CommandList>
                                    {availableCountries?.map((country) => (
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
                  placeholder="새로운 국가의 이름 (6자 이하)"
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
