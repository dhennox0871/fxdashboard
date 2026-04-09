FROM python:3.11-slim

# Install system dependencies (SQL Server ODBC drivers)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    unixodbc \
    unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-archive-keyring.gpg \
    && echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-archive-keyring.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy pre-built Go binary (compiled locally for Linux)
COPY main .
RUN chmod +x main

# Copy python scripts
COPY *.py ./

# Default environment variables
ENV PORT=4000
ENV DB_DIR=/app/data

EXPOSE 4000

# Run the Go application
CMD ["./main"]
