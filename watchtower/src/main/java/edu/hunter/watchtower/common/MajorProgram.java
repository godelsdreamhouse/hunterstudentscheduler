/**
 * @author Allison Gorman
 * Static storage of exceptions for major electives. Each major program that Watchtower supports has an entry.
 * The format is as follows:
 *      key : String, majorName_concentrationName
 *      value : String[], [ Broad definition, String of course exceptions separated by commas ]
 * Example: ComputerScience_ComputerScience: [CSCI >13600, "CSCI 496, CSCI 497, ..."]
 */
package edu.hunter.watchtower.common;

import java.util.HashMap;
import java.util.Map;

import lombok.NoArgsConstructor;

@NoArgsConstructor
public class MajorProgram {

    private final Map<String, String[]> majorElectiveExceptions = new HashMap<>() {{
        put("ComputerScience_ComputerScience", new String[] {"CSCI >13600", "CSCI 49600, 49700, 49800, 49900, 12000, 12100, 13200, 13300, 18100, 18200, 18300, 22700, 23200, 23300"});
        put("Mathematics_Mathematics", new String[] {"MATH 3@ or MATH 4@ or STAT 3@ or STAT 4@", ""});
        put("PoliticalScience_None", new String[] {"POLSC 4@ or POLSC 3@ or POLSC 2@ or POLSC 1@", ""});
    }};

    // "CSCI 49600, CSCI 49700, CSCI 49800, CSCI 49900, CSCI 12000, CSCI 12100, CSCI 13200, CSCI 13300, CSCI 18100, CSCI 18200, CSCI 18300, CSCI 22700, CSCI 23200, CSCI 23300"

    public String[] get(String major, String concentration) {
        return majorElectiveExceptions.get(major.replace(" ", "") + "_" + concentration.replace(" ", ""));
    }

}
