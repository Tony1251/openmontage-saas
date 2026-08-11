import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const sizeStyles: React.CSSProperties = {};
  if (width !== undefined) {
    sizeStyles.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    sizeStyles.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-md',
        variant === 'text' && 'h-4 w-full rounded',
        className,
      )}
      style={{ ...sizeStyles, ...style }}
      {...props}
    />
  );
}

export { Skeleton };
