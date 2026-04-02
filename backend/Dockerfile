# Stage 1: Build
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o main .

# Stage 2: Final image
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies (if any)
RUN apk add --no-cache ca-certificates

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port from .env
EXPOSE 4000

# Run the application
CMD ["./main"]
