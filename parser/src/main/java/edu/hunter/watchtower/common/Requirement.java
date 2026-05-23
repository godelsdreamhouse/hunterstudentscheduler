/**
 * @file Requirement.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.common;

import java.util.ArrayList;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class Requirement {
    public String name; // example: Software Analysis and Design I
    public String tag; // example: major_Computer Science
    public ArrayList<Course> courses; // example: { {Software Analysis and Design 1} }
    public ArrayList<Course> exceptions; // example: { {CSCI 31000}, {CSCI 322@} }
    public float credits;

    @Override
    public String toString() {
        String c = (courses == null) ? "[]" : courses.toString();
        String e = (exceptions == null) ? "[]" : exceptions.toString();
        return name + ", " + tag + ", " + credits + ": " + c + ", " + e;
    }
}
