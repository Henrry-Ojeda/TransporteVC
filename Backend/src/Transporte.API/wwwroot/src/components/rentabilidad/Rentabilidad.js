// ==========================================================================
// MÓDULO: ADMINISTRACIÓN GENERAL Y BALANCE DE RENTABILIDAD
// ==========================================================================
var datosAdminGeneralActual = null;

function seleccionarPeriodoAdmin(tipo) {
    const btnActiva = document.getElementById('btnAdminFiltroSemanaActiva');
    const btnAnt = document.getElementById('btnAdminFiltroSemanaAnterior');
    const btnMes = document.getElementById('btnAdminFiltroMes');
    const inputDesde = document.getElementById('adminFechaDesde');
    const inputHasta = document.getElementById('adminFechaHasta');

    if (btnActiva) btnActiva.classList.remove('active');
    if (btnAnt) btnAnt.classList.remove('active');
    if (btnMes) btnMes.classList.remove('active');

    let fIni = '';
    let fFin = '';

    if (tipo === 'activa') {
        if (btnActiva) btnActiva.classList.add('active');
        if (state.cicloActivo && state.cicloActivo.fechaInicio && state.cicloActivo.fechaFin) {
            fIni = state.cicloActivo.fechaInicio.split('T')[0];
            fFin = state.cicloActivo.fechaFin.split('T')[0];
        } else {
            const hoy = new Date();
            const diaSem = hoy.getDay();
            const diffMartes = (diaSem >= 2) ? (diaSem - 2) : (diaSem + 5);
            const martes = new Date(hoy);
            martes.setDate(hoy.getDate() - diffMartes);
            const lunes = new Date(martes);
            lunes.setDate(martes.getDate() + 6);
            fIni = martes.toISOString().split('T')[0];
            fFin = lunes.toISOString().split('T')[0];
        }
    } else if (tipo === 'anterior') {
        if (btnAnt) btnAnt.classList.add('active');
        let refIni = new Date();
        if (state.cicloActivo && state.cicloActivo.fechaInicio) {
            refIni = new Date(state.cicloActivo.fechaInicio.split('T')[0] + 'T12:00:00');
        } else {
            const diaSem = refIni.getDay();
            const diffMartes = (diaSem >= 2) ? (diaSem - 2) : (diaSem + 5);
            refIni.setDate(refIni.getDate() - diffMartes);
        }
        const martesAnt = new Date(refIni);
        martesAnt.setDate(refIni.getDate() - 7);
        const lunesAnt = new Date(martesAnt);
        lunesAnt.setDate(martesAnt.getDate() + 6);
        fIni = martesAnt.toISOString().split('T')[0];
        fFin = lunesAnt.toISOString().split('T')[0];
    } else if (tipo === 'mes') {
        if (btnMes) btnMes.classList.add('active');
        const hoy = new Date();
        const primeroMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fIni = primeroMes.toISOString().split('T')[0];
        fFin = hoy.toISOString().split('T')[0];
    }

    if (inputDesde) inputDesde.value = fIni;
    if (inputHasta) inputHasta.value = fFin;

    cargarAdministracionGeneral();
}
window.seleccionarPeriodoAdmin = seleccionarPeriodoAdmin;

function desmarcarPillsAdmin() {
    const btnActiva = document.getElementById('btnAdminFiltroSemanaActiva');
    const btnAnt = document.getElementById('btnAdminFiltroSemanaAnterior');
    const btnMes = document.getElementById('btnAdminFiltroMes');
    if (btnActiva) btnActiva.classList.remove('active');
    if (btnAnt) btnAnt.classList.remove('active');
    if (btnMes) btnMes.classList.remove('active');
}
window.desmarcarPillsAdmin = desmarcarPillsAdmin;

