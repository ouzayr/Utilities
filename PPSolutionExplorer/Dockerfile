# Multi-stage build: Angular client -> .NET publish -> slim runtime.
# The image is meant to run with host networking on the user's machine (see docs/DEPLOYMENT.md),
# because the API only talks to PostgreSQL and llama-server on 127.0.0.1.

FROM node:22-bookworm-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npx ng build --configuration production

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props PPSolutionExplorer.sln ./
COPY src/ src/
COPY prompts/ prompts/
COPY --from=web /src/src/Api/wwwroot src/Api/wwwroot
RUN dotnet publish src/Api/PPSolutionExplorer.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production \
    Urls=http://127.0.0.1:5080
USER app
ENTRYPOINT ["dotnet", "PPSolutionExplorer.Api.dll"]
