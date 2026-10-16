CREATE TABLE `practice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`position` integer NOT NULL,
	`slot` text NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`difficulty` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`reason` text NOT NULL,
	`focus_tag` text,
	FOREIGN KEY (`plan_id`) REFERENCES `practice_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_items_plan_problem_idx` ON `practice_items` (`plan_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `practice_items_ext_idx` ON `practice_items` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `practice_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`level` integer NOT NULL,
	`size` integer NOT NULL,
	`theme` text,
	`coach_note` text,
	`model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_plans_day_unique` ON `practice_plans` (`day`);--> statement-breakpoint
CREATE TABLE `problemset` (
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`contest_id` integer NOT NULL,
	`index` text NOT NULL,
	`name` text NOT NULL,
	`rating` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`solved_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`platform`, `external_id`)
);
--> statement-breakpoint
CREATE INDEX `problemset_rating_idx` ON `problemset` (`platform`,`rating`);