-- Enable PostGIS extension and create basic tables
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS places (
    id SERIAL PRIMARY KEY,
    name TEXT,
    geom geometry(Point, 4326)
);
