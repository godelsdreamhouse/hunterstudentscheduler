/**
 * @file PDFController.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
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

        if (file.getOriginalFilename().contains("ADMIN4082") && file.getOriginalFilename().contains(".txt")) {
            pdf = false;
        } else if (!file.getOriginalFilename().contains(".pdf")) {
            result.put("ERROR", "Not a PDF");
            result.put("fname", file.getOriginalFilename());
            return result;
        }

        String filename = file.getOriginalFilename().split("\\.")[0];
        File path = (File) context.getAttribute(ServletContext.TEMPDIR);
        File f = pdf ? new File(path, filename + ".pdf") : new File(path, filename + ".txt");

        try {
            file.transferTo(f);
            result = auditParser.parse(f, pdf);
        } catch (IOException e) {
            result.put("ERROR", e.getMessage());
        } finally {
            f.deleteOnExit();
        }

        return result;
    }

}
