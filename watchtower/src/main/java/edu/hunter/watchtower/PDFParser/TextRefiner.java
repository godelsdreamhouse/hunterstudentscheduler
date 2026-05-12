package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import lombok.NoArgsConstructor;

@NoArgsConstructor
public class TextRefiner {
    
    /**
     * @brief Isolates a block of text from a larger file
     * @param text The text to search through
     * @param start The line where the block starts
     * @param stop An array of potential ends to that block; the block cuts out at the line above the stop string
     * @return A string containing the block of text; has line-breaks within block
     */
    public String getBlock(String text, String start, String stop, boolean multiple) {
        StringBuilder builder = new StringBuilder();

        String[] lines = text.split("\n");
        ArrayList<String> blocks = new ArrayList<>();
        boolean found = false;

        Pattern p1 = Pattern.compile(start);
        Pattern p2 = Pattern.compile(stop);

        for (String line : lines) {
            if (!found) {
                Matcher matcher = p1.matcher(line);
                if (matcher.find()) {
                    found = true;
                    if (!multiple) builder.append(line).append("\n");
                }
            } else {
                Matcher matcher = p2.matcher(line);
                if (matcher.find()) {
                    if (!multiple) break;
                    else {
                        found = false;
                        String result = builder.toString().trim();
                        if (!result.isEmpty()) blocks.add(builder.toString().trim());
                        builder.setLength(0);
                    }
                } else builder.append(line).append("\n");
            }
        } // end iteration through text

        if (!multiple) return builder.toString().trim();
        else return blocks.get(0);
    }

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

    public ArrayList<String> getBlocks(String text, String start, String stop) {
        ArrayList<String> result = new ArrayList<>();
        StringBuilder builder = new StringBuilder();
        boolean found = false;
        String[] lines = text.split("\n");

        for (int i = 0; i < lines.length; ++i) {
            Matcher m1 = Pattern.compile(start).matcher(lines[i]);
            if (m1.find()) System.out.println(m1);
            if (!found) {
                Matcher matcher = Pattern.compile(start).matcher(lines[i]);
                if (matcher.find()) {
                    found = true;
                    builder.append(lines[i].substring(matcher.end())).append("\n");
                }
            } else if (i == lines.length - 1) {
                result.add(builder.append(lines[i]).toString().trim());
            } else {
                Matcher matcher = Pattern.compile(stop).matcher(lines[i]);
                if (matcher.find()) {
                    found = false;
                    if (builder.length() > 0) {
                        builder.append(lines[i].substring(0,matcher.start()));
                        System.out.println(builder.toString());
                        result.add(builder.toString().trim());
                    }
                    builder.setLength(0);
                    i--; // check same line
                } else {
                    builder.append(lines[i]).append("\n");
                }
            }
        }

        return result;
    }
    
    public ArrayList<String> getBlocks(String text, Pattern divider) {
        ArrayList<String> result = new ArrayList<>();
        int i = 0;
        Matcher m = divider.matcher(text);

        while (m.find()) {
            System.out.println("match"+m.group()+"\n");
            String s = text.substring(i, m.start()).trim();
            result.add(s);
            i = m.start();
        }
        result.add(text.substring(i));

        return result;
    }
    
    public ArrayList<String> getLines(String text, ArrayList<String> line) {
        ArrayList<String> result = new ArrayList<>();
        String[] lines = text.split("\n");

        for (String l : lines) {
            if (contains(l,line)) result.add(l);
        }

        return result;
    }

    public ArrayList<String> getLinesLeft(String text, String marker) {
        ArrayList<String> result = new ArrayList<>();
        String[] lines = text.split("\n");
        Pattern mark = Pattern.compile(marker);

        for (String l : lines) {
            Matcher matcher = mark.matcher(l);
            if (matcher.find()) result.add(l.substring(0,matcher.start()).trim());
        }

        return result;
    }

    public ArrayList<String> getLinesRight(String text, String marker) {
        ArrayList<String> result = new ArrayList<>();
        String[] lines = text.split("\n");
        Pattern mark = Pattern.compile(marker);
        for (String l : lines) {
            Matcher matcher = mark.matcher(l);
            if (matcher.find()) result.add(l.substring(matcher.end()).trim());
        }
        return result;
    }

    public String findInLine(String line, String start, String end) {
        if (start.isEmpty()) {
           return getLinesLeft(line,end).get(0);
        } else if (end.isEmpty()) {
            return getLinesRight(line, start).get(0);
        }

        String[] split = line.split(start,2);
        if (split.length == 1) return new String();

        Matcher matcher = Pattern.compile(end).matcher(split[1]);
        if (matcher.find()) return split[1].substring(0,matcher.start()).trim();

        return new String();
    }

    public ArrayList<String> splitSection(String text, ArrayList<String> sections, ArrayList<String> splitWith, String refiner) {
        if (splitWith.size() == 1) {
            sections.add(text);
            return sections;
        }

        Pattern split = Pattern.compile(refiner+splitWith.get(1));
        Matcher matcher = split.matcher(text);

        if (matcher.find()) {
            sections.add(text.substring(0,matcher.start()));
        } else {
            return sections;
        }

        return splitSection(text.substring(matcher.start()),sections, new ArrayList<>(splitWith.subList(1, splitWith.size())), refiner);
    }

    private boolean contains(String text, ArrayList<String> strings) {
        for (String str : strings) {
            Matcher matcher = Pattern.compile(str).matcher(text);
            if (matcher.find()) return true;
        }
        return false;
    }

    

} // end TextRefiner definition
