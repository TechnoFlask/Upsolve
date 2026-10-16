CREATE TABLE `contest_problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contest_id` integer NOT NULL,
	`index` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`difficulty` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_problems_contest_index_idx` ON `contest_problems` (`contest_id`,`index`);--> statement-breakpoint
CREATE INDEX `contest_problems_ext_idx` ON `contest_problems` (`external_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`difficulty` integer,
	`difficulty_label` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'solved' NOT NULL,
	`tries` integer DEFAULT 1 NOT NULL,
	`used_editorial` integer DEFAULT false NOT NULL,
	`solved_at` integer,
	`notes` text,
	`ai_approach` text,
	`ai_model` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_problems`("id", "platform", "external_id", "name", "url", "difficulty", "difficulty_label", "tags", "status", "tries", "used_editorial", "solved_at", "notes", "ai_approach", "ai_model", "source", "created_at", "updated_at") SELECT "id", "platform", "external_id", "name", "url", "difficulty", "difficulty_label", "tags", "status", "tries", "used_editorial", "solved_at", "notes", "ai_approach", "ai_model", "source", "created_at", "updated_at" FROM `problems`;--> statement-breakpoint
DROP TABLE `problems`;--> statement-breakpoint
ALTER TABLE `__new_problems` RENAME TO `problems`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `problems_platform_ext_idx` ON `problems` (`platform`,`external_id`);--> statement-breakpoint
CREATE INDEX `problems_status_idx` ON `problems` (`status`);--> statement-breakpoint
CREATE INDEX `problems_solved_at_idx` ON `problems` (`solved_at`);--> statement-breakpoint
ALTER TABLE `contests` ADD `participation` text DEFAULT 'practice' NOT NULL;