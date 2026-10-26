using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Transporte.Core.DTOs;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    [Route("api/control-companias")]
    public class ControlCompaniasController : ControllerBase
    {
        private readonly IControlCompaniasRepository _controlCompaniasRepository;

        public ControlCompaniasController(IControlCompaniasRepository controlCompaniasRepository)
        {
            _controlCompaniasRepository = controlCompaniasRepository;
        }

        /// <summary>
        /// Obtiene la lista de despachos a compañías con filtros opcionales.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> ObtenerDespachos(
            [FromQuery] DateTime? fecha = null,
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] string? estado = null,
            [FromQuery] int? usuarioId = null,
            [FromQuery] int? companiaId = null)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";

            // Si es chofer y no es admin, solo ve sus despachos asignados a menos que filtre
            int? filtroChofer = (rol == "ADMIN" || rol == "SUPERADMIN") ? usuarioId : userId;

            var despachos = await _controlCompaniasRepository.ObtenerTodosAsync(fecha, fechaInicio, fechaFin, estado, filtroChofer, companiaId);
            return Ok(despachos);
        }

        /// <summary>
        /// Obtiene la trazabilidad completa de leche de Búfala por fechas, semanas, fincas y compañías.
        /// </summary>
        [HttpGet("trazabilidad-bufala")]
        public async Task<IActionResult> ObtenerTrazabilidadBufala(
            [FromQuery] DateTime? fechaDesde = null,
            [FromQuery] DateTime? fechaHasta = null,
            [FromQuery] int? cicloId = null,
            [FromQuery] int? fincaId = null,
            [FromQuery] int? companiaId = null,
            [FromQuery] int? usuarioId = null,
            [FromQuery] string? tipoServicio = null)
        {
            try
            {
                var resumen = await _controlCompaniasRepository.ObtenerTrazabilidadBufalaAsync(fechaDesde, fechaHasta, cicloId, fincaId, companiaId, usuarioId, tipoServicio);
                return Ok(resumen);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Obtiene un despacho específico por su ID.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<IActionResult> ObtenerPorId([FromRoute] long id)
        {
            var despacho = await _controlCompaniasRepository.ObtenerPorIdAsync(id);
            if (despacho == null) return NotFound(new { message = "Despacho no encontrado." });
            return Ok(despacho);
        }

        /// <summary>
        /// Obtiene el ticket activo en estado 'EN VIA' asignado al chofer.
        /// </summary>
        [HttpGet("chofer-activo")]
        public async Task<IActionResult> ObtenerTicketActivoChofer([FromQuery] int? choferId = null)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";
            int idBusqueda = (rol == "ADMIN" && choferId.HasValue && choferId.Value > 0) ? choferId.Value : userId;

            var ticket = await _controlCompaniasRepository.ObtenerTicketActivoChoferAsync(idBusqueda);
            return Ok(ticket);
        }

        /// <summary>
        /// Registra un nuevo despacho / ticket de salida hacia una compañía (Estado 'EN VIA').
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CrearDespacho([FromBody] CrearControlCompaniaDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";

            if (rol == "CHOFER")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Un chofer no puede crear tickets de receptoría o despacho. Solo la Administración de Receptoría puede emitir tickets de salida." });
            }

            try
            {
                if (dto.UsuarioId <= 0)
                {
                    return BadRequest(new { message = "Debe seleccionar un conductor asignado para el despacho." });
                }

                if (dto.LitrosDespachados <= 0)
                {
                    return BadRequest(new { message = "Los litros despachados deben ser mayores a 0." });
                }

                var id = await _controlCompaniasRepository.CrearDespachoAsync(dto, userId);
                return Ok(new { message = "Ticket de despacho a compañía creado exitosamente.", id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// El chofer o receptoría valida la entrega de la leche en la quesera, registrando la cantidad recibida y la falla.
        /// Pasa el estado a 'DESPACHO'.
        /// </summary>
        [HttpPost("{id:long}/validar-entrega")]
        public async Task<IActionResult> ValidarEntrega([FromRoute] long id, [FromBody] ValidarEntregaCompaniaDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            try
            {
                if (dto.LitrosRecibidosCompania < 0)
                {
                    return BadRequest(new { message = "Los litros recibidos no pueden ser negativos." });
                }

                var ok = await _controlCompaniasRepository.ValidarYFinalizarEntregaAsync(id, dto, userId);
                if (!ok) return NotFound(new { message = "Despacho no encontrado." });

                return Ok(new { message = "Entrega en compañía validada exitosamente. Estado actualizado a DESPACHO." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Edita un ticket de despacho a compañía (Solo Administrador).
        /// </summary>
        [Authorize(Roles = "ADMIN,SUPERADMIN")]
        [HttpPut("{id:long}")]
        public async Task<IActionResult> EditarDespacho([FromRoute] long id, [FromBody] EditarControlCompaniaDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            try
            {
                var ok = await _controlCompaniasRepository.EditarDespachoAsync(id, dto, userId);
                if (!ok) return NotFound(new { message = "Despacho no encontrado." });
                return Ok(new { message = "Ticket de despacho actualizado exitosamente." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Elimina un ticket de despacho (Solo Administrador).
        /// </summary>
        [Authorize(Roles = "ADMIN,SUPERADMIN")]
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> EliminarDespacho([FromRoute] long id)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            try
            {
                var ok = await _controlCompaniasRepository.EliminarDespachoAsync(id, userId);
                if (!ok) return NotFound(new { message = "Despacho no encontrado." });
                return Ok(new { message = "Ticket de despacho eliminado exitosamente." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
