'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface RevokeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyLabel: string;
  onConfirm: () => void;
  isLoading: boolean;
}

export function RevokeConfirmDialog({ open, onOpenChange, keyLabel, onConfirm, isLoading }: RevokeConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const workspaceName = 'my-workspace';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setConfirmText(''); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Revoke API key
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. Any services using this key will immediately lose access.
          </p>
          <div className="rounded-md bg-muted p-3 text-sm">
            <span className="font-medium">Key:</span> {keyLabel || 'Untitled'}
          </div>
          <div>
            <Label>Type <span className="font-semibold">{workspaceName}</span> to confirm</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspaceName}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2 p-6 pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmText !== workspaceName || isLoading}
            onClick={onConfirm}
          >
            {isLoading ? 'Revoking...' : 'Revoke key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
