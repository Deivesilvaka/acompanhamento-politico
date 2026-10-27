-- O banco é criado automaticamente via POSTGRES_DB no docker-compose
CREATE EXTENSION IF NOT EXISTS unaccent;

SET lock_timeout = 1000;
SET idle_in_transaction_session_timeout = 10000;
