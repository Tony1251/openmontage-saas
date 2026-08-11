'use client';

import { usePathname } from 'next/navigation';
import { Plus, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import CreateRenderDialog from '@/components/dashboard/create-render-dialog';

const workspaces = ["Tony's Workspace", 'Personal'];

export default function Topbar() {
  const pathname = usePathname();

  const crumbs = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {crumbs.length > 0 ? (
            crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                <span className={i === crumbs.length - 1 ? 'text-foreground font-medium' : ''}>
                  {crumb}
                </span>
              </span>
            ))
          ) : (
            <span className="text-foreground font-medium">Dashboard</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Tony's Workspace
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {workspaces.map((ws) => (
                <DropdownMenuItem key={ws}>{ws}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <CreateRenderDialog>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> New Render
            </Button>
          </CreateRenderDialog>

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            T
          </div>
        </div>
      </header>
    </>
  );
}
