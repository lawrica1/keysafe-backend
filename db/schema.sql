-- KeySafe Tracker Database Schema

-- Drop tables if they exist (for easy resetting/seeding)
DROP TABLE IF EXISTS tracking_logs CASCADE;
DROP TABLE IF EXISTS keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;

-- 1. Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'security')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Keys Table
CREATE TABLE keys (
    key_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Office', 'Vehicle', 'Residential')),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'checked_out', 'lost')),
    current_holder_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tracking Logs Table
CREATE TABLE tracking_logs (
    log_id SERIAL PRIMARY KEY,
    key_id VARCHAR(100) REFERENCES keys(key_id) ON DELETE CASCADE,
    reported_by VARCHAR(100) NOT NULL,
    gateway_id VARCHAR(100) NOT NULL,
    rssi INTEGER NOT NULL CHECK (rssi BETWEEN -100 AND -30),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. App Config Table
CREATE TABLE app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(100) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_logs_key_timestamp ON tracking_logs(key_id, timestamp DESC);
CREATE INDEX idx_logs_timestamp ON tracking_logs(timestamp DESC);
CREATE INDEX idx_keys_last_updated ON keys(last_updated DESC);
CREATE INDEX idx_users_email ON users(email);
