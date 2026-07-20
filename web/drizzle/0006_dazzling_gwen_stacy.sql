ALTER TABLE `session` ADD `impersonated_by` varchar(36);--> statement-breakpoint
ALTER TABLE `user` ADD `banned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` timestamp;