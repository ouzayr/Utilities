FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY apps/scanner-dotnet/scanner-dotnet.csproj ./
RUN dotnet restore scanner-dotnet.csproj
COPY apps/scanner-dotnet ./
RUN dotnet publish scanner-dotnet.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/sdk:8.0
WORKDIR /app
COPY --from=build /out ./
ENTRYPOINT ["dotnet", "/app/cc-scan-dotnet.dll"]
