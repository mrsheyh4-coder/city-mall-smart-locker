import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-[#C8A96B] bg-[#C8A96B] text-[#0F0F0F] shadow-[0_18px_42px_rgba(200,169,107,0.30)] hover:scale-[1.02] hover:bg-[#D8BE8B]',
  secondary:
    'border border-[#E5E5E5] bg-[#FFFFFF] text-[#0F0F0F] hover:scale-[1.02] hover:border-[#C8A96B] hover:bg-[#F5F5F3]',
  ghost: 'text-[#7A7A7A] hover:bg-[#C8A96B]/10 hover:text-[#0F0F0F]',
  danger:
    'border border-[#C8A96B]/35 bg-[#C8A96B]/10 text-[#0F0F0F] hover:bg-[#C8A96B]/20',
};

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-bold tracking-normal transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
