FROM debian:bookworm-slim

# Install system dependencies (Python3 and SQL Server ODBC drivers)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    gnupg2 \
    unixodbc \
    unixodbc-dev \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy python requirements and install (if any)
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt || true

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
