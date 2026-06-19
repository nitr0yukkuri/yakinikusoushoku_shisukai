FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /server .

FROM alpine:3.22
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /server /server
USER app
EXPOSE 8080
ENTRYPOINT ["/server"]
