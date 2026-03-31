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

    @Autowired ServletContext context;

    @PostMapping(path = "/AuditParse")
    public Map<String,Object> postMethodName(@RequestParam("file") MultipartFile file) {
        Map<String,Object> result = new HashMap<>();
        AuditParser auditParser = new AuditParser();

        if (!file.getOriginalFilename().contains(".pdf")) {
            result.put("ERROR","Not a PDF");
            result.put("fname",file.getOriginalFilename());
            return result;
        }

        String filename = file.getOriginalFilename().split("\\.")[0];
        File path = (File) context.getAttribute(ServletContext.TEMPDIR);
        File f = new File(path,filename+".pdf");
        
        try {
            file.transferTo(f);
            result = auditParser.parse(f);
        } catch (IOException e) {
            result.put("ERROR", e.getMessage());
        } finally {
            f.deleteOnExit();
        }

        return result;
    }
    
    
}

