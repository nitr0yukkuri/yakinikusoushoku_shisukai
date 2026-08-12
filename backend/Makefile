.PHONY: build docker run migrate

build:
	go build -o bin/server .

docker:
	docker build -t matsunya-backend:latest .

run:
	DATABASE_URL="$${DATABASE_URL}" PORT=8080 ./bin/server

migrate:
	psql "$${DATABASE_URL}" -f migrations/0001_init.sql
	psql "$${DATABASE_URL}" -f migrations/0002_friends.sql
	psql "$${DATABASE_URL}" -f migrations/0003_meetups.sql
	psql "$${DATABASE_URL}" -f migrations/0004_notifications.sql
	psql "$${DATABASE_URL}" -f migrations/0005_arrival_estimate_routes.sql
	psql "$${DATABASE_URL}" -f migrations/0006_google_oauth_codes.sql
