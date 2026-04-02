# Stage 1: Build
FROM golang:1.21-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y git

# Copy dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o main .

# Stage 2: Final image
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies including Python 3 and Microsoft ODBC Driver 18
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    python3 \
    python3-pip \
    python3-pyodbc \
    unixodbc \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && sed -i 's/deb \[/deb [signed-by=\/usr\/share\/keyrings\/microsoft-prod.gpg /' /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/main .
# Copy python migration scripts
COPY --from=builder /app/*.py ./

# Expose port from .env
EXPOSE 4000

# Run the application
CMD ["./main"]
