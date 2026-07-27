'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

const models = [
  { value: 'deepseek-v4', label: 'DeepSeek V4' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude-4', label: 'Claude 4' },
];

const durations = [
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
];

const resolutions = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4K', label: '4K' },
];

interface CreateRenderDialogProps {
  children?: React.ReactNode;
}

export default function CreateRenderDialog({ children }: CreateRenderDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('deepseek-v4');
  const [duration, setDuration] = useState('5');
  const [resolution, setResolution] = useState('720p');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let token: string;
      if (isMock) {
        token = localStorage.getItem('mock_token') ?? 'sk_test_demo';
      } else {
        const { useAuth } = await import('@clerk/nextjs');
        const auth = useAuth();
        token = (await auth.getToken()) ?? '';
      }

      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      await api.post('/v1/renders', {
        prompt,
        model,
        duration_sec: Number(duration),
        resolution,
      });

      toast.success('Render queued successfully');
      setPrompt('');
      setModel('deepseek-v4');
      setDuration('5');
      setResolution('720p');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create render');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children ?? <Button>New Render</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Render</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the video you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              required
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">{prompt.length}/2000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={models}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                options={durations}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                options={resolutions}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !prompt.trim()}>
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
