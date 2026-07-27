'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateApiKey } from '@/lib/hooks/use-api-keys';

interface CreateKeyDialogProps {
  getToken?: () => Promise<string | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateKeyDialog({ getToken, open, onOpenChange }: CreateKeyDialogProps) {
  const [fullSecret, setFullSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createKey = useCreateApiKey(getToken);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = fd.get('label') as string;
    const result = await createKey.mutateAsync(label);
    if (result && 'secret' in result) {
      setFullSecret((result as unknown as { secret: string }).secret);
      toast.success('API key created. Copy it now — you won\'t see it again.');
    }
  };

  const handleCopy = () => {
    if (fullSecret) {
      navigator.clipboard.writeText(fullSecret);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setFullSecret(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>Create API key</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fullSecret ? 'API key created' : 'Create new API key'}</DialogTitle>
        </DialogHeader>

        {fullSecret ? (
          <div className="space-y-4 p-6">
            <Card className="border-yellow-500 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  Save this secret key now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-yellow-700">
                  This is the only time you'll see the full secret key. Store it securely.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-yellow-100 px-3 py-2 text-xs font-mono">
                    {fullSecret}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" placeholder="e.g. production-server" required maxLength={64} className="mt-1" />
            </div>
            <div>
              <Label>Environment</Label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="environment" value="test" defaultChecked />
                  Test
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="environment" value="live" />
                  Live
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createKey.isPending} className="w-full">
                {createKey.isPending ? 'Creating...' : 'Create key'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
