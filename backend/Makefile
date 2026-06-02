.PHONY: build docker run migrate

build:
	go build -o bin/server .

docker:
	docker build -t matsunya-backend:latest .

run:
	DATABASE_URL="$${DATABASE_URL}" PORT=8080 ./bin/server

migrate:
	psql "$${DATABASE_URL}" -f migrations/0001_init.sql