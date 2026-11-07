using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Transporte.Core.DTOs;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [ApiController]
    [Route("api/notificaciones")]
    [Authorize]
    public class NotificacionesController : ControllerBase
    {
        private readonly INotificacionesRepository _notificacionesRepository;

        public NotificacionesController(INotificacionesRepository notificacionesRepository)
        {
            _notificacionesRepository = notificacionesRepository;
        }

        private int GetCurrentUserId()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirst("id")?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        [HttpGet("mis-notificaciones")]
        public async Task<IActionResult> ObtenerMisNotificaciones([FromQuery] int limite = 30)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized(new { message = "Usuario no identificado." });

            var lista = await _notificacionesRepository.ObtenerMisNotificacionesAsync(userId, limite);
            return Ok(lista);
        }

        [HttpPut("{id}/leer")]
        public async Task<IActionResult> MarcarLeida([FromRoute] long id)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized(new { message = "Usuario no identificado." });

            var ok = await _notificacionesRepository.MarcarComoLeidaAsync(id, userId);
            return Ok(new { success = ok });
        }

        [HttpPut("marcar-todas-leidas")]
        public async Task<IActionResult> MarcarTodasLeidas()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized(new { message = "Usuario no identificado." });

            var ok = await _notificacionesRepository.MarcarTodasComoLeidasAsync(userId);
            return Ok(new { success = ok });
        }

        [HttpPost("enviar")]
        public async Task<IActionResult> EnviarNotificacion([FromBody] CrearNotificacionMovilDto dto)
        {
            if (dto.UsuarioId <= 0 || string.IsNullOrWhiteSpace(dto.Titulo))
            {
                return BadRequest(new { message = "UsuarioId y Titulo son obligatorios." });
            }

            var id = await _notificacionesRepository.CrearNotificacionAsync(dto);
            return Ok(new { success = true, id });
        }
    }
}
