using Microsoft.EntityFrameworkCore;
using SampleApi.Data;
using SampleApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("sample"));
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

app.MapControllers();
app.MapGet("/healthz", () => Results.Ok(new { ok = true }));
app.MapGet("/version", () => Results.Ok(new { version = "0.0.1-sample" }));

app.Run();
