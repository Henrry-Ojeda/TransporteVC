import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogosApi } from '@/api/catalogos.api';
import { SearchableSelect, type SelectOption } from '@/components/common/SearchableSelect';
import type { CamionDto } from '@/types';

interface CamionSelectProps {
  value: number | string | undefined | null;
  onChange: (value: number, camion?: CamionDto) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const CamionSelect: React.FC<CamionSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Seleccionar Camión Cisterna --',
  searchPlaceholder = 'Buscar camión por placa, marca o chofer...',
  disabled = false,
  required = false,
  allowClear = true,
  style,
  className,
}) => {
  const { data: camiones = [], isLoading } = useQuery<CamionDto[]>({
    queryKey: ['camiones-catalogos'],
    queryFn: () => catalogosApi.getCamiones(true),
    staleTime: 1000 * 60 * 5,
  });

  const options: SelectOption[] = useMemo(() => {
    return camiones.map((c) => ({
      value: c.id,
      label: `${c.placa} - ${c.marca || 'Cisterna'} ${c.modelo || ''}`.trim(),
      subLabel: `Chofer: ${c.choferNombre || 'Sin chofer asignado'} | Capacidad: ${(c.capacidadLitros || 0).toLocaleString()} Lts`,
      badge: `${(c.capacidadLitros || 0).toLocaleString()} L`,
    }));
  }, [camiones]);

  const handleChange = (val: string | number) => {
    const num = Number(val) || 0;
    const match = camiones.find((c) => c.id === num);
    onChange(num, match);
  };

  return (
    <SearchableSelect
      options={options}
      value={value ? Number(value) : ''}
      onChange={handleChange}
      placeholder={isLoading ? 'Cargando camiones...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      disabled={disabled || isLoading}
      required={required}
      allowClear={allowClear}
      style={style}
      className={className}
    />
  );
};
