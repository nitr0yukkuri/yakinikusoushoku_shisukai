ALTER TABLE meetup_arrival_estimates
    ADD COLUMN IF NOT EXISTS route_polyline TEXT;
