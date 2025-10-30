'use client';

import { useMemo } from 'react';
import type { User, Country, ClientTile, RankedUser, RankedCountry } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from './ui/badge';
import { MAP_HEIGHT, MAP_WIDTH } from '@/lib/world-map-shape';

interface LeaderboardSheetProps {
  users: User[];
  countries: Country[];
  landTiles: ClientTile[];
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


export default function LeaderboardSheet({ users, countries, landTiles }: LeaderboardSheetProps) {
  const { userRankings, countryRankings } = useMemo(() => {
    // User Rankings
    const userTileCount = users.reduce((acc, user) => {
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
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .map((p, index) => {
        const user = users.find(u => u.id === p.id);
        return {
          rank: index + 1,
          id: p.id,
          nickname: user?.nickname || '알 수 없는 플레이어',
          tileCount: p.count,
        }
      });

    // Country Rankings
    const countryTileCount = countries.reduce((acc, country) => {
      acc[country.id] = 0;
      return acc;
    }, {} as Record<string, number>);

    const userToCountryMap = new Map(users.map(u => [u.id, u.countryId]));

    landTiles.forEach(tile => {
        if (tile && tile.ownerId) {
            const countryId = userToCountryMap.get(tile.ownerId);
            if (countryId && countryTileCount[countryId] !== undefined) {
                countryTileCount[countryId]++;
            }
        }
    });

    const sortedCountries: RankedCountry[] = Object.entries(countryTileCount)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .map((item, index) => {
        const country = countries.find(co => co.id === item.id);
        return {
          rank: index + 1,
          id: item.id,
          name: country?.name || '알 수 없는 국가',
          color: country?.color || '#888',
          tileCount: item.count,
        };
      });

    return { userRankings: sortedUsers, countryRankings: sortedCountries };
  }, [users, countries, landTiles]);

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
          <RankingTable data={userRankings} type="user" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
