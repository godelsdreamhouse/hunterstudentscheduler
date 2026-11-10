/**
 * @file PDFController.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
class PDFController {

    private static final byte[] PDF_SIGNATURE = {'%', 'P', 'D', 'F', '-'};

    private final AuditParser auditParser;

    PDFController(AuditParser auditParser) {
        this.auditParser = auditParser;
    }

    @GetMapping(path = "/parser/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    /**
     * @brief Endpoint which takes a MultipartFile and returns the extracted
     *        information, provided it is a DegreeWorks Audit
     * @param file MultipartFile containing a DegreeWorks PDF
     * @return The extracted information, provided file is a DegreeWorks Audit
     */
    @PostMapping(path = "/AuditParse")
    public ResponseEntity<Map<String, Object>> parseAudit(@RequestParam("file") MultipartFile file) {
        Map<String, Object> result = new HashMap<>();
        String originalFilename = file.getOriginalFilename();

        if (originalFilename == null || originalFilename.isBlank()) {
            result.put("ERROR", "Missing filename");
            return noStore(result);
        }

        if (!originalFilename.toLowerCase().endsWith(".pdf")) {
            result.put("ERROR", "Not a PDF");
            return noStore(result);
        }

        Path temporaryAudit = null;

        try {
            if (!hasPdfSignature(file)) {
                result.put("ERROR", "Not a PDF");
                return noStore(result);
            }

            temporaryAudit = Files.createTempFile("audit-", ".pdf");
            file.transferTo(temporaryAudit);
            result = auditParser.parse(temporaryAudit.toFile(), true);
        } catch (IOException e) {
            result.put("ERROR", "Could not process the uploaded audit");
        } finally {
            if (temporaryAudit != null) {
                try {
                    Files.deleteIfExists(temporaryAudit);
                } catch (IOException ignored) {
                    // Lambda discards /tmp with the execution environment.
                }
            }
        }

        return noStore(result);
    }

    private boolean hasPdfSignature(MultipartFile file) throws IOException {
        try (var input = file.getInputStream()) {
            byte[] signature = input.readNBytes(PDF_SIGNATURE.length);
            return java.util.Arrays.equals(signature, PDF_SIGNATURE);
        }
    }

    private ResponseEntity<Map<String, Object>> noStore(Map<String, Object> body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(body);
    }
}
