using Microsoft.AspNetCore.Mvc;
using SampleApi.Models;
using SampleApi.Services;

namespace SampleApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductsController(IProductService service) : ControllerBase
{
    [HttpGet]
    public Task<List<Product>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Product>> Get(int id, CancellationToken ct)
    {
        var p = await service.GetAsync(id, ct);
        return p is null ? NotFound() : Ok(p);
    }
}
