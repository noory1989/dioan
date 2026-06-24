-- Migration: create overdue_dossiers table
-- Run this SQL against your MySQL/MariaDB database.

CREATE TABLE IF NOT EXISTS `overdue_dossiers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `dossier_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  `overdue_since` DATETIME NOT NULL,
  `status` ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_overdue_dossiers_dossier` (`dossier_id`),
  INDEX `idx_overdue_dossiers_department` (`department_id`),
  CONSTRAINT `fk_overdue_dossiers_dossier` FOREIGN KEY (`dossier_id`) REFERENCES `circle_mail`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_overdue_dossiers_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: the above foreign keys assume tables `circle_mail` and `departments` exist.
-- If your departments table is named differently (e.g. `circles`), adjust the FK accordingly.
