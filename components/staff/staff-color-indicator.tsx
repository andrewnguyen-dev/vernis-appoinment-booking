"use client";

interface StaffColorIndicatorProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StaffColorIndicator({ 
  color, 
  size = 'md', 
  className = '' 
}: StaffColorIndicatorProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border border-gray-200 flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      title="Staff member color"
    />
  );
}
