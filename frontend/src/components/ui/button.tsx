import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-[#b3806e]/70 bg-[#b3806e] text-[#ffffff] shadow-[0_0_30px_rgba(179,128,110,0.28)] hover:bg-[#ffffff] hover:text-[#1a212f]',
  secondary:
    'border border-[#ffffff]/15 bg-[#ffffff]/[0.07] text-[#ffffff] hover:border-[#b3806e]/60 hover:bg-[#b3806e]/20',
  ghost: 'text-[#ffffff]/75 hover:bg-[#ffffff]/10 hover:text-[#ffffff]',
  danger:
    'border border-[#b3806e]/35 bg-[#b3806e]/10 text-[#ffffff] hover:bg-[#b3806e]/24',
};

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.35rem] px-4 text-sm font-bold tracking-normal transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
