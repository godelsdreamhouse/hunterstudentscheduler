/**
 * @file Course.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.common;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class Course {
    public String courseID; // e.g. 26000, 49900
    public String departmentCode; // e.g. CSCI, MATH, etc.
    public String name; // Course name
    public String grade; // Letter grade
    public float credit; // Credit

    @Override
    public String toString() {
        return departmentCode + " " + courseID + " " + name + " " + grade + " " + credit;
    }
}
