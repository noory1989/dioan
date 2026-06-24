-- Migration: add duration_started_at and expected_duration_minutes to circle_mail
-- Run this SQL against your MySQL/MariaDB database.

ALTER TABLE `circle_mail`
  ADD COLUMN `duration_started_at` DATETIME NULL,
  ADD COLUMN `expected_duration_minutes` INT NULL;

-- Optional: create index to speed up overdue checks
CREATE INDEX IF NOT EXISTS `idx_circle_mail_duration_started` ON `circle_mail` (`duration_started_at`);
CREATE INDEX IF NOT EXISTS `idx_circle_mail_expected_minutes` ON `circle_mail` (`expected_duration_minutes`);
