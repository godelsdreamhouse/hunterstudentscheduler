package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;
import java.util.Map;

import org.junit.jupiter.api.Test;

public class AuditParserTests {
    
    private final String filepath = "ENTER PATH";
    private final AuditParser auditParser = new AuditParser();
    

    @Test
    void testParse() throws IOException {
        File file = new File(filepath);
        if(!file.exists()) throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file);

        result.forEach( (key, value) -> { String s = key + "\n" + value.toString()+"\n"; System.out.println(s); } );
        
    }

}
