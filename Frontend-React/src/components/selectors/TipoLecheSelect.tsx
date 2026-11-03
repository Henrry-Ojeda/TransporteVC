import React from 'react';
import { SearchableSelect, type SelectOption } from '@/components/common/SearchableSelect';

interface TipoLecheSelectProps {
  value: string | undefined | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const TIPOS_LECHE_OPTIONS: SelectOption[] = [
  { value: 'VACA', label: '🥛 Leche de Vaca' },
  { value: 'BUFALA', label: '🐃 Leche de Búfala' },
];

export const TipoLecheSelect: React.FC<TipoLecheSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Seleccionar Tipo de Leche --',
  disabled = false,
  required = false,
  allowClear = false,
  style,
  className,
}) => {
  return (
    <SearchableSelect
      options={TIPOS_LECHE_OPTIONS}
      value={value || 'VACA'}
      onChange={(val) => onChange(String(val || 'VACA'))}
      placeholder={placeholder}
      searchPlaceholder="Buscar tipo de leche..."
      disabled={disabled}
      required={required}
      allowClear={allowClear}
      style={style}
      className={className}
    />
  );
};

