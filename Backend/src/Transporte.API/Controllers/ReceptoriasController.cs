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
    [Route("api/entregas")]
    [Route("api/receptoria")]
    public class ReceptoriasController : ControllerBase
    {
        private readonly IEntregasRepository _entregasRepository;

        public ReceptoriasController(IEntregasRepository entregasRepository)
        {
            _entregasRepository = entregasRepository;
        }

        [HttpGet]
        [HttpGet("hoy")]
        public async Task<IActionResult> ObtenerEntregasHoy(
            [FromQuery] DateTime? fecha = null,
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null,
            [FromQuery] int? cicloId = null)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";

            var entregas = await _entregasRepository.ObtenerEntregasHoyAsync(userId, rol, fecha, fechaInicio, fechaFin, cicloId);
            return Ok(entregas);
        }

        /// <summary>
        /// Obtiene el balance volumétrico completo, stock físico en tanques y trazabilidad de los 4 procesos operativos.
        /// </summary>
        [HttpGet("balance-volumetrico")]
        public async Task<IActionResult> ObtenerBalanceVolumetrico(
            [FromQuery] int? cicloId = null,
            [FromQuery] DateTime? fechaInicio = null,
            [FromQuery] DateTime? fechaFin = null)
        {
            try
            {
                var balance = await _entregasRepository.ObtenerBalanceVolumetricoAsync(cicloId, fechaInicio, fechaFin);
                return Ok(balance);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarEntrega([FromBody] RegistrarEntregaDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";
            try
            {
                var id = await _entregasRepository.RegistrarEntregaAsync(dto, userId, rol);
                return Ok(new { message = "Entrega en receptoría registrada exitosamente.", id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> ModificarEntrega([FromRoute] int id, [FromBody] EditarEntregaDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";

            try
            {
                await _entregasRepository.EditarEntregaAsync(id, dto, userId, rol);
                return Ok(new { message = "Entrega actualizada exitosamente." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarEntrega([FromRoute] int id)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var rol = User.FindFirstValue(ClaimTypes.Role) ?? "CHOFER";

            try
            {
                await _entregasRepository.EliminarEntregaAsync(id, userId, rol);
                return Ok(new { message = "Entrega eliminada exitosamente." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}