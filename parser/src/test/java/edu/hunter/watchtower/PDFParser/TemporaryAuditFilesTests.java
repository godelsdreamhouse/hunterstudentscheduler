package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class TemporaryAuditFilesTests {

    private static final Instant NOW = Instant.parse("2026-11-09T20:00:00Z");

    @Test
    void createRemovesExpiredAuditFilesButPreservesActiveAndUnrelatedFiles(
            @TempDir Path directory) throws Exception {
        Path expired = Files.writeString(directory.resolve("audit-expired.pdf"), "private audit");
        Path active = Files.writeString(directory.resolve("audit-active.pdf"), "active audit");
        Path unrelated = Files.writeString(directory.resolve("other.pdf"), "unrelated");
        Files.setLastModifiedTime(expired, FileTime.from(NOW.minus(Duration.ofMinutes(6))));
        Files.setLastModifiedTime(active, FileTime.from(NOW.minus(Duration.ofMinutes(4))));
        Files.setLastModifiedTime(unrelated, FileTime.from(NOW.minus(Duration.ofHours(1))));

        TemporaryAuditFiles auditFiles = new TemporaryAuditFiles(
                directory,
                Clock.fixed(NOW, ZoneOffset.UTC),
                Duration.ofMinutes(5));

        Path created = auditFiles.create();

        assertFalse(Files.exists(expired));
        assertTrue(Files.exists(active));
        assertTrue(Files.exists(unrelated));
        assertTrue(created.getFileName().toString().startsWith("audit-"));
        assertTrue(created.getFileName().toString().endsWith(".pdf"));
        assertTrue(auditFiles.delete(created));
        assertFalse(Files.exists(created));
    }

    @Test
    void deleteIsIdempotent(@TempDir Path directory) throws Exception {
        TemporaryAuditFiles auditFiles = new TemporaryAuditFiles(
                directory,
                Clock.fixed(NOW, ZoneOffset.UTC),
                Duration.ofMinutes(5));
        Path created = auditFiles.create();

        assertTrue(auditFiles.delete(created));
        assertTrue(auditFiles.delete(created));
    }

    @Test
    void failedUnlinkTruncatesAuditBeforeReturningFailure(@TempDir Path directory)
            throws Exception {
        assumeTrue(Files.getFileStore(directory).supportsFileAttributeView("posix"));
        Path lockedDirectory = Files.createDirectory(directory.resolve("locked"));
        Path audit = Files.writeString(lockedDirectory.resolve("audit-private.pdf"), "private audit");
        Set<PosixFilePermission> originalPermissions = Files.getPosixFilePermissions(lockedDirectory);
        TemporaryAuditFiles auditFiles = new TemporaryAuditFiles(
                lockedDirectory,
                Clock.fixed(NOW, ZoneOffset.UTC),
                Duration.ofMinutes(5));

        try {
            Files.setPosixFilePermissions(
                    lockedDirectory,
                    EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_EXECUTE));

            assertFalse(auditFiles.delete(audit));
            assertTrue(Files.exists(audit));
            assertEquals(0, Files.size(audit));
        } finally {
            Files.setPosixFilePermissions(lockedDirectory, originalPermissions);
            Files.deleteIfExists(audit);
        }
    }

    @Test
    void expiryCleanupDoesNotDeleteAnActiveAudit(@TempDir Path directory) throws Exception {
        TemporaryAuditFiles auditFiles = new TemporaryAuditFiles(
                directory,
                Clock.fixed(NOW, ZoneOffset.UTC),
                Duration.ofMinutes(5));
        Path active = auditFiles.create();
        Files.setLastModifiedTime(active, FileTime.from(NOW.minus(Duration.ofHours(1))));

        auditFiles.deleteExpired();

        assertTrue(Files.exists(active));
        assertTrue(auditFiles.delete(active));
    }
}
