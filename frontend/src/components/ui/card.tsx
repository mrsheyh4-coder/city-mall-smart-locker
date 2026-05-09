import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'luxury-card rounded-[1.65rem] p-5 text-white transition duration-300',
        className,
      )}
      {...props}
    />
  );
}
