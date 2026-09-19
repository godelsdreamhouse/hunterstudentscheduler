/**
 * @file PDFController.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.ServletContext;

@RestController
class PDFController {

    @Autowired
    ServletContext context;

    @Autowired
    private AuditParser auditParser = new AuditParser();

    @GetMapping(path = "/parser/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    /**
     * @brief Endpoint which takes a MultipartFile and returns the extracted
     *        information, provided it is a DegreeWorks Audit
     * @param file MultipartFile of DegreeWorks Audit, either a PDF or txt file
     *             whose name contains ADMIN4082 for testing
     * @return The extracted information, provided file is a DegreeWorks Audit
     */
    @PostMapping(path = "/AuditParse")
    public Map<String, Object> postMethodName(@RequestParam("file") MultipartFile file) {
        Map<String, Object> result = new HashMap<>();
        boolean pdf = true;
        String originalFilename = file.getOriginalFilename();

        if (originalFilename == null || originalFilename.isBlank()) {
            result.put("ERROR", "Missing filename");
            return result;
        }

        if (originalFilename.contains("ADMIN4082") && originalFilename.endsWith(".txt")) {
            pdf = false;
        } else if (!originalFilename.toLowerCase().endsWith(".pdf")) {
            result.put("ERROR", "Not a PDF");
            result.put("fname", originalFilename);
            return result;
        }

        File path = (File) context.getAttribute(ServletContext.TEMPDIR);
        File f = null;

        try {
            f = Files.createTempFile(path.toPath(), "audit-", pdf ? ".pdf" : ".txt").toFile();
            file.transferTo(f);
            result = auditParser.parse(f, pdf);
        } catch (IOException e) {
            result.put("ERROR", "Could not process the uploaded audit");
        } finally {
            if (f != null) {
                try {
                    Files.deleteIfExists(f.toPath());
                } catch (IOException ignored) {
                    // Lambda discards /tmp with the execution environment.
                }
            }
        }

        return result;
    }

}
