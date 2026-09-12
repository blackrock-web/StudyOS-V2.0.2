import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  interactive,
  ...props
}) => {
  const isInteractive = interactive !== undefined ? interactive : Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`bg-white/80 backdrop-blur-md border border-slate-200/70 shadow-sm rounded-2xl p-5 transition-all duration-300 ${
        isInteractive
          ? 'cursor-pointer hover:bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
