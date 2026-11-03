import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogosApi } from '@/api/catalogos.api';
import { SearchableSelect, type SelectOption } from '@/components/common/SearchableSelect';
import type { FincaDto } from '@/types';

interface FincaSelectProps {
  value: number | string | undefined | null;
  onChange: (value: number, finca?: FincaDto) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const FincaSelect: React.FC<FincaSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Seleccionar Finca Ganadera --',
  searchPlaceholder = 'Buscar finca por nombre o productor...',
  disabled = false,
  required = false,
  allowClear = true,
  style,
  className,
}) => {
  const { data: fincas = [], isLoading } = useQuery<FincaDto[]>({
    queryKey: ['fincas-catalogos'],
    queryFn: () => catalogosApi.getFincas(true),
    staleTime: 1000 * 60 * 5,
  });

  const options: SelectOption[] = useMemo(() => {
    return fincas.map((f) => ({
      value: f.id,
      label: f.nombre,
      subLabel: f.propietarioNombre ? `Ganadero: ${f.propietarioNombre}` : undefined,
      badge: f.tipoLeche === 'BUFALA' ? '🐃 BÚFALA' : '🥛 VACA',
    }));
  }, [fincas]);

  const handleChange = (val: string | number) => {
    const num = Number(val) || 0;
    const match = fincas.find((f) => f.id === num);
    onChange(num, match);
  };

  return (
    <SearchableSelect
      options={options}
      value={value ? Number(value) : ''}
      onChange={handleChange}
      placeholder={isLoading ? 'Cargando fincas...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      disabled={disabled || isLoading}
      required={required}
      allowClear={allowClear}
      style={style}
      className={className}
    />
  );
};

