-- Migration: add locked_at to circle_mail
-- Run this SQL against your MySQL/MariaDB database.

ALTER TABLE `circle_mail`
  ADD COLUMN `locked_at` DATETIME NULL;

CREATE INDEX IF NOT EXISTS `idx_circle_mail_locked_at` ON `circle_mail` (`locked_at`);
