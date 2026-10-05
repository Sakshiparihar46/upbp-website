CREATE DATABASE IF NOT EXISTS upba CHARACTER SET utf8mb4;
USE upba;


CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('Boxer','Coach','Doctor','Physiotherapist','Referee & Judge') NOT NULL,
  reg_no VARCHAR(20) UNIQUE,
  title VARCHAR(10), first_name VARCHAR(80) NOT NULL, last_name VARCHAR(80) NOT NULL,
  gender VARCHAR(10), dob DATE, email VARCHAR(120), mobile VARCHAR(15) NOT NULL,
  address TEXT, photo VARCHAR(255),
  data JSON,
  status ENUM('pending','paid') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (role), INDEX (mobile)
);


CREATE TABLE IF NOT EXISTS education (
  id INT AUTO_INCREMENT PRIMARY KEY, member_id INT NOT NULL,
  degree VARCHAR(120), board VARCHAR(120), year VARCHAR(6),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS achievements (
  id INT AUTO_INCREMENT PRIMARY KEY, member_id INT NOT NULL, text VARCHAR(255),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY, member_id INT NOT NULL,
  amount INT NOT NULL, receipt_no VARCHAR(30) UNIQUE, gateway_ref VARCHAR(80),
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS form_configs (
  role VARCHAR(80) PRIMARY KEY,
  config JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registration_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  field_label VARCHAR(120) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  review_note VARCHAR(500),
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY member_document_label (member_id, field_label),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
