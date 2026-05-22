/**
 * @file TextRefinerTests.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class TextRefinerTests {
    
    private final TextRefiner refiner = new TextRefiner();

    @Test
    void testFindBlock() {
        String block = """
                Major U Computer Science   Concentration U Computer Science   Minor None   Level Undergraduate   Classification Upper
                Junior   Transfer Credits 10.00 Academic Status (GST) Good Academic Standing   Student Group/Indicator (GROUPS)MHC PRTY (SI),
                (GROUPS)MHC PRTY (SI)   Matriculation Term 2023 Spring Term   
                """;
        
        String found = refiner.getBlock(block, "Transfer Credits", "Matriculation");
        String expected = "Junior   Transfer Credits 10.00 Academic Status (GST) Good Academic Standing   Student Group/Indicator (GROUPS)MHC PRTY (SI),";
        assertEquals(expected,found.trim());
    }

    @Test
    void testFindBlocks() {
        String block = """
                line line line
                line line line
                line block1 line line line 
                content2
                content3 block11 block3
                block45 block3 line line
                sdfk;a
                asdf
                block45
                block6
                line
                sdf
                """;
        
        ArrayList<String> found = refiner.getBlocks(block,
            new ArrayList<>(Arrays.asList("block1","block3","block6")),
            new ArrayList<>(Arrays.asList("block11","block45","end"))
        );

        ArrayList<String> expected = new ArrayList<>(Arrays.asList(
            "line line line\ncontent2\ncontent3",
            "line line\nsdfk;a\nasdf",
            "line\nsdf"
        ));
        assertEquals(expected,found);

    }

    @Test
    void testDivideText() {
        String text = """
                line line line
                95 line line 4line 
                moreline more line32 
                43 line line
                76 line line
                footer1 footer2 footer3
                """;
        Pattern divider = Pattern.compile("\\b\\d{2}\\b");

        ArrayList<String> found = refiner.divideText(text, divider);

        ArrayList<String> expected = new ArrayList<>(Arrays.asList(
            "line line line",
            "95 line line 4line\nmoreline more line32",
            "43 line line",
            "76 line line\nfooter1 footer2 footer3"
        ));
        
        assertEquals(expected,found);
    }


}
