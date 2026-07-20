CREATE TABLE `admin_audit_log` (
	`id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`action` varchar(100) NOT NULL,
	`target_type` varchar(50) NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `role` enum('user','support','admin') DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_audit_actor_idx` ON `admin_audit_log` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit_log` (`created_at`);