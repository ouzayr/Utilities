-- CardForge Demo Seed Data
-- Run: sqlcmd -S "(localdb)\mssqllocaldb" -d CardForge -i scripts\seed.sql

-- Demo Tenant
DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-0000-0000-0000-000000000001';
DECLARE @SuperAdminId UNIQUEIDENTIFIER = '22222222-0000-0000-0000-000000000001';
DECLARE @ClientAdminId UNIQUEIDENTIFIER = '22222222-0000-0000-0000-000000000002';
DECLARE @UserId UNIQUEIDENTIFIER = '22222222-0000-0000-0000-000000000003';
DECLARE @SubscriptionId UNIQUEIDENTIFIER = '33333333-0000-0000-0000-000000000001';

-- Insert tenant (Acme Corp)
IF NOT EXISTS (SELECT 1 FROM Tenants WHERE Id = @TenantId)
BEGIN
    INSERT INTO Tenants (Id, Name, Slug, IsActive, TemplateCreationPolicy, WhiteLabelEnabled, CreatedAt)
    VALUES (@TenantId, 'Acme Corp', 'acme', 1, 1, 0, SYSDATETIMEOFFSET());
END

-- SuperAdmin (no tenant)
-- Password: Admin123!
-- BCrypt hash for "Admin123!"
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'superadmin@cardforge.io')
BEGIN
    INSERT INTO Users (Id, TenantId, Email, PasswordHash, Role, FirstName, LastName, IsActive, CreatedAt)
    VALUES (
        @SuperAdminId, NULL, 'superadmin@cardforge.io',
        '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        0, 'Platform', 'Admin', 1, SYSDATETIMEOFFSET()
    );
END

-- ClientAdmin for Acme
-- Password: Admin123!
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'clientadmin@acme.com')
BEGIN
    INSERT INTO Users (Id, TenantId, Email, PasswordHash, Role, FirstName, LastName, JobTitle, IsActive, CreatedAt)
    VALUES (
        @ClientAdminId, @TenantId, 'clientadmin@acme.com',
        '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        1, 'Jane', 'Smith', 'Marketing Manager', 1, SYSDATETIMEOFFSET()
    );
END

-- Regular User for Acme
-- Password: User123!
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'user@acme.com')
BEGIN
    INSERT INTO Users (Id, TenantId, Email, PasswordHash, Role, FirstName, LastName, JobTitle, Phone, IsActive, CreatedAt)
    VALUES (
        @UserId, @TenantId, 'user@acme.com',
        '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        3, 'John', 'Doe', 'Sales Representative', '+1 555 123 4567', 1, SYSDATETIMEOFFSET()
    );
END

-- Starter Subscription for Acme
IF NOT EXISTS (SELECT 1 FROM Subscriptions WHERE Id = @SubscriptionId)
BEGIN
    INSERT INTO Subscriptions (Id, TenantId, Tier, Status, StartsAt, CreatedAt)
    VALUES (@SubscriptionId, @TenantId, 0, 'Active', SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());

    INSERT INTO BillingDetails (Id, SubscriptionId, AmountCents, Currency, CreatedAt)
    VALUES (NEWID(), @SubscriptionId, 0, 'USD', SYSDATETIMEOFFSET());
END

PRINT 'Seed complete.';
PRINT 'Logins:';
PRINT '  superadmin@cardforge.io / Admin123!';
PRINT '  clientadmin@acme.com    / Admin123!';
PRINT '  user@acme.com           / User123!';
