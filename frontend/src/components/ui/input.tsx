import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-12 w-full rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/70 px-4 text-sm text-[#ffffff] outline-none transition placeholder:text-[#ffffff]/45 focus:border-[#b3806e]/70 focus:ring-4 focus:ring-[#b3806e]/15',
        className,
      )}
      {...props}
    />
  );
}
