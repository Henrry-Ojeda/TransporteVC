using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Transporte.Core.DTOs;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMIN")]
    public class UsuariosController : ControllerBase
    {
        private readonly IUsuariosRepository _usuariosRepository;

        public UsuariosController(IUsuariosRepository usuariosRepository)
        {
            _usuariosRepository = usuariosRepository;
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerUsuarios([FromQuery] string? rol = null, [FromQuery] bool soloActivos = false)
        {
            var usuarios = await _usuariosRepository.ObtenerUsuariosAsync(rol, soloActivos);
            return Ok(usuarios);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerUsuarioPorId([FromRoute] int id)
        {
            var usuario = await _usuariosRepository.ObtenerUsuarioPorIdAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });
            return Ok(usuario);
        }

        [HttpGet("roles")]
        public async Task<IActionResult> ObtenerRoles()
        {
            var roles = await _usuariosRepository.ObtenerRolesAsync();
            return Ok(roles);
        }

        [HttpGet("choferes-disponibles")]
        public async Task<IActionResult> ObtenerChoferesDisponibles()
        {
            var choferes = await _usuariosRepository.ObtenerChoferesDisponiblesAsync();
            return Ok(choferes);
        }

        [HttpPost]
        public async Task<IActionResult> CrearUsuario([FromBody] CrearUsuarioDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username))
                return BadRequest(new { message = "El nombre de usuario es obligatorio." });

            if (string.IsNullOrWhiteSpace(dto.NombreCompleto))
                return BadRequest(new { message = "El nombre completo es obligatorio." });

            try
            {
                var id = await _usuariosRepository.CrearUsuarioAsync(dto);
                return Ok(new { id, message = "Usuario creado exitosamente." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message.Contains("UQ_") || ex.Message.Contains("UNIQUE") || ex.Message.Contains("duplicate")
                    ? "El nombre de usuario ya está registrado en el sistema."
                    : $"Error al crear usuario: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> ActualizarUsuario([FromRoute] int id, [FromBody] EditarUsuarioDto dto)
        {
            var ok = await _usuariosRepository.ActualizarUsuarioAsync(id, dto);
            if (!ok) return NotFound(new { message = "Usuario no encontrado o no modificado." });
            return Ok(new { message = "Usuario actualizado exitosamente." });
        }

        [HttpPut("{id}/password")]
        public async Task<IActionResult> ActualizarPassword([FromRoute] int id, [FromBody] CambiarPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.NuevaPassword) || dto.NuevaPassword.Length < 6)
                return BadRequest(new { message = "La nueva contraseña debe tener al menos 6 caracteres." });

            var ok = await _usuariosRepository.ActualizarPasswordAsync(id, dto.NuevaPassword);
            if (!ok) return NotFound(new { message = "Usuario no encontrado." });
            return Ok(new { message = "Contraseña actualizada exitosamente." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarUsuario([FromRoute] int id)
        {
            var ok = await _usuariosRepository.EliminarUsuarioAsync(id);
            if (!ok) return NotFound(new { message = "Usuario no encontrado." });
            return Ok(new { message = "Usuario eliminado exitosamente." });
        }
    }
}
