'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateRender } from '@/lib/hooks/use-renders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const MODEL_OPTIONS = [
  { value: 'openmontage-v1', label: 'OpenMontage v1' },
  { value: 'openmontage-v1-fast', label: 'OpenMontage v1 Fast' },
];

const RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p (1280×720)' },
  { value: '1080p', label: '1080p (1920×1080)' },
  { value: '4k', label: '4K (3840×2160)' },
];

export default function NewRenderPage() {
  const router = useRouter();
  const createRender = useCreateRender();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('openmontage-v1');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('720p');

  const isValid =
    prompt.trim().length > 0 &&
    duration >= 5 &&
    duration <= 10 &&
    resolution.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      const result = await createRender.mutateAsync({
        prompt: prompt.trim(),
        model,
        duration_sec: duration,
        resolution,
      });
      router.push(`/dashboard/renders/${result.id}`);
    } catch {
      // Toast is handled by the mutation
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/renders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to renders
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New render</CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate a new video by describing what you want to create.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the video you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length} / 2000 characters
              </p>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                options={MODEL_OPTIONS}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={10}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Between 5 and 10 seconds
              </p>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                options={RESOLUTION_OPTIONS}
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={!isValid || createRender.isPending}
              >
                {createRender.isPending ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate video'
                )}
              </Button>
              <Link href="/dashboard/renders">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>

            {/* Error */}
            {createRender.isError && (
              <p className="text-sm text-destructive">
                {createRender.error?.message ?? 'Failed to create render.'}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
