import { db } from '../config/db.js';

export const CoreSchemaModel = {
  async ensureTables() {
    await db.query(`CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role ENUM('Boxer','Coach','Doctor','Physiotherapist','Referee & Judge') NOT NULL,
      reg_no VARCHAR(20) UNIQUE,
      title VARCHAR(10),
      first_name VARCHAR(80) NOT NULL,
      last_name VARCHAR(80) NOT NULL,
      gender VARCHAR(10),
      dob DATE,
      email VARCHAR(120),
      mobile VARCHAR(15) NOT NULL,
      address TEXT,
      photo VARCHAR(255),
      data JSON,
      status ENUM('pending','paid') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (role),
      INDEX (mobile)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.query(`CREATE TABLE IF NOT EXISTS education (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      degree VARCHAR(120),
      board VARCHAR(120),
      year VARCHAR(6),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.query(`CREATE TABLE IF NOT EXISTS achievements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      text VARCHAR(255),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.query(`CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      amount INT NOT NULL,
      receipt_no VARCHAR(30) UNIQUE,
      gateway_ref VARCHAR(80),
      paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
};
