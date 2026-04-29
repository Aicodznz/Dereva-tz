import React from 'react';
import { Package, FileText, Smartphone, Box, Pill, Dog } from 'lucide-react';
import { ParcelCategory } from '../../../types/parcel';

interface Props {
  category: ParcelCategory;
  size?: 'sm' | 'md' | 'lg';
}

const CategoryBadge: React.FC<Props> = ({ category, size = 'sm' }) => {
  const categories: Record<string, { icon: any, color: string, label: string }> = {
    gift: { icon: Package, color: '#D4537E', label: 'Zawadi' },
    document: { icon: FileText, color: '#378ADD', label: 'Hati' },
    electronics: { icon: Smartphone, color: '#EF9F27', label: 'Elektroniki' },
    package: { icon: Box, color: '#888780', label: 'Kifurushi' },
    medicine: { icon: Pill, color: '#E24B4A', label: 'Dawa' },
    pet_supplies: { icon: Dog, color: '#639922', label: 'Mifugo' }
  };

  // Add aliases for common plural/mismatched strings
  const config = categories[category] || 
                 categories[category?.replace(/s$/, '')] || 
                 categories.package;

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 gap-1 text-[9px] rounded-md',
    md: 'px-4 py-2 gap-2 text-[11px] rounded-lg',
    lg: 'px-6 py-3 gap-3 text-[13px] rounded-xl'
  }[size];

  const iconSizes = {
    sm: 10,
    md: 14,
    lg: 18
  }[size];

  return (
    <div 
      className={`inline-flex items-center font-black uppercase tracking-widest leading-none ${sizeClasses}`}
      style={{ backgroundColor: `${config.color}20`, color: config.color, border: `1px solid ${config.color}30` }}
    >
      <Icon size={iconSizes} />
      {config.label}
    </div>
  );
};

export default CategoryBadge;
