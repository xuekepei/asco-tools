RENAME TABLE `declaration` TO `renewal_declaration`;--> statement-breakpoint
ALTER TABLE `renewal_declaration` DROP FOREIGN KEY `declaration_user_id_user_id_fk`;
--> statement-breakpoint
DROP INDEX `declaration_user_year_idx` ON `renewal_declaration`;--> statement-breakpoint
ALTER TABLE `renewal_declaration` ADD CONSTRAINT `renewal_declaration_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `renewal_declaration_user_year_idx` ON `renewal_declaration` (`user_id`,`fiscal_year`);