async function cargarAdministracionGeneral() {
    const container = document.getElementById('contenedorAdministracionGeneral');
    if (!container) return;

    let inputDesde = document.getElementById('adminFechaDesde');
    let inputHasta = document.getElementById('adminFechaHasta');
    const lblTasa = document.getElementById('lblAdminTasaBcv');

    if (lblTasa) {
        lblTasa.innerText = `Bs. ${formatearNumero(state.tasaBcv || 0, 4)}`;
    }

    let fIni = inputDesde?.value;
    let fFin = inputHasta?.value;

    if (!fIni || !fFin) {
        if (state.cicloActivo && state.cicloActivo.fechaInicio && state.cicloActivo.fechaFin) {
            fIni = state.cicloActivo.fechaInicio.split('T')[0];
            fFin = state.cicloActivo.fechaFin.split('T')[0];
        } else {
            const hoy = new Date();
            const diaSem = hoy.getDay();
            const diffMartes = (diaSem >= 2) ? (diaSem - 2) : (diaSem + 5);
            const martes = new Date(hoy);
            martes.setDate(hoy.getDate() - diffMartes);
            const lunes = new Date(martes);
            lunes.setDate(martes.getDate() + 6);
            fIni = martes.toISOString().split('T')[0];
            fFin = lunes.toISOString().split('T')[0];
        }
        if (inputDesde) inputDesde.value = fIni;
        if (inputHasta) inputHasta.value = fFin;
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 36px; color: #10b981; margin-bottom: 14px; display: block;"></i>
            <span style="font-size: 15px; font-weight: 600; color: #334155;">Consolidando datos administrativos y balances de rentabilidad...</span>
        </div>
    `;

    try {
        const headers = { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' };

        const [resComp, resFincas, resChof, resCatComp, resCatFincas] = await Promise.all([
            fetch(`${API_BASE}/reportes/relacion-companias?fechaInicio=${fIni}&fechaFin=${fFin}`, { headers }),
            fetch(`${API_BASE}/reportes/fincas?fechaInicio=${fIni}&fechaFin=${fFin}`, { headers }),
            fetch(`${API_BASE}/reportes/relacion-choferes?fechaInicio=${fIni}&fechaFin=${fFin}`, { headers }),
            fetch(`${API_BASE}/catalogos/companias`, { headers }),
            fetch(`${API_BASE}/catalogos/fincas`, { headers })
        ]);

        if (!resComp.ok || !resFincas.ok) {
            throw new Error('No se pudieron obtener los datos completos del servidor.');
        }

        if (resCatComp && resCatComp.ok) {
            state.companias = await resCatComp.json();
        }
        if (resCatFincas && resCatFincas.ok) {
            state.fincas = await resCatFincas.json();
        }

        const rawComp = await resComp.json();
        const rawFincas = await resFincas.json();
        const rawChof = resChof.ok ? (await resChof.json()) : [];

        // 1. COMPAÑÍAS: Separación entre RUTA PROPIA (Ventas de Leche) y TRANSPORTE (Servicio Flete $0.10/L)
        const compValidas = (rawComp || []).filter(c => {
            const nom = (c.companiaNombre || c.CompaniaNombre || '').toUpperCase();
            return !nom.includes('RECEPTOR');
        });

        const companiasLeche = [];
        const companiasTransporte = [];

        compValidas.forEach(c => {
            const nom = (c.companiaNombre || c.CompaniaNombre || '').toUpperCase();
            const tsId = Number(c.tipoServicioId || c.TipoServicioId || 1);
            const tsNom = (c.tipoServicioNombre || c.TipoServicioNombre || '').toUpperCase();
            const esTransporte = tsId === 2 || tsNom.includes('TRANSPORTE') || nom.includes('COLONA') || nom.includes('TRANSPORTE');
            if (esTransporte) {
                companiasTransporte.push(c);
            } else {
                companiasLeche.push(c);
            }
        });

        // 1.A. Venta de Leche Propia (Compañías de Ruta Propia)
        let ltsVacaComp = 0, usdVacaComp = 0;
        let ltsBufalaComp = 0, usdBufalaComp = 0;
        let ltsAcidaComp = 0, usdAcidaComp = 0;
        let totalLitrosComp = 0, totalUSDComp = 0, totalAbonosUSDComp = 0, totalNetoUSDComp = 0;

        companiasLeche.forEach(c => {
            const cId = Number(c.companiaId || c.CompaniaId || c.id || c.Id || 0);
            const compCat = (state.companias || []).find(cat => (cat.id || cat.Id) === cId) || {};

            const pUnitVaca = Number(compCat.precioCompraLitroUSD !== undefined && compCat.precioCompraLitroUSD !== null ? compCat.precioCompraLitroUSD : (c.precioLitroUSD || c.PrecioLitroUSD || 0));
            const pUnitBufala = Number(compCat.precioBufalaLitroUSD !== undefined && compCat.precioBufalaLitroUSD !== null ? compCat.precioBufalaLitroUSD : (c.precioBufalaLitroUSD || c.PrecioBufalaLitroUSD || pUnitVaca || 0));
            const pUnitAcida = Number(compCat.precioAcidaLitroUSD !== undefined && compCat.precioAcidaLitroUSD !== null ? compCat.precioAcidaLitroUSD : (c.precioAcidaLitroUSD || c.PrecioAcidaLitroUSD || 0));

            const cAbUSD = Number(c.totalAbonosUSD || c.TotalAbonosUSD || 0);

            let ltsVacaCompLocal = 0, usdVacaCompLocal = 0;
            let ltsBufalaCompLocal = 0, usdBufalaCompLocal = 0;
            let ltsAcidaCompLocal = 0, usdAcidaCompLocal = 0;

            const entregas = c.entregasDetalle || c.EntregasDetalle || [];
            if (entregas.length > 0) {
                entregas.forEach(e => {
                    const eLts = Number(e.litros || e.Litros || 0);
                    const eTipo = (e.tipoLeche || e.TipoLeche || '').toUpperCase();
                    const eObs = (e.observacion || e.Observacion || '').toUpperCase();
                    const esAcida = e.esAcida || e.EsAcida || eTipo.includes('ACID') || eTipo.includes('ÁCID') || eObs.includes('ACID') || eObs.includes('ÁCID') || eObs.includes('MALA');
                    const esBufala = eTipo.includes('BUFAL') || eObs.includes('BUFAL');

                    if (esAcida) {
                        ltsAcidaCompLocal += eLts;
                        usdAcidaCompLocal += (eLts * pUnitAcida);
                    } else if (esBufala) {
                        ltsBufalaCompLocal += eLts;
                        usdBufalaCompLocal += (eLts * pUnitBufala);
                    } else {
                        ltsVacaCompLocal += eLts;
                        usdVacaCompLocal += (eLts * pUnitVaca);
                    }
                });
            } else {
                const cNom = (c.companiaNombre || c.CompaniaNombre || '').toUpperCase();
                const cLts = Number(c.totalLitros || c.TotalLitros || 0);
                if (cNom.includes('BUFAL')) {
                    ltsBufalaCompLocal += cLts;
                    usdBufalaCompLocal += (cLts * pUnitBufala);
                } else {
                    ltsVacaCompLocal += cLts;
                    usdVacaCompLocal += (cLts * pUnitVaca);
                }
            }

            const cLtsTotal = ltsVacaCompLocal + ltsBufalaCompLocal + ltsAcidaCompLocal;
            const cUSDTotal = usdVacaCompLocal + usdBufalaCompLocal + usdAcidaCompLocal;
            const cNetUSD = cUSDTotal - cAbUSD;

            c.totalUSD = cUSDTotal;
            c.totalNetoUSD = cNetUSD;
            c.precioLitroUSD = pUnitVaca;

            ltsVacaComp += ltsVacaCompLocal;
            usdVacaComp += usdVacaCompLocal;
            ltsBufalaComp += ltsBufalaCompLocal;
            usdBufalaComp += usdBufalaCompLocal;
            ltsAcidaComp += ltsAcidaCompLocal;
            usdAcidaComp += usdAcidaCompLocal;

            totalLitrosComp += cLtsTotal;
            totalUSDComp += cUSDTotal;
            totalAbonosUSDComp += cAbUSD;
            totalNetoUSDComp += cNetUSD;
        });

        // 1.B. Servicio de Transporte a Terceros (Cobro de Flete $0.10 por litro entregado: Vaca y Búfala)
        let ltsVacaTransp = 0, usdVacaTransp = 0;
        let ltsBufalaTransp = 0, usdBufalaTransp = 0;
        let totalLitrosTransporte = 0, totalUSDTransporte = 0, totalAbonosUSDTransporte = 0, totalNetoUSDTransporte = 0;

        companiasTransporte.forEach(c => {
            const cId = Number(c.companiaId || c.CompaniaId || c.id || c.Id || 0);
            const compCat = (state.companias || []).find(cat => (cat.id || cat.Id) === cId) || {};
            const cLts = Number(c.totalLitros || c.TotalLitros || 0);
            
            const pFleteVaca = Number(compCat.precioCompraLitroUSD !== undefined && compCat.precioCompraLitroUSD !== null ? compCat.precioCompraLitroUSD : (c.precioLitroUSD || c.PrecioLitroUSD || 0.10));
            const pFleteBufala = Number(compCat.precioBufalaLitroUSD !== undefined && compCat.precioBufalaLitroUSD !== null ? compCat.precioBufalaLitroUSD : (c.precioBufalaLitroUSD || c.PrecioBufalaLitroUSD || pFleteVaca || 0.10));
            const cAbUSD = Number(c.totalAbonosUSD || c.TotalAbonosUSD || 0);

            let ltsVacaCompLocal = 0, usdVacaCompLocal = 0;
            let ltsBufalaCompLocal = 0, usdBufalaCompLocal = 0;

            const entregas = c.entregasDetalle || c.EntregasDetalle || [];
            if (entregas.length > 0) {
                entregas.forEach(e => {
                    const eLts = Number(e.litros || e.Litros || 0);
                    const eTipo = (e.tipoLeche || e.TipoLeche || '').toUpperCase();
                    const eObs = (e.observacion || e.Observacion || '').toUpperCase();

                    if (eTipo.includes('BUFAL') || eObs.includes('BUFAL')) {
                        ltsBufalaCompLocal += eLts;
                        usdBufalaCompLocal += (eLts * pFleteBufala);
                    } else {
                        ltsVacaCompLocal += eLts;
                        usdVacaCompLocal += (eLts * pFleteVaca);
                    }
                });
            } else {
                const cNom = (c.companiaNombre || c.CompaniaNombre || '').toUpperCase();
                if (cNom.includes('BUFAL')) {
                    ltsBufalaCompLocal += cLts;
                    usdBufalaCompLocal += (cLts * pFleteBufala);
                } else {
                    ltsVacaCompLocal += cLts;
                    usdVacaCompLocal += (cLts * pFleteVaca);
                }
            }

            const cUSD = usdVacaCompLocal + usdBufalaCompLocal;
            const cNetUSD = cUSD - cAbUSD;

            c.totalUSD = cUSD;
            c.totalNetoUSD = cNetUSD;
            c.precioLitroUSD = pFleteVaca;

            ltsVacaTransp += ltsVacaCompLocal;
            usdVacaTransp += usdVacaCompLocal;
            ltsBufalaTransp += ltsBufalaCompLocal;
            usdBufalaTransp += usdBufalaCompLocal;

            totalLitrosTransporte += cLts;
            totalUSDTransporte += cUSD;
            totalAbonosUSDTransporte += cAbUSD;
            totalNetoUSDTransporte += cNetUSD;
        });

        // Clasificación de Fincas: RUTA PROPIA (Compra Leche / Costo) vs TRANSPORTE (Flete Terceros / Acopio Campo)
        const idsTransporte = [54, 55, 57, 58, 71, 72, 76, 13114];
        const fincasRuta = [];
        const fincasTransporteCampo = [];

        (rawFincas || []).forEach(f => {
            const fId = Number(f.id || f.Id || 0);
            const tipoServId = Number(f.tipoServicioId || f.TipoServicioId || 1);
            const tipoServNom = (f.tipoServicioNombre || f.TipoServicioNombre || '').toUpperCase();

            // Es modalidad TRANSPORTE (Flete / Acarreo a Terceros)
            const esTransporte = tipoServId === 2 || tipoServNom.includes('TRANSPORTE') || idsTransporte.includes(fId);

            if (esTransporte) {
                fincasTransporteCampo.push(f);
            } else {
                fincasRuta.push(f);
            }
        });

        // 2.A. FINCAS DE RUTA PROPIA (Compras / Costo Real de Leche Propia)
        let ltsVacaFincas = 0, usdVacaFincas = 0;
        let ltsBufalaFincas = 0, usdBufalaFincas = 0;
        let ltsAcidaFincas = 0, usdAcidaFincas = 0;
        let totalLitrosFincasRuta = 0, totalUSDFincasRuta = 0, totalAdelantosUSDFincasRuta = 0, totalNetoUSDFincasRuta = 0;

        fincasRuta.forEach(f => {
            const fId = Number(f.id || f.Id || f.fincaId || f.FincaId || 0);
            const fincaCat = (state.fincas || []).find(cat => (cat.id || cat.Id) === fId) || {};
            const pVacaFinca = Number(fincaCat.precioLitroUSD !== undefined && fincaCat.precioLitroUSD !== null ? fincaCat.precioLitroUSD : (f.precioLitroUSD || f.PrecioLitroUSD || 0));
            const pBufalaFinca = Number(fincaCat.precioBufalaLitroUSD !== undefined && fincaCat.precioBufalaLitroUSD !== null ? fincaCat.precioBufalaLitroUSD : (f.precioBufalaLitroUSD || f.PrecioBufalaLitroUSD || (f.tieneDosTiposLeche ? pVacaFinca : (fincaCat.precioLitroUSD || f.precioLitroUSD)) || 0));
            const pAcidaFinca = Number(fincaCat.precioLitroAcidaUSD !== undefined && fincaCat.precioLitroAcidaUSD !== null ? fincaCat.precioLitroAcidaUSD : (f.precioLitroAcidaUSD || f.PrecioLitroAcidaUSD || 0));

            const fAdUSD = Number(f.totalAdelantosUSD || f.TotalAdelantosUSD || 0);

            let ltsVacaFincaLocal = 0, usdVacaFincaLocal = 0;
            let ltsBufalaFincaLocal = 0, usdBufalaFincaLocal = 0;
            let ltsAcidaFincaLocal = 0, usdAcidaFincaLocal = 0;

            const detalle = f.detalle || f.Detalle || [];
            if (detalle.length > 0) {
                detalle.forEach(dItem => {
                    const dLts = Number(dItem.litros || dItem.Litros || 0);
                    const dTipo = (dItem.tipoLeche || dItem.TipoLeche || 'VACA').toUpperCase();
                    const fNom = (f.nombre || f.Nombre || '').toUpperCase();
                    const dEsAcida = dItem.esAcida || dItem.EsAcida;
                    const dEsBufala = dTipo.includes('BUFAL') || fNom.includes('BUFAL');

                    if (dEsAcida) {
                        ltsAcidaFincaLocal += dLts;
                        usdAcidaFincaLocal += (dLts * pAcidaFinca);
                    } else if (dEsBufala) {
                        const p = pBufalaFinca > 0 ? pBufalaFinca : pVacaFinca;
                        ltsBufalaFincaLocal += dLts;
                        usdBufalaFincaLocal += (dLts * p);
                    } else {
                        ltsVacaFincaLocal += dLts;
                        usdVacaFincaLocal += (dLts * pVacaFinca);
                    }
                });
            } else {
                const fNom = (f.nombre || f.Nombre || '').toUpperCase();
                const fLts = Number(f.totalLitros || f.TotalLitros || 0);
                const esBufala = fNom.includes('BUFAL');
                if (esBufala) {
                    const p = pBufalaFinca > 0 ? pBufalaFinca : pVacaFinca;
                    ltsBufalaFincaLocal += fLts;
                    usdBufalaFincaLocal += (fLts * p);
                } else {
                    ltsVacaFincaLocal += fLts;
                    usdVacaFincaLocal += (fLts * pVacaFinca);
                }
            }

            const fLtsTotal = ltsVacaFincaLocal + ltsBufalaFincaLocal + ltsAcidaFincaLocal;
            const fUSDTotal = usdVacaFincaLocal + usdBufalaFincaLocal + usdAcidaFincaLocal;
            const fNetUSD = fUSDTotal - fAdUSD;

            f.totalUSD = fUSDTotal;
            f.totalNetoUSD = fNetUSD;
            f.precioLitroUSD = pVacaFinca;

            ltsVacaFincas += ltsVacaFincaLocal;
            usdVacaFincas += usdVacaFincaLocal;
            ltsBufalaFincas += ltsBufalaFincaLocal;
            usdBufalaFincas += usdBufalaFincaLocal;
            ltsAcidaFincas += ltsAcidaFincaLocal;
            usdAcidaFincas += usdAcidaFincaLocal;

            totalLitrosFincasRuta += fLtsTotal;
            totalUSDFincasRuta += fUSDTotal;
            totalAdelantosUSDFincasRuta += fAdUSD;
            totalNetoUSDFincasRuta += fNetUSD;
        });

        // 2.B. FINCAS DE TRANSPORTE A TERCEROS (Acopio en Campo / Servicio de Fletes)
        let ltsVacaTranspCampo = 0;
        let ltsBufalaTranspCampo = 0;
        let totalLitrosTransporteCampo = 0;

        fincasTransporteCampo.forEach(f => {
            const fId = Number(f.id || f.Id || f.fincaId || f.FincaId || 0);
            const fincaCat = (state.fincas || []).find(cat => (cat.id || cat.Id) === fId) || {};
            const pTarifa = Number(fincaCat.precioLitroUSD !== undefined && fincaCat.precioLitroUSD !== null ? fincaCat.precioLitroUSD : (f.precioLitroUSD || f.PrecioLitroUSD || 0.10));
            const fLts = Number(f.totalLitros || f.TotalLitros || 0);
            f.precioLitroUSD = pTarifa;
            f.totalUSD = fLts * pTarifa;
            totalLitrosTransporteCampo += fLts;

            const detalle = f.detalle || f.Detalle || [];
            if (detalle.length > 0) {
                detalle.forEach(dItem => {
                    const dLts = Number(dItem.litros || dItem.Litros || 0);
                    const dTipo = (dItem.tipoLeche || dItem.TipoLeche || 'VACA').toUpperCase();
                    if (dTipo.includes('BUFAL') || (f.nombre || f.Nombre || '').toUpperCase().includes('BUFAL')) {
                        ltsBufalaTranspCampo += dLts;
                    } else {
                        ltsVacaTranspCampo += dLts;
                    }
                });
            } else {
                const fNom = (f.nombre || f.Nombre || '').toUpperCase();
                if (fNom.includes('BUFAL')) {
                    ltsBufalaTranspCampo += fLts;
                } else {
                    ltsVacaTranspCampo += fLts;
                }
            }
        });

        // 3. FLETES / CHOFERES (Gastos Operativos de Traslado)
        let totalFletesUSD = 0;
        (rawChof || []).forEach(ch => {
            totalFletesUSD += Number(ch.fleteTotalUSD || ch.FleteTotalUSD || 0);
        });

        // 4. CONCILIACIÓN DE VENTAS DE LECHE PROPIA VS TRANSPORTE
        const precioPromVentaVaca = ltsVacaComp > 0 ? (usdVacaComp / ltsVacaComp) : 0;
        const precioPromCompraVaca = ltsVacaFincas > 0 ? (usdVacaFincas / ltsVacaFincas) : 0;
        const gananciaLitroVaca = precioPromVentaVaca - precioPromCompraVaca;
        const gananciaTotalVaca = usdVacaComp - usdVacaFincas;

        const precioPromVentaBufala = ltsBufalaComp > 0 ? (usdBufalaComp / ltsBufalaComp) : 0;
        const precioPromCompraBufala = ltsBufalaFincas > 0 ? (usdBufalaFincas / ltsBufalaFincas) : 0;
        const gananciaLitroBufala = precioPromVentaBufala - precioPromCompraBufala;
        
        // Ventas de búfala propia: separar de la búfala despachada por acarreo/transporte de terceros
        const ltsBufalaVentaRuta = (ltsBufalaComp > ltsBufalaFincas && ltsBufalaTranspCampo > 0) ? ltsBufalaFincas : ltsBufalaComp;
        const usdVentaBufalaRuta = ltsBufalaVentaRuta * (precioPromVentaBufala > 0 ? precioPromVentaBufala : 0.94);
        const gananciaTotalBufala = usdVentaBufalaRuta - usdBufalaFincas;

        // Total Leche Propia Vendida y Facturada (Ruta Propia)
        const totalLitrosLechePropiaVendida = ltsVacaComp + ltsBufalaVentaRuta;
        const totalUSDLechePropiaVendida = usdVacaComp + usdVentaBufalaRuta;

        // Costo Leche Ruta Propia
        const costoLecheRuta = totalUSDFincasRuta;
        // Margen Bruto de Leche Propia (Ganancia Vaca + Ganancia Búfala)
        const margenBrutoLeche = gananciaTotalVaca + gananciaTotalBufala;
        // Ingresos Operativos Totales (Venta Leche Propia + Fletes Transporte Terceros)
        const totalIngresosOperativos = totalUSDLechePropiaVendida + totalUSDTransporte;
        // Margen Operativo Total (Margen Leche Propia + Ingresos Transporte)
        const margenOperativoTotal = margenBrutoLeche + totalUSDTransporte;
        // Utilidad Teórica Contable en USD (Margen Operativo Total - Gastos Operativos Choferes)
        const utilidadNetaUSD = margenOperativoTotal - totalFletesUSD;
        
        // CÁLCULO DE IMPACTO CAMBIARIO (DEVALUACIÓN BS / DÓLAR):
        const tasaBcv = Number(state.tasaBcv || 791.3248);
        const tasaActualReposicion = (state.historialBcv && state.historialBcv.length > 0) 
            ? Number(state.historialBcv[0].tasaDolarBs || state.historialBcv[0].TasaDolarBs || tasaBcv) 
            : 842.2067;
        
        const utilidadNetaBs = tasaBcv > 0 ? (utilidadNetaUSD * tasaBcv) : 0;
        const utilidadRealEfectivaUSD = tasaActualReposicion > 0 ? (utilidadNetaBs / tasaActualReposicion) : utilidadNetaUSD;
        const perdidaCambiariaUSD = utilidadNetaUSD - utilidadRealEfectivaUSD;
        const perdidaCambiariaPct = utilidadNetaUSD > 0 ? ((perdidaCambiariaUSD / utilidadNetaUSD) * 100) : 0;

        const baseLitrosMargen = totalLitrosFincasRuta > 0 ? totalLitrosFincasRuta : totalLitrosLechePropiaVendida;
        const margenNetoPorLitro = baseLitrosMargen > 0 ? (utilidadRealEfectivaUSD / baseLitrosMargen) : 0;
        const margenRentabilidadPct = totalIngresosOperativos > 0 ? ((utilidadRealEfectivaUSD / totalIngresosOperativos) * 100) : 0;

        const totalLitrosRecibidosCampo = totalLitrosFincasRuta + totalLitrosTransporteCampo;
        const totalLitrosDespachadosGlobal = totalLitrosComp + totalLitrosTransporte;
        const diferenciaLitrosGlobal = totalLitrosRecibidosCampo - totalLitrosDespachadosGlobal;

        datosAdminGeneralActual = {
            fIni, fFin, tasaBcv, tasaActualReposicion,
            utilidadRealEfectivaUSD, perdidaCambiariaUSD, perdidaCambiariaPct,
            companias: compValidas,
            companiasLeche,
            companiasTransporte,
            fincas: rawFincas || [],
            fincasRuta,
            empresasTransporte: fincasTransporteCampo,
            fincasTransporteCampo,
            totalLitrosComp, totalUSDComp, totalAbonosUSDComp, totalNetoUSDComp,
            totalLitrosLechePropiaVendida, totalUSDLechePropiaVendida,
            totalLitrosFincasRuta, totalUSDFincasRuta, totalAdelantosUSDFincasRuta, totalNetoUSDFincasRuta,
            totalLitrosTransporte, totalUSDTransporte, totalAbonosUSDTransporte, totalNetoUSDTransporte,
            totalLitrosTransporteCampo,
            ltsVacaTransp, usdVacaTransp, ltsBufalaTransp, usdBufalaTransp,
            totalIngresosOperativos,
            totalLitrosRecibidosCampo,
            totalLitrosDespachadosGlobal,
            totalFletesUSD,
            margenBrutoLeche, margenOperativoTotal, utilidadNetaUSD, utilidadNetaBs, margenNetoPorLitro, margenRentabilidadPct,
            vaca: {
                ltsVenta: ltsVacaComp, usdVenta: usdVacaComp, precioVenta: precioPromVentaVaca,
                ltsCompra: ltsVacaFincas, usdCompra: usdVacaFincas, precioCompra: precioPromCompraVaca,
                gananciaLitro: gananciaLitroVaca, gananciaTotal: gananciaTotalVaca,
                difLitros: ltsVacaFincas - ltsVacaComp
            },
            bufala: {
                ltsVenta: ltsBufalaVentaRuta, usdVenta: usdVentaBufalaRuta, precioVenta: precioPromVentaBufala,
                ltsVentaTotalPlantas: ltsBufalaComp, usdVentaTotalPlantas: usdBufalaComp,
                ltsCompra: ltsBufalaFincas, usdCompra: usdBufalaFincas, precioCompra: precioPromCompraBufala,
                gananciaLitro: gananciaLitroBufala, gananciaTotal: gananciaTotalBufala,
                ltsTranspTerceros: ltsBufalaTranspCampo || ltsBufalaTransp,
                difLitros: ltsBufalaFincas - ltsBufalaVentaRuta
            },
            transporte: {
                ltsVaca: ltsVacaTransp || ltsVacaTranspCampo,
                usdVaca: usdVacaTransp,
                ltsBufala: ltsBufalaTransp || ltsBufalaTranspCampo,
                usdBufala: usdBufalaTransp,
                totalLitros: totalLitrosTransporte,
                totalUSD: totalUSDTransporte,
                tarifaProm: totalLitrosTransporte > 0 ? (totalUSDTransporte / totalLitrosTransporte) : 0.10
            },
            acida: {
                ltsVenta: ltsAcidaComp, usdVenta: usdAcidaComp,
                ltsCompra: ltsAcidaFincas, usdCompra: usdAcidaFincas
            },
            diferenciaLitrosGlobal
        };

        renderAdministracionGeneral(datosAdminGeneralActual);
    } catch (err) {
        console.error('Error al cargar administración general:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444; background: #fff; border-radius: 12px; border: 1px dashed #fca5a5;">
                <i class="fa-solid fa-circle-exclamation" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                <strong>Error al cargar la administración general:</strong><br>
                <span>${err.message}</span>
            </div>
        `;
    }
}
window.cargarAdministracionGeneral = cargarAdministracionGeneral;

