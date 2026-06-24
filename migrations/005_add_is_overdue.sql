-- Migration: add is_overdue boolean to circle_mail
-- Run this SQL against your MySQL/MariaDB database.

ALTER TABLE `circle_mail`
  ADD COLUMN `is_overdue` TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS `idx_circle_mail_is_overdue` ON `circle_mail` (`is_overdue`);
