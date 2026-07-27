'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const mockMembers = [
  { name: 'Alice Chen', email: 'alice@openmontage.com', role: 'Owner', status: 'Active' as const },
  { name: 'Bob Zhang', email: 'bob@openmontage.com', role: 'Admin', status: 'Active' as const },
  { name: 'Carol Li', email: 'carol@openmontage.com', role: 'Member', status: 'Pending' as const },
];

const roleColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  Owner: 'default',
  Admin: 'secondary',
  Member: 'outline',
};

const statusColors: Record<string, 'success' | 'secondary'> = {
  Active: 'success',
  Pending: 'secondary',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace members</p>
        </div>
        <Button disabled className="relative">
          Invite Member
          <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0 absolute -top-2 -right-2">
            Soon
          </Badge>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <p className="text-sm text-muted-foreground">{mockMembers.length} member(s) in your workspace</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockMembers.map((member) => (
            <div
              key={member.email}
              className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleColors[member.role]} className="text-xs">
                  {member.role}
                </Badge>
                <Badge variant={statusColors[member.status]} className="text-xs">
                  {member.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
