package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter

public class AuditParser extends PDFTextStripper{
    
    public String parse(File file) {
        String text = "";
        
        try (PDDocument audit = Loader.loadPDF(file)) {
            text = getText(audit);
        } catch (IOException e) {
            System.out.println(e.getMessage());
        }

        return text;
    }

}