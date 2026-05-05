using CardForge.Domain.Enums;

namespace CardForge.Application.DTOs.Auth;

public record UserDto(
    Guid Id,
    Guid? TenantId,
    string Email,
    string FirstName,
    string LastName,
    string? JobTitle,
    string? Phone,
    UserRole Role,
    bool IsActive,
    DateTimeOffset CreatedAt
);

public record CreateUserRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string? JobTitle,
    string? Phone,
    UserRole Role
);

public record UpdateUserRequest(
    string FirstName,
    string LastName,
    string? JobTitle,
    string? Phone,
    bool IsActive
);

public record UpdateUserRoleRequest(UserRole Role);
