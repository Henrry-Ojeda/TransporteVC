using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Transporte.Core.DTOs;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthRepository _authRepository;
        private readonly IUsuariosRepository _usuariosRepository;
        private readonly IConfiguration _config;
        private readonly Transporte.Core.Interfaces.ITenantService _tenantService;

        public AuthController(
            IAuthRepository authRepository, 
            IUsuariosRepository usuariosRepository,
            IConfiguration config,
            Transporte.Core.Interfaces.ITenantService tenantService)
        {
            _authRepository = authRepository;
            _usuariosRepository = usuariosRepository;
            _config = config;
            _tenantService = tenantService;
        }

        [HttpGet("tenant")]
        [AllowAnonymous]
        public IActionResult GetTenantInfo()
        {
            return Ok(new
            {
                codigo = _tenantService.GetTenantCode(),
                nombre = _tenantService.GetTenantName(),
                modulos = _tenantService.GetModulosActivos()
            });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _authRepository.ObtenerPorUsernameAsync(dto.Username);
            if (user == null)
            {
                return Unauthorized(new { message = "Usuario o contraseÃ±a invÃ¡lidos." });
            }

            bool passwordValida = false;
            try
            {
                if (!string.IsNullOrEmpty(user.PasswordHash) && 
                    (user.PasswordHash.StartsWith("$2a$") || user.PasswordHash.StartsWith("$2b$") || user.PasswordHash.StartsWith("$2y$")))
                {
                    passwordValida = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
                }
                else
                {
                    passwordValida = (!string.IsNullOrEmpty(dto.Password) && dto.Password == user.PasswordHash);
                }
            }
            catch
            {
                passwordValida = false;
            }

            if (!passwordValida)
            {
                return Unauthorized(new { message = "Usuario o contraseña inválidos." });
            }

            var permisos = user.Rol == "ADMIN"
                ? new[] { "DASHBOARD", "RUTAS_ALL", "MERMAS", "SEMANAS", "LIQUIDACION", "CATALOGOS", "BCV" }
                : (await _authRepository.ObtenerPermisosUsuarioAsync(user.Id));

            var tokenHandler = new JwtSecurityTokenHandler();
            var secretKey = _config["Jwt:SecretKey"] ?? _config["Jwt:Key"] ?? "ClaveSecretaSuperSeguraParaRutasDeLeche2026_JWT_Token_Key_MuyLargaParaHmacSha256!";
            var key = Encoding.UTF8.GetBytes(secretKey);
            
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Rol)
            };

            foreach (var perm in permisos)
            {
                claims.Add(new Claim("permiso", perm));
            }

            var issuer = _config["Jwt:Issuer"] ?? "TransporteAPI";
            var audience = _config["Jwt:Audience"] ?? "TransporteApp";

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddDays(7),
                Issuer = issuer,
                Audience = audience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Ok(new LoginResponseDto
            {
                Id = user.Id,
                Username = user.Username,
                NombreCompleto = user.NombreCompleto,
                Rol = user.Rol,
                Token = tokenString,
                Permisos = permisos,
                ModulosHabilitados = _tenantService.GetModulosActivos(),
                EmpresaCodigo = _tenantService.GetTenantCode(),
                EmpresaNombre = _tenantService.GetTenantName()
            });
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var user = await _authRepository.ObtenerPorUsernameAsync(username);
            if (user == null) return NotFound();

            var permisos = await _authRepository.ObtenerPermisosUsuarioAsync(user.Id);

            return Ok(new
            {
                id = user.Id,
                username = user.Username,
                nombreCompleto = user.NombreCompleto,
                rol = user.Rol,
                permisos,
                modulosHabilitados = _tenantService.GetModulosActivos(),
                empresaCodigo = _tenantService.GetTenantCode(),
                empresaNombre = _tenantService.GetTenantName()
            });
        }

        [HttpGet("perfil")]
        [Authorize]
        public async Task<IActionResult> ObtenerMiPerfil()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var perfil = await _usuariosRepository.ObtenerPerfilAsync(userId);
            if (perfil == null) return NotFound(new { message = "Perfil de usuario no encontrado." });
            return Ok(perfil);
        }

        [HttpPut("perfil")]
        [Authorize]
        public async Task<IActionResult> ActualizarMiPerfil([FromBody] ActualizarPerfilDto dto)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var (ok, msg) = await _usuariosRepository.ActualizarPerfilAsync(userId, dto);
            if (!ok) return BadRequest(new { message = msg });

            var perfilActualizado = await _usuariosRepository.ObtenerPerfilAsync(userId);
            return Ok(new { success = true, message = msg, perfil = perfilActualizado });
        }
    }
}