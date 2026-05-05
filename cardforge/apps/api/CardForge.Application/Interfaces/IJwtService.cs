using CardForge.Domain.Entities;

namespace CardForge.Application.Interfaces;

public interface IJwtService
{
    string GenerateToken(AppUser user);
    string GenerateRefreshToken();
}
