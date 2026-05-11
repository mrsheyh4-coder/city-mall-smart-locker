import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-12 w-full rounded-[14px] border border-[#E5E5E5] bg-[#FFFFFF] px-4 text-sm text-[#0F0F0F] outline-none transition placeholder:text-[#7A7A7A]/65 focus:border-[#C8A96B] focus:ring-4 focus:ring-[#C8A96B]/15',
        className,
      )}
      {...props}
    />
  );
}
