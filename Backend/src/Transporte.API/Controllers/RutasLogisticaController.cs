using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Transporte.Core.DTOs;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/rutas-logistica")]
    public class RutasLogisticaController : ControllerBase
    {
        private readonly IRutasLogisticaRepository _rutasLogisticaRepository;

        public RutasLogisticaController(IRutasLogisticaRepository rutasLogisticaRepository)
        {
            _rutasLogisticaRepository = rutasLogisticaRepository;
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerRutas()
        {
            var rutas = await _rutasLogisticaRepository.ObtenerRutasAsync();
            return Ok(rutas);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> ObtenerRutaPorId(int id)
        {
            var ruta = await _rutasLogisticaRepository.ObtenerRutaPorIdAsync(id);
            if (ruta == null) return NotFound(new { message = "Ruta logística no encontrada." });
            return Ok(ruta);
        }

        [HttpPost]
        public async Task<IActionResult> CrearRuta([FromBody] GuardarRutaLogisticaDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Nombre))
            {
                return BadRequest(new { message = "El nombre de la ruta es obligatorio." });
            }
            if (string.IsNullOrWhiteSpace(dto.Codigo))
            {
                dto.Codigo = dto.Nombre.ToUpper().Replace(" ", "_");
            }

            try
            {
                var id = await _rutasLogisticaRepository.CrearRutaAsync(dto);
                return Ok(new { message = "Ruta logística creada exitosamente.", id });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> ActualizarRuta(int id, [FromBody] GuardarRutaLogisticaDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Nombre))
            {
                return BadRequest(new { message = "El nombre de la ruta es obligatorio." });
            }

            try
            {
                var ok = await _rutasLogisticaRepository.ActualizarRutaAsync(id, dto);
                if (!ok) return NotFound(new { message = "Ruta logística no encontrada." });
                return Ok(new { message = "Ruta logística actualizada exitosamente." });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> EliminarRuta(int id)
        {
            try
            {
                var ok = await _rutasLogisticaRepository.EliminarRutaAsync(id);
                if (!ok) return NotFound(new { message = "Ruta no encontrada." });
                return Ok(new { message = "Ruta logística eliminada exitosamente." });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id:int}/fincas")]
        public async Task<IActionResult> ObtenerFincasDeRuta(int id)
        {
            var fincas = await _rutasLogisticaRepository.ObtenerFincasDeRutaAsync(id);
            return Ok(fincas);
        }

        [HttpPost("{id:int}/fincas")]
        public async Task<IActionResult> AsignarFincasARuta(int id, [FromBody] AsignarFincasRutaDto dto)
        {
            try
            {
                var ok = await _rutasLogisticaRepository.AsignarFincasARutaAsync(id, dto.FincaIds);
                return Ok(new { message = "Fincas asignadas a la ruta exitosamente." });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
