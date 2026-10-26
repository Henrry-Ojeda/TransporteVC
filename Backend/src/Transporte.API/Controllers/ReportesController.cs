using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Transporte.Core.DTOs;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ReportesController : ControllerBase
    {
        private readonly IReportesRepository _reportesRepository;

        public ReportesController(IReportesRepository reportesRepository)
        {
            _reportesRepository = reportesRepository;
        }

        [HttpGet("diarios")]
        public async Task<IActionResult> ObtenerReporteDiarios(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null)
        {
            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            var res = await _reportesRepository.ObtenerReporteDiariosAsync(fIni, fFin);
            return Ok(res);
        }

        [HttpGet("receptorias")]
        public async Task<IActionResult> ObtenerReporteReceptorias(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] int? companiaId = null)
        {
            var rol = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
            if (!string.Equals(rol, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            var res = await _reportesRepository.ObtenerReporteReceptoriasAsync(fIni, fFin, companiaId);
            return Ok(res);
        }

        [HttpGet("fincas")]
        public async Task<IActionResult> ObtenerReporteFincas(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] string? fincaIds = null)
        {
            var rol = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
            if (!string.Equals(rol, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            List<int>? listaIds = null;
            if (!string.IsNullOrWhiteSpace(fincaIds))
            {
                listaIds = fincaIds.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => int.TryParse(x.Trim(), out var n) ? n : 0)
                    .Where(x => x > 0)
                    .ToList();
            }

            var res = await _reportesRepository.ObtenerReporteFincasAsync(fIni, fFin, listaIds);
            return Ok(res);
        }

        [HttpGet("choferes")]
        public async Task<IActionResult> ObtenerReporteChoferes(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] int? choferId = null)
        {
            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            var rol = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int userId = int.TryParse(userIdClaim, out var u) ? u : 0;

            if (!string.Equals(rol, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                choferId = userId;
            }

            var res = await _reportesRepository.ObtenerReporteChoferesAsync(fIni, fFin, choferId);
            return Ok(res);
        }

        [HttpGet("bancos")]
        public async Task<IActionResult> ObtenerReporteBancosFincas(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] int? bancoId = null,
            [FromQuery] int? cicloId = null,
            [FromQuery] decimal? tasaBcv = null)
        {
            var rol = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
            if (!string.Equals(rol, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            var res = await _reportesRepository.ObtenerReporteBancosFincasAsync(fIni, fFin, bancoId, cicloId, tasaBcv);
            return Ok(res);
        }

        [HttpGet("relacion-companias")]
        public async Task<IActionResult> ObtenerReporteRelacionCompanias(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] int? companiaId = null,
            [FromQuery] int? cicloId = null,
            [FromQuery] decimal? tasaBcv = null)
        {
            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            var res = await _reportesRepository.ObtenerReporteRelacionCompaniasAsync(fIni, fFin, companiaId, cicloId, tasaBcv);
            return Ok(res);
        }

        [HttpGet("relacion-choferes")]
        public async Task<IActionResult> ObtenerReporteRelacionChoferes(
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null)
        {
            DateTime fIni = fechaInicio ?? DateTime.Today.AddDays(-6);
            DateTime fFin = fechaFin ?? DateTime.Today;

            var res = await _reportesRepository.ObtenerReporteRelacionChoferesAsync(fIni, fFin);

            var rol = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int userId = int.TryParse(userIdClaim, out var u) ? u : 0;
            var username = User.Identity?.Name ?? "";

            if (!string.Equals(rol, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                res = res.Where(r => r.UsuarioId == userId || (r.Chofer != null && r.Chofer.Contains(username, StringComparison.OrdinalIgnoreCase))).ToList();
            }

            return Ok(res);
        }

        [HttpGet("dashboard-avanzado")]
        public async Task<IActionResult> ObtenerDashboardAvanzado([FromQuery] int semanas = 8)
        {
            var rol = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = null;
            if (!string.Equals(rol, "ADMIN", StringComparison.OrdinalIgnoreCase) && int.TryParse(userIdClaim, out var u))
            {
                usuarioId = u;
            }

            var res = await _reportesRepository.ObtenerDashboardAvanzadoAsync(semanas, usuarioId);
            return Ok(res);
        }
    }
}


