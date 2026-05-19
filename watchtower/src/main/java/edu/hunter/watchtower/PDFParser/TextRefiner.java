/**
 * @file TextRefiner.java
 * @author Allison Gorman
 * @brief Contains methods for refining a large block of text
 */
package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import lombok.NoArgsConstructor;

@NoArgsConstructor
public class TextRefiner {
    
    /**
     * @brief Isolates a block of text
     * @param text The text to search through
     * @param start A string which marks where the block starts; includes the line with the start string
     * @param stop The string which marks where the block ends; does not include the line with the stop string
     * @return A string containing the block of text; has line-breaks within block
     */
    public String getBlock(String text, String start, String stop) {
        StringBuilder builder = new StringBuilder();

        String[] lines = text.split("\n");
        boolean found = false;

        Pattern p1 = Pattern.compile(start);
        Pattern p2 = Pattern.compile(stop);

        for (String line : lines) {
            if (!found) {
                Matcher matcher = p1.matcher(line);
                if (matcher.find()) {
                    found = true;
                    builder.append(line).append("\n");
                }
            } else {
                Matcher matcher = p2.matcher(line);
                if (matcher.find()) break;
                else builder.append(line).append("\n");
            }
        } // end iteration through text

        return builder.toString().trim();
    }

    /**
     * @brief Extracts blocks of text, in order of the blocks given by the start and stop strings
     * @param text The text to search through
     * @param start An ArrayList of strings which mark where the blocks start; includes the line with the start string
     * @param stop An ArrayList of strings which mark where the blocks end; does not include the line with the stop string
     * @return An ArrayList of strings containing the blocks of text; has line-breaks within blocks
     * Goes through the document line by line, looking for the start and stop strings. 
     * When a start string is found, it begins adding lines to a StringBuilder until the corresponding stop string is found. 
     * The resulting block of text, if it exists, i.e. builder.length() > 0, is then added to the ArrayList of blocks.
     * The line including the stop string is then read through again in order to check for the next start string.
     * If the stop string is "end", then all lines after the start string are added
     */
    public ArrayList<String> getBlocks(String text, ArrayList<String> starts, ArrayList<String> stops) {
        if (starts.isEmpty() || stops.isEmpty()) return new ArrayList<>();

        ArrayList<String> blocks = new ArrayList<>();
        StringBuilder builder = new StringBuilder();

        String[] lines = text.split("\n");

        ArrayList<Pattern> startPatterns = new ArrayList<>();
        ArrayList<Pattern> stopPatterns = new ArrayList<>();
        starts.forEach( (x) -> { startPatterns.add(Pattern.compile(x)); });
        stops.forEach ( (x) -> { stopPatterns.add(Pattern.compile(x)); });

        boolean found = false;
        int block = 0;

        for (int i = 0; i < lines.length; i++) {
            if (block == startPatterns.size()) break;
            if (!found) {
                Matcher matcher = startPatterns.get(block).matcher(lines[i]);
                if (matcher.find()) {
                    found = true;
                    builder.append(lines[i].substring(matcher.end())).append("\n");
                }
            } else if (i == lines.length - 1) {
                blocks.add(builder.append(lines[i]).toString().trim());
            } else if (stopPatterns.get(block).toString().equals("end")) {
                builder.append(lines[i]).append("\n");
            } else {
                Matcher matcher = stopPatterns.get(block).matcher(lines[i]);
                if (matcher.find()) {
                    found = false;
                    if (builder.length() > 0) {
                        block++;
                        builder.append(lines[i].substring(0,matcher.start()));
                        blocks.add(builder.toString().trim());
                    }
                    builder.setLength(0);
                    i--; // check same line
                } else {
                    builder.append(lines[i]).append("\n");
                }
            }
        } // end iteration through text

        return blocks;
    }
    
    /**
     * @brief Divides a string into blocks of text based on a regex pattern
     * @param text The text to divide
     * @param divider A regex pattern which represents the divider
     * @return An ArrayList of the resulting blocks created by the divider
     * Similar to String.split(), but keeps the divider in the resulting blocks.
     */
    public ArrayList<String> divideText(String text, Pattern divider) {
        ArrayList<String> result = new ArrayList<>();
        int i = 0;
        Matcher m = divider.matcher(text);

        while (m.find()) {
            String s = text.substring(i, m.start()).trim();
            result.add(s);
            i = m.start();
        }
        result.add(text.substring(i));

        return result;
    }

    

} // end TextRefiner definition
