package edu.hunter.watchtower.PDFParser;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Creates short-lived audit files and removes leftovers from warm runtimes. */
final class TemporaryAuditFiles {

    static final Duration DEFAULT_MAX_RETENTION = Duration.ofMinutes(5);

    private static final Logger LOGGER = LoggerFactory.getLogger(TemporaryAuditFiles.class);
    private static final String PREFIX = "audit-";
    private static final String SUFFIX = ".pdf";

    private final Path temporaryDirectory;
    private final Clock clock;
    private final Duration maxRetention;
    private final Set<Path> activeFiles = ConcurrentHashMap.newKeySet();

    TemporaryAuditFiles() {
        this(
                Path.of(System.getProperty("java.io.tmpdir")),
                Clock.systemUTC(),
                DEFAULT_MAX_RETENTION);
    }

    TemporaryAuditFiles(Path temporaryDirectory, Clock clock, Duration maxRetention) {
        this.temporaryDirectory = temporaryDirectory;
        this.clock = clock;
        this.maxRetention = maxRetention;
    }

    Path create() throws IOException {
        deleteExpired();
        Path audit = Files.createTempFile(temporaryDirectory, PREFIX, SUFFIX);
        activeFiles.add(audit);
        return audit;
    }

    boolean delete(Path audit) {
        activeFiles.remove(audit);
        try {
            Files.deleteIfExists(audit);
            return true;
        } catch (IOException firstFailure) {
            if (!Files.isRegularFile(audit, LinkOption.NOFOLLOW_LINKS)) {
                LOGGER.error("Unable to remove a non-regular temporary audit path");
                return false;
            }
            try {
                // Remove the student data even if the filesystem temporarily
                // refuses to unlink the directory entry.
                try (OutputStream output = Files.newOutputStream(
                        audit,
                        StandardOpenOption.WRITE,
                        StandardOpenOption.TRUNCATE_EXISTING)) {
                    // Opening with TRUNCATE_EXISTING is the intended write.
                }
                Files.deleteIfExists(audit);
                return true;
            } catch (IOException retryFailure) {
                LOGGER.error(
                        "Unable to remove a temporary audit file; expiry cleanup will retry ({})",
                        retryFailure.getClass().getSimpleName());
                return false;
            }
        }
    }

    void deleteExpired() {
        Instant cutoff = clock.instant().minus(maxRetention);
        try (DirectoryStream<Path> candidates = Files.newDirectoryStream(
                temporaryDirectory,
                PREFIX + "*" + SUFFIX)) {
            for (Path candidate : candidates) {
                if (Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)
                        && !activeFiles.contains(candidate)
                        && Files.getLastModifiedTime(candidate).toInstant().isBefore(cutoff)) {
                    delete(candidate);
                }
            }
        } catch (IOException cleanupFailure) {
            LOGGER.warn(
                    "Unable to scan for expired temporary audit files ({})",
                    cleanupFailure.getClass().getSimpleName());
        }
    }
}
