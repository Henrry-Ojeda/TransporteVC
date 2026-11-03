import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogosApi } from '@/api/catalogos.api';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { PropietarioDto } from '@/types';

export interface PropietarioSelectProps {
  value: number | string | undefined | null;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  className?: string;
  style?: React.CSSProperties;
  soloActivos?: boolean;
}

export const PropietarioSelect: React.FC<PropietarioSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Seleccionar Propietario Ganadero --',
  searchPlaceholder = 'Buscar ganadero por nombre o RIF...',
  disabled = false,
  required = false,
  allowClear = true,
  className = '',
  style,
  soloActivos = true,
}) => {
  const { data: propietarios = [], isLoading } = useQuery<PropietarioDto[]>({
    queryKey: ['propietarios-selector'],
    queryFn: () => catalogosApi.getPropietarios(),
    staleTime: 1000 * 60 * 5,
  });

  const options = useMemo(() => {
    return propietarios
      .filter((p: any) => {
        if (!soloActivos) return true;
        const estado = (p.estado || p.Estado || 'ACTIVO').toUpperCase();
        return estado === 'ACTIVO' || estado === '1' || p.activo === true;
      })
      .map((p: any) => {
        const id = p.id ?? p.Id;
        const rawName = String(p.nombre || p.Nombre || p.nombreCompleto || p.NombreCompleto || p.propietario || p.Propietario || '').trim();
        const rif = String(p.cedulaRIF || p.cedulaRif || p.CedulaRIF || p.rif || p.RIF || '').trim();
        const nombre = rawName || (rif ? `Ganadero (${rif})` : `Ganadero #${id}`);
        const totalFincas = p.totalFincas ?? p.TotalFincas ?? 0;

        let subLabel = '';
        if (rif) {
          subLabel = `RIF: ${rif}`;
          if (totalFincas > 0) subLabel += ` • ${totalFincas} ${totalFincas === 1 ? 'finca' : 'fincas'}`;
        } else if (totalFincas > 0) {
          subLabel = `${totalFincas} ${totalFincas === 1 ? 'finca registrada' : 'fincas registradas'}`;
        }

        return {
          value: id,
          label: nombre,
          subLabel: subLabel || undefined,
        };
      });
  }, [propietarios, soloActivos]);

  return (
    <SearchableSelect
      options={options}
      value={value ?? ''}
      onChange={(val) => onChange(val ? Number(val) : undefined)}
      placeholder={isLoading ? 'Cargando ganaderos...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      disabled={disabled || isLoading}
      required={required}
      allowClear={allowClear}
      className={className}
      style={style}
    />
  );
};

