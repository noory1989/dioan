-- Migration: add dossier workflow fields to circle_mail and create overdue_dossiers table
-- Run against MySQL/MariaDB

ALTER TABLE `circle_mail`
  ADD COLUMN `current_department_id` INT NULL,
  ADD COLUMN `expected_duration_minutes` INT NULL,
  ADD COLUMN `duration_started_at` DATETIME NULL,
  ADD COLUMN `is_locked` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `is_transferred` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `deleted_at` DATETIME NULL;

-- Create overdue_dossiers table to record detected overdue dossiers
CREATE TABLE IF NOT EXISTS `overdue_dossiers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `dossier_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  `overdue_since` DATETIME NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`dossier_id`),
  INDEX (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
