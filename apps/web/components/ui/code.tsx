'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  showCopy?: boolean;
  code?: string;
}

const Code = React.forwardRef<HTMLPreElement, CodeProps>(
  ({ className, children, code, showCopy = true, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);
    const textToCopy = code || (typeof children === 'string' ? children : '');

    const handleCopy = async () => {
      const ok = await navigator.clipboard.writeText(textToCopy);
      // Fallback for older browsers
      if (ok !== undefined && !ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleFallbackCopy = async () => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard not available
      }
    };

    return (
      <div className="relative group">
        <pre
          ref={ref}
          className={cn(
            'overflow-x-auto rounded-lg border bg-muted p-4 text-sm font-mono text-foreground',
            className,
          )}
          {...props}
        >
          <code>{children}</code>
        </pre>
        {showCopy && textToCopy && (
          <button
            onClick={handleFallbackCopy}
            className="absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    );
  },
);
Code.displayName = 'Code';

export { Code };
export type { CodeProps };
