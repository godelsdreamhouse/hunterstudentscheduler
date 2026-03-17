package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import lombok.Data;

@Data
public class TextRefiner {
    
    /**
     * @brief Isolates a block of text from a larger file
     * @param text The text to search through
     * @param start The line before when the block starts
     * @param stop An array of potential ends to that block; the block cuts out at the line above the stop string
     * @return A string containing the block of text; has line-breaks within block
     */
    public String getBlock(String text, String start, ArrayList<String> stop) {
        StringBuilder builder = new StringBuilder();

        String[] lines = text.split("\n");
        boolean found = false;

        for (String line : lines) {
            if (!found) {
                Matcher matcher = Pattern.compile(start).matcher(line);
                if (matcher.find()) {
                    found = true;
                }
            } else {
                if (contains(line,stop)) break;
                else builder.append(line).append("\n");
            }
        } // end iteration through text

        return builder.toString().trim();
    }

    public ArrayList<String> getLines(String text, ArrayList<String> line) {
        ArrayList<String> result = new ArrayList<>();
        String[] lines = text.split("\n");

        for (String l : lines) {
            if (contains(l,line)) result.addLast(l);
        }

        return result;
    }

    public ArrayList<String> getLinesLeft(String text, ArrayList<String> markers) {
        ArrayList<String> result = new ArrayList<>();
        String[] lines = text.split("\n");

        for (String l : lines) {
            for (String str : markers) {
                Matcher matcher = Pattern.compile(str).matcher(text);
                if (matcher.find()) result.addLast(l.substring(0,matcher.start()).trim());
            }
        }

        return result;
    }

    public ArrayList<String> getLinesRight(String text, ArrayList<String> markers) {
        ArrayList<String> result = new ArrayList<>();
        String[] lines = text.split("\n");

        for (String l : lines) {
            for (String str : markers) {
                Matcher matcher = Pattern.compile(str).matcher(text);
                if (matcher.find()) result.addLast(l.substring(matcher.end()).trim());
            }
        }

        return result;
    }

    public String findInLine(String line, String start, ArrayList<String> end) {
        if (start.isEmpty()) {
           return getLinesLeft(line,end).get(0);
        } else if (end.isEmpty()) {
            return getLinesRight(line, new ArrayList<String>(Collections.singletonList(start))).get(0);
        }

        String[] split = line.split(start,2);
        if (split.length == 1) return new String();

        for (String str : end) {
            Matcher matcher = Pattern.compile(str).matcher(split[1]);
            if (matcher.find()) return split[1].substring(0,matcher.end());
        }

        return new String();
    }

    private boolean contains(String text, ArrayList<String> strings) {
        for (String str : strings) {
            Matcher matcher = Pattern.compile(str).matcher(text);
            if (matcher.find()) return true;
        }
        return false;
    }

} // end TextRefiner definition
