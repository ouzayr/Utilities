namespace CardForge.Application.Exceptions;

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
    public NotFoundException(string entity, Guid id) : base($"{entity} '{id}' was not found.") { }
}
