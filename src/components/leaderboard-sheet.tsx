'use client';

import { useMemo, useState } from 'react';
import type { User, Country, ClientTile, RankedUser, RankedCountry } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

interface LeaderboardData {
  userRankings: RankedUser[];
  countryRankings: RankedCountry[];
}

const RankingTable = ({ data, type }: { data: (RankedUser | RankedCountry)[], type: 'user' | 'country' }) => {
  if (data.length === 0) {
    return <p className="text-center text-muted-foreground mt-4">데이터가 없습니다.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px] text-center">순위</TableHead>
          <TableHead>{type === 'user' ? '닉네임' : '국가'}</TableHead>
          <TableHead className="text-right">영토 수</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(item => (
          <TableRow key={item.id}>
            <TableCell className="font-medium text-center">{item.rank}</TableCell>
            <TableCell>
              {'nickname' in item ? (
                item.nickname
              ) : (
                <Badge variant="secondary" style={{ backgroundColor: item.color, color: 'white' }}>
                  {item.name}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">{item.tileCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface LeaderboardSheetProps {
  allUsers?: User[];
  countries?: Country[];
  landTiles?: ClientTile[];
}

export default function LeaderboardSheet({ allUsers = [], countries = [], landTiles = [] }: LeaderboardSheetProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const { userRankings, countryRankings } = useMemo(() => {
      if (allUsers.length === 0 && countries.length === 0) {
        return { userRankings: [], countryRankings: [] };
      }

      // User Rankings
      const userTileCount = allUsers.reduce((acc, user) => {
        acc[user.id] = 0;
        return acc;
      }, {} as Record<string, number>);

      landTiles.forEach(tile => {
        if (tile && tile.ownerId) {
          if (userTileCount[tile.ownerId] !== undefined) {
            userTileCount[tile.ownerId]++;
          }
        }
      });

      const sortedUsers: RankedUser[] = Object.entries(userTileCount)
        .map(([id, count]) => {
          const user = allUsers.find(u => u.id === id);
          return {
            rank: 0,
            id: id,
            nickname: user?.nickname || '알 수 없는 플레이어',
            tileCount: count,
          };
        })
        .sort((a, b) => b.tileCount - a.tileCount)
        .map((p, index) => ({ ...p, rank: index + 1 }));

      // Country Rankings
      const countryTileCount = countries.reduce((acc, country) => {
        acc[country.id] = 0;
        return acc;
      }, {} as Record<string, number>);

      const userCountryMap = new Map(allUsers.map(u => [u.id, u.countryId]));

      landTiles.forEach(tile => {
        if (tile && tile.ownerId) {
          const countryId = userCountryMap.get(tile.ownerId);
          if (countryId && countryTileCount[countryId] !== undefined) {
            countryTileCount[countryId]++;
          }
        }
      });

      const sortedCountries: RankedCountry[] = Object.entries(countryTileCount)
        .map(([id, count]) => {
          const country = countries.find(c => c.id === id);
          return {
            rank: 0,
            id: id,
            name: country?.name || '알 수 없는 국가',
            color: country?.color || '#cccccc',
            tileCount: count,
          };
        })
        .sort((a, b) => b.tileCount - a.tileCount)
        .map((c, index) => ({ ...c, rank: index + 1 }));

      return { userRankings: sortedUsers, countryRankings: sortedCountries };
    }, [allUsers, countries, landTiles]);

    const filteredUserRankings = useMemo(() => {
        if (!searchTerm) {
            return userRankings;
        }
        return userRankings.filter(user => 
            user.nickname.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, userRankings]);

  return (
    <div className="mt-6">
      <Tabs defaultValue="country">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="country">국가별 순위</TabsTrigger>
          <TabsTrigger value="user">개인별 순위</TabsTrigger>
        </TabsList>
        <TabsContent value="country">
          <RankingTable data={countryRankings} type="country" />
        </TabsContent>
        <TabsContent value="user">
            <div className="py-4">
                <Input 
                    placeholder="닉네임으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                />
            </div>
          <RankingTable data={filteredUserRankings} type="user" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
