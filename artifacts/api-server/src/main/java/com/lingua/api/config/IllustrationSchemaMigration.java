package com.lingua.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-time migration: replace the old UNIQUE(book_id, paragraph_id) constraint
 * on chapter_illustrations with UNIQUE(book_id, paragraph_id, scene_index),
 * which is needed to store multiple scenes per chapter.
 *
 * Safe to run repeatedly — checks existence before acting.
 */
@Component
public class IllustrationSchemaMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(IllustrationSchemaMigration.class);
    private final JdbcTemplate jdbc;

    public IllustrationSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            // Drop old constraint if it still exists
            Boolean oldExists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chapter_illustrations_book_id_paragraph_id_key')",
                Boolean.class);
            if (Boolean.TRUE.equals(oldExists)) {
                jdbc.execute("ALTER TABLE chapter_illustrations DROP CONSTRAINT chapter_illustrations_book_id_paragraph_id_key");
                log.info("Dropped old unique constraint (book_id, paragraph_id) from chapter_illustrations");
            }

            // Add new constraint if not already present
            Boolean newExists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chapter_illustrations_book_id_paragraph_id_scene_key')",
                Boolean.class);
            if (!Boolean.TRUE.equals(newExists)) {
                jdbc.execute("ALTER TABLE chapter_illustrations ADD CONSTRAINT chapter_illustrations_book_id_paragraph_id_scene_key UNIQUE (book_id, paragraph_id, scene_index)");
                log.info("Added new unique constraint (book_id, paragraph_id, scene_index) to chapter_illustrations");
            }
        } catch (Exception e) {
            log.warn("IllustrationSchemaMigration failed (non-fatal): {}", e.getMessage());
        }
    }
}