function renderAdministracionGeneral(d) {
    const container = document.getElementById('contenedorAdministracionGeneral');
    if (!container || !d) return;

    const esPositivo = d.utilidadNetaUSD >= 0;
    const colorUtilidad = esPositivo ? '#10b981' : '#ef4444';
    const bgUtilidad = esPositivo 
        ? 'linear-gradient(135deg, #064e3b, #047857)' 
        : 'linear-gradient(135deg, #7f1d1d, #b91c1c)';

    const signoNeto = d.utilidadNetaUSD >= 0 ? '+' : '';
    const signoVaca = d.vaca.gananciaTotal >= 0 ? '+' : '';
    const signoBufala = d.bufala.gananciaTotal >= 0 ? '+' : '';

    // Filas para tabla de compañías
    let rowsCompHtml = '';
    d.companias.forEach(c => {
        const nom = c.companiaNombre || c.CompaniaNombre || '';
        const lts = Number(c.totalLitros || c.TotalLitros || 0);
        const pUSD = Number(c.precioLitroUSD || c.PrecioLitroUSD || 0);
        const bUSD = Number(c.totalUSD || c.TotalUSD || 0);
        const abUSD = Number(c.totalAbonosUSD || c.TotalAbonosUSD || 0);
        const netUSD = Number(c.totalNetoUSD || c.TotalNetoUSD || (bUSD - abUSD));

        let ltsV = 0, ltsB = 0;
        (c.entregasDetalle || c.EntregasDetalle || []).forEach(e => {
            const eL = Number(e.litros || e.Litros || 0);
            const eT = (e.tipoLeche || e.TipoLeche || '').toUpperCase();
            const eO = (e.observacion || e.Observacion || '').toUpperCase();
            if (eT.includes('BUFAL') || eO.includes('BUFAL')) ltsB += eL;
            else ltsV += eL;
        });
        if (ltsV === 0 && ltsB === 0) {
            if (nom.toUpperCase().includes('BUFAL')) ltsB = lts;
            else ltsV = lts;
        }

        rowsCompHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; text-align: left;">
                    <i class="fa-solid fa-building" style="color: #64748b; margin-right: 6px;"></i> ${nom}
                </td>
                <td style="padding: 10px 14px; text-align: right; color: #1e40af; font-weight: 700;">${formatearNumero(ltsV)} L</td>
                <td style="padding: 10px 14px; text-align: right; color: #047857; font-weight: 700;">${formatearNumero(ltsB)} L</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #0f172a;">${formatearNumero(lts)} L</td>
                <td style="padding: 10px 14px; text-align: right; color: #64748b;">$ ${formatearNumero(pUSD, 4)}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #2563eb;">$ ${formatearNumero(bUSD, 2)}</td>
                <td style="padding: 10px 14px; text-align: right; color: #e11d48; font-weight: 600;">${abUSD > 0 ? `-$${formatearNumero(abUSD, 2)}` : '-'}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #047857;">$ ${formatearNumero(netUSD, 2)}</td>
            </tr>
        `;
    });

    // Filas para tabla de EMPRESAS DE TRANSPORTE (Flete / Acarreo a Terceros - Ellos nos pagan a nosotros)
    let rowsTransporteHtml = '';
    (d.empresasTransporte || []).forEach(f => {
        const fId = f.id || f.Id;
        const nom = f.nombre || f.Nombre || '';
        const prop = f.propietario || f.Propietario || '';
        const lts = Number(f.totalLitros || f.TotalLitros || 0);
        const pUSD = Number(f.precioLitroUSD || f.PrecioLitroUSD || 0.10);
        const bUSD = Number(f.totalUSD || f.TotalUSD || (lts * pUSD));
        const bsVal = bUSD * (d.tasaBcv || 0);

        let ltsV = 0, ltsB = 0;
        const detalle = f.detalle || f.Detalle || [];
        if (detalle.length > 0) {
            detalle.forEach(item => {
                const itemLts = Number(item.litros || item.Litros || 0);
                const itemTipo = (item.tipoLeche || item.TipoLeche || 'VACA').toUpperCase();
                if (itemTipo.includes('BUFAL') || nom.toUpperCase().includes('BUFAL')) ltsB += itemLts;
                else ltsV += itemLts;
            });
        } else {
            if (nom.toUpperCase().includes('BUFAL')) ltsB = lts;
            else ltsV = lts;
        }

        let tipoBadge = '';
        if (ltsB > 0 && ltsV > 0) {
            tipoBadge = `<span style="background: #fdf4ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">MIXTO (V:${formatearNumero(ltsV)}L / B:${formatearNumero(ltsB)}L)</span>`;
        } else if (ltsB > 0) {
            tipoBadge = `<span style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;"><i class="fa-solid fa-leaf"></i> BÚFALA</span>`;
        } else {
            tipoBadge = `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;"><i class="fa-solid fa-cow"></i> VACA</span>`;
        }

        rowsTransporteHtml += `
            <tr style="border-bottom: 1px solid #f3e8ff; transition: background 0.15s;" onmouseover="this.style.background='#faf5ff'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
                            <i class="fa-solid fa-truck-moving"></i> TRANSPORTE
                        </span>
                        <span style="font-size: 13.5px; color: #0f172a;">${nom}</span>
                        ${tipoBadge}
                    </div>
                    ${prop ? `<span style="display: block; font-size: 11px; color: #64748b; font-weight: normal; margin-left: 4px;">Contacto: ${prop}</span>` : ''}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #6b21a8; font-size: 13.5px;">${formatearNumero(lts)} L</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0f172a;">
                    $ ${formatearNumero(pUSD, 4)} / L
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #7e22ce; font-size: 14px;">
                    $ ${formatearNumero(bUSD, 2)}
                </td>
                <td style="padding: 10px 14px; text-align: right; color: #64748b; font-weight: 700;">
                    Bs. ${formatearNumero(bsVal, 2)}
                </td>
                <td style="padding: 10px 14px; text-align: center;">
                    <button type="button" class="btn-action" style="padding: 4px 10px; font-size: 11px; font-weight: 700; background: #7e22ce; color: #fff; border-radius: 6px; border: none; cursor: pointer;" onclick="window.cambiarPrecioFincaTransporte(${fId}, '${nom.replace(/'/g, "\\'")}', ${pUSD})">
                        <i class="fa-solid fa-pen-to-square"></i> Tarifa
                    </button>
                </td>
            </tr>
        `;
    });

    // Filas para tabla de fincas RUTA PROPIA
    let rowsFincasHtml = '';
    (d.fincasRuta || []).forEach(f => {
        const nom = f.nombre || f.Nombre || '';
        const prop = f.propietario || f.Propietario || '';
        const lts = Number(f.totalLitros || f.TotalLitros || 0);
        const pUSD = Number(f.precioLitroUSD || f.PrecioLitroUSD || 0);
        const bUSD = Number(f.totalUSD || f.TotalUSD || 0);
        const adUSD = Number(f.totalAdelantosUSD || f.TotalAdelantosUSD || 0);
        const netUSD = Number(f.totalNetoUSD || f.TotalNetoUSD || (bUSD - adUSD));
        
        let ltsV = 0, ltsB = 0;
        const detalle = f.detalle || f.Detalle || [];
        if (detalle.length > 0) {
            detalle.forEach(item => {
                const itemLts = Number(item.litros || item.Litros || 0);
                const itemTipo = (item.tipoLeche || item.TipoLeche || 'VACA').toUpperCase();
                if (itemTipo.includes('BUFAL') || nom.toUpperCase().includes('BUFAL')) ltsB += itemLts;
                else ltsV += itemLts;
            });
        } else {
            if (nom.toUpperCase().includes('BUFAL')) ltsB = lts;
            else ltsV = lts;
        }

        let badgeTipoLeche = '';
        if (ltsB > 0 && ltsV > 0) {
            badgeTipoLeche = `<span style="background: #fdf4ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;"><i class="fa-solid fa-layer-group"></i> MIXTO (V:${formatearNumero(ltsV)}L / B:${formatearNumero(ltsB)}L)</span>`;
        } else if (ltsB > 0) {
            badgeTipoLeche = `<span style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;"><i class="fa-solid fa-leaf"></i> BÚFALA</span>`;
        } else {
            badgeTipoLeche = `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;"><i class="fa-solid fa-cow"></i> VACA</span>`;
        }

        rowsFincasHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; text-align: left;">
                    ${nom}
                    ${prop ? `<span style="display: block; font-size: 11px; color: #64748b; font-weight: normal;">${prop}</span>` : ''}
                </td>
                <td style="padding: 10px 14px; text-align: center;">
                    ${badgeTipoLeche}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0f172a;">${formatearNumero(lts)} L</td>
                <td style="padding: 10px 14px; text-align: right; color: #64748b;">$ ${formatearNumero(pUSD, 4)}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #475569;">$ ${formatearNumero(bUSD, 2)}</td>
                <td style="padding: 10px 14px; text-align: right; color: #e11d48; font-weight: 600;">${adUSD > 0 ? `-$${formatearNumero(adUSD, 2)}` : '-'}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #047857;">$ ${formatearNumero(netUSD, 2)}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <!-- BANNER SUPERIOR DE PERÍODO -->
        <div style="margin-bottom: 20px; background: #0f172a; color: #fff; padding: 16px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
            <div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 900; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-briefcase"></i> ESTADO DE RESULTADOS Y ADMINISTRACIÓN GENERAL
                </h3>
                <p style="margin: 4px 0 0 0; font-size: 12.5px; color: #94a3b8;">
                    Período Operativo: <strong style="color: #fff;">${formatearFechaLocal(d.fIni)}</strong> al <strong style="color: #fff;">${formatearFechaLocal(d.fFin)}</strong> | 
                    Tasa Oficial BCV: <strong style="color: #fbbf24;">Bs. ${formatearNumero(d.tasaBcv, 4)}</strong>
                </p>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-chart-line"></i> Rentabilidad: ${formatearNumero(d.margenRentabilidadPct, 1)}%
                </span>
            </div>
        </div>

        <!-- FILA 1: TARJETAS DE KPIS PRINCIPALES (LA SUMA Y RESTA GLOBAL CONSOLIDADA) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <!-- 1. VENTAS LECHE PROPIA -->
            <div style="background: #ffffff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(37,99,235,0.06);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em;">
                        <i class="fa-solid fa-circle-arrow-up" style="color: #2563eb;"></i> Ingresos (Ventas Leche)
                    </span>
                    <span style="background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                        ${(d.companiasLeche || []).length} Compañías
                    </span>
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #1e3a8a; margin-bottom: 4px;">
                    $ ${formatearNumero(d.totalUSDLechePropiaVendida, 2)}
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between;">
                    <span>Litros Vendidos (Ruta):</span>
                    <strong style="color: #0f172a;">${formatearNumero(d.totalLitrosLechePropiaVendida)} L</strong>
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between; margin-top: 2px;">
                    <span>Precio Promedio:</span>
                    <strong style="color: #2563eb;">$ ${formatearNumero(d.totalLitrosLechePropiaVendida > 0 ? (d.totalUSDLechePropiaVendida/d.totalLitrosLechePropiaVendida) : 0, 4)} / L</strong>
                </div>
            </div>

            <!-- 2. INGRESOS POR TRANSPORTE (FLETES A TERCEROS) -->
            <div style="background: #faf5ff; border: 1.5px solid #c084fc; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(147,51,234,0.06);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 800; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.05em;">
                        <i class="fa-solid fa-truck-moving" style="color: #9333ea;"></i> Ingreso Fletes Transporte
                    </span>
                    <span style="background: #f3e8ff; color: #7e22ce; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                        Flete $0.10 / L
                    </span>
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #6b21a8; margin-bottom: 4px;">
                    +$ ${formatearNumero(d.totalUSDTransporte, 2)}
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between;">
                    <span>Litros Entregados:</span>
                    <strong style="color: #6b21a8;">${formatearNumero(d.totalLitrosTransporte)} L</strong>
                </div>
                <div style="font-size: 11.5px; color: #7e22ce; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #d8b4fe; display: flex; justify-content: space-between;">
                    <span>Vaca: <strong>${formatearNumero(d.ltsVacaTransp)} L</strong> ($${formatearNumero(d.usdVacaTransp, 2)})</span>
                </div>
                <div style="font-size: 11.5px; color: #7e22ce; display: flex; justify-content: space-between;">
                    <span>Búfala: <strong>${formatearNumero(d.ltsBufalaTransp)} L</strong> ($${formatearNumero(d.usdBufalaTransp, 2)})</span>
                </div>
            </div>

            <!-- 3. COSTO DE LECHE (FINCAS RUTA PROPIA) -->
            <div style="background: #ffffff; border: 1.5px solid #fed7aa; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(234,88,12,0.06);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.05em;">
                        <i class="fa-solid fa-circle-arrow-down" style="color: #ea580c;"></i> Costo Leche (Ruta Propia)
                    </span>
                    <span style="background: #fff7ed; color: #c2410c; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                        ${d.fincasRuta.length} Fincas
                    </span>
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #9a3412; margin-bottom: 4px;">
                    -$ ${formatearNumero(d.totalUSDFincasRuta, 2)}
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between;">
                    <span>Litros Comprados:</span>
                    <strong style="color: #0f172a;">${formatearNumero(d.totalLitrosFincasRuta)} L</strong>
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between; margin-top: 2px;">
                    <span>Precio Promedio:</span>
                    <strong style="color: #c2410c;">$ ${formatearNumero(d.totalLitrosFincasRuta > 0 ? (d.totalUSDFincasRuta/d.totalLitrosFincasRuta) : 0, 4)} / L</strong>
                </div>
            </div>

            <!-- 4. GASTOS TRANSPORTE A CHOFERES -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
                        <i class="fa-solid fa-truck" style="color: #64748b;"></i> Pagos Choferes (Operativo)
                    </span>
                    <span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                        Fletes
                    </span>
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #334155; margin-bottom: 4px;">
                    -$ ${formatearNumero(d.totalFletesUSD, 2)}
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between;">
                    <span>Costo Chofer / Litro:</span>
                    <strong style="color: #0f172a;">$ ${formatearNumero(d.totalLitrosLechePropiaVendida > 0 ? (d.totalFletesUSD / d.totalLitrosLechePropiaVendida) : 0, 4)} / L</strong>
                </div>
                <div style="font-size: 12.5px; color: #64748b; display: flex; justify-content: space-between; margin-top: 2px;">
                    <span>Margen Bruto Leche:</span>
                    <strong style="color: ${d.margenBrutoLeche >= 0 ? '#047857' : '#e11d48'};">$ ${formatearNumero(d.margenBrutoLeche, 2)}</strong>
                </div>
            </div>

            <!-- 5. GANANCIA NETA REAL (PROTEGIDA POR DEVALUACIÓN BCV) -->
            <div style="background: ${bgUtilidad}; color: #ffffff; border-radius: 12px; padding: 18px; box-shadow: 0 4px 14px rgba(6,78,59,0.25); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <span style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #a7f3d0;">
                            <i class="fa-solid fa-shield-halved"></i> Utilidad Real Efectiva
                        </span>
                        <span style="background: rgba(255,255,255,0.2); color: #ffffff; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 6px;" title="Tasa reposición actual">
                            BCV Bs. ${formatearNumero(d.tasaActualReposicion, 2)}
                        </span>
                    </div>
                    <div style="font-size: 25px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 2px;">
                        ${signoNeto}$ ${formatearNumero(d.utilidadRealEfectivaUSD, 2)}
                    </div>
                    <div style="font-size: 13.5px; font-weight: 700; color: #6ee7b7; margin-bottom: 6px;">
                        ${signoNeto}Bs. ${formatearNumero(d.utilidadNetaBs, 2)}
                    </div>
                    
                    <!-- IMPACTO CAMBIARIO / DESVALORIZACIÓN -->
                    <div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between; color: #e2e8f0;">
                            <span>Utilidad Teórica (Dólar Papel):</span>
                            <strong>$ ${formatearNumero(d.utilidadNetaUSD, 2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; color: #fecaca; font-weight: 700; margin-top: 2px;">
                            <span><i class="fa-solid fa-arrow-trend-down"></i> Pérdida Cambiaria Diaria:</span>
                            <span>-$ ${formatearNumero(d.perdidaCambiariaUSD, 2)} (${formatearNumero(d.perdidaCambiariaPct, 1)}%)</span>
                        </div>
                    </div>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px; font-size: 11.5px; color: #d1fae5; display: flex; justify-content: space-between;">
                    <span>Margen Real por Litro:</span>
                    <strong>${signoNeto}$ ${formatearNumero(d.margenNetoPorLitro, 4)} / L</strong>
                </div>
            </div>
        </div>

        <!-- FILA 2: ANÁLISIS DETALLADO POR TIPOS DE LECHE Y MODALIDAD -->
        <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-layer-group" style="color: #3b82f6;"></i> LITROS Y GANANCIAS POR TIPO DE LECHE Y MODALIDAD
                </h4>
                <span style="font-size: 12px; color: #64748b;">Separación estricta de Ruta Propia (Vaca / Búfala) vs Servicio de Transporte (Acarreo)</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                <!-- 1. TARJETA LECHE DE VACA (RUTA PROPIA) -->
                <div style="background: #ffffff; border: 2px solid #3b82f6; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 10px rgba(59,130,246,0.06);">
                    <div style="background: linear-gradient(135deg, #1e40af, #2563eb); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14.5px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-cow"></i> VACA (RUTA PROPIA)
                        </span>
                        <span style="background: rgba(255,255,255,0.2); font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                            ${signoVaca}$ ${formatearNumero(d.vaca.gananciaLitro, 4)} / L
                        </span>
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; margin-bottom: 12px;">
                            <div>
                                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Litros Comprados:</span>
                                <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${formatearNumero(d.vaca.ltsCompra)} L</div>
                                <span style="font-size: 11px; color: #c2410c;">Costo Prom: $${formatearNumero(d.vaca.precioCompra, 4)}</span>
                            </div>
                            <div>
                                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Litros Vendidos:</span>
                                <div style="font-size: 16px; font-weight: 900; color: #1e40af;">${formatearNumero(d.vaca.ltsVenta)} L</div>
                                <span style="font-size: 11px; color: #2563eb;">Venta Prom: $${formatearNumero(d.vaca.precioVenta, 4)}</span>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12.5px;">
                            <span style="color: #475569;">Facturación Ventas Vaca:</span>
                            <strong style="color: #2563eb;">$ ${formatearNumero(d.vaca.usdVenta, 2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 12.5px;">
                            <span style="color: #475569;">Costo Compras Vaca:</span>
                            <strong style="color: #c2410c;">-$ ${formatearNumero(d.vaca.usdCompra, 2)}</strong>
                        </div>
                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 11.5px; font-weight: 800; color: #1e40af; text-transform: uppercase;">Margen Bruto Vaca:</span>
                            <div style="text-align: right;">
                                <div style="font-size: 15px; font-weight: 900; color: ${d.vaca.gananciaTotal >= 0 ? '#1d4ed8' : '#e11d48'};">
                                    ${signoVaca}$ ${formatearNumero(d.vaca.gananciaTotal, 2)}
                                </div>
                                <div style="font-size: 10.5px; font-weight: 700; color: #64748b;">
                                    Margen / Litro: <strong style="color: #1e40af;">${signoVaca}$ ${formatearNumero(d.vaca.gananciaLitro, 4)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. TARJETA LECHE DE BÚFALA (RUTA PROPIA) -->
                <div style="background: #ffffff; border: 2px solid #10b981; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 10px rgba(16,185,129,0.06);">
                    <div style="background: linear-gradient(135deg, #065f46, #059669); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14.5px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-gem"></i> BÚFALA (RUTA PROPIA)
                        </span>
                        <span style="background: rgba(255,255,255,0.2); font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                            ${signoBufala}$ ${formatearNumero(d.bufala.gananciaLitro, 4)} / L
                        </span>
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; margin-bottom: 12px;">
                            <div>
                                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Litros Comprados:</span>
                                <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${formatearNumero(d.bufala.ltsCompra)} L</div>
                                <span style="font-size: 11px; color: #c2410c;">Costo Prom: $${formatearNumero(d.bufala.precioCompra, 4)}</span>
                            </div>
                            <div>
                                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Litros Vendidos:</span>
                                <div style="font-size: 16px; font-weight: 900; color: #047857;">${formatearNumero(d.bufala.ltsVenta)} L</div>
                                <span style="font-size: 11px; color: #059669;">Venta Prom: $${formatearNumero(d.bufala.precioVenta, 4)}</span>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12.5px;">
                            <span style="color: #475569;">Facturación Ventas Búfala:</span>
                            <strong style="color: #047857;">$ ${formatearNumero(d.bufala.usdVenta, 2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 12.5px;">
                            <span style="color: #475569;">Costo Compras Búfala:</span>
                            <strong style="color: #c2410c;">-$ ${formatearNumero(d.bufala.usdCompra, 2)}</strong>
                        </div>
                        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 11.5px; font-weight: 800; color: #065f46; text-transform: uppercase;">Margen Bruto Búfala:</span>
                            <div style="text-align: right;">
                                <div style="font-size: 15px; font-weight: 900; color: ${d.bufala.gananciaTotal >= 0 ? '#047857' : '#e11d48'};">
                                    ${signoBufala}$ ${formatearNumero(d.bufala.gananciaTotal, 2)}
                                </div>
                                <div style="font-size: 10.5px; font-weight: 700; color: #64748b;">
                                    Margen / Litro: <strong style="color: #047857;">${signoBufala}$ ${formatearNumero(d.bufala.gananciaLitro, 4)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. TARJETA TRANSPORTE Y ACARREO (A TERCEROS) -->
                <div style="background: #ffffff; border: 2px solid #a855f7; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 10px rgba(168,85,247,0.06);">
                    <div style="background: linear-gradient(135deg, #581c87, #7e22ce); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14.5px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-truck-moving"></i> TRANSPORTE A TERCEROS
                        </span>
                        <span style="background: rgba(255,255,255,0.2); font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                            Flete $0.10 / L
                        </span>
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; margin-bottom: 12px;">
                            <div>
                                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Vaca Transportada:</span>
                                <div style="font-size: 15px; font-weight: 900; color: #6b21a8;">${formatearNumero(d.transporte.ltsVaca)} L</div>
                                <span style="font-size: 11px; color: #7e22ce;">Flete: $${formatearNumero(d.transporte.usdVaca, 2)}</span>
                            </div>
                            <div>
                                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Búfala Transportada:</span>
                                <div style="font-size: 15px; font-weight: 900; color: #6b21a8;">${formatearNumero(d.transporte.ltsBufala)} L</div>
                                <span style="font-size: 11px; color: #7e22ce;">Flete: $${formatearNumero(d.transporte.usdBufala, 2)}</span>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12.5px;">
                            <span style="color: #475569;">Total Acarreo Entregado:</span>
                            <strong style="color: #6b21a8;">${formatearNumero(d.transporte.totalLitros)} L</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 12.5px;">
                            <span style="color: #475569;">Tarifa Servicio Flete:</span>
                            <strong style="color: #0f172a;">$ 0,1000 / L</strong>
                        </div>
                        <div style="background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 11.5px; font-weight: 800; color: #6b21a8; text-transform: uppercase;">Ingreso Fletes:</span>
                            <div style="text-align: right;">
                                <div style="font-size: 15px; font-weight: 900; color: #7e22ce;">
                                    +$ ${formatearNumero(d.transporte.totalUSD, 2)}
                                </div>
                                <div style="font-size: 10.5px; font-weight: 700; color: #64748b;">
                                    Margen / Litro: <strong style="color: #7e22ce;">+$ 0,1000</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. BALANCE DE VOLUMEN TOTAL -->
                <div style="background: #ffffff; border: 2px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 10px rgba(15,23,42,0.06); display: flex; flex-direction: column;">
                    <div style="background: linear-gradient(135deg, #0f172a, #334155); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14.5px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-scale-balanced"></i> BALANCE DE VOLUMEN
                        </span>
                        <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                            Acopio vs Salidas
                        </span>
                    </div>
                    <div style="padding: 16px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 11.5px; color: #475569;">Litros Comprados Ruta:</span>
                                <strong style="font-size: 13px; color: #0f172a;">${formatearNumero(d.totalLitrosFincasRuta)} L</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 11.5px; color: #7e22ce; font-weight: 700;">Litros Acarreo Transporte:</span>
                                <strong style="font-size: 13px; color: #7e22ce;">${formatearNumero(d.totalLitrosTransporteCampo)} L</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
                                <span style="font-size: 12px; color: #0f172a; font-weight: 800;">Total Acopio Campo:</span>
                                <strong style="font-size: 13.5px; color: #0f172a;">${formatearNumero(d.totalLitrosRecibidosCampo)} L</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 11.5px; color: #2563eb;">Entregado Ventas Leche:</span>
                                <strong style="font-size: 12.5px; color: #2563eb;">${formatearNumero(d.totalLitrosComp)} L</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 11.5px; color: #7e22ce;">Entregado Transporte (Colona):</span>
                                <strong style="font-size: 12.5px; color: #7e22ce;">${formatearNumero(d.totalLitrosTransporte)} L</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
                                <span style="font-size: 12px; color: #0f172a; font-weight: 800;">Total Despachado Plantas:</span>
                                <strong style="font-size: 13.5px; color: #0f172a;">${formatearNumero(d.totalLitrosDespachadosGlobal)} L</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 11.5px; color: #64748b;">Diferencia / Tránsito:</span>
                                <strong style="font-size: 13px; color: ${d.diferenciaLitrosGlobal <= 0 ? '#10b981' : '#f59e0b'};">
                                    ${formatearNumero(d.diferenciaLitrosGlobal)} L
                                </strong>
                            </div>
                        </div>
                        <div style="border-top: 1px dashed #e2e8f0; padding-top: 6px; font-size: 10.5px; color: #64748b;">
                            Conciliación de ruta propia (compra de leche) + servicios de flete a terceros.
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- FILA 3: CUADRO DE SUMA Y RESTA (ESTADO DE RESULTADOS OPERATIVO) -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="background: #0f172a; color: #ffffff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-calculator"></i> CUADRO ADMINISTRATIVO DE "SUMA Y RESTA"
                </h4>
                <span style="font-size: 12px; color: #cbd5e1;">Flujo Financiero Operativo en Dólares ($) y Bolívares (Bs)</span>
            </div>
            <div class="table-responsive" style="margin: 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                    <tbody>
                        <!-- 1. INGRESOS POR VENTAS DE LECHE A COMPAÑÍAS -->
                        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 10px 18px; font-weight: 800; color: #1e40af;" colspan="3">
                                (+) 1. INGRESOS POR VENTAS DE LECHE A COMPAÑÍAS (RUTA PROPIA)
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #334155;">
                                (+) Venta de Leche de Vaca (${formatearNumero(d.vaca.ltsVenta)} Lts a $${formatearNumero(d.vaca.precioVenta, 4)}/L)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #2563eb;">
                                $ ${formatearNumero(d.vaca.usdVenta, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                Bs. ${formatearNumero(d.vaca.usdVenta * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #334155;">
                                (+) Venta de Leche de Búfala (${formatearNumero(d.bufala.ltsVenta)} Lts a $${formatearNumero(d.bufala.precioVenta, 4)}/L)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #047857;">
                                $ ${formatearNumero(d.bufala.usdVenta, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                Bs. ${formatearNumero(d.bufala.usdVenta * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="background: #eff6ff; border-bottom: 2px solid #bfdbfe; font-weight: 800;">
                            <td style="padding: 9px 18px 9px 36px; color: #1e3a8a;">
                                Subtotal Facturación Leche Compañías (${formatearNumero(d.totalLitrosComp)} Lts)
                            </td>
                            <td style="padding: 9px 18px; text-align: right; font-weight: 900; color: #1d4ed8; font-size: 14.5px;">
                                $ ${formatearNumero(d.totalUSDComp, 2)}
                            </td>
                            <td style="padding: 9px 18px; text-align: right; font-weight: 800; color: #1e40af;">
                                Bs. ${formatearNumero(d.totalUSDComp * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>

                        <!-- 2. INGRESOS POR SERVICIO DE TRANSPORTE A TERCEROS -->
                        <tr style="background: #faf5ff; border-bottom: 1px solid #e9d5ff;">
                            <td style="padding: 10px 18px; font-weight: 800; color: #7e22ce;" colspan="3">
                                (+) 2. INGRESOS POR SERVICIO DE TRANSPORTE A TERCEROS (FLETE $0.10/L)
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #4a044e;">
                                (+) Flete Leche de Vaca (${formatearNumero(d.ltsVacaTransp)} Lts a $0.10/L)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #7e22ce;">
                                +$ ${formatearNumero(d.usdVacaTransp, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                Bs. ${formatearNumero(d.usdVacaTransp * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #4a044e;">
                                (+) Flete Leche de Búfala (${formatearNumero(d.ltsBufalaTransp)} Lts a $0.10/L)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #7e22ce;">
                                +$ ${formatearNumero(d.usdBufalaTransp, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                Bs. ${formatearNumero(d.usdBufalaTransp * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="background: #fdf4ff; border-bottom: 2px solid #e879f9; font-weight: 800;">
                            <td style="padding: 9px 18px 9px 36px; color: #701a75;">
                                Subtotal Facturación Fletes Transporte (${formatearNumero(d.totalLitrosTransporte)} Lts a $0.10/L)
                            </td>
                            <td style="padding: 9px 18px; text-align: right; font-weight: 900; color: #86198f; font-size: 14.5px;">
                                +$ ${formatearNumero(d.totalUSDTransporte, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                Bs. ${formatearNumero(d.totalUSDTransporte * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="background: #fdf4ff; border-bottom: 2px solid #e879f9; font-weight: 800;">
                            <td style="padding: 10px 18px; color: #701a75;">
                                (=) TOTAL INGRESOS OPERATIVOS (Ventas Leche + Servicio Transporte)
                            </td>
                            <td style="padding: 10px 18px; text-align: right; font-weight: 900; color: #86198f; font-size: 15px;">
                                $ ${formatearNumero(d.totalIngresosOperativos, 2)}
                            </td>
                            <td style="padding: 10px 18px; text-align: right; font-weight: 800; color: #701a75;">
                                Bs. ${formatearNumero(d.totalIngresosOperativos * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>

                        <!-- 3. COSTOS DE COMPRA DE LECHE A FINCAS (RUTA PROPIA) -->
                        <tr style="background: #fff7ed; border-bottom: 1px solid #fed7aa;">
                            <td style="padding: 10px 18px; font-weight: 800; color: #c2410c;" colspan="3">
                                (-) 3. COSTO DE COMPRA DE LECHE A FINCAS (RUTA PROPIA)
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #334155;">
                                (-) Compra de Leche de Vaca (${formatearNumero(d.vaca.ltsCompra)} Lts a $${formatearNumero(d.vaca.precioCompra, 4)}/L)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #ea580c;">
                                -$ ${formatearNumero(d.vaca.usdCompra, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                -Bs. ${formatearNumero(d.vaca.usdCompra * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #334155;">
                                (-) Compra de Leche de Búfala (${formatearNumero(d.bufala.ltsCompra)} Lts a $${formatearNumero(d.bufala.precioCompra, 4)}/L)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #ea580c;">
                                -$ ${formatearNumero(d.bufala.usdCompra, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                -Bs. ${formatearNumero(d.bufala.usdCompra * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="background: #fff7ed; border-bottom: 2px solid #fed7aa; font-weight: 800;">
                            <td style="padding: 9px 18px 9px 36px; color: #9a3412;">
                                Subtotal Costo Leche Fincas Ruta (${formatearNumero(d.totalLitrosFincasRuta)} Lts)
                            </td>
                            <td style="padding: 9px 18px; text-align: right; font-weight: 900; color: #c2410c; font-size: 14.5px;">
                                -$ ${formatearNumero(d.totalUSDFincasRuta, 2)}
                            </td>
                            <td style="padding: 9px 18px; text-align: right; font-weight: 800; color: #9a3412;">
                                -Bs. ${formatearNumero(d.totalUSDFincasRuta * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>
                        <tr style="background: #fef3c7; border-bottom: 2px solid #fde68a; font-weight: 800;">
                            <td style="padding: 10px 18px; color: #92400e;">
                                (=) MARGEN BRUTO OPERATIVO
                            </td>
                            <td style="padding: 10px 18px; text-align: right; font-weight: 900; color: ${d.margenOperativoTotal >= 0 ? '#047857' : '#b91c1c'}; font-size: 15px;">
                                ${d.margenOperativoTotal >= 0 ? '+' : ''}$ ${formatearNumero(d.margenOperativoTotal, 2)}
                            </td>
                            <td style="padding: 10px 18px; text-align: right; font-weight: 800; color: #92400e;">
                                ${d.margenOperativoTotal >= 0 ? '+' : ''}Bs. ${formatearNumero(d.margenOperativoTotal * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>

                        <!-- 4. GASTOS OPERATIVOS CHOFERES -->
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 18px 8px 36px; color: #475569;">
                                (-) Fletes y Pagos de Transporte a Choferes (Operativo)
                            </td>
                            <td style="padding: 8px 18px; text-align: right; font-weight: 700; color: #475569;">
                                -$ ${formatearNumero(d.totalFletesUSD, 2)}
                            </td>
                            <td style="padding: 8px 18px; text-align: right; color: #64748b;">
                                -Bs. ${formatearNumero(d.totalFletesUSD * (d.tasaBcv || 0), 2)}
                            </td>
                        </tr>

                        <!-- 5. UTILIDAD CONTABLE TEÓRICA -->
                        <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1;">
                            <td style="padding: 10px 18px; font-weight: 800; font-size: 13.5px; color: #334155;">
                                (=) UTILIDAD CONTABLE TEÓRICA (A tasa de facturación Bs. ${formatearNumero(d.tasaBcv, 2)})
                            </td>
                            <td style="padding: 10px 18px; text-align: right; font-weight: 800; font-size: 15px; color: #334155;">
                                ${signoNeto}$ ${formatearNumero(d.utilidadNetaUSD, 2)}
                            </td>
                            <td style="padding: 10px 18px; text-align: right; font-weight: 800; font-size: 14.5px; color: #334155;">
                                ${signoNeto}Bs. ${formatearNumero(d.utilidadNetaBs, 2)}
                            </td>
                        </tr>

                        <!-- 6. AJUSTE POR DEVALUACIÓN Y DESLIZAMIENTO CAMBIARIO -->
                        <tr style="background: #fff1f2; border-bottom: 1px solid #fecdd3;">
                            <td style="padding: 9px 18px 9px 36px; color: #9f1239; font-weight: 700;">
                                <i class="fa-solid fa-arrow-trend-down" style="color: #e11d48;"></i> (-) Pérdida por Deslizamiento Cambiario (Tasa actual reposición: Bs. ${formatearNumero(d.tasaActualReposicion, 2)})
                            </td>
                            <td style="padding: 9px 18px; text-align: right; font-weight: 800; font-size: 14px; color: #e11d48;">
                                -$ ${formatearNumero(d.perdidaCambiariaUSD, 2)}
                            </td>
                            <td style="padding: 9px 18px; text-align: right; color: #9f1239; font-size: 12px;">
                                -${formatearNumero(d.perdidaCambiariaPct, 1)}% por devaluación
                            </td>
                        </tr>

                        <!-- 7. UTILIDAD / GANANCIA NETA REAL EFECTIVA -->
                        <tr style="background: ${esPositivo ? '#ecfdf5' : '#fef2f2'}; border-top: 3px solid ${colorUtilidad};">
                            <td style="padding: 14px 18px; font-weight: 900; font-size: 15px; color: ${colorUtilidad}; text-transform: uppercase;">
                                <i class="fa-solid fa-shield-halved"></i> (=) GANANCIA NETA REAL EFECTIVA (PROTEGIDA)
                            </td>
                            <td style="padding: 14px 18px; text-align: right; font-weight: 900; font-size: 21px; color: ${colorUtilidad};">
                                ${signoNeto}$ ${formatearNumero(d.utilidadRealEfectivaUSD, 2)}
                            </td>
                            <td style="padding: 14px 18px; text-align: right; font-weight: 900; font-size: 17px; color: ${colorUtilidad};">
                                ${signoNeto}Bs. ${formatearNumero(d.utilidadNetaBs, 2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- FILA 4: TABLAS RESUMEN DE CONTRAPARTES -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
            <!-- COMPAÑÍAS -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="background: #1e293b; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-building" style="color: #38bdf8;"></i> RESUMEN POR COMPAÑÍAS (CLIENTES / VENTAS DE LECHE)
                    </div>
                    <span style="font-size: 12px; color: #94a3b8;">
                        Total Facturado: <strong style="color: #38bdf8;">$ ${formatearNumero(d.totalUSDComp, 2)}</strong>
                    </span>
                </div>
                <div class="table-responsive" style="margin: 0; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 2; border-bottom: 2px solid #cbd5e1;">
                            <tr>
                                <th style="padding: 10px 14px; text-align: left;">COMPAÑÍA</th>
                                <th style="padding: 10px 14px; text-align: right;">LTS VACA</th>
                                <th style="padding: 10px 14px; text-align: right;">LTS BÚFALA</th>
                                <th style="padding: 10px 14px; text-align: right;">TOTAL LTS</th>
                                <th style="padding: 10px 14px; text-align: right;">PRECIO ($/L)</th>
                                <th style="padding: 10px 14px; text-align: right;">TOTAL BRUTO ($)</th>
                                <th style="padding: 10px 14px; text-align: right;">ABONOS ($)</th>
                                <th style="padding: 10px 14px; text-align: right;">NETO ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsCompHtml}
                        </tbody>
                        <tfoot style="position: sticky; bottom: 0; background: #0f172a; color: #fff; font-weight: 800;">
                            <tr>
                                <td style="padding: 10px 14px; text-align: left;">TOTAL COMPAÑÍAS</td>
                                <td style="padding: 10px 14px; text-align: right; color: #93c5fd;">${formatearNumero(d.vaca.ltsVenta)} L</td>
                                <td style="padding: 10px 14px; text-align: right; color: #6ee7b7;">${formatearNumero(d.bufala.ltsVenta)} L</td>
                                <td style="padding: 10px 14px; text-align: right; color: #38bdf8; font-weight: 900;">${formatearNumero(d.totalLitrosComp)} L</td>
                                <td style="padding: 10px 14px; text-align: right;">-</td>
                                <td style="padding: 10px 14px; text-align: right; color: #60a5fa; font-weight: 900;">$ ${formatearNumero(d.totalUSDComp, 2)}</td>
                                <td style="padding: 10px 14px; text-align: right; color: #f87171;">-$ ${formatearNumero(d.totalAbonosUSDComp, 2)}</td>
                                <td style="padding: 10px 14px; text-align: right; color: #4ade80; font-weight: 900; font-size: 14px;">$ ${formatearNumero(d.totalNetoUSDComp, 2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- EMPRESAS DE TRANSPORTE (FLETES A TERCEROS - ELLOS NOS PAGAN A NOSOTROS) -->
            <div style="background: #ffffff; border: 1.5px solid #d8b4fe; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(147,51,234,0.06);">
                <div style="background: #581c87; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-truck-moving" style="color: #d8b4fe;"></i> RESUMEN DE EMPRESAS DE TRANSPORTE (FLETE / INGRESO - ELLOS NOS PAGAN)
                    </div>
                    <span style="font-size: 12px; color: #e9d5ff;">
                        Total Facturado Transporte: <strong style="color: #f5d0fe; font-size: 14px;">$ ${formatearNumero(d.totalUSDTransporte, 2)}</strong> (${formatearNumero(d.totalLitrosTransporte)} L)
                    </span>
                </div>
                <div class="table-responsive" style="margin: 0; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                        <thead style="position: sticky; top: 0; background: #faf5ff; z-index: 2; border-bottom: 2px solid #d8b4fe;">
                            <tr>
                                <th style="padding: 10px 14px; text-align: left;">EMPRESA / PROPIETARIO</th>
                                <th style="padding: 10px 14px; text-align: right;">LITROS TRANSPORTADOS</th>
                                <th style="padding: 10px 14px; text-align: right;">TARIFA FLETE ($/L)</th>
                                <th style="padding: 10px 14px; text-align: right;">A COBRAR ($)</th>
                                <th style="padding: 10px 14px; text-align: right;">MONTO BS</th>
                                <th style="padding: 10px 14px; text-align: center;">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsTransporteHtml || '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #94a3b8;">No se registraron empresas de transporte en este ciclo.</td></tr>'}
                        </tbody>
                        <tfoot style="position: sticky; bottom: 0; background: #3b0764; color: #fff; font-weight: 800;">
                            <tr>
                                <td style="padding: 10px 14px; text-align: left;">TOTAL SERVICIO TRANSPORTE (${d.empresasTransporte.length} Empresas)</td>
                                <td style="padding: 10px 14px; text-align: right; color: #f5d0fe; font-weight: 900;">${formatearNumero(d.totalLitrosTransporte)} L</td>
                                <td style="padding: 10px 14px; text-align: right;">-</td>
                                <td style="padding: 10px 14px; text-align: right; color: #a7f3d0; font-weight: 900; font-size: 14px;">+$ ${formatearNumero(d.totalUSDTransporte, 2)}</td>
                                <td style="padding: 10px 14px; text-align: right; color: #f5d0fe; font-weight: 800;">Bs. ${formatearNumero(d.totalUSDTransporte * (d.tasaBcv || 0), 2)}</td>
                                <td style="padding: 10px 14px; text-align: center;">-</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- FINCAS RUTA PROPIA -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="background: #1e293b; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-wheat-awn" style="color: #fbbf24;"></i> RESUMEN POR FINCAS DE RUTA (PROVEEDORES / COSTO DE COMPRA DE LECHE)
                    </div>
                    <span style="font-size: 12px; color: #94a3b8;">
                        Total Leche Comprada: <strong style="color: #fbbf24;">$ ${formatearNumero(d.totalUSDFincasRuta, 2)}</strong> (${formatearNumero(d.totalLitrosFincasRuta)} L)
                    </span>
                </div>
                <div class="table-responsive" style="margin: 0; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 2; border-bottom: 2px solid #cbd5e1;">
                            <tr>
                                <th style="padding: 10px 14px; text-align: left;">FINCA / GANADERO</th>
                                <th style="padding: 10px 14px; text-align: center;">TIPO LECHE</th>
                                <th style="padding: 10px 14px; text-align: right;">LITROS COMPRADOS</th>
                                <th style="padding: 10px 14px; text-align: right;">PRECIO ($/L)</th>
                                <th style="padding: 10px 14px; text-align: right;">TOTAL BRUTO ($)</th>
                                <th style="padding: 10px 14px; text-align: right;">ADELANTOS ($)</th>
                                <th style="padding: 10px 14px; text-align: right;">NETO A PAGAR ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsFincasHtml}
                        </tbody>
                        <tfoot style="position: sticky; bottom: 0; background: #0f172a; color: #fff; font-weight: 800;">
                            <tr>
                                <td style="padding: 10px 14px; text-align: left;" colspan="2">TOTAL FINCAS RUTA (${d.fincasRuta.length})</td>
                                <td style="padding: 10px 14px; text-align: right; color: #38bdf8; font-weight: 900;">${formatearNumero(d.totalLitrosFincasRuta)} L</td>
                                <td style="padding: 10px 14px; text-align: right;">-</td>
                                <td style="padding: 10px 14px; text-align: right; color: #fbbf24; font-weight: 900;">-$ ${formatearNumero(d.totalUSDFincasRuta, 2)}</td>
                                <td style="padding: 10px 14px; text-align: right; color: #f87171;">-$ ${formatearNumero(d.totalAdelantosUSDFincasRuta, 2)}</td>
                                <td style="padding: 10px 14px; text-align: right; color: #4ade80; font-weight: 900; font-size: 14px;">-$ ${formatearNumero(d.totalNetoUSDFincasRuta, 2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    `;
}
window.renderAdministracionGeneral = renderAdministracionGeneral;

// Función para cambiar rápidamente la tarifa de transporte de una empresa
window.cambiarPrecioFincaTransporte = async function(fincaId, nombre, precioActual) {
    const { value: nuevoPrecioStr } = await Swal.fire({
        title: 'Tarifa de Servicio de Transporte',
        html: `
            <div style="text-align: left; font-size: 13.5px; color: #334155; margin-bottom: 12px; background: #faf5ff; padding: 12px; border-radius: 8px; border: 1px solid #d8b4fe;">
                Empresa: <strong style="color: #7e22ce;">${nombre}</strong><br>
                Modalidad: <span style="background: #f3e8ff; color: #7e22ce; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-truck-moving"></i> TRANSPORTE A TERCEROS</span><br>
                <span style="font-size: 12px; color: #64748b; display: block; margin-top: 4px;">Esta es la tarifa de flete que ellos nos pagan a nosotros por cada litro de leche transportado.</span>
            </div>
            <label style="display:block; text-align: left; font-size: 12.5px; font-weight: 700; color: #475569; margin-bottom: 6px;">Nueva Tarifa Flete USD por Litro ($/L):</label>
        `,
        input: 'number',
        inputValue: precioActual || 0,
        inputAttributes: {
            step: '0.0001',
            min: '0'
        },
        showCancelButton: true,
        confirmButtonText: 'Guardar Tarifa',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7e22ce',
        cancelButtonColor: '#64748b'
    });

    if (nuevoPrecioStr !== undefined && nuevoPrecioStr !== null && nuevoPrecioStr !== '') {
        const nuevoPrecio = parseFloat(nuevoPrecioStr);
        if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
            Swal.fire({ icon: 'warning', title: 'Precio Inválido', text: 'Ingrese un precio válido mayor o igual a 0.' });
            return;
        }

        try {
            const headers = { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' };
            const resGet = await fetch(`${API_BASE}/catalogos/fincas/${fincaId}`, { headers });
            if (resGet.ok) {
                const fData = await resGet.json();
                fData.precioLitroUSD = nuevoPrecio;
                fData.tipoServicioId = 2; // Asegurar modalidad TRANSPORTE
                const resPut = await fetch(`${API_BASE}/catalogos/fincas/${fincaId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(fData)
                });
                if (!resPut.ok) {
                    throw new Error('No se pudo actualizar el precio en el servidor.');
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Tarifa Actualizada',
                text: `Se actualizó la tarifa de ${nombre} a $${nuevoPrecio.toFixed(4)} / L`,
                timer: 1500,
                showConfirmButton: false
            });

            // Recargar administración general
            cargarAdministracionGeneral();
        } catch (err) {
            console.error('Error al actualizar precio de transporte:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
};

function exportarAdministracionGeneralExcel() {
    if (!datosAdminGeneralActual) {
        alert('Por favor realice primero una consulta para exportar los datos.');
        return;
    }
    const d = datosAdminGeneralActual;

    let tablasHtml = `
        <table>
            <tr>
                <td colspan="8" class="excel-banner-title">ADMINISTRACIÓN GENERAL & BALANCE DE RENTABILIDAD</td>
            </tr>
            <tr>
                <td colspan="8" class="excel-banner-sub">Período: ${formatearFechaLocal(d.fIni)} al ${formatearFechaLocal(d.fFin)} | Tasa BCV: Bs. ${formatearNumero(d.tasaBcv, 4)}</td>
            </tr>
        </table>

        <!-- RESUMEN EJECUTIVO -->
        <table>
            <thead>
                <tr>
                    <th colspan="4" class="excel-sec-header">1. RESUMEN EJECUTIVO DE OPERACIONES</th>
                </tr>
                <tr>
                    <th class="excel-th">CONCEPTO</th>
                    <th class="excel-th">VOLUMEN (LTS)</th>
                    <th class="excel-th">TOTAL USD ($)</th>
                    <th class="excel-th">TOTAL BS (BCV)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold">1. INGRESOS POR VENTAS DE LECHE A COMPAÑÍAS</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.totalLitrosComp)}</td>
                    <td class="excel-td excel-td-num excel-td-currency">$ ${formatearNumero(d.totalUSDComp, 2)}</td>
                    <td class="excel-td excel-td-num excel-td-currency">Bs. ${formatearNumero(d.totalUSDComp * (d.tasaBcv || 0), 2)}</td>
                </tr>
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold" style="color: #7e22ce;">2. INGRESOS POR SERVICIO DE TRANSPORTE (FLETES A TERCEROS)</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.totalLitrosTransporte)}</td>
                    <td class="excel-td excel-td-num excel-td-currency" style="color: #7e22ce;">+$ ${formatearNumero(d.totalUSDTransporte, 2)}</td>
                    <td class="excel-td excel-td-num excel-td-currency" style="color: #7e22ce;">Bs. ${formatearNumero(d.totalUSDTransporte * (d.tasaBcv || 0), 2)}</td>
                </tr>
                <tr style="background: #fdf4ff; font-weight: bold;">
                    <td class="excel-td excel-td-left excel-td-bold">(=) TOTAL INGRESOS OPERATIVOS</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.totalLitrosComp + d.totalLitrosTransporte)}</td>
                    <td class="excel-td excel-td-num excel-td-currency">$ ${formatearNumero(d.totalIngresosOperativos, 2)}</td>
                    <td class="excel-td excel-td-num excel-td-currency">Bs. ${formatearNumero(d.totalIngresosOperativos * (d.tasaBcv || 0), 2)}</td>
                </tr>
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold">3. COSTO DE COMPRA DE LECHE A FINCAS (RUTA PROPIA)</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.totalLitrosFincasRuta)}</td>
                    <td class="excel-td excel-td-num excel-td-currency" style="color: #c2410c;">-$ ${formatearNumero(d.totalUSDFincasRuta, 2)}</td>
                    <td class="excel-td excel-td-num excel-td-currency" style="color: #c2410c;">-Bs. ${formatearNumero(d.totalUSDFincasRuta * (d.tasaBcv || 0), 2)}</td>
                </tr>
                <tr style="background: #fef3c7; font-weight: bold;">
                    <td class="excel-td excel-td-left excel-td-bold">(=) MARGEN BRUTO OPERATIVO</td>
                    <td class="excel-td excel-td-num">-</td>
                    <td class="excel-td excel-td-num excel-td-currency">$ ${formatearNumero(d.margenOperativoTotal, 2)}</td>
                    <td class="excel-td excel-td-num excel-td-currency">Bs. ${formatearNumero(d.margenOperativoTotal * (d.tasaBcv || 0), 2)}</td>
                </tr>
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold">4. GASTOS DE TRANSPORTE Y FLETES (CHOFERES OPERATIVO)</td>
                    <td class="excel-td excel-td-num">-</td>
                    <td class="excel-td excel-td-num excel-td-currency" style="color: #64748b;">-$ ${formatearNumero(d.totalFletesUSD, 2)}</td>
                    <td class="excel-td excel-td-num excel-td-currency" style="color: #64748b;">-Bs. ${formatearNumero(d.totalFletesUSD * (d.tasaBcv || 0), 2)}</td>
                </tr>
                <tr class="excel-grand-total">
                    <td class="excel-td-left">(=) UTILIDAD NETA FINAL</td>
                    <td>${formatearNumero(d.totalLitrosComp)} Lts</td>
                    <td>$ ${formatearNumero(d.utilidadNetaUSD, 2)}</td>
                    <td>Bs. ${formatearNumero(d.utilidadNetaBs, 2)}</td>
                </tr>
            </tbody>
        </table>

        <!-- DESGLOSE POR TIPOS DE LECHE -->
        <table>
            <thead>
                <tr>
                    <th colspan="7" class="excel-sec-header">2. DESGLOSE POR TIPO DE LECHE Y GANANCIA UNITARIA</th>
                </tr>
                <tr>
                    <th class="excel-th">TIPO DE LECHE</th>
                    <th class="excel-th">LTS COMPRA</th>
                    <th class="excel-th">PRECIO COMPRA</th>
                    <th class="excel-th">LTS VENTA</th>
                    <th class="excel-th">PRECIO VENTA</th>
                    <th class="excel-th">MARGEN / LITRO</th>
                    <th class="excel-th">GANANCIA BRUTA ($)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold">LECHE DE VACA</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.vaca.ltsCompra)}</td>
                    <td class="excel-td excel-td-num">$ ${formatearNumero(d.vaca.precioCompra, 4)}</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.vaca.ltsVenta)}</td>
                    <td class="excel-td excel-td-num">$ ${formatearNumero(d.vaca.precioVenta, 4)}</td>
                    <td class="excel-td excel-td-bold excel-td-num">$ ${formatearNumero(d.vaca.gananciaLitro, 4)}</td>
                    <td class="excel-td excel-td-bold excel-td-currency">$ ${formatearNumero(d.vaca.gananciaTotal, 2)}</td>
                </tr>
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold">LECHE DE BÚFALA</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.bufala.ltsCompra)}</td>
                    <td class="excel-td excel-td-num">$ ${formatearNumero(d.bufala.precioCompra, 4)}</td>
                    <td class="excel-td excel-td-num">${formatearNumero(d.bufala.ltsVenta)}</td>
                    <td class="excel-td excel-td-num">$ ${formatearNumero(d.bufala.precioVenta, 4)}</td>
                    <td class="excel-td excel-td-bold excel-td-num">$ ${formatearNumero(d.bufala.gananciaLitro, 4)}</td>
                    <td class="excel-td excel-td-bold excel-td-currency">$ ${formatearNumero(d.bufala.gananciaTotal, 2)}</td>
                </tr>
            </tbody>
        </table>
    `;

    descargarExcelConDiseno(tablasHtml, `ADMINISTRACION_GENERAL_${d.fIni}_al_${d.fFin}`, 'ADMINISTRACIÓN GENERAL');
}
window.exportarAdministracionGeneralExcel = exportarAdministracionGeneralExcel;
