FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg ca-certificates unixodbc-dev build-essential \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

COPY sqlutil ./sqlutil

ENV SQLUTIL_DATA_DIR=/data
RUN mkdir -p /data /app/web
VOLUME ["/data"]

EXPOSE 8000
CMD ["uvicorn", "sqlutil.main:app", "--host", "0.0.0.0", "--port", "8000"]
