import React, { useMemo } from 'react';
import { SearchableSelect, type SelectOption } from '@/components/common/SearchableSelect';
import { useAuthStore } from '@/stores/authStore';

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
  const hasBufala = useAuthStore((state) => state.hasTenantModule('MOD_LECHE_BUFALA'));

  const options: SelectOption[] = useMemo(() => {
    if (!hasBufala) {
      return [{ value: 'VACA', label: '🥛 Leche de Vaca' }];
    }
    return [
      { value: 'VACA', label: '🥛 Leche de Vaca' },
      { value: 'BUFALA', label: '🐃 Leche de Búfala' },
    ];
  }, [hasBufala]);

  // Si no tiene búfala y viene con búfala u otro, forzar VACA
  const valorEfectivo = !hasBufala ? 'VACA' : (value || 'VACA');

  return (
    <SearchableSelect
      options={options}
      value={valorEfectivo}
      onChange={(val) => onChange(String(val || 'VACA'))}
      placeholder={placeholder}
      searchPlaceholder="Buscar tipo de leche..."
      disabled={disabled || !hasBufala}
      required={required}
      allowClear={allowClear}
      style={style}
      className={className}
    />
  );
};

