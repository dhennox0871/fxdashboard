FROM golang:1.21-bookworm AS go-builder

WORKDIR /src

# Cache dependencies first for faster rebuilds
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/main .

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

# Copy Go binary built in the builder stage
COPY --from=go-builder /out/main .
RUN chmod +x main

# Copy python scripts
COPY *.py ./

# Default environment variables
ENV PORT=4000
ENV DB_DIR=/app/data

EXPOSE 4000

# Run the Go application
CMD ["./main"]
